// artifacts/frameless/src/server/routes/accounts.ts
// Chart of Accounts — fondasi sistem akuntansi double-entry
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

// ── Ensure tables exist ───────────────────────────────────────────────────────
async function ensureTables() {
  try {
    // Account types: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    // Normal balance: ASSET+EXPENSE = Debit, LIABILITY+EQUITY+REVENUE = Credit
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id            TEXT        PRIMARY KEY,
        code          TEXT        NOT NULL UNIQUE,   -- e.g. "1-1100"
        name          TEXT        NOT NULL,
        type          TEXT        NOT NULL,           -- ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE
        sub_type      TEXT,                           -- e.g. "Current Asset", "Fixed Asset"
        normal_balance TEXT       NOT NULL,           -- DEBIT|CREDIT
        description   TEXT,
        is_active     BOOLEAN     NOT NULL DEFAULT true,
        is_system     BOOLEAN     NOT NULL DEFAULT false, -- system accounts can't be deleted
        parent_code   TEXT,                           -- for sub-accounts
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default Chart of Accounts for a Creative Production House
    // Only insert if table is empty
    const existing = await db.execute(sql`SELECT COUNT(*) as cnt FROM accounts`);
    const count = Number((existing as any).rows?.[0]?.cnt || 0);

    if (count === 0) {
      const defaultAccounts = [
        // ── ASET (1-xxxx) ───────────────────────────────────────
        ["1-1000", "Kas & Setara Kas",       "ASSET", "Current Asset",  "DEBIT",  "Uang tunai dan rekening bank", true],
        ["1-1100", "Kas Tunai",               "ASSET", "Current Asset",  "DEBIT",  "Uang kas di tangan", true],
        ["1-1200", "Bank BCA",                "ASSET", "Current Asset",  "DEBIT",  "Rekening Bank BCA", true],
        ["1-1300", "Bank Mandiri",            "ASSET", "Current Asset",  "DEBIT",  "Rekening Bank Mandiri", true],
        ["1-2000", "Piutang Usaha",           "ASSET", "Current Asset",  "DEBIT",  "Tagihan kepada klien atas jasa yang sudah diberikan", true],
        ["1-3000", "Perlengkapan",            "ASSET", "Current Asset",  "DEBIT",  "Perlengkapan kantor dan produksi yang belum terpakai", true],
        ["1-4000", "Biaya Dibayar Dimuka",    "ASSET", "Current Asset",  "DEBIT",  "Biaya yang sudah dibayar tapi belum menjadi beban", true],
        ["1-5000", "Peralatan Produksi",      "ASSET", "Fixed Asset",    "DEBIT",  "Kamera, drone, lighting, dan peralatan produksi lainnya", true],
        ["1-5100", "Akum. Penyusutan Alat",  "ASSET", "Fixed Asset",    "CREDIT", "Akumulasi penyusutan peralatan produksi", true],
        ["1-6000", "Komputer & Elektronik",   "ASSET", "Fixed Asset",    "DEBIT",  "Komputer, monitor, dan perangkat elektronik", true],
        ["1-6100", "Akum. Penyusutan Komp",  "ASSET", "Fixed Asset",    "CREDIT", "Akumulasi penyusutan komputer & elektronik", true],

        // ── KEWAJIBAN (2-xxxx) ──────────────────────────────────
        ["2-1000", "Hutang Usaha",            "LIABILITY", "Current Liability", "CREDIT", "Tagihan dari vendor/supplier yang belum dibayar", true],
        ["2-2000", "Hutang Pajak",            "LIABILITY", "Current Liability", "CREDIT", "PPh 21, PPh 23, PPN yang belum disetorkan", true],
        ["2-2100", "Hutang PPh 21",           "LIABILITY", "Current Liability", "CREDIT", "Pajak penghasilan karyawan yang dipotong", true],
        ["2-2200", "Hutang PPN",              "LIABILITY", "Current Liability", "CREDIT", "PPN yang dipungut dari klien", true],
        ["2-3000", "Pendapatan Diterima Dimuka", "LIABILITY", "Current Liability", "CREDIT", "DP/uang muka dari klien yang belum dikerjakan", true],

        // ── MODAL (3-xxxx) ──────────────────────────────────────
        ["3-1000", "Modal Pemilik",           "EQUITY", "Owner's Equity", "CREDIT", "Modal awal yang disetorkan pemilik", true],
        ["3-2000", "Laba Ditahan",            "EQUITY", "Retained Earnings", "CREDIT", "Akumulasi laba yang tidak dibagikan", true],
        ["3-3000", "Prive / Pengambilan",     "EQUITY", "Drawing",        "DEBIT",  "Pengambilan pribadi pemilik", true],

        // ── PENDAPATAN (4-xxxx) ─────────────────────────────────
        ["4-1000", "Pendapatan Jasa Produksi", "REVENUE", "Operating Revenue", "CREDIT", "Pendapatan dari produksi video & film", true],
        ["4-1100", "Pendapatan Video Klip",   "REVENUE", "Operating Revenue", "CREDIT", "Pendapatan produksi video klip musik", true],
        ["4-1200", "Pendapatan Video Iklan",  "REVENUE", "Operating Revenue", "CREDIT", "Pendapatan produksi iklan/commercial", true],
        ["4-1300", "Pendapatan Dokumentasi",  "REVENUE", "Operating Revenue", "CREDIT", "Pendapatan dokumentasi event & wedding", true],
        ["4-2000", "Pendapatan Jasa Editing", "REVENUE", "Operating Revenue", "CREDIT", "Pendapatan dari editing & post-production", true],
        ["4-3000", "Pendapatan Sewa Alat",    "REVENUE", "Other Revenue",    "CREDIT", "Pendapatan dari sewa peralatan produksi", true],
        ["4-4000", "Pendapatan Kursus/Academy", "REVENUE", "Other Revenue",  "CREDIT", "Pendapatan dari Frameless Academy & kursus", true],
        ["4-9000", "Pendapatan Lain-lain",    "REVENUE", "Other Revenue",    "CREDIT", "Pendapatan di luar operasional utama", true],

        // ── BEBAN OPERASIONAL (5-xxxx) ──────────────────────────
        ["5-1000", "Beban Gaji & Honor",      "EXPENSE", "Operating Expense", "DEBIT", "Gaji karyawan tetap dan honor freelance", true],
        ["5-1100", "Beban Gaji Karyawan",     "EXPENSE", "Operating Expense", "DEBIT", "Gaji karyawan tetap bulanan", true],
        ["5-1200", "Beban Honor Freelance",   "EXPENSE", "Operating Expense", "DEBIT", "Honor kameraman, editor, talent freelance", true],
        ["5-2000", "Beban Peralatan",         "EXPENSE", "Operating Expense", "DEBIT", "Pembelian aksesoris dan perlengkapan produksi", true],
        ["5-3000", "Beban Transportasi",      "EXPENSE", "Operating Expense", "DEBIT", "BBM, tol, parkir, transportasi produksi", true],
        ["5-4000", "Beban Akomodasi",         "EXPENSE", "Operating Expense", "DEBIT", "Hotel dan penginapan untuk produksi luar kota", true],
        ["5-5000", "Beban Makan & Minum",     "EXPENSE", "Operating Expense", "DEBIT", "Konsumsi kru dan talent selama produksi", true],
        ["5-6000", "Beban Utilitas",          "EXPENSE", "Operating Expense", "DEBIT", "Listrik, air, internet studio", true],
        ["5-6100", "Beban Listrik & Air",     "EXPENSE", "Operating Expense", "DEBIT", "Tagihan PLN dan PDAM", true],
        ["5-6200", "Beban Internet & Telepon","EXPENSE", "Operating Expense", "DEBIT", "Tagihan internet dan komunikasi", true],
        ["5-7000", "Beban Software & Langganan", "EXPENSE", "Operating Expense", "DEBIT", "Adobe CC, CapCut, tools digital", true],
        ["5-8000", "Beban Marketing",         "EXPENSE", "Operating Expense", "DEBIT", "Iklan digital, promosi, branding", true],
        ["5-9000", "Beban Sewa Tempat",       "EXPENSE", "Operating Expense", "DEBIT", "Sewa studio dan lokasi syuting", true],
        ["5-9100", "Beban Administrasi",      "EXPENSE", "Operating Expense", "DEBIT", "ATK, fotokopi, keperluan kantor", true],

        // ── BEBAN NON-OPERASIONAL (6-xxxx) ─────────────────────
        ["6-1000", "Beban Penyusutan",        "EXPENSE", "Non-Operating",   "DEBIT", "Penyusutan peralatan dan aset tetap", true],
        ["6-9000", "Beban Lain-lain",         "EXPENSE", "Non-Operating",   "DEBIT", "Beban di luar kegiatan operasional utama", true],
      ];

      for (const [code, name, type, sub_type, normal_balance, description, is_system] of defaultAccounts) {
        await db.execute(sql`
          INSERT INTO accounts (id, code, name, type, sub_type, normal_balance, description, is_system)
          VALUES (
            ${crypto.randomUUID()},
            ${code as string},
            ${name as string},
            ${type as string},
            ${sub_type as string},
            ${normal_balance as string},
            ${description as string},
            ${is_system as boolean}
          ) ON CONFLICT (code) DO NOTHING
        `);
      }
    }
  } catch (e) {
    console.warn("[accounts] ensureTables warn:", e);
  }
}
ensureTables();

// ── Helper ────────────────────────────────────────────────────────────────────
function mapAccount(r: any) {
  return {
    id:            r.id,
    code:          r.code,
    name:          r.name,
    type:          r.type,
    subType:       r.sub_type || r.subType || null,
    normalBalance: r.normal_balance || r.normalBalance,
    description:   r.description || null,
    isActive:      r.is_active ?? r.isActive ?? true,
    isSystem:      r.is_system ?? r.isSystem ?? false,
    parentCode:    r.parent_code || r.parentCode || null,
    createdAt:     r.created_at || r.createdAt || null,
  };
}

// ── GET /accounts ─────────────────────────────────────────────────────────────
router.get("/accounts", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM accounts WHERE is_active = true ORDER BY code ASC
    `);
    const rows = (result as any).rows || result;
    res.json(Array.isArray(rows) ? rows.map(mapAccount) : []);
  } catch (err) {
    console.error("[accounts GET]", err);
    res.status(500).json({ error: "Gagal mengambil daftar akun" });
  }
});

// ── GET /accounts/:id ─────────────────────────────────────────────────────────
router.get("/accounts/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM accounts WHERE id = ${req.params.id} LIMIT 1
    `);
    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) { res.status(404).json({ error: "Akun tidak ditemukan" }); return; }
    res.json(mapAccount(row));
  } catch (err) {
    console.error("[accounts GET/:id]", err);
    res.status(500).json({ error: "Gagal mengambil akun" });
  }
});

// ── POST /accounts ────────────────────────────────────────────────────────────
router.post("/accounts", async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, type, subType, normalBalance, description, parentCode } = req.body ?? {};
    if (!code || !name || !type || !normalBalance) {
      res.status(400).json({ error: "Kode, nama, tipe, dan saldo normal wajib diisi" });
      return;
    }
    const id = crypto.randomUUID();
    const result = await db.execute(sql`
      INSERT INTO accounts (id, code, name, type, sub_type, normal_balance, description, parent_code)
      VALUES (${id}, ${String(code)}, ${String(name)}, ${String(type)},
              ${subType ? String(subType) : null}, ${String(normalBalance)},
              ${description ? String(description) : null}, ${parentCode ? String(parentCode) : null})
      RETURNING *
    `);
    const rows = (result as any).rows || result;
    res.status(201).json(mapAccount(Array.isArray(rows) ? rows[0] : rows));
  } catch (err: any) {
    console.error("[accounts POST]", err);
    if (err.message?.includes("unique")) {
      res.status(409).json({ error: "Kode akun sudah digunakan" });
    } else {
      res.status(500).json({ error: "Gagal membuat akun" });
    }
  }
});

// ── PUT /accounts/:id ─────────────────────────────────────────────────────────
router.put("/accounts/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, subType, description, isActive } = req.body ?? {};
    const esc = (v: string) => v.replace(/'/g, "''");
    const sets: string[] = ["updated_at = NOW()"];
    if (name !== undefined)      sets.push(`name = '${esc(String(name))}'`);
    if (subType !== undefined)   sets.push(`sub_type = ${subType ? `'${esc(String(subType))}'` : "NULL"}`);
    if (description !== undefined) sets.push(`description = ${description ? `'${esc(String(description))}'` : "NULL"}`);
    if (isActive !== undefined)  sets.push(`is_active = ${Boolean(isActive)}`);

    const result = await db.execute(sql.raw(
      `UPDATE accounts SET ${sets.join(", ")} WHERE id = '${req.params.id}' AND is_system = false RETURNING *`
    ));
    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) { res.status(404).json({ error: "Akun tidak ditemukan atau tidak dapat diubah" }); return; }
    res.json(mapAccount(row));
  } catch (err) {
    console.error("[accounts PUT]", err);
    res.status(500).json({ error: "Gagal memperbarui akun" });
  }
});

// ── DELETE /accounts/:id ──────────────────────────────────────────────────────
router.delete("/accounts/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    // Cek apakah akun sudah punya transaksi
    const used = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM journal_lines WHERE account_id = ${req.params.id}
    `).catch(() => ({ rows: [{ cnt: 0 }] }));
    const cnt = Number((used as any).rows?.[0]?.cnt || 0);
    if (cnt > 0) {
      res.status(409).json({ error: "Akun tidak dapat dihapus karena sudah memiliki transaksi" });
      return;
    }
    await db.execute(sql.raw(
      `DELETE FROM accounts WHERE id = '${req.params.id}' AND is_system = false`
    ));
    res.json({ success: true });
  } catch (err) {
    console.error("[accounts DELETE]", err);
    res.status(500).json({ error: "Gagal menghapus akun" });
  }
});

// ── GET /accounts/:id/balance — saldo akun berdasarkan jurnal ─────────────────
router.get("/accounts/:id/balance", async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    let dateFilter = "";
    if (from) dateFilter += ` AND je.date >= '${from}'`;
    if (to)   dateFilter += ` AND je.date <= '${to}'`;

    const result = await db.execute(sql.raw(`
      SELECT
        a.id, a.code, a.name, a.normal_balance,
        COALESCE(SUM(jl.debit), 0)  AS total_debit,
        COALESCE(SUM(jl.credit), 0) AS total_credit,
        CASE
          WHEN a.normal_balance = 'DEBIT'
          THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
          ELSE COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
        END AS balance
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'POSTED'${dateFilter}
      WHERE a.id = '${req.params.id}'
      GROUP BY a.id, a.code, a.name, a.normal_balance
    `));
    const rows = (result as any).rows || result;
    res.json(Array.isArray(rows) ? rows[0] : rows);
  } catch (err) {
    console.error("[accounts/:id/balance]", err);
    res.status(500).json({ error: "Gagal menghitung saldo" });
  }
});

export default router;