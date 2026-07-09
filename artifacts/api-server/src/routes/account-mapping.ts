// artifacts/frameless/src/server/routes/account-mapping.ts
// Pemetaan akun otomatis: expense category → account code, dll.
// Dipanggil oleh auto-poster setiap kali invoice dibayar atau expense dibuat.
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

// ── Ensure table ──────────────────────────────────────────────────────────────
async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS account_mappings (
        id            TEXT  PRIMARY KEY,
        mapping_type  TEXT  NOT NULL,   -- expense_category|income_source|default
        key           TEXT  NOT NULL,   -- e.g. "Gaji & Honor", "invoice_payment"
        debit_code    TEXT  NOT NULL,   -- account code to debit
        credit_code   TEXT  NOT NULL,   -- account code to credit
        description   TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(mapping_type, key)
      )
    `);

    // Seed default mappings
    const existing = await db.execute(sql`SELECT COUNT(*) as cnt FROM account_mappings`);
    const count = Number((existing as any).rows?.[0]?.cnt || 0);

    if (count === 0) {
      const defaults = [
        // ── Invoice payments → Kas masuk / Pendapatan ──────────────────────────
        // Ketika invoice dibayar lunas: Debit Kas (1-1200), Kredit Pendapatan Jasa (4-1000)
        ["default",           "invoice_payment",      "1-1200", "4-1000", "Pembayaran invoice dari klien"],
        ["default",           "invoice_dp",           "1-1200", "2-3000", "DP/uang muka dari klien → Pendapatan Diterima Dimuka"],
        ["default",           "invoice_piutang",      "1-2000", "4-1000", "Penagihan invoice → catat piutang usaha"],

        // ── Expense categories → Beban akun ────────────────────────────────────
        // Ketika expense dicatat: Debit Beban, Kredit Kas
        ["expense_category",  "Gaji & Honor",         "5-1000", "1-1200", "Pembayaran gaji dan honor freelance"],
        ["expense_category",  "Peralatan",             "5-2000", "1-1200", "Pembelian peralatan produksi"],
        ["expense_category",  "Transportasi",          "5-3000", "1-1200", "Biaya transportasi produksi"],
        ["expense_category",  "Akomodasi",             "5-4000", "1-1200", "Biaya akomodasi produksi"],
        ["expense_category",  "Makan & Minum",         "5-5000", "1-1200", "Konsumsi produksi"],
        ["expense_category",  "Utilitas",              "5-6000", "1-1200", "Biaya listrik, air, dan utilitas"],
        ["expense_category",  "Software & Langganan",  "5-7000", "1-1200", "Langganan software dan tools digital"],
        ["expense_category",  "Marketing",             "5-8000", "1-1200", "Biaya marketing dan promosi"],
        ["expense_category",  "Sewa Tempat",           "5-9000", "1-1200", "Biaya sewa studio dan lokasi"],
        ["expense_category",  "Komunikasi",            "5-6200", "1-1200", "Biaya internet dan telepon"],
        ["expense_category",  "Administrasi",          "5-9100", "1-1200", "Biaya administrasi dan ATK"],
        ["expense_category",  "Lainnya",               "6-9000", "1-1200", "Beban lain-lain"],

        // ── Manual income ───────────────────────────────────────────────────────
        ["income_source",     "Jasa Produksi",         "1-1200", "4-1000", "Pendapatan jasa produksi manual"],
        ["income_source",     "Jasa Editing",          "1-1200", "4-2000", "Pendapatan jasa editing"],
        ["income_source",     "Sewa Alat",             "1-1200", "4-3000", "Pendapatan sewa peralatan"],
        ["income_source",     "Royalti",               "1-1200", "4-9000", "Royalti dan pendapatan lain"],
        ["income_source",     "Konsultasi",            "1-1200", "4-1000", "Pendapatan konsultasi"],
        ["income_source",     "Manual",                "1-1200", "4-9000", "Pemasukan manual umum"],

        // ── Depreciation ────────────────────────────────────────────────────────
        ["default",           "depreciation_equipment","6-1000", "1-5100", "Penyusutan peralatan produksi"],
        ["default",           "depreciation_computer", "6-1000", "1-6100", "Penyusutan komputer & elektronik"],
      ];

      for (const [mapping_type, key, debit_code, credit_code, description] of defaults) {
        await db.execute(sql`
          INSERT INTO account_mappings (id, mapping_type, key, debit_code, credit_code, description)
          VALUES (
            ${crypto.randomUUID()},
            ${mapping_type as string},
            ${key as string},
            ${debit_code as string},
            ${credit_code as string},
            ${description as string}
          ) ON CONFLICT (mapping_type, key) DO NOTHING
        `);
      }
    }
  } catch (e) {
    console.warn("[account-mapping] ensureTable:", e);
  }
}
ensureTable();

// ── GET /account-mappings ─────────────────────────────────────────────────────
router.get("/account-mappings", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT am.*, 
        da.name AS debit_name,
        ca.name AS credit_name
      FROM account_mappings am
      LEFT JOIN accounts da ON da.code = am.debit_code
      LEFT JOIN accounts ca ON ca.code = am.credit_code
      ORDER BY am.mapping_type, am.key
    `);
    const rows = (result as any).rows || result;
    res.json(Array.isArray(rows) ? rows.map((r: any) => ({
      id:          r.id,
      mappingType: r.mapping_type,
      key:         r.key,
      debitCode:   r.debit_code,
      debitName:   r.debit_name || r.debit_code,
      creditCode:  r.credit_code,
      creditName:  r.credit_name || r.credit_code,
      description: r.description,
    })) : []);
  } catch (err) {
    console.error("[account-mappings GET]", err);
    res.status(500).json({ error: "Gagal mengambil pemetaan akun" });
  }
});

// ── PUT /account-mappings/:id — update satu mapping ──────────────────────────
router.put("/account-mappings/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { debitCode, creditCode, description } = req.body ?? {};
    const esc = (v: string) => v.replace(/'/g, "''");
    const sets: string[] = [];
    if (debitCode)   sets.push(`debit_code = '${esc(String(debitCode))}'`);
    if (creditCode)  sets.push(`credit_code = '${esc(String(creditCode))}'`);
    if (description !== undefined) sets.push(`description = '${esc(String(description))}'`);
    if (sets.length === 0) { res.status(400).json({ error: "Tidak ada yang diubah" }); return; }

    const result = await db.execute(sql.raw(
      `UPDATE account_mappings SET ${sets.join(", ")} WHERE id = '${req.params.id}' RETURNING *`
    ));
    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) { res.status(404).json({ error: "Pemetaan tidak ditemukan" }); return; }
    res.json({ id: row.id, debitCode: row.debit_code, creditCode: row.credit_code });
  } catch (err) {
    console.error("[account-mappings PUT]", err);
    res.status(500).json({ error: "Gagal memperbarui pemetaan" });
  }
});

// ── Helper: resolve mapping untuk auto-poster ────────────────────────────────
// Exported untuk dipakai di auto-poster routes
export async function resolveMapping(mappingType: string, key: string): Promise<{ debitCode: string; creditCode: string } | null> {
  try {
    const result = await db.execute(sql`
      SELECT debit_code, credit_code FROM account_mappings
      WHERE mapping_type = ${mappingType} AND key = ${key}
      LIMIT 1
    `);
    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return { debitCode: row.debit_code, creditCode: row.credit_code };
  } catch {
    return null;
  }
}

export default router;