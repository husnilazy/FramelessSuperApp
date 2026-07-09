import { Router, type IRouter } from "express";
import { db, filmmakingDocumentsTable, filmmakingCollaboratorsTable, teamMembersTable, projectsTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireUniversalAuth } from "./middleware.js";
import { generatePdfFromHtml } from "../lib/pdf.js";

type AuthedRequest = any;

const router: IRouter = Router();

const PRODUCTION_HOUSE_NAME = "Frameless Creative";

// =============================================
// Helper: cek akses baca dokumen (owner ATAU collaborator ATAU admin)
// =============================================
async function verifyReadAccess(documentId: string, user: { id: string; role: string }) {
  const [document] = await db
    .select()
    .from(filmmakingDocumentsTable)
    .where(and(eq(filmmakingDocumentsTable.id, documentId), isNull(filmmakingDocumentsTable.deletedAt)));

  if (!document) return null;
  if (document.crewId === user.id) return document;
  if (user.role === "admin") return document;

  const [collaborator] = await db
    .select()
    .from(filmmakingCollaboratorsTable)
    .where(
      and(
        eq(filmmakingCollaboratorsTable.documentId, documentId),
        eq(filmmakingCollaboratorsTable.crewMemberId, user.id)
      )
    );

  return collaborator ? document : null;
}

// =============================================
// Helper: kumpulkan metadata produksi (PH, project/client, schedule, crew)
// untuk ditampilkan di kop dokumen PDF
// =============================================
interface ProductionMeta {
  productionHouse: string;
  projectTitle: string | null;
  client: string | null;
  schedule: string | null;
  preparedBy: string | null;
  crew: { name: string; role: string }[];
}

async function gatherProductionMeta(document: any): Promise<ProductionMeta> {
  let projectTitle: string | null = null;
  let client: string | null = null;
  let schedule: string | null = null;

  if (document.projectId) {
    try {
      const [project] = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, document.projectId))
        .limit(1);
      if (project) {
        projectTitle = project.title ?? null;
        client = project.client ?? null;
        schedule = project.deadline
          ? new Date(project.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
          : null;
      }
    } catch (err) {
      logger.warn({ err, projectId: document.projectId }, "export-pdf.project_lookup_failed");
    }
  }

  let preparedBy: string | null = null;
  try {
    const [owner] = await db
      .select({ name: teamMembersTable.name, role: teamMembersTable.role })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, document.crewId))
      .limit(1);
    if (owner) preparedBy = owner.role ? `${owner.name} (${owner.role})` : owner.name;
  } catch (err) {
    logger.warn({ err }, "export-pdf.owner_lookup_failed");
  }

  let crew: { name: string; role: string }[] = [];
  try {
    const collaborators = await db
      .select({
        role: filmmakingCollaboratorsTable.role,
        memberName: teamMembersTable.name,
        memberRole: teamMembersTable.role,
      })
      .from(filmmakingCollaboratorsTable)
      .leftJoin(teamMembersTable, eq(filmmakingCollaboratorsTable.crewMemberId, teamMembersTable.id))
      .where(eq(filmmakingCollaboratorsTable.documentId, document.id));

    crew = collaborators
      .filter((c) => !!c.memberName)
      .map((c) => ({ name: c.memberName as string, role: c.memberRole || c.role }));
  } catch (err) {
    logger.warn({ err }, "export-pdf.crew_lookup_failed");
  }

  return {
    productionHouse: PRODUCTION_HOUSE_NAME,
    projectTitle,
    client,
    schedule,
    preparedBy,
    crew,
  };
}

function slugify(text: string): string {
  return (
    (text || "document")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "document"
  );
}

// =============================================
// GET /filmmaking-documents/:id/export-pdf
// Generate & download PDF ASLI dari dokumen produksi, lengkap dengan info
// Production House, Project/Client, Schedule, dan daftar Crew.
//
// Query params opsional:
//   ?orientation=landscape|portrait  (default: landscape untuk shotlist, portrait untuk lainnya)
// =============================================
router.get(
  "/filmmaking-documents/:id/export-pdf",
  requireUniversalAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { id: documentId } = req.params as { id: string };
      const { orientation } = req.query as { orientation?: string };

      const document = await verifyReadAccess(documentId, req.user);
      if (!document) {
        res.status(404).json({ error: "Document not found or no access" });
        return;
      }

      const { docType, title, content } = document;
      const meta = await gatherProductionMeta(document);

      const landscape = orientation
        ? orientation === "landscape"
        : docType === "shotlist";

      const html = generateHtmlForDocType(docType, title, content, meta, landscape);
      const pdfBuffer = await generatePdfFromHtml(html, { landscape });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${slugify(title)}.pdf"`);
      res.setHeader("Content-Length", String(pdfBuffer.length));
      res.send(pdfBuffer);
    } catch (err) {
      logger.error({ err }, "filmmaking-documents.export-pdf.error");
      res.status(500).json({
        error: "Failed to generate PDF. Pastikan dependency puppeteer/@sparticuz/chromium sudah terinstall di server.",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
);

// =============================================
// GET /filmmaking-documents/:id/export-html
// Versi HTML mentah (untuk preview di browser sebelum download, opsional dipakai FE)
// =============================================
router.get(
  "/filmmaking-documents/:id/export-html",
  requireUniversalAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { id: documentId } = req.params as { id: string };
      const { orientation } = req.query as { orientation?: string };
      const document = await verifyReadAccess(documentId, req.user);
      if (!document) {
        res.status(404).json({ error: "Document not found or no access" });
        return;
      }

      const { docType, title, content } = document;
      const meta = await gatherProductionMeta(document);
      const landscape = orientation ? orientation === "landscape" : docType === "shotlist";

      res.setHeader("Content-Type", "text/html");
      res.send(generateHtmlForDocType(docType, title, content, meta, landscape));
    } catch (err) {
      logger.error({ err }, "filmmaking-documents.export-html.error");
      res.status(500).json({ error: "Failed to generate preview" });
    }
  }
);

// =============================================
// Template generator
// =============================================
function generateHtmlForDocType(
  docType: string,
  title: string,
  content: any,
  meta: ProductionMeta,
  landscape: boolean
): string {
  const styles = `
    <style>
      @page {
        size: A4 ${landscape ? "landscape" : "portrait"};
        margin: 0;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        max-width: ${landscape ? "1100px" : "900px"};
        margin: 0 auto;
        padding: 40px;
        color: #333;
        line-height: 1.6;
      }
      .doc-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        border-bottom: 3px solid #F03820;
        padding-bottom: 14px;
        margin-bottom: 4px;
      }
      .doc-header h1 {
        font-size: 26px;
        font-weight: bold;
        margin: 0;
      }
      .doc-type-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #F03820;
        background: #fff1ee;
        padding: 4px 10px;
        border-radius: 999px;
        margin-bottom: 8px;
      }
      .ph-name {
        text-align: right;
        font-weight: 700;
        font-size: 15px;
        color: #F03820;
      }
      .ph-tagline {
        text-align: right;
        font-size: 10px;
        color: #999;
        margin-top: 2px;
      }
      .meta-bar {
        color: #888;
        font-size: 11px;
        margin-bottom: 20px;
      }
      .info-panel {
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 24px;
        overflow: hidden;
      }
      .info-item {
        flex: 1;
        min-width: 140px;
        padding: 12px 16px;
        border-right: 1px solid #e5e7eb;
      }
      .info-item:last-child { border-right: none; }
      .info-label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #9ca3af;
        margin-bottom: 4px;
      }
      .info-value {
        font-size: 13px;
        font-weight: 600;
        color: #1f2937;
      }
      .crew-panel {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 24px;
      }
      .crew-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      .crew-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        color: #374151;
      }
      .crew-chip .role {
        color: #9ca3af;
        text-transform: capitalize;
      }
      .section {
        margin-bottom: 30px;
      }
      .section-title {
        font-size: 18px;
        font-weight: bold;
        color: #1f2937;
        margin-top: 20px;
        margin-bottom: 10px;
        border-left: 4px solid #F03820;
        padding-left: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 12.5px;
      }
      th {
        background-color: #f3f4f6;
        border: 1px solid #e5e7eb;
        padding: 8px 10px;
        text-align: left;
        font-weight: 600;
      }
      td {
        border: 1px solid #e5e7eb;
        padding: 8px 10px;
        vertical-align: top;
      }
      tr:nth-child(even) {
        background-color: #f9fafb;
      }
      .notes {
        background-color: #fff5f3;
        border-left: 4px solid #F03820;
        padding: 15px;
        margin: 15px 0;
        border-radius: 4px;
        white-space: pre-wrap;
      }
      .idea-list {
        list-style: none;
        padding: 0;
        margin: 10px 0 0 0;
      }
      .idea-list li {
        padding: 8px 12px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        margin-bottom: 6px;
      }
      .scene-card {
        background-color: #f9fafb;
        border: 1px solid #e5e7eb;
        padding: 15px;
        margin: 10px 0;
        border-radius: 6px;
        page-break-inside: avoid;
      }
      .scene-label {
        font-weight: 600;
        color: #374151;
        margin-bottom: 8px;
      }
      .screenplay-body {
        font-family: 'Courier New', Courier, monospace;
        font-size: 13px;
        white-space: pre-wrap;
        line-height: 1.8;
      }
      .doc-footer {
        margin-top: 40px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
        color: #999;
        font-size: 10.5px;
        display: flex;
        justify-content: space-between;
      }
      @media print {
        .section { page-break-inside: avoid; }
      }
    </style>
  `;

  let body = "";

  if (docType === "concept") {
    body = generateConceptHtml(content);
  } else if (docType === "screenplay") {
    body = generateScreenplayHtml(content);
  } else if (docType === "script") {
    body = generateScriptHtml(content);
  } else if (docType === "shotlist") {
    body = generateShotlistHtml(content);
  } else {
    body = `<p>Unknown document type: ${escapeHtml(docType)}</p>`;
  }

  const generatedDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const infoItems = [
    { label: "Production House", value: meta.productionHouse },
    { label: "Project / Client", value: [meta.projectTitle, meta.client].filter(Boolean).join(" — ") || "-" },
    { label: "Schedule", value: meta.schedule || "-" },
    { label: "Prepared by", value: meta.preparedBy || "-" },
  ];

  const crewHtml =
    meta.crew.length > 0
      ? `
        <div class="crew-panel">
          <div class="info-label">Crew</div>
          <div class="crew-chips">
            ${meta.crew.map((c) => `<span class="crew-chip">${escapeHtml(c.name)} <span class="role">· ${escapeHtml(c.role)}</span></span>`).join("")}
          </div>
        </div>
      `
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        ${styles}
      </head>
      <body>
        <div class="doc-header">
          <div>
            <div class="doc-type-badge">${escapeHtml(docType)}</div>
            <h1>${escapeHtml(title)}</h1>
          </div>
          <div>
            <div class="ph-name">${escapeHtml(meta.productionHouse)}</div>
            <div class="ph-tagline">Production Document</div>
          </div>
        </div>
        <div class="meta-bar">Generated on ${generatedDate}</div>

        <div class="info-panel">
          ${infoItems.map((item) => `
            <div class="info-item">
              <div class="info-label">${escapeHtml(item.label)}</div>
              <div class="info-value">${escapeHtml(item.value)}</div>
            </div>
          `).join("")}
        </div>

        ${crewHtml}

        ${body}

        <div class="doc-footer">
          <span>${escapeHtml(meta.productionHouse)} — Filmmaking Tools</span>
          <span>${escapeHtml(title)} · ${generatedDate}</span>
        </div>
      </body>
    </html>
  `;
}

function generateConceptHtml(content: any): string {
  const notes = content?.notes || "";
  const ideas: string[] = content?.ideas || [];

  let html = `
    <div class="section">
      <div class="section-title">Concept Notes</div>
      <div class="notes">${escapeHtml(notes) || "<em>No notes yet.</em>"}</div>
    </div>
  `;

  if (ideas.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">Quick Ideas</div>
        <ul class="idea-list">
          ${ideas.map((idea) => `<li>${escapeHtml(idea)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  return html;
}

function generateScreenplayHtml(content: any): string {
  const text = content?.text || "";
  return `
    <div class="section">
      <div class="screenplay-body">${escapeHtml(text) || "<em>Empty screenplay.</em>"}</div>
    </div>
  `;
}

function generateScriptHtml(content: any): string {
  const scenes = content?.scenes || [];

  if (scenes.length === 0) {
    return "<p>No scenes defined</p>";
  }

  let html = "";

  scenes.forEach((scene: any, index: number) => {
    const cast = Array.isArray(scene.cast) ? scene.cast.join(", ") : scene.cast || "";
    html += `
      <div class="scene-card">
        <div class="scene-label">Scene ${escapeHtml(scene.sceneNumber || String(index + 1))}</div>
        <table style="margin: 0;">
          <tr>
            <td style="font-weight: 600; width: 20%;">Location</td>
            <td>${escapeHtml(scene.location || "")}</td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Time of Day</td>
            <td>${escapeHtml(scene.timeOfDay || "")}</td>
          </tr>
          <tr>
            <td style="font-weight: 600;">Duration</td>
            <td>${escapeHtml(scene.duration || "")}</td>
          </tr>
          <tr>
            <td colspan="2" style="font-weight: 600; padding-top: 12px;">Description</td>
          </tr>
          <tr>
            <td colspan="2">${escapeHtml(scene.description || "")}</td>
          </tr>
          ${cast ? `<tr>
            <td style="font-weight: 600;">Cast</td>
            <td>${escapeHtml(cast)}</td>
          </tr>` : ""}
          ${scene.dialogue ? `<tr>
            <td colspan="2" style="font-weight: 600;">Dialogue</td>
          </tr>
          <tr>
            <td colspan="2">${escapeHtml(scene.dialogue)}</td>
          </tr>` : ""}
        </table>
      </div>
    `;
  });

  return `<div class="section">${html}</div>`;
}

function generateShotlistHtml(content: any): string {
  const shots = content?.shots || [];

  if (shots.length === 0) {
    return "<p>No shots defined</p>";
  }

  let html = `
    <div class="section">
      <table>
        <thead>
          <tr>
            <th>Scene</th>
            <th>Shot</th>
            <th>Description</th>
            <th>Camera Angle</th>
            <th>Duration</th>
            <th>Props</th>
            <th>Talents</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
  `;

  shots.forEach((shot: any, idx: number) => {
    html += `
      <tr>
        <td>${escapeHtml(shot.sceneNumber || "")}</td>
        <td>${escapeHtml(String(shot.shotNumber ?? idx + 1))}</td>
        <td>${escapeHtml(shot.description || "")}</td>
        <td>${escapeHtml(shot.cameraAngle || "")}</td>
        <td>${escapeHtml(shot.duration || "")}</td>
        <td>${escapeHtml(shot.props || "")}</td>
        <td>${escapeHtml(shot.talents || "")}</td>
        <td>${escapeHtml(shot.notes || "")}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  return html;
}

function escapeHtml(text: string): string {
  if (!text) return "";
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

export default router;