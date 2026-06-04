import { Router, type IRouter } from "express";
import { db, filmmakingDocumentsTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireUniversalAuth } from "./middleware.js";

const router: IRouter = Router();

// =============================================
// POST /filmmaking-documents/:id/export-pdf
// Generate and download document as PDF
// =============================================
router.post(
  "/filmmaking-documents/:id/export-pdf",
  requireUniversalAuth,
  async (req: any, res): Promise<void> => {
    try {
      const { id: documentId } = req.params as { id: string };
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");

      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Fetch document
      const doc = await db
        .select()
        .from(filmmakingDocumentsTable)
        .where(
          and(
            eq(filmmakingDocumentsTable.id, documentId),
            isNull(filmmakingDocumentsTable.deletedAt)
          )
        )
        .limit(1);

      if (doc.length === 0) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      const document = doc[0];
      const { docType, title, content } = document;

      // Generate HTML content based on doc type
      let htmlContent = generateHtmlForDocType(docType, title, content);

      // For now, return HTML content with instructions to print to PDF
      // In production, use html-pdf or pdfkit library
      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (err) {
      logger.error({ err }, "filmmaking-documents.export-pdf.error");
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
);

// Helper function to generate HTML based on document type
function generateHtmlForDocType(
  docType: string,
  title: string,
  content: any
): string {
  const styles = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        max-width: 900px;
        margin: 0 auto;
        padding: 40px;
        color: #333;
        line-height: 1.6;
      }
      h1 {
        font-size: 28px;
        font-weight: bold;
        margin-bottom: 10px;
        border-bottom: 3px solid #3b82f6;
        padding-bottom: 10px;
      }
      .meta {
        color: #666;
        font-size: 12px;
        margin-bottom: 30px;
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
        border-left: 4px solid #3b82f6;
        padding-left: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 13px;
      }
      th {
        background-color: #f3f4f6;
        border: 1px solid #e5e7eb;
        padding: 10px;
        text-align: left;
        font-weight: 600;
      }
      td {
        border: 1px solid #e5e7eb;
        padding: 10px;
      }
      tr:nth-child(even) {
        background-color: #f9fafb;
      }
      .notes {
        background-color: #f0f9ff;
        border-left: 4px solid #3b82f6;
        padding: 15px;
        margin: 15px 0;
        border-radius: 4px;
      }
      .scene-card {
        background-color: #f9fafb;
        border: 1px solid #e5e7eb;
        padding: 15px;
        margin: 10px 0;
        border-radius: 6px;
      }
      .scene-label {
        font-weight: 600;
        color: #374151;
        margin-bottom: 8px;
      }
      @media print {
        body { padding: 20px; }
        .section { page-break-inside: avoid; }
      }
    </style>
  `;

  let body = "";

  if (docType === "concept") {
    body = generateConceptHtml(title, content);
  } else if (docType === "script") {
    body = generateScriptHtml(title, content);
  } else if (docType === "shotlist") {
    body = generateShotlistHtml(title, content);
  }

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
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Generated on ${new Date().toLocaleDateString()} | Frameless Creative</div>
        ${body}
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px;">
          <p>This document was generated from Frameless Creative's Filmmaking Tools.</p>
        </div>
      </body>
    </html>
  `;
}

function generateConceptHtml(title: string, content: any): string {
  const notes = content?.notes || "";
  return `
    <div class="section">
      <div class="notes">
        <strong>Concept Notes:</strong><br><br>
        ${notes.split("\n").map((line: string) => escapeHtml(line) + "<br>").join("")}
      </div>
    </div>
  `;
}

function generateScriptHtml(title: string, content: any): string {
  const scenes = content?.scenes || [];
  let html = "";

  scenes.forEach((scene: any, index: number) => {
    html += `
      <div class="scene-card">
        <div class="scene-label">Scene ${scene.sceneNumber || index + 1}</div>
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
          ${scene.cast ? `<tr>
            <td style="font-weight: 600;">Cast</td>
            <td>${escapeHtml(scene.cast)}</td>
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

function generateShotlistHtml(title: string, content: any): string {
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
        <td>${escapeHtml(shot.shotNumber || idx + 1)}</td>
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
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export default router;
