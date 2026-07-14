import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  quotationsTable,
  quotationItemsTable,
  quotationRabItemsTable,
  clientsTable,
  projectsTable,
  invoicesTable,
  invoiceItemsTable,
  expensesTable,
  companyProfileTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { generatePdfFromHtml } from "../lib/pdf.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function toStr(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v).trim();
}
function toNumStr(v: unknown, fallback = "0"): string {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : fallback;
}
function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function parseComponents(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(String(raw));
    return Array.isArray(arr) ? arr.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

const PAPER_DIMENSIONS: Record<string, { width: string; height: string }> = {
  A4: { width: "210mm", height: "297mm" },
  Letter: { width: "216mm", height: "279mm" },
  Legal: { width: "216mm", height: "356mm" },
  F4: { width: "215mm", height: "330mm" },
};

const PHASE_ORDER = ["pra", "produksi", "pasca", "lain"] as const;
const PHASE_LABELS: Record<string, string> = {
  pra: "Pra Produksi", produksi: "Produksi", pasca: "Pasca Produksi", lain: "Lainnya",
};

async function getCompanyProfile() {
  try {
    const [row] = await db.select().from(companyProfileTable).where(eq(companyProfileTable.id, "default")).limit(1);
    if (row) return row;
  } catch (err) {
    logger.warn({ err }, "quotations.company_profile_lookup_failed");
  }
  return {
    companyName: "Frameless Creative",
    tagline: "Creative Production House",
    address: "Jl. Lurah Sudarto Jlamprang Wonosobo 56319",
    email: "info@frameless.com",
    phone: null,
    website: "www.framelesscreative.com",
    logoUrl: null,
  };
}

function persistItemFields(item: any) {
  const label = toStr(item?.label) || toStr(item?.description);
  const componentsArr = Array.isArray(item?.components)
    ? item.components.filter(Boolean).map(String)
    : toStr(item?.components).split(",").map((s: string) => s.trim()).filter(Boolean);
  return {
    phase: toStr(item?.phase, "lain") || "lain",
    label,
    components: JSON.stringify(componentsArr),
    description: toStr(item?.description) || label,
  };
}

// ================= CRUD =================

router.get("/quotations", async (req, res): Promise<void> => {
  try {
    const { status, clientId } = req.query as { status?: string; clientId?: string };
    const rows = await db
      .select({ quotation: quotationsTable, clientName: clientsTable.name })
      .from(quotationsTable)
      .leftJoin(clientsTable, eq(quotationsTable.clientId, clientsTable.id))
      .orderBy(quotationsTable.createdAt);

    let result = rows.map((r: any) => ({ ...mapQuotation(r.quotation), clientName: r.clientName }));
    if (status) result = result.filter((q: any) => q.status === status);
    if (clientId) result = result.filter((q: any) => q.clientId === clientId);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "quotations.get.error");
    res.status(500).json({ error: "Failed to fetch quotations" });
  }
});

router.post("/quotations", async (req, res): Promise<void> => {
  try {
    const {
      clientId, projectType, title, status, validUntil,
      subtotal, tax, discount, total, estimatedCost, dpPercentage,
      notes, terms, billTo, logoUrl, paperSize,
      marginTop, marginBottom, marginLeft, marginRight,
      items, rabItems,
    } = req.body ?? {};

    const client = toStr(clientId);
    if (!client) { res.status(400).json({ error: "Client ID is required" }); return; }
    if (!toStr(title)) { res.status(400).json({ error: "Judul penawaran wajib diisi" }); return; }

    const count = await db.select().from(quotationsTable);
    const number = `PEN-${String(count.length + 1).padStart(4, "0")}`;
    const quotationId = crypto.randomUUID();

    const [quotation] = await db.insert(quotationsTable).values({
      id: quotationId,
      number,
      clientId: client,
      projectType: toStr(projectType) || null,
      title: toStr(title),
      status: toStr(status) || "DRAFT",
      validUntil: toDateOrNull(validUntil),
      subtotal: toNumStr(subtotal),
      tax: toNumStr(tax),
      discount: toNumStr(discount),
      total: toNumStr(total),
      estimatedCost: toNumStr(estimatedCost),
      dpPercentage: toNumStr(dpPercentage, "50"),
      notes: toStr(notes) || null,
      terms: toStr(terms) || null,
      billTo: toStr(billTo) || null,
      logoUrl: toStr(logoUrl) || null,
      paperSize: toStr(paperSize) || "A4",
      marginTop: toStr(marginTop) || "16mm",
      marginBottom: toStr(marginBottom) || "16mm",
      marginLeft: toStr(marginLeft) || "14mm",
      marginRight: toStr(marginRight) || "14mm",
    }).returning();

    if (Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const f = persistItemFields(item);
        await db.insert(quotationItemsTable).values({
          id: crypto.randomUUID(),
          quotationId,
          phase: f.phase,
          label: f.label,
          components: f.components,
          description: f.description,
          quantity: toNumStr(item?.quantity, "1"),
          unitPrice: toNumStr(item?.unitPrice),
          total: toNumStr(item?.total),
          sortOrder: String(i),
        });
      }
    }

    if (Array.isArray(rabItems)) {
      for (let i = 0; i < rabItems.length; i++) {
        const r = rabItems[i];
        await db.insert(quotationRabItemsTable).values({
          id: crypto.randomUUID(),
          quotationId,
          category: toStr(r?.category, "Lainnya"),
          itemName: toStr(r?.itemName),
          quantity: toNumStr(r?.quantity, "1"),
          unit: toStr(r?.unit) || null,
          unitCost: toNumStr(r?.unitCost),
          total: toNumStr(r?.total),
          notes: toStr(r?.notes) || null,
          sortOrder: String(i),
        });
      }
    }

    await logActivity("quotation.created", `Penawaran ${number} dibuat`);
    res.status(201).json(mapQuotation(quotation));
  } catch (err) {
    logger.error({ err }, "quotations.post.error");
    res.status(500).json({ error: "Failed to create quotation" });
  }
});

router.get("/quotations/:id", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = toStr(req.params.id);
    const [row] = await db
      .select({ quotation: quotationsTable, clientName: clientsTable.name })
      .from(quotationsTable)
      .leftJoin(clientsTable, eq(quotationsTable.clientId, clientsTable.id))
      .where(eq(quotationsTable.id, id))
      .limit(1);

    if (!row) { res.status(404).json({ error: "Quotation not found" }); return; }

    const items = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
    const rabItems = await db.select().from(quotationRabItemsTable).where(eq(quotationRabItemsTable.quotationId, id));

    res.json({
      ...mapQuotation(row.quotation),
      clientName: row.clientName,
      items: items.map(mapItem),
      rabItems: rabItems.map(mapRabItem),
    });
  } catch (err) {
    logger.error({ err }, "quotations.detail.error");
    res.status(500).json({ error: "Failed to fetch quotation" });
  }
});

router.put("/quotations/:id", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = toStr(req.params.id);
    const {
      status, title, validUntil, subtotal, tax, discount, total,
      estimatedCost, dpPercentage, notes, terms, billTo, logoUrl,
      paperSize, marginTop, marginBottom, marginLeft, marginRight,
      items, rabItems, projectType,
    } = req.body ?? {};

    const [quotation] = await db.update(quotationsTable).set({
      ...(status !== undefined && { status: toStr(status) }),
      ...(title !== undefined && { title: toStr(title) }),
      ...(projectType !== undefined && { projectType: toStr(projectType) || null }),
      ...(validUntil !== undefined && { validUntil: toDateOrNull(validUntil) }),
      ...(subtotal !== undefined && { subtotal: toNumStr(subtotal) }),
      ...(tax !== undefined && { tax: toNumStr(tax) }),
      ...(discount !== undefined && { discount: toNumStr(discount) }),
      ...(total !== undefined && { total: toNumStr(total) }),
      ...(estimatedCost !== undefined && { estimatedCost: toNumStr(estimatedCost) }),
      ...(dpPercentage !== undefined && { dpPercentage: toNumStr(dpPercentage, "50") }),
      ...(notes !== undefined && { notes: toStr(notes) }),
      ...(terms !== undefined && { terms: toStr(terms) }),
      ...(billTo !== undefined && { billTo: toStr(billTo) }),
      ...(logoUrl !== undefined && { logoUrl: toStr(logoUrl) || null }),
      ...(paperSize !== undefined && { paperSize: toStr(paperSize) || "A4" }),
      ...(marginTop !== undefined && { marginTop: toStr(marginTop) }),
      ...(marginBottom !== undefined && { marginBottom: toStr(marginBottom) }),
      ...(marginLeft !== undefined && { marginLeft: toStr(marginLeft) }),
      ...(marginRight !== undefined && { marginRight: toStr(marginRight) }),
      updatedAt: new Date(),
    }).where(eq(quotationsTable.id, id)).returning();

    if (!quotation) { res.status(404).json({ error: "Quotation not found" }); return; }

    if (Array.isArray(items)) {
      await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const f = persistItemFields(item);
        await db.insert(quotationItemsTable).values({
          id: crypto.randomUUID(),
          quotationId: id,
          phase: f.phase,
          label: f.label,
          components: f.components,
          description: f.description,
          quantity: toNumStr(item?.quantity, "1"),
          unitPrice: toNumStr(item?.unitPrice),
          total: toNumStr(item?.total),
          sortOrder: String(i),
        });
      }
    }

    if (Array.isArray(rabItems)) {
      await db.delete(quotationRabItemsTable).where(eq(quotationRabItemsTable.quotationId, id));
      for (let i = 0; i < rabItems.length; i++) {
        const r = rabItems[i];
        await db.insert(quotationRabItemsTable).values({
          id: crypto.randomUUID(),
          quotationId: id,
          category: toStr(r?.category, "Lainnya"),
          itemName: toStr(r?.itemName),
          quantity: toNumStr(r?.quantity, "1"),
          unit: toStr(r?.unit) || null,
          unitCost: toNumStr(r?.unitCost),
          total: toNumStr(r?.total),
          notes: toStr(r?.notes) || null,
          sortOrder: String(i),
        });
      }
    }

    const updatedItems = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
    const updatedRab = await db.select().from(quotationRabItemsTable).where(eq(quotationRabItemsTable.quotationId, id));

    res.json({ ...mapQuotation(quotation), items: updatedItems.map(mapItem), rabItems: updatedRab.map(mapRabItem) });
  } catch (err) {
    logger.error({ err }, "quotations.put.error");
    res.status(500).json({ error: "Failed to update quotation" });
  }
});

router.delete("/quotations/:id", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = toStr(req.params.id);
    await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
    await db.delete(quotationRabItemsTable).where(eq(quotationRabItemsTable.quotationId, id));
    await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
    res.json({ success: true, message: "Quotation deleted" });
  } catch (err) {
    logger.error({ err }, "quotations.delete.error");
    res.status(500).json({ error: "Failed to delete quotation" });
  }
});

// ================= RAB Auto-Suggest =================
router.get("/quotations/rab-suggest", async (req, res): Promise<void> => {
  try {
    const { projectType } = req.query as { projectType?: string };
    const expenses = await db.select().from(expensesTable);
    const projects = await db.select().from(projectsTable);
    const projectTypeById = new Map(projects.map((p: any) => [p.id, p.projectType]));

    const relevant = projectType
      ? expenses.filter((e: any) => e.projectId && projectTypeById.get(e.projectId) === projectType)
      : expenses;
    const pool = relevant.length > 0 ? relevant : expenses;

    const byCategory: Record<string, number[]> = {};
    for (const e of pool as any[]) {
      const cat = e.category || "Lainnya";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(Number(e.amount));
    }

    const suggestions = Object.entries(byCategory).map(([category, amounts]) => ({
      category,
      averageCost: Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length),
      sampleSize: amounts.length,
      minCost: Math.round(Math.min(...amounts)),
      maxCost: Math.round(Math.max(...amounts)),
    })).sort((a, b) => b.averageCost - a.averageCost);

    res.json({
      basedOnProjectType: relevant.length > 0 ? projectType || null : null,
      fallbackUsed: relevant.length === 0 && !!projectType,
      suggestions,
    });
  } catch (err) {
    logger.error({ err }, "quotations.rab-suggest.error");
    res.status(500).json({ error: "Failed to compute RAB suggestions" });
  }
});

// ================= PDF Export =================

router.post("/quotations/preview-pdf", async (req, res): Promise<void> => {
  try {
    const body = req.body ?? {};
    const company = await getCompanyProfile();
    const html = buildQuotationHtml(body, company);
    const dims = PAPER_DIMENSIONS[toStr(body.paperSize) || "A4"] || PAPER_DIMENSIONS.A4;
    const pdfBuffer = await generatePdfFromHtml(html, {
      width: dims.width,
      height: dims.height,
      margin: {
        top: toStr(body.marginTop) || "16mm",
        bottom: toStr(body.marginBottom) || "16mm",
        left: toStr(body.marginLeft) || "14mm",
        right: toStr(body.marginRight) || "14mm",
      },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slugify(body.number || body.title || "penawaran")}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, "quotations.preview-pdf.error");
    res.status(500).json({ error: "Gagal generate PDF preview", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/quotations/:id/export-pdf", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = toStr(req.params.id);
    const data = await loadQuotationForExport(id);
    if (!data) { res.status(404).json({ error: "Quotation not found" }); return; }
    const company = await getCompanyProfile();
    const dims = PAPER_DIMENSIONS[data.paperSize] || PAPER_DIMENSIONS.A4;
    const html = buildQuotationHtml(data, company);
    const pdfBuffer = await generatePdfFromHtml(html, {
      width: dims.width,
      height: dims.height,
      margin: { top: data.marginTop, bottom: data.marginBottom, left: data.marginLeft, right: data.marginRight },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slugify(data.number)}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, "quotations.export-pdf.error");
    res.status(500).json({ error: "Gagal generate PDF. Pastikan puppeteer/@sparticuz/chromium sudah terinstall.", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/quotations/:id/export-html", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = toStr(req.params.id);
    const data = await loadQuotationForExport(id);
    if (!data) { res.status(404).json({ error: "Quotation not found" }); return; }
    const company = await getCompanyProfile();
    res.setHeader("Content-Type", "text/html");
    res.send(buildQuotationHtml(data, company));
  } catch (err) {
    logger.error({ err }, "quotations.export-html.error");
    res.status(500).json({ error: "Failed to render preview" });
  }
});

router.post("/quotations/preview-html", async (req, res): Promise<void> => {
  try {
    const company = await getCompanyProfile();
    res.setHeader("Content-Type", "text/html");
    res.send(buildQuotationHtml(req.body ?? {}, company));
  } catch (err) {
    logger.error({ err }, "quotations.preview-html.error");
    res.status(500).json({ error: "Failed to render preview" });
  }
});

async function loadQuotationForExport(id: string) {
  const [row] = await db
    .select({ quotation: quotationsTable, clientName: clientsTable.name })
    .from(quotationsTable)
    .leftJoin(clientsTable, eq(quotationsTable.clientId, clientsTable.id))
    .where(eq(quotationsTable.id, id))
    .limit(1);
  if (!row) return null;
  const items = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  return { ...mapQuotation(row.quotation), clientName: row.clientName, items: items.map(mapItem) };
}

// ================= Convert to Project + Invoice =================

router.post("/quotations/:id/convert", async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = toStr(req.params.id);
    const [quotation] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id)).limit(1);
    if (!quotation) { res.status(404).json({ error: "Quotation not found" }); return; }
    if (quotation.convertedProjectId) { res.status(400).json({ error: "Penawaran ini sudah pernah dikonversi" }); return; }

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, quotation.clientId)).limit(1);

    const [project] = await db.insert(projectsTable).values({
      title: quotation.title,
      client: client?.name || null,
      status: "active",
      priority: "medium",
      projectType: quotation.projectType || null,
      budget: String(Number(quotation.total)),
      startDate: new Date() as any,
      notes: `Auto-generated dari Penawaran ${quotation.number}`,
    } as any).returning();

    const dpPercent = Number(quotation.dpPercentage) || 50;
    const dpAmount = Math.round((Number(quotation.total) * dpPercent) / 100);
    const invoiceId = crypto.randomUUID();
    const invoiceCount = await db.select().from(invoicesTable);
    const invoiceNumber = `INV-${String(invoiceCount.length + 1).padStart(4, "0")}`;

    const [invoice] = await db.insert(invoicesTable).values({
      id: invoiceId,
      number: invoiceNumber,
      clientId: quotation.clientId,
      projectId: project.id,
      status: "DRAFT",
      type: "DP",
      subtotal: String(dpAmount),
      tax: "0",
      discount: "0",
      total: String(dpAmount),
      paidAmount: "0",
      dueDate: null,
      billTo: quotation.billTo,
      notes: `DP ${dpPercent}% dari Penawaran ${quotation.number} — ${quotation.title}`,
    }).returning();

    await db.insert(invoiceItemsTable).values({
      id: crypto.randomUUID(),
      invoiceId,
      description: `DP ${dpPercent}% — ${quotation.title} (Ref: ${quotation.number})`,
      quantity: "1",
      unitPrice: String(dpAmount),
      total: String(dpAmount),
      sortOrder: "0",
    });

    await db.update(quotationsTable).set({
      status: "CONVERTED",
      convertedProjectId: project.id,
      convertedInvoiceId: invoiceId,
      updatedAt: new Date(),
    }).where(eq(quotationsTable.id, id));

    await logActivity("quotation.converted", `Penawaran ${quotation.number} dikonversi jadi Project & Invoice DP`);

    res.json({
      success: true,
      project: { id: project.id, title: project.title },
      invoice: { id: invoice.id, number: invoice.number, total: dpAmount },
    });
  } catch (err) {
    logger.error({ err }, "quotations.convert.error");
    res.status(500).json({ error: "Gagal convert penawaran", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ================= HTML Template (dipakai preview & PDF) =================

function buildQuotationHtml(q: any, company: any): string {
  const items = Array.isArray(q.items) ? q.items : [];
  const effectiveLogo = q.logoUrl || company.logoUrl;
  const logoHtml = effectiveLogo
    ? `<img src="${effectiveLogo}" alt="Logo" style="height:48px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#ff6b35;">${escapeHtml((company.companyName || "FRAMELESS").toUpperCase())}</div>`;

  const generatedDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const validUntil = q.validUntil
    ? new Date(q.validUntil).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    : "-";

  // Group items by phase, preserve within-phase order
  const groups = PHASE_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    items: items.filter((it: any) => (it.phase || "lain") === phase),
  })).filter((g) => g.items.length > 0);

  const rowsHtml = groups.map((g) => `
    <tr>
      <td colspan="4" style="padding:8px 14px;background:#f2f2f2;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#666;">${escapeHtml(g.label)}</td>
    </tr>
    ${g.items.map((item: any, idx: number) => `
      <tr style="background:${idx % 2 === 0 ? "#fafafa" : "#ffffff"};border-bottom:1px solid #ececec;">
        <td style="padding:10px 14px;font-size:13px;color:#222;">${escapeHtml(item.description || "—")}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;color:#666;">${escapeHtml(String(item.quantity ?? ""))}</td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;color:#555;">${formatIDR(item.unitPrice)}</td>
        <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#111;">${formatIDR(item.total)}</td>
      </tr>
    `).join("")}
  `).join("");

  const addressLine = company.address ? escapeHtml(company.address) : "";
  const contactLine = [company.email, company.website].filter(Boolean).map(escapeHtml).join(" · ");

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      @page { margin: 0; }
      body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color:#222; margin:0; padding:40px; line-height:1.5; }
      table { width:100%; border-collapse:collapse; }
      .section { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        ${logoHtml}
        <p style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:2px;margin-top:6px;">${escapeHtml(company.tagline || "Creative Production House")}</p>
        ${addressLine ? `<p style="font-size:10px;color:#999;margin-top:4px;">${addressLine}</p>` : ""}
        ${contactLine ? `<p style="font-size:10px;color:#999;">${contactLine}</p>` : ""}
      </div>
      <div style="text-align:right;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:3px;color:#999;margin:0 0 4px;">Surat Penawaran</p>
        <p style="font-size:22px;font-weight:800;color:#1a1a1a;margin:0;">${escapeHtml(q.number || "")}</p>
        <p style="font-size:10px;color:#999;margin-top:6px;">Tanggal: ${generatedDate}</p>
        <p style="font-size:10px;color:#999;">Berlaku s/d: ${validUntil}</p>
      </div>
    </div>

    <div style="height:3px;background:linear-gradient(90deg,#ff6b35 0%,#ff9a35 60%,#ffd23520 100%);margin-bottom:24px;border-radius:2px;"></div>

    <div class="section" style="margin-bottom:20px;">
      <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;">${escapeHtml(q.title || "")}</h2>
    </div>

    <div class="section" style="background:#f9f9f9;border-radius:6px;padding:14px 16px;border-left:3px solid #ff6b35;margin-bottom:24px;max-width:60%;">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#999;margin-bottom:6px;font-weight:600;">Kepada Yth</div>
      <div style="white-space:pre-line;font-size:12px;color:#333;">${escapeHtml(q.billTo || q.clientName || "—")}</div>
    </div>

    <table class="section">
      <thead>
        <tr style="background:#1a1a1a;">
          <th style="text-align:left;padding:10px 14px;color:#fff;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Deskripsi Jasa</th>
          <th style="text-align:center;padding:10px 14px;color:#fff;font-size:10px;letter-spacing:2px;text-transform:uppercase;width:60px;">Qty</th>
          <th style="text-align:right;padding:10px 14px;color:#fff;font-size:10px;letter-spacing:2px;text-transform:uppercase;width:140px;">Harga</th>
          <th style="text-align:right;padding:10px 14px;color:#fff;font-size:10px;letter-spacing:2px;text-transform:uppercase;width:140px;">Jumlah</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div class="section" style="display:flex;justify-content:flex-end;margin-top:16px;">
      <div style="width:320px;">
        <table>
          <tbody>
            <tr><td style="padding:5px 0;color:#666;font-size:12px;">Subtotal</td><td style="padding:5px 0;text-align:right;font-weight:500;">${formatIDR(q.subtotal)}</td></tr>
            ${Number(q.tax) > 0 ? `<tr><td style="padding:5px 0;color:#666;font-size:12px;">Pajak</td><td style="padding:5px 0;text-align:right;font-weight:500;">${formatIDR(q.tax)}</td></tr>` : ""}
            ${Number(q.discount) > 0 ? `<tr><td style="padding:5px 0;color:#666;font-size:12px;">Diskon</td><td style="padding:5px 0;text-align:right;font-weight:500;color:#22c55e;">−${formatIDR(q.discount)}</td></tr>` : ""}
            <tr style="border-top:2px solid #1a1a1a;">
              <td style="padding:10px 0 5px;font-weight:700;font-size:13px;text-transform:uppercase;">Total Penawaran</td>
              <td style="padding:10px 0 5px;text-align:right;font-weight:800;font-size:18px;color:#ff6b35;">${formatIDR(q.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    ${(q.notes || q.terms) ? `
    <div class="section" style="display:grid;grid-template-columns:${q.notes && q.terms ? "1fr 1fr" : "1fr"};gap:28px;border-top:1px solid #ececec;padding-top:18px;margin-top:24px;">
      ${q.notes ? `<div><div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#999;margin-bottom:5px;font-weight:600;">Catatan</div><div style="color:#444;font-size:12px;white-space:pre-line;">${escapeHtml(q.notes)}</div></div>` : ""}
      ${q.terms ? `<div><div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#999;margin-bottom:5px;font-weight:600;">Syarat & Ketentuan</div><div style="color:#555;font-size:11px;white-space:pre-line;">${escapeHtml(q.terms)}</div></div>` : ""}
    </div>` : ""}

    <div class="section" style="border-top:2px solid #1a1a1a;padding-top:16px;margin-top:32px;display:flex;justify-content:space-between;">
      <div style="font-size:10px;color:#888;line-height:1.6;max-width:60%;">
        Dokumen ini merupakan penawaran resmi dari ${escapeHtml(company.companyName || "Frameless Creative")} dan berlaku hingga tanggal yang tercantum di atas.
      </div>
      <div style="text-align:right;font-size:10px;color:#999;">Dicetak ${generatedDate}</div>
    </div>
  </body>
  </html>
  `;
}

function formatIDR(v: unknown): string {
  const n = Number(v) || 0;
  return "Rp " + n.toLocaleString("id-ID");
}
function escapeHtml(text: string): string {
  if (!text) return "";
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text).replace(/[&<>"']/g, (c) => map[c]);
}
function slugify(text: string): string {
  return (text || "penawaran").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "penawaran";
}

// ================= Mappers =================

function mapQuotation(q: any) {
  return {
    id: q.id, number: q.number, clientId: q.clientId, projectId: q.projectId,
    projectType: q.projectType, title: q.title, status: q.status, validUntil: q.validUntil,
    subtotal: Number(q.subtotal), tax: Number(q.tax), discount: Number(q.discount), total: Number(q.total),
    estimatedCost: Number(q.estimatedCost), dpPercentage: Number(q.dpPercentage),
    notes: q.notes, terms: q.terms, billTo: q.billTo, logoUrl: q.logoUrl,
    paperSize: q.paperSize, marginTop: q.marginTop, marginBottom: q.marginBottom,
    marginLeft: q.marginLeft, marginRight: q.marginRight,
    convertedProjectId: q.convertedProjectId, convertedInvoiceId: q.convertedInvoiceId,
    createdAt: q.createdAt, updatedAt: q.updatedAt,
  };
}
function mapItem(i: any) {
  return {
    id: i.id, quotationId: i.quotationId,
    phase: i.phase || "lain",
    label: i.label || i.description,
    components: parseComponents(i.components),
    description: i.description,
    quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), total: Number(i.total),
    sortOrder: Number(i.sortOrder),
  };
}
function mapRabItem(r: any) {
  return { id: r.id, quotationId: r.quotationId, category: r.category, itemName: r.itemName, quantity: Number(r.quantity), unit: r.unit, unitCost: Number(r.unitCost), total: Number(r.total), notes: r.notes, sortOrder: Number(r.sortOrder) };
}

async function logActivity(action: string, description: string) {
  try {
    const { activityLogsTable, db: database } = await import("@workspace/db");
    await database.insert(activityLogsTable).values({ id: crypto.randomUUID(), action, description });
  } catch {}
}

export default router;