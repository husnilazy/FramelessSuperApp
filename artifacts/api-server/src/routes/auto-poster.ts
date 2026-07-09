// artifacts/frameless/src/server/routes/auto-poster.ts
// Auto-posting jurnal dari invoice payment, expense, income manual, dan depresiasi
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { resolveMapping } from "./account-mapping.js";

const router: IRouter = Router();

// ── Internal helper: buat satu journal entry + 2 lines ───────────────────────
async function createJournalEntry(opts: {
  date: string;
  type: string;
  description: string;
  sourceType: string;
  sourceId: string;
  debitCode: string;
  creditCode: string;
  amount: number;
  notes?: string;
}): Promise<{ entryId: string; refNumber: string } | { skipped: true; reason: string }> {
  // Cek duplikat
  const dup = await db.execute(sql`
    SELECT id FROM journal_entries
    WHERE source_type = ${opts.sourceType} AND source_id = ${opts.sourceId} AND status != 'VOID'
    LIMIT 1
  `);
  const dupRows = (dup as any).rows || dup;
  if (Array.isArray(dupRows) && dupRows.length > 0) {
    return { skipped: true, reason: `Jurnal untuk ${opts.sourceType} ${opts.sourceId} sudah ada` };
  }

  // Resolve account names
  const getAccount = async (code: string) => {
    const r = await db.execute(sql`SELECT id, name FROM accounts WHERE code = ${code} LIMIT 1`);
    const rows = (r as any).rows || r;
    return Array.isArray(rows) ? rows[0] : null;
  };

  const debitAcct  = await getAccount(opts.debitCode);
  const creditAcct = await getAccount(opts.creditCode);
  if (!debitAcct || !creditAcct) {
    return { skipped: true, reason: `Akun ${!debitAcct ? opts.debitCode : opts.creditCode} tidak ditemukan` };
  }

  // Count for ref number
  const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM journal_entries WHERE type = ${opts.type}`);
  const cnt = Number((countResult as any).rows?.[0]?.cnt || 0);
  const prefix = opts.type === "INVOICE" ? "JNL-INV" : opts.type === "EXPENSE" ? "JNL-EXP" : opts.type === "INCOME" ? "JNL-INC" : opts.type === "DEPRECIATION" ? "JNL-DEP" : "JNL";
  const refNumber = `${prefix}-${String(cnt + 1).padStart(4, "0")}`;

  const id = crypto.randomUUID();

  await db.execute(sql`
    INSERT INTO journal_entries (id, date, ref_number, type, description, source_type, source_id, status, notes)
    VALUES (
      ${id},
      ${opts.date}::date,
      ${refNumber},
      ${opts.type},
      ${opts.description},
      ${opts.sourceType},
      ${opts.sourceId},
      'POSTED',
      ${opts.notes || null}
    )
  `);

  // Debit line
  await db.execute(sql`
    INSERT INTO journal_lines (id, journal_entry_id, account_id, account_code, account_name, description, debit, credit, sort_order)
    VALUES (${crypto.randomUUID()}, ${id}, ${debitAcct.id}, ${opts.debitCode}, ${debitAcct.name}, ${opts.description}, ${opts.amount}, 0, 0)
  `);

  // Credit line
  await db.execute(sql`
    INSERT INTO journal_lines (id, journal_entry_id, account_id, account_code, account_name, description, debit, credit, sort_order)
    VALUES (${crypto.randomUUID()}, ${id}, ${creditAcct.id}, ${opts.creditCode}, ${creditAcct.name}, ${opts.description}, 0, ${opts.amount}, 1)
  `);

  return { entryId: id, refNumber };
}

// ── POST /auto-post/invoice/:id — posting jurnal saat invoice dibayar ─────────
router.post("/auto-post/invoice/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    // Ambil data invoice
    const invResult = await db.execute(sql`
      SELECT i.*, c.name AS client_name
      FROM invoices i
      LEFT JOIN clients c ON c.id = i."clientId"
      WHERE i.id = ${id} LIMIT 1
    `);
    const invRows = (invResult as any).rows || invResult;
    const inv = Array.isArray(invRows) ? invRows[0] : null;

    if (!inv) { res.status(404).json({ error: "Invoice tidak ditemukan" }); return; }
    if (inv.status !== "PAID") {
      res.status(400).json({ error: "Invoice belum lunas — hanya invoice berstatus PAID yang bisa diposting" });
      return;
    }

    const paidAmount = Number(inv.paidAmount || inv.paid_amount || 0);
    if (paidAmount <= 0) { res.status(400).json({ error: "Jumlah yang dibayar tidak valid" }); return; }

    // Resolve mapping: invoice_payment
    const mapping = await resolveMapping("default", "invoice_payment")
      || { debitCode: "1-1200", creditCode: "4-1000" };

    const invNumber = inv.number || id;
    const clientName = inv.client_name || "Klien";
    const paidDate = inv.paidAt || inv.paid_at || inv.updatedAt || inv.updated_at || new Date().toISOString();

    const result = await createJournalEntry({
      date:        new Date(paidDate).toISOString().split("T")[0],
      type:        "INVOICE",
      description: `Pembayaran invoice ${invNumber} — ${clientName}`,
      sourceType:  "invoice",
      sourceId:    id,
      debitCode:   mapping.debitCode,
      creditCode:  mapping.creditCode,
      amount:      paidAmount,
      notes:       `Invoice #${invNumber}, Klien: ${clientName}`,
    });

    if ("skipped" in result) {
      res.status(409).json({ message: result.reason, skipped: true });
    } else {
      res.status(201).json({ success: true, ...result });
    }
  } catch (err) {
    console.error("[auto-post/invoice]", err);
    res.status(500).json({ error: "Gagal auto-posting invoice" });
  }
});

// ── POST /auto-post/expense/:id — posting jurnal saat expense dibuat/diupdate ─
router.post("/auto-post/expense/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const expResult = await db.execute(sql`SELECT * FROM expenses WHERE id = ${id} LIMIT 1`);
    const expRows = (expResult as any).rows || expResult;
    const exp = Array.isArray(expRows) ? expRows[0] : null;

    if (!exp) { res.status(404).json({ error: "Pengeluaran tidak ditemukan" }); return; }

    const amount = Number(exp.amount || 0);
    if (amount <= 0) { res.status(400).json({ error: "Jumlah tidak valid" }); return; }

    const category = exp.category || "Lainnya";
    const mapping  = await resolveMapping("expense_category", category)
      || { debitCode: "6-9000", creditCode: "1-1200" };

    const expDate = exp.date ? new Date(exp.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    const result = await createJournalEntry({
      date:        expDate,
      type:        "EXPENSE",
      description: `${exp.description} [${category}]`,
      sourceType:  "expense",
      sourceId:    id,
      debitCode:   mapping.debitCode,
      creditCode:  mapping.creditCode,
      amount,
    });

    if ("skipped" in result) {
      res.status(409).json({ message: result.reason, skipped: true });
    } else {
      res.status(201).json({ success: true, ...result });
    }
  } catch (err) {
    console.error("[auto-post/expense]", err);
    res.status(500).json({ error: "Gagal auto-posting pengeluaran" });
  }
});

// ── POST /auto-post/income/:id — posting jurnal pemasukan manual ──────────────
router.post("/auto-post/income/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const incResult = await db.execute(sql`SELECT * FROM income_entries WHERE id = ${id} LIMIT 1`);
    const incRows = (incResult as any).rows || incResult;
    const inc = Array.isArray(incRows) ? incRows[0] : null;

    if (!inc) { res.status(404).json({ error: "Pemasukan tidak ditemukan" }); return; }

    const amount   = Number(inc.amount || 0);
    if (amount <= 0) { res.status(400).json({ error: "Jumlah tidak valid" }); return; }

    const category = inc.category || "Manual";
    const mapping  = await resolveMapping("income_source", category)
      || { debitCode: "1-1200", creditCode: "4-9000" };

    const incDate = inc.date ? new Date(inc.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    const result = await createJournalEntry({
      date:        incDate,
      type:        "INCOME",
      description: `${inc.description} [${category}]`,
      sourceType:  "income",
      sourceId:    id,
      debitCode:   mapping.debitCode,
      creditCode:  mapping.creditCode,
      amount,
      notes:       inc.source ? `Sumber: ${inc.source}` : undefined,
    });

    if ("skipped" in result) {
      res.status(409).json({ message: result.reason, skipped: true });
    } else {
      res.status(201).json({ success: true, ...result });
    }
  } catch (err) {
    console.error("[auto-post/income]", err);
    res.status(500).json({ error: "Gagal auto-posting pemasukan" });
  }
});

// ── POST /auto-post/depreciation — hitung & posting depresiasi semua aset ─────
// Dipanggil manual (misal tiap akhir bulan) atau dari cron job
router.post("/auto-post/depreciation", async (req: Request, res: Response): Promise<void> => {
  try {
    const { periodDate } = req.body ?? {};
    const depDate = periodDate
      ? new Date(periodDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Ambil semua equipment
    const eqResult = await db.execute(sql`SELECT * FROM equipment ORDER BY name`);
    const eqRows   = (eqResult as any).rows || eqResult;
    const equipment = Array.isArray(eqRows) ? eqRows : [];

    if (equipment.length === 0) {
      res.json({ success: true, posted: 0, message: "Tidak ada aset terdaftar" });
      return;
    }

    const mapping = await resolveMapping("default", "depreciation_equipment")
      || { debitCode: "6-1000", creditCode: "1-5100" };

    const results: { name: string; monthly: number; result: any }[] = [];
    let totalPosted = 0;

    for (const eq of equipment) {
      const purchasePrice     = Number(eq.purchase_price || eq.purchasePrice || 0);
      const depreciationYears = Number(eq.depreciation_years || eq.depreciationYears || 5);
      if (purchasePrice <= 0) continue;

      // Monthly depreciation = harga beli / (umur ekonomis * 12)
      const monthlyDep = Math.round(purchasePrice / (depreciationYears * 12));
      if (monthlyDep <= 0) continue;

      const sourceId = `dep-${eq.id}-${depDate.slice(0, 7)}`; // e.g. dep-xxx-2026-06

      const result = await createJournalEntry({
        date:        depDate,
        type:        "DEPRECIATION",
        description: `Penyusutan ${eq.name} — ${new Date(depDate).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`,
        sourceType:  "depreciation",
        sourceId,
        debitCode:   mapping.debitCode,
        creditCode:  mapping.creditCode,
        amount:      monthlyDep,
        notes:       `Aset: ${eq.name} | Harga: Rp ${purchasePrice.toLocaleString()} | Umur: ${depreciationYears}thn | Bulanan: Rp ${monthlyDep.toLocaleString()}`,
      });

      results.push({ name: eq.name, monthly: monthlyDep, result });
      if (!("skipped" in result)) totalPosted++;
    }

    const totalDepreciation = results.reduce((s, r) => s + r.monthly, 0);

    res.json({
      success: true,
      posted:  totalPosted,
      skipped: results.length - totalPosted,
      totalDepreciation,
      periodDate: depDate,
      details: results.map(r => ({
        asset:        r.name,
        monthlyDepreciation: r.monthly,
        ...("skipped" in r.result ? { skipped: true, reason: r.result.reason } : { entryId: r.result.entryId, refNumber: r.result.refNumber }),
      })),
    });
  } catch (err) {
    console.error("[auto-post/depreciation]", err);
    res.status(500).json({ error: "Gagal posting depresiasi" });
  }
});

// ── POST /auto-post/bulk-backfill — posting semua transaksi lama sekaligus ────
// One-time migration untuk data yang sudah ada sebelum sistem akuntansi ini
router.post("/auto-post/bulk-backfill", async (req: Request, res: Response): Promise<void> => {
  try {
    const { types = ["expense", "income", "invoice"] } = req.body ?? {};
    const results: Record<string, { posted: number; skipped: number; errors: number }> = {};

    if ((types as string[]).includes("expense")) {
      results.expense = { posted: 0, skipped: 0, errors: 0 };
      const expResult = await db.execute(sql`SELECT id FROM expenses ORDER BY date ASC`);
      const expRows   = (expResult as any).rows || expResult;
      for (const row of (Array.isArray(expRows) ? expRows : [])) {
        try {
          const r = await fetch(`http://localhost:${process.env.PORT || 3001}/api/auto-post/expense/${row.id}`, { method: "POST" });
          const data = await r.json() as any;
          if (r.status === 409 || data.skipped) results.expense.skipped++;
          else if (r.ok) results.expense.posted++;
          else results.expense.errors++;
        } catch { results.expense.errors++; }
      }
    }

    if ((types as string[]).includes("income")) {
      results.income = { posted: 0, skipped: 0, errors: 0 };
      const incResult = await db.execute(sql`SELECT id FROM income_entries ORDER BY date ASC`);
      const incRows   = (incResult as any).rows || incResult;
      for (const row of (Array.isArray(incRows) ? incRows : [])) {
        try {
          const r = await fetch(`http://localhost:${process.env.PORT || 3001}/api/auto-post/income/${row.id}`, { method: "POST" });
          const data = await r.json() as any;
          if (r.status === 409 || data.skipped) results.income.skipped++;
          else if (r.ok) results.income.posted++;
          else results.income.errors++;
        } catch { results.income.errors++; }
      }
    }

    if ((types as string[]).includes("invoice")) {
      results.invoice = { posted: 0, skipped: 0, errors: 0 };
      const invResult = await db.execute(sql`SELECT id FROM invoices WHERE status = 'PAID' ORDER BY "updatedAt" ASC`);
      const invRows   = (invResult as any).rows || invResult;
      for (const row of (Array.isArray(invRows) ? invRows : [])) {
        try {
          const r = await fetch(`http://localhost:${process.env.PORT || 3001}/api/auto-post/invoice/${row.id}`, { method: "POST" });
          const data = await r.json() as any;
          if (r.status === 409 || data.skipped) results.invoice.skipped++;
          else if (r.ok) results.invoice.posted++;
          else results.invoice.errors++;
        } catch { results.invoice.errors++; }
      }
    }

    const totalPosted  = Object.values(results).reduce((s, r) => s + r.posted,  0);
    const totalSkipped = Object.values(results).reduce((s, r) => s + r.skipped, 0);

    res.json({
      success: true,
      summary: `${totalPosted} jurnal diposting, ${totalSkipped} sudah ada (dilewati)`,
      detail: results,
    });
  } catch (err) {
    console.error("[auto-post/bulk-backfill]", err);
    res.status(500).json({ error: "Gagal backfill" });
  }
});

// ── GET /auto-post/status — cek status posting semua transaksi ────────────────
router.get("/auto-post/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [expTotal, expPosted, incTotal, incPosted, invTotal, invPosted] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as cnt FROM expenses`).then((r: any) => Number((r.rows || r)[0]?.cnt || 0)),
      db.execute(sql`SELECT COUNT(DISTINCT source_id) as cnt FROM journal_entries WHERE source_type='expense' AND status='POSTED'`).then((r: any) => Number((r.rows || r)[0]?.cnt || 0)),
      db.execute(sql`SELECT COUNT(*) as cnt FROM income_entries`).then((r: any) => Number((r.rows || r)[0]?.cnt || 0)),
      db.execute(sql`SELECT COUNT(DISTINCT source_id) as cnt FROM journal_entries WHERE source_type='income' AND status='POSTED'`).then((r: any) => Number((r.rows || r)[0]?.cnt || 0)),
      db.execute(sql`SELECT COUNT(*) as cnt FROM invoices WHERE status='PAID'`).then((r: any) => Number((r.rows || r)[0]?.cnt || 0)),
      db.execute(sql`SELECT COUNT(DISTINCT source_id) as cnt FROM journal_entries WHERE source_type='invoice' AND status='POSTED'`).then((r: any) => Number((r.rows || r)[0]?.cnt || 0)),
    ]).catch(() => [0,0,0,0,0,0]);

    res.json({
      expense: { total: expTotal, posted: expPosted, pending: expTotal - expPosted },
      income:  { total: incTotal, posted: incPosted, pending: incTotal - incPosted },
      invoice: { total: invTotal, posted: invPosted, pending: invTotal - invPosted },
      allSynced: expTotal === expPosted && incTotal === incPosted && invTotal === invPosted,
    });
  } catch (err) {
    console.error("[auto-post/status]", err);
    res.status(500).json({ error: "Gagal cek status" });
  }
});

export default router;