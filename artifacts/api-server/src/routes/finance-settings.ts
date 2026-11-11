import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Pengaturan keuangan sederhana (saldo awal). Dipasang di bawah prefix "/finance" → otomatis wajib admin (lihat routes/index.ts).
 * Dipakai tab Laporan Bulanan agar "Saldo tercatat" sebanding dengan buku kas (saldo awal + pemasukan − pengeluaran − pembelian alat).
 */
const router: IRouter = Router();

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS finance_settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

async function read() {
  await ensureTable();
  const all = rows(await db.execute(sql`SELECT key, value FROM finance_settings WHERE key IN ('opening_balance','opening_date')`));
  const map = new Map(all.map((r) => [r.key, r.value]));
  return {
    openingBalance: Number(map.get("opening_balance") ?? 0) || 0,
    // tanggal mulai pencatatan: pembelian alat sebelum tanggal ini dianggap aset awal (sudah termasuk saldo awal)
    openingDate: String(map.get("opening_date") ?? "2025-01-01"),
  };
}

router.get("/finance/settings", async (_req: Request, res: Response): Promise<void> => {
  try { res.json(await read()); }
  catch (e: any) { res.status(500).json({ error: e?.message || "Gagal memuat pengaturan keuangan" }); }
});

router.put("/finance/settings", async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTable();
    const bal = Number(req.body?.openingBalance);
    const date = String(req.body?.openingDate ?? "");
    if (!Number.isFinite(bal)) { res.status(400).json({ error: "Saldo awal tidak valid" }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) { res.status(400).json({ error: "Tanggal mulai tidak valid (YYYY-MM-DD)" }); return; }
    for (const [k, v] of [["opening_balance", String(Math.round(bal))], ["opening_date", date]] as const) {
      await db.execute(sql`
        INSERT INTO finance_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`);
    }
    res.json(await read());
  } catch (e: any) { res.status(500).json({ error: e?.message || "Gagal menyimpan pengaturan keuangan" }); }
});

export default router;
