import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  paymentsTable,
  clientsTable,
  projectsTable,
  companyProfileTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { postPaymentJournal, voidPaymentJournal } from "../lib/journal-poster.js";
import { loadCashEvents } from "../lib/invoice-cash.js";
import { makeShareToken, readShareToken } from "../lib/share-token.js";
import { rateLimit } from "../middlewares/rate-limit.js";
import { nextInvoiceNumber } from "../lib/invoice-number.js";
import { generatePdfFromHtml } from "../lib/pdf.js";
import { logger } from "../lib/logger.js";
import {
  buildInvoiceHtml,
  paymentStage,
  type DocKind,
  type InvoiceDocData,
  type DocCompany,
  type DocBank,
  DEFAULT_BANK,
} from "../lib/invoice-html.js";

const router: IRouter = Router();

type InvoiceParams = { id: string };

type InvoiceItemInput = {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  total?: unknown;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function toStr(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v).trim();
}

function toNum(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

function slugify(text: string): string {
  return (text || "invoice").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "invoice";
}

/** Total selalu dihitung server dari item — tidak percaya angka kiriman client. */
function computeTotals(rawItems: unknown, taxRate: number, discount: number, shipping: number) {
  const items = (Array.isArray(rawItems) ? rawItems : []).map((it) => {
    const i = it as InvoiceItemInput;
    const quantity = toNum(i?.quantity, 1);
    const unitPrice = toNum(i?.unitPrice);
    return { description: toStr(i?.description), quantity, unitPrice, total: Math.round(quantity * unitPrice * 100) / 100 };
  });
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tax = Math.round(subtotal * (taxRate / 100));
  const total = Math.max(subtotal + tax - discount + shipping, 0);
  return { items, subtotal, tax, total };
}

async function numberTaken(number: string, exceptId?: string): Promise<boolean> {
  const rows = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.number, number));
  return rows.some((r) => r.id !== exceptId);
}

function requestOrigin(req: Request): string {
  const env = process.env.APP_URL || process.env.PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:5173";
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}

const FALLBACK_COMPANY: DocCompany = {
  name: "Frameless Creative Project PT",
  tagline: "Creative Production House",
  address: "Jl. Lurah Sudarto Jlamprang Wonosobo 56319",
  email: "info@frameless.com",
  phone: null,
  website: "www.framelesscreative.com",
  logoUrl: "/logo-frameless.png",
};

async function loadCompanyAndBank(): Promise<{ company: DocCompany; bank: DocBank }> {
  try {
    const [row] = await db.select().from(companyProfileTable).where(eq(companyProfileTable.id, "default")).limit(1);
    if (row) {
      const r = row as any;
      return {
        company: {
          name: row.companyName || FALLBACK_COMPANY.name,
          tagline: row.tagline,
          address: row.address || FALLBACK_COMPANY.address,
          email: row.email || FALLBACK_COMPANY.email,
          phone: row.phone,
          website: row.website || FALLBACK_COMPANY.website,
          logoUrl: row.logoUrl || FALLBACK_COMPANY.logoUrl,
          signerName: r.signerName ?? null,
        },
        bank: r.bankNumber
          ? { bank: r.bankName || DEFAULT_BANK.bank, number: r.bankNumber, holder: r.bankHolder || row.companyName || DEFAULT_BANK.holder }
          : DEFAULT_BANK,
      };
    }
  } catch (err) {
    logger.warn({ err }, "invoices.company_lookup_failed");
  }
  return { company: { ...FALLBACK_COMPANY }, bank: DEFAULT_BANK };
}

const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

function journalPayment(paymentId: string, where: string) {
  postPaymentJournal(paymentId)
    .then((r) => {
      if (!r.success && !r.skipped) console.warn(`[${where}] journal post error:`, r.error);
    })
    .catch((e) => console.warn(`[${where}] journal post failed:`, e?.message));
}

// Cek apakah pembuatan PDF di server ini berfungsi (berguna setelah deploy ke Vercel).
// GET /api/admin/pdf-check → { ok, ms, bytes } atau { ok:false, error }
router.get("/admin/pdf-check", async (_req, res): Promise<void> => {
  const t0 = Date.now();
  try {
    const pdf = await generatePdfFromHtml("<html><body><h1>PDF OK</h1></body></html>");
    res.json({ ok: true, ms: Date.now() - t0, bytes: pdf.length, serverless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) });
  } catch (err) {
    res.status(500).json({ ok: false, ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── List ───────────────────────────────────────────────────────────────────

router.get("/invoices", async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId.trim() : undefined;

  const rows = await db
    .select({ invoice: invoicesTable, clientName: clientsTable.name })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(invoicesTable.createdAt);

  let result = rows.map((r) => ({ ...mapInvoice(r.invoice), clientName: r.clientName }));
  if (status) result = result.filter((i) => i.displayStatus === status || (status !== "OVERDUE" && i.status === status));
  if (clientId) result = result.filter((i) => i.clientId === clientId);

  res.json(result);
});

// Uang masuk invoice per tanggal pembayaran (dipakai laporan Finance)
router.get("/invoices/cash-events", async (_req, res): Promise<void> => {
  res.json(await loadCashEvents());
});

// ── Rekonsiliasi data lama ───────────────────────────────────────────────────
// POST /invoices/reconcile  { apply: false } → hanya rencana;  { apply: true } → terapkan yang aman.
// Yang AMAN (otomatis): (a) paidAmount ada tapi belum ada rincian pembayaran → buat 1 rincian;
// (b) status PAID tapi uang masuk kurang, DAN total cocok dengan item/pajak/diskon → buat rincian untuk sisanya.
// Yang TIDAK diotak-atik: total tersimpan tidak cocok dengan hasil hitung item → butuh keputusan manual.
router.post("/invoices/reconcile", async (req, res): Promise<void> => {
  const apply = req.body?.apply === true;
  const rows = await db.select().from(invoicesTable).orderBy(invoicesTable.number);
  const items = await db.select().from(invoiceItemsTable);
  const pays = await db.select().from(paymentsTable);

  type Plan = { number: string; id: string; issue: string; action: string; amount: number; auto: boolean; manual?: string };
  const plan: Plan[] = [];
  const todo: { invoiceId: string; amount: number; date: Date; note: string }[] = [];

  for (const inv of rows) {
    const total = Number(inv.total);
    const paid = Number(inv.paidAmount);
    const myPays = pays.filter((p) => p.invoiceId === inv.id);
    const itemSum = items.filter((i) => i.invoiceId === inv.id).reduce((a, i) => a + Number(i.total), 0);
    const computed = Number(inv.subtotal) + Number(inv.tax) - Number(inv.discount) + Number(inv.shipping ?? 0);
    const itemsMatch = Math.abs(itemSum - Number(inv.subtotal)) < 1;
    const totalMatches = Math.abs(total - computed) < 1 && itemsMatch;
    const refDate = new Date((inv.paidAt ?? inv.updatedAt ?? inv.createdAt) as any);

    if (myPays.length === 0 && paid > 0) {
      plan.push({ number: inv.number, id: inv.id, issue: "Ada uang masuk tetapi tidak ada rincian pembayaran", action: `Buat 1 rincian pembayaran ${rp(paid)}`, amount: paid, auto: true });
      todo.push({ invoiceId: inv.id, amount: paid, date: refDate, note: "Rekonsiliasi: pembayaran dari data lama" });
    }
    const effectivePaid = myPays.length === 0 ? paid : myPays.reduce((a, p) => a + Number(p.amount), 0);
    if (inv.status === "PAID" && effectivePaid < total - 0.5) {
      if (totalMatches) {
        const gap = total - effectivePaid;
        plan.push({ number: inv.number, id: inv.id, issue: "Status PAID tetapi pembayaran tercatat kurang dari total", action: `Catat pelunasan ${rp(gap)}`, amount: gap, auto: true });
        todo.push({ invoiceId: inv.id, amount: gap, date: refDate, note: "Rekonsiliasi: status PAID tanpa catatan pembayaran" });
      } else {
        plan.push({
          number: inv.number, id: inv.id, auto: false, amount: effectivePaid,
          issue: "Status PAID tetapi pembayaran kurang dari total",
          action: "Perlu keputusan manual",
          manual: `Total tersimpan ${rp(total)} tidak cocok dengan hasil hitung item ${rp(computed)} (item berjumlah ${rp(itemSum)}). Buka invoice, periksa item, lalu Simpan agar total dihitung ulang.`,
        });
      }
    }
  }

  if (apply && todo.length > 0) {
    for (const t of todo) {
      await db.insert(paymentsTable).values({
        id: crypto.randomUUID(), invoiceId: t.invoiceId, amount: String(t.amount),
        method: "Transfer", paidAt: t.date, notes: t.note,
      });
      // Hanya selaraskan jumlah terbayar — status invoice TIDAK diubah oleh rekonsiliasi
      const sum = (await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, t.invoiceId))).reduce((a, p) => a + Number(p.amount), 0);
      const [cur] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, t.invoiceId)).limit(1);
      await db.update(invoicesTable).set({
        paidAmount: String(sum),
        ...(cur?.status === "PAID" && !cur.paidAt ? { paidAt: t.date } : {}),
      }).where(eq(invoicesTable.id, t.invoiceId));
    }
    await logActivity("invoice.reconciled", `Rekonsiliasi data invoice lama: ${todo.length} rincian pembayaran dibuat (${plan.filter((p) => p.auto).map((p) => p.number).join(", ")})`);
  }
  res.json({ applied: apply ? todo.length : 0, plan });
});

router.get("/invoices/next-number", async (_req, res): Promise<void> => {
  res.json({ number: await nextInvoiceNumber() });
});

// ─── Preview dokumen dari draft (belum disimpan) ────────────────────────────

router.post("/invoices/preview-html", async (req, res): Promise<void> => {
  try {
    const b = req.body ?? {};
    const { company, bank } = await loadCompanyAndBank();
    const overrideName = toStr(b.fromName);
    const overrideAddr = toStr(b.fromAddress);
    if (overrideName) company.name = overrideName;
    if (overrideAddr) company.address = overrideAddr;
    if (toStr(b.logoUrl)) company.logoUrl = toStr(b.logoUrl);

    const taxRate = toNum(b.taxRate, 11);
    const discount = toNum(b.discount);
    const shipping = toNum(b.shipping);
    const t = computeTotals(b.items, taxRate, discount, shipping);

    let payments: InvoiceDocData["payments"] = [];
    let paidAmount = 0;
    let projectName: string | null = null;
    const invoiceId = toStr(b.invoiceId);
    if (invoiceId) {
      const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, invoiceId));
      payments = rows.map(mapPayment);
      const [cur] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
      paidAmount = cur ? Number(cur.paidAmount) : 0;
    }
    const projectId = toStr(b.projectId);
    if (projectId) {
      const [p] = await db.select({ title: projectsTable.title }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
      projectName = p?.title ?? null;
    }
    const clientId = toStr(b.clientId);
    let clientName: string | null = null;
    if (clientId) {
      const [c] = await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
      clientName = c?.name ?? null;
    }

    const data: InvoiceDocData = {
      number: toStr(b.invoiceNumber) || "INV-XXXX",
      status: toStr(b.status) || "DRAFT",
      invoiceDate: toDateOrNull(b.invoiceDate) ?? new Date(),
      dueDate: toDateOrNull(b.dueDate),
      paymentTerms: toStr(b.paymentTerms) || null,
      poNumber: toStr(b.poNumber) || null,
      clientName,
      projectName,
      billTo: toStr(b.billTo),
      shipTo: toStr(b.shipTo),
      items: t.items,
      subtotal: t.subtotal,
      taxRate,
      tax: t.tax,
      discount,
      shipping,
      total: t.total,
      paidAmount,
      payments,
      notes: toStr(b.notes),
      terms: toStr(b.terms),
    };

    const kind: DocKind = b.doc === "receipt" ? "receipt" : "invoice";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(buildInvoiceHtml(data, { kind, company, bank, appUrl: requestOrigin(req) }));
  } catch (err) {
    logger.error({ err }, "invoices.preview-html.error");
    res.status(500).json({ error: "Gagal membuat preview" });
  }
});

// ─── Create ─────────────────────────────────────────────────────────────────

router.post("/invoices", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const clientId = toStr(b.clientId);
  if (!clientId) {
    res.status(400).json({ error: "Client ID is required" });
    return;
  }

  const requested = toStr(b.number || b.invoiceNumber);
  if (requested && (await numberTaken(requested))) {
    res.status(409).json({ error: `Nomor invoice ${requested} sudah dipakai` });
    return;
  }
  const number = requested || (await nextInvoiceNumber());

  const taxRate = toNum(b.taxRate, 11);
  const discount = toNum(b.discount);
  const shipping = toNum(b.shipping);
  const hasItems = Array.isArray(b.items) && b.items.length > 0;
  const t = hasItems
    ? computeTotals(b.items, taxRate, discount, shipping)
    : { items: [], subtotal: toNum(b.subtotal), tax: toNum(b.tax), total: toNum(b.total) };

  const status = toStr(b.status) || "DRAFT";
  const invoiceId = crypto.randomUUID();

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      id: invoiceId,
      number,
      clientId,
      projectId: toStr(b.projectId) || null,
      status,
      type: toStr(b.type) || "FULL",
      subtotal: String(t.subtotal),
      tax: String(t.tax),
      discount: String(discount),
      total: String(t.total),
      paidAmount: "0",
      taxRate: String(taxRate),
      shipping: String(shipping),
      invoiceDate: toDateOrNull(b.invoiceDate) ?? new Date(),
      paymentTerms: toStr(b.paymentTerms) || null,
      poNumber: toStr(b.poNumber) || null,
      dueDate: toDateOrNull(b.dueDate),
      notes: toStr(b.notes) || null,
      terms: toStr(b.terms) || null,
      billTo: toStr(b.billTo) || null,
      shipTo: toStr(b.shipTo) || null,
    })
    .returning();

  for (let i = 0; i < t.items.length; i++) {
    const item = t.items[i];
    await db.insert(invoiceItemsTable).values({
      id: crypto.randomUUID(),
      invoiceId,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      total: String(item.total),
      sortOrder: String(i),
    });
  }

  // Dibuat langsung sebagai PAID / dengan jumlah terbayar → catat sebagai pembayaran nyata
  const initialPaid = status === "PAID" ? t.total : Math.min(toNum(b.paidAmount), t.total);
  if (initialPaid > 0) {
    const initialPaymentId = crypto.randomUUID();
    await db.insert(paymentsTable).values({
      id: initialPaymentId,
      invoiceId,
      amount: String(initialPaid),
      method: toStr(b.paymentMethod) || "Transfer",
      reference: null,
      paidAt: new Date(),
      notes: status === "PAID" ? "Dicatat saat invoice dibuat" : "DP dicatat saat invoice dibuat",
    });
    await syncPaymentTotals(invoiceId);
    journalPayment(initialPaymentId, "invoices POST");
  }

  await logActivity("invoice.created", `Invoice ${number} created`);

  const [fresh] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  res.status(201).json(mapInvoice(fresh ?? invoice));
});

// ─── Detail ─────────────────────────────────────────────────────────────────

router.get("/invoices/:id", async (req: Request<InvoiceParams>, res: Response): Promise<void> => {
  const id = toStr(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invoice ID is required" });
    return;
  }

  const [row] = await db
    .select({ invoice: invoicesTable, clientName: clientsTable.name, clientPhone: clientsTable.phone, clientEmail: clientsTable.email, projectName: projectsTable.title })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, sql`${projectsTable.id}::text = ${invoicesTable.projectId}`)
    .where(eq(invoicesTable.id, id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, id));

  res.json({
    ...mapInvoice(row.invoice),
    clientName: row.clientName,
    clientPhone: (row as any).clientPhone ?? null,
    clientEmail: (row as any).clientEmail ?? null,
    projectName: row.projectName,
    items: items.map(mapItem).sort((a, b) => a.sortOrder - b.sortOrder),
    payments: payments.map(mapPayment).sort((a, b) => new Date(a.paidAt ?? 0).getTime() - new Date(b.paidAt ?? 0).getTime()),
  });
});

// ─── Dokumen cetak: invoice / kwitansi (DP, termin, lunas) ──────────────────
// GET /invoices/:id/doc?doc=invoice|receipt&format=html|pdf&paymentId=&stamp=0

/** Render dokumen (HTML atau PDF) — dipakai rute admin dan link publik. */
async function renderDoc(
  req: Request,
  res: Response,
  opts: { id: string; kind: DocKind; paymentId: string | null; format: "html" | "pdf"; stamp: boolean },
): Promise<void> {
  const data = await loadDocData(opts.id);
  if (!data) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (opts.kind === "receipt" && data.paidAmount <= 0) {
    res.status(400).json({ error: "Belum ada pembayaran — kwitansi belum bisa dibuat." });
    return;
  }
  const { company, bank } = await loadCompanyAndBank();
  const html = buildInvoiceHtml(data, {
    kind: opts.kind,
    company,
    bank,
    paymentId: opts.paymentId,
    stamp: opts.stamp,
    appUrl: requestOrigin(req),
  });

  if (opts.format === "pdf") {
    const pdf = await generatePdfFromHtml(html);
    const prefix = opts.kind === "receipt" ? "kwitansi" : "invoice";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${prefix}-${slugify(data.number)}.pdf"`);
    res.send(pdf);
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}

router.get("/invoices/:id/doc", async (req: Request<InvoiceParams>, res: Response): Promise<void> => {
  try {
    await renderDoc(req, res, {
      id: toStr(req.params.id),
      kind: req.query.doc === "receipt" ? "receipt" : "invoice",
      paymentId: typeof req.query.paymentId === "string" ? req.query.paymentId : null,
      format: req.query.format === "pdf" ? "pdf" : "html",
      stamp: req.query.stamp !== "0",
    });
  } catch (err) {
    logger.error({ err }, "invoices.doc.error");
    res.status(500).json({ error: "Gagal membuat dokumen", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ── Link publik (kirim ke client) ────────────────────────────────────────────
// POST /invoices/:id/share { doc, paymentId } → { url }   (admin)
router.post("/invoices/:id/share", async (req: Request<InvoiceParams>, res: Response): Promise<void> => {
  try {
    const id = toStr(req.params.id);
    const [inv] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
    if (!inv) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    const doc = req.body?.doc === "receipt" ? "receipt" : "invoice";
    const token = makeShareToken({ invoiceId: id, doc, paymentId: toStr(req.body?.paymentId) });
    res.json({ url: `${requestOrigin(req)}/api/public/invoice/${token}` });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Gagal membuat link" });
  }
});

// GET /public/invoice/:token[?format=pdf]  (tanpa login — hanya untuk pemegang token yang valid)
router.get("/public/invoice/:token", rateLimit({ windowMs: 60_000, max: 60, key: "public-invoice" }), async (req: Request<{ token: string }>, res: Response): Promise<void> => {
  try {
    const t = readShareToken(req.params.token);
    if (!t) {
      res.status(404).send("Link tidak valid.");
      return;
    }
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "private, no-store");
    await renderDoc(req, res, {
      id: t.invoiceId,
      kind: t.doc,
      paymentId: t.paymentId || null,
      format: req.query.format === "pdf" ? "pdf" : "html",
      stamp: true,
    });
  } catch (err) {
    logger.error({ err }, "invoices.public.error");
    res.status(500).send("Gagal memuat dokumen.");
  }
});

async function loadDocData(id: string): Promise<InvoiceDocData | null> {
  const [row] = await db
    .select({ invoice: invoicesTable, clientName: clientsTable.name, projectName: projectsTable.title })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, sql`${projectsTable.id}::text = ${invoicesTable.projectId}`)
    .where(eq(invoicesTable.id, id))
    .limit(1);
  if (!row) return null;

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, id));
  const inv = mapInvoice(row.invoice);

  return {
    number: inv.number,
    status: inv.status,
    invoiceDate: inv.invoiceDate ?? inv.createdAt,
    dueDate: inv.dueDate,
    paymentTerms: inv.paymentTerms,
    poNumber: inv.poNumber,
    clientName: row.clientName,
    projectName: row.projectName,
    billTo: inv.billTo,
    shipTo: inv.shipTo,
    items: items
      .map(mapItem)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
    subtotal: inv.subtotal,
    taxRate: inv.taxRate,
    tax: inv.tax,
    discount: inv.discount,
    shipping: inv.shipping,
    total: inv.total,
    paidAmount: inv.paidAmount,
    payments: payments.map(mapPayment),
    notes: inv.notes,
    terms: inv.terms,
  };
}

// ─── Update ─────────────────────────────────────────────────────────────────

router.put("/invoices/:id", async (req: Request<InvoiceParams>, res: Response): Promise<void> => {
  const id = toStr(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invoice ID is required" });
    return;
  }
  const b = req.body ?? {};

  const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const newNumber = toStr(b.number || b.invoiceNumber);
  if (newNumber && newNumber !== existing.number && (await numberTaken(newNumber, id))) {
    res.status(409).json({ error: `Nomor invoice ${newNumber} sudah dipakai` });
    return;
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  const assign = (key: string, val: unknown, present: boolean) => {
    if (present) set[key] = val;
  };

  assign("number", newNumber, !!newNumber);
  assign("clientId", toStr(b.clientId), !!toStr(b.clientId));
  assign("projectId", toStr(b.projectId) || null, b.projectId !== undefined);
  assign("status", toStr(b.status), b.status !== undefined);
  assign("type", toStr(b.type), b.type !== undefined);
  assign("dueDate", toDateOrNull(b.dueDate), b.dueDate !== undefined);
  assign("invoiceDate", toDateOrNull(b.invoiceDate), b.invoiceDate !== undefined);
  assign("paymentTerms", toStr(b.paymentTerms) || null, b.paymentTerms !== undefined);
  assign("poNumber", toStr(b.poNumber) || null, b.poNumber !== undefined);
  assign("notes", toStr(b.notes), b.notes !== undefined);
  assign("terms", toStr(b.terms), b.terms !== undefined);
  assign("billTo", toStr(b.billTo), b.billTo !== undefined);
  assign("shipTo", toStr(b.shipTo), b.shipTo !== undefined);

  // Nominal: bila items dikirim, semua total dihitung ulang di server.
  const taxRate = b.taxRate !== undefined ? toNum(b.taxRate, 11) : toNum(existing.taxRate, 11);
  const discount = b.discount !== undefined ? toNum(b.discount) : Number(existing.discount);
  const shipping = b.shipping !== undefined ? toNum(b.shipping) : Number(existing.shipping ?? 0);
  let newTotal = Number(existing.total);

  if (Array.isArray(b.items)) {
    const t = computeTotals(b.items, taxRate, discount, shipping);
    Object.assign(set, {
      subtotal: String(t.subtotal),
      tax: String(t.tax),
      total: String(t.total),
      discount: String(discount),
      shipping: String(shipping),
      taxRate: String(taxRate),
    });
    newTotal = t.total;
  } else {
    assign("subtotal", toNumStr(b.subtotal), b.subtotal !== undefined);
    assign("tax", toNumStr(b.tax), b.tax !== undefined);
    assign("discount", toNumStr(b.discount), b.discount !== undefined);
    assign("shipping", toNumStr(b.shipping), b.shipping !== undefined);
    assign("taxRate", toNumStr(b.taxRate), b.taxRate !== undefined);
    assign("total", toNumStr(b.total), b.total !== undefined);
    if (b.total !== undefined) newTotal = toNum(b.total);
  }

  // paidAmount hanya boleh diedit langsung untuk data lama yang belum punya rincian pembayaran.
  const paymentRows = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(eq(paymentsTable.invoiceId, id));
  if (b.paidAmount !== undefined && paymentRows.length === 0) {
    set.paidAmount = toNumStr(b.paidAmount);
  }

  const markedPaid = toStr(b.status) === "PAID" && existing.status !== "PAID";

  const [invoice] = await db.update(invoicesTable).set(set as any).where(eq(invoicesTable.id, id)).returning();

  if (Array.isArray(b.items)) {
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    const t = computeTotals(b.items, taxRate, discount, shipping);
    for (let i = 0; i < t.items.length; i++) {
      const item = t.items[i];
      await db.insert(invoiceItemsTable).values({
        id: crypto.randomUUID(),
        invoiceId: id,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        total: String(item.total),
        sortOrder: String(i),
      });
    }
  }

  // Ditandai lunas manual → buat rincian pembayaran untuk sisa tagihan agar kwitansi bisa dicetak.
  let remainderPaymentId: string | null = null;
  if (markedPaid) {
    const paidNow = (await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, id))).reduce(
      (s, p) => s + Number(p.amount),
      Number(invoice.paidAmount) > 0 && paymentRows.length === 0 ? Number(invoice.paidAmount) : 0,
    );
    // data lama: paidAmount ada tapi belum ada rincian → jadikan satu entri dulu
    if (paymentRows.length === 0 && Number(invoice.paidAmount) > 0) {
      await db.insert(paymentsTable).values({
        id: crypto.randomUUID(),
        invoiceId: id,
        amount: String(Number(invoice.paidAmount)),
        method: "Transfer",
        paidAt: invoice.paidAt ?? invoice.updatedAt ?? new Date(),
        notes: "Pembayaran sebelumnya (data lama)",
      });
    }
    const remaining = newTotal - paidNow;
    if (remaining > 0.5) {
      remainderPaymentId = crypto.randomUUID();
      await db.insert(paymentsTable).values({
        id: remainderPaymentId,
        invoiceId: id,
        amount: String(remaining),
        method: "Transfer",
        paidAt: new Date(),
        notes: "Ditandai lunas manual",
      });
    }
  }

  const synced = await syncPaymentTotals(id);

  void synced;
  if (remainderPaymentId) journalPayment(remainderPaymentId, "invoices PUT");

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const [fresh] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);

  res.json({
    ...mapInvoice(fresh ?? invoice),
    items: items.map(mapItem).sort((a, b) => a.sortOrder - b.sortOrder),
  });
});

// ─── Delete ─────────────────────────────────────────────────────────────────

router.delete("/invoices/:id", async (req: Request<InvoiceParams>, res: Response): Promise<void> => {
  const id = toStr(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invoice ID is required" });
    return;
  }

  const paymentIds = (await db.select({ id: paymentsTable.id }).from(paymentsTable).where(eq(paymentsTable.invoiceId, id))).map((r) => r.id);
  await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  await db.delete(paymentsTable).where(eq(paymentsTable.invoiceId, id));
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  for (const pid of paymentIds) await voidPaymentJournal(pid);
  try {
    await db.execute(sql`
      UPDATE journal_entries SET status = 'VOID', updated_at = NOW()
      WHERE source_type = 'invoice' AND source_id = ${id} AND status != 'VOID'
    `);
  } catch (e: any) {
    logger.warn({ err: e?.message }, "invoices.void_journal_on_delete_failed");
  }

  res.json({ success: true, message: "Invoice deleted" });
});

// ─── Pembayaran (DP / termin / pelunasan) ───────────────────────────────────

/**
 * Hitung ulang paidAmount, status dan paidAt dari tabel payments.
 * Mengembalikan becamePaid=true bila transisi ke PAID baru saja terjadi.
 */
async function syncPaymentTotals(invoiceId: string): Promise<{ paid: number; becamePaid: boolean } | null> {
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!inv) return null;

  const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, invoiceId));
  // data lama tanpa rincian: pertahankan paidAmount yang ada
  const paid = rows.length === 0 ? Number(inv.paidAmount) : rows.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(inv.total);
  const fullyPaid = total > 0 && paid >= total - 0.5;

  let status = inv.status;
  let paidAt = inv.paidAt;
  if (fullyPaid) {
    status = "PAID";
    if (!paidAt || inv.status !== "PAID") {
      const last = rows.map((p) => p.paidAt).filter(Boolean).sort((a, b) => +new Date(b as any) - +new Date(a as any))[0];
      paidAt = (last as Date) ?? new Date();
    }
  } else if (inv.status === "PAID" && rows.length > 0) {
    status = "SENT"; // pembayaran dihapus/dikoreksi → tidak lagi lunas
    paidAt = null;
  } else if (paid > 0 && inv.status === "DRAFT") {
    status = "SENT";
  }

  await db
    .update(invoicesTable)
    .set({ paidAmount: String(paid), status, paidAt, updatedAt: new Date() })
    .where(eq(invoicesTable.id, invoiceId));

  // Tidak lagi lunas (pembayaran dihapus/dikoreksi) → batalkan jurnal pendapatan otomatis invoice ini.
  if (inv.status === "PAID" && status !== "PAID") {
    try {
      await db.execute(sql`
        UPDATE journal_entries SET status = 'VOID', updated_at = NOW()
        WHERE source_type = 'invoice' AND source_id = ${invoiceId} AND status != 'VOID'
      `);
    } catch (e: any) {
      logger.warn({ err: e?.message }, "invoices.void_journal_failed");
    }
  }

  return { paid, becamePaid: status === "PAID" && inv.status !== "PAID" };
}

router.post("/invoices/:id/payments", async (req: Request<InvoiceParams>, res: Response): Promise<void> => {
  const invoiceId = toStr(req.params.id);
  if (!invoiceId) {
    res.status(400).json({ error: "Invoice ID is required" });
    return;
  }

  const { amount, method, reference, notes, paidAt } = req.body ?? {};
  const amt = toNum(amount);
  if (!(amt > 0) || !method) {
    res.status(400).json({ error: "Jumlah (> 0) dan metode pembayaran wajib diisi" });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const existingRows = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, invoiceId));
  const alreadyPaid = existingRows.length === 0 ? Number(invoice.paidAmount) : existingRows.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Number(invoice.total) - alreadyPaid;
  if (amt > balance + 0.5) {
    res.status(400).json({ error: `Jumlah melebihi sisa tagihan (${Math.max(balance, 0)})` });
    return;
  }

  // data lama (paidAmount ada, rincian kosong): simpan dulu sebagai entri agar tidak hilang saat dijumlah ulang
  if (existingRows.length === 0 && Number(invoice.paidAmount) > 0) {
    await db.insert(paymentsTable).values({
      id: crypto.randomUUID(),
      invoiceId,
      amount: String(Number(invoice.paidAmount)),
      method: "Transfer",
      paidAt: invoice.paidAt ?? invoice.updatedAt ?? new Date(),
      notes: "Pembayaran sebelumnya (data lama)",
    });
  }

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      id: crypto.randomUUID(),
      invoiceId,
      amount: String(amt),
      method: toStr(method),
      reference: toStr(reference) || null,
      paidAt: toDateOrNull(paidAt) ?? new Date(),
      notes: toStr(notes) || null,
    })
    .returning();

  const synced = await syncPaymentTotals(invoiceId);

  await logActivity("payment.recorded", `Pembayaran ${toStr(method)} sebesar ${amt} diterima untuk invoice ${invoice.number}`);

  journalPayment(payment.id, "invoices/payments");

  res.status(201).json({
    ...mapPayment(payment),
    stage: paymentStage(Number(invoice.total), synced?.paid ?? 0),
  });
});

router.delete("/invoices/:id/payments/:paymentId", async (req: Request<{ id: string; paymentId: string }>, res: Response): Promise<void> => {
  const invoiceId = toStr(req.params.id);
  const paymentId = toStr(req.params.paymentId);

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId)).limit(1);
  if (!payment || payment.invoiceId !== invoiceId) {
    res.status(404).json({ error: "Pembayaran tidak ditemukan" });
    return;
  }

  await db.delete(paymentsTable).where(eq(paymentsTable.id, paymentId));
  await voidPaymentJournal(paymentId);
  const synced = await syncPaymentTotals(invoiceId);
  await logActivity("payment.deleted", `Pembayaran ${Number(payment.amount)} dihapus dari invoice ${invoiceId}`);
  res.json({ success: true, paidAmount: synced?.paid ?? 0 });
});

// ── POST /invoices/backfill-paid-at ──────────────────────────────────────────
// Satu kali: isi paidAt untuk invoice PAID lama yang paidAt-nya null.
router.post("/invoices/backfill-paid-at", async (_req: Request, res: Response): Promise<void> => {
  try {
    const all = await db.select().from(invoicesTable);
    const toFix = all.filter((i: any) => i.status === "PAID" && !i.paidAt);

    if (toFix.length === 0) {
      res.json({ fixed: 0, message: "Semua invoice PAID sudah punya paidAt — tidak ada yang perlu diperbaiki." });
      return;
    }

    for (const inv of toFix) {
      const fallback = (inv as any).updatedAt ?? (inv as any).createdAt ?? new Date();
      await db.update(invoicesTable).set({ paidAt: new Date(fallback) }).where(eq(invoicesTable.id, (inv as any).id));
    }

    res.json({
      fixed: toFix.length,
      message: `${toFix.length} invoice diperbaiki — paidAt diisi dari updatedAt/createdAt sebagai fallback.`,
      invoiceNumbers: toFix.map((i: any) => i.number),
    });
  } catch (err) {
    console.error("[invoices/backfill-paid-at]", err);
    res.status(500).json({ error: "Backfill gagal" });
  }
});

// ─── Mappers ────────────────────────────────────────────────────────────────

function mapInvoice(i: any) {
  const total = Number(i.total);
  const paidAmount = Number(i.paidAmount);
  return {
    id: i.id,
    number: i.number,
    clientId: i.clientId,
    projectId: i.projectId,
    status: i.status,
    type: i.type,
    subtotal: Number(i.subtotal),
    tax: Number(i.tax),
    taxRate: i.taxRate === null || i.taxRate === undefined ? 11 : Number(i.taxRate),
    discount: Number(i.discount),
    shipping: Number(i.shipping ?? 0),
    total,
    paidAmount,
    balance: Math.max(total - paidAmount, 0),
    paymentStage: paymentStage(total, paidAmount),
    // Overdue dihitung otomatis: belum lunas, bukan draft/batal, dan lewat jatuh tempo (WIB)
    displayStatus: computeDisplayStatus(i.status, i.dueDate, total, paidAmount),
    invoiceDate: i.invoiceDate ?? null,
    paymentTerms: i.paymentTerms ?? null,
    poNumber: i.poNumber ?? null,
    dueDate: i.dueDate,
    paidAt: i.paidAt,
    updatedAt: i.updatedAt,
    notes: i.notes,
    terms: i.terms,
    billTo: i.billTo,
    shipTo: i.shipTo,
    createdAt: i.createdAt,
  };
}

function computeDisplayStatus(status: string, dueDate: unknown, total: number, paid: number): string {
  if (status === "PAID" || status === "CANCELLED" || status === "DRAFT") return status;
  if (total - paid <= 0.5) return status;
  if (dueDate) {
    const due = new Date(dueDate as any).getTime();
    // jatuh tempo dianggap berakhir pada akhir hari (WIB)
    if (!Number.isNaN(due) && Date.now() > due + 24 * 3600_000) return "OVERDUE";
  }
  return status;
}

function mapItem(i: any) {
  return {
    id: i.id,
    invoiceId: i.invoiceId,
    description: i.description,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    total: Number(i.total),
    sortOrder: Number(i.sortOrder),
  };
}

function mapPayment(p: any) {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    amount: Number(p.amount),
    method: p.method,
    reference: p.reference,
    paidAt: p.paidAt,
    notes: p.notes,
  };
}

async function logActivity(action: string, description: string) {
  try {
    const { activityLogsTable, db: database } = await import("@workspace/db");
    await database.insert(activityLogsTable).values({
      id: crypto.randomUUID(),
      action,
      description,
    });
  } catch {}
}

export default router;
