// artifacts/frameless/src/server/routes/auto-poster.ts
// Auto-posting jurnal dari invoice payment, expense, income manual, dan depresiasi
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { resolveMapping } from "./account-mapping.js";
import {
  createDoubleEntry,
  postInvoiceJournal,
  postExpenseJournal,
  postIncomeJournal,
  postDepreciationJournal,
} from "../lib/journal-poster.js";

const router: IRouter = Router();


// ── POST /auto-post/invoice/:id ───────────────────────────────────────────────
router.post("/auto-post/invoice/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await postInvoiceJournal(String(req.params.id));
    if (!result.success && result.skipped) {
      res.status(409).json({ message: result.reason, skipped: true }); return;
    }
    if (!result.success) {
      res.status(400).json({ error: result.error }); return;
    }
    res.status(201).json({ success: true, entryId: result.entryId, refNumber: result.refNumber });
  } catch (err) {
    console.error("[auto-post/invoice]", err);
    res.status(500).json({ error: "Gagal auto-posting invoice" });
  }
});

// ── POST /auto-post/expense/:id ───────────────────────────────────────────────
router.post("/auto-post/expense/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await postExpenseJournal(String(req.params.id));
    if (!result.success && result.skipped) {
      res.status(409).json({ message: result.reason, skipped: true }); return;
    }
    if (!result.success) {
      res.status(400).json({ error: result.error }); return;
    }
    res.status(201).json({ success: true, entryId: result.entryId, refNumber: result.refNumber });
  } catch (err) {
    console.error("[auto-post/expense]", err);
    res.status(500).json({ error: "Gagal auto-posting pengeluaran" });
  }
});

// ── POST /auto-post/income/:id ────────────────────────────────────────────────
router.post("/auto-post/income/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await postIncomeJournal(String(req.params.id));
    if (!result.success && result.skipped) {
      res.status(409).json({ message: result.reason, skipped: true }); return;
    }
    if (!result.success) {
      res.status(400).json({ error: result.error }); return;
    }
    res.status(201).json({ success: true, entryId: result.entryId, refNumber: result.refNumber });
  } catch (err) {
    console.error("[auto-post/income]", err);
    res.status(500).json({ error: "Gagal auto-posting pemasukan" });
  }
});

// ── POST /auto-post/depreciation ─────────────────────────────────────────────
router.post("/auto-post/depreciation", async (req: Request, res: Response): Promise<void> => {
  try {
    const { periodDate } = req.body ?? {};
    const depDate = periodDate
      ? new Date(periodDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const eqResult  = await db.execute(sql`SELECT * FROM equipment ORDER BY name`);
    const eqRows    = (eqResult as any).rows || eqResult;
    const equipment = Array.isArray(eqRows) ? eqRows : [];

    if (equipment.length === 0) {
      res.json({ success: true, posted: 0, message: "Tidak ada aset terdaftar" });
      return;
    }

    const results: { name: string; monthly: number; result: any }[] = [];
    let totalPosted = 0;

    for (const eq of equipment) {
      const purchasePrice     = Number(eq.purchase_price || eq.purchasePrice || 0);
      const depreciationYears = Number(eq.depreciation_years || eq.depreciationYears || 5);
      if (purchasePrice <= 0) continue;

      const monthlyDep = Math.round(purchasePrice / (depreciationYears * 12));
      if (monthlyDep <= 0) continue;

      const result = await postDepreciationJournal(eq.id, monthlyDep, eq.name, depDate);
      results.push({ name: eq.name, monthly: monthlyDep, result });
      if (result.success) totalPosted++;
    }

    const totalDepreciation = results.reduce((s, r) => s + r.monthly, 0);
    res.json({
      success: true,
      posted:  totalPosted,
      skipped: results.length - totalPosted,
      totalDepreciation,
      periodDate: depDate,
      details: results.map(r => ({
        asset: r.name,
        monthlyDepreciation: r.monthly,
        ...(!r.result.success
          ? { skipped: r.result.skipped ?? false, reason: (r.result as any).reason ?? (r.result as any).error }
          : { entryId: r.result.entryId, refNumber: r.result.refNumber }),
      })),
    });
  } catch (err) {
    console.error("[auto-post/depreciation]", err);
    res.status(500).json({ error: "Gagal posting depresiasi" });
  }
});

// ── POST /auto-post/bulk-backfill ─────────────────────────────────────────────
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
          const r = await postExpenseJournal(row.id);
          if (!r.success && r.skipped) results.expense.skipped++;
          else if (r.success) results.expense.posted++;
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
          const r = await postIncomeJournal(row.id);
          if (!r.success && r.skipped) results.income.skipped++;
          else if (r.success) results.income.posted++;
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
          const r = await postInvoiceJournal(row.id);
          if (!r.success && r.skipped) results.invoice.skipped++;
          else if (r.success) results.invoice.posted++;
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