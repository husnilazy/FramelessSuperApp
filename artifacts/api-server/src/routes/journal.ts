// artifacts/frameless/src/server/routes/journal.ts
// General Journal — double-entry bookkeeping engine
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

// ── Ensure tables exist ───────────────────────────────────────────────────────
async function ensureTables() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id            TEXT        PRIMARY KEY,
        date          DATE        NOT NULL DEFAULT CURRENT_DATE,
        ref_number    TEXT        NOT NULL UNIQUE,   -- JNL-0001, INV-0001, EXP-0001
        type          TEXT        NOT NULL DEFAULT 'GENERAL', -- GENERAL|INVOICE|EXPENSE|ADJUSTMENT|DEPRECIATION
        description   TEXT        NOT NULL,
        source_type   TEXT,       -- invoice|expense|income|manual
        source_id     TEXT,       -- FK ke tabel asal (opsional)
        status        TEXT        NOT NULL DEFAULT 'POSTED', -- DRAFT|POSTED|VOID
        notes         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS journal_lines (
        id               TEXT        PRIMARY KEY,
        journal_entry_id TEXT        NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id       TEXT        NOT NULL REFERENCES accounts(id),
        account_code     TEXT        NOT NULL,  -- denormalized for speed
        account_name     TEXT        NOT NULL,  -- denormalized for display
        description      TEXT,
        debit            NUMERIC     NOT NULL DEFAULT 0,
        credit           NUMERIC     NOT NULL DEFAULT 0,
        sort_order       INTEGER     NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Index untuk performa query buku besar
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id)
    `);
  } catch (e) {
    console.warn("[journal] ensureTables warn:", e);
  }
}
ensureTables();

// ── Helpers ───────────────────────────────────────────────────────────────────
function mapEntry(r: any, lines?: any[]) {
  return {
    id:          r.id,
    date:        r.date,
    refNumber:   r.ref_number || r.refNumber,
    type:        r.type,
    description: r.description,
    sourceType:  r.source_type || r.sourceType || null,
    sourceId:    r.source_id || r.sourceId || null,
    status:      r.status,
    notes:       r.notes || null,
    totalDebit:  Number(r.total_debit || 0),
    totalCredit: Number(r.total_credit || 0),
    createdAt:   r.created_at || r.createdAt,
    ...(lines !== undefined && { lines: lines.map(mapLine) }),
  };
}

function mapLine(r: any) {
  return {
    id:             r.id,
    journalEntryId: r.journal_entry_id || r.journalEntryId,
    accountId:      r.account_id || r.accountId,
    accountCode:    r.account_code || r.accountCode,
    accountName:    r.account_name || r.accountName,
    description:    r.description || null,
    debit:          Number(r.debit || 0),
    credit:         Number(r.credit || 0),
    sortOrder:      Number(r.sort_order ?? r.sortOrder ?? 0),
  };
}

async function getNextRefNumber(type: string): Promise<string> {
  const prefix = type === "INVOICE" ? "JNL-INV" : type === "EXPENSE" ? "JNL-EXP" : type === "ADJUSTMENT" ? "JNL-ADJ" : type === "DEPRECIATION" ? "JNL-DEP" : "JNL";
  const result = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM journal_entries WHERE type = ${type}
  `);
  const cnt = Number((result as any).rows?.[0]?.cnt || 0);
  return `${prefix}-${String(cnt + 1).padStart(4, "0")}`;
}

async function getAccountByCode(code: string) {
  const result = await db.execute(sql`
    SELECT * FROM accounts WHERE code = ${code} LIMIT 1
  `);
  const rows = (result as any).rows || result;
  return Array.isArray(rows) ? rows[0] : null;
}

// ── POST /journal — buat jurnal entry baru (manual) ──────────────────────────
router.post("/journal", async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, type = "GENERAL", description, notes, lines, status = "POSTED" } = req.body ?? {};

    if (!description || !Array.isArray(lines) || lines.length < 2) {
      res.status(400).json({ error: "Deskripsi dan minimal 2 baris (debit+kredit) wajib diisi" });
      return;
    }

    // Validasi: total debit harus = total kredit
    const totalDebit  = lines.reduce((s: number, l: any) => s + Number(l.debit  || 0), 0);
    const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      res.status(400).json({ error: `Jumlah debit (${totalDebit}) tidak sama dengan kredit (${totalCredit})` });
      return;
    }

    const id        = crypto.randomUUID();
    const refNumber = await getNextRefNumber(String(type));
    const entryDate = date ? new Date(date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    await db.execute(sql`
      INSERT INTO journal_entries (id, date, ref_number, type, description, status, notes)
      VALUES (${id}, ${entryDate}::date, ${refNumber}, ${String(type)}, ${String(description)}, ${String(status)}, ${notes ? String(notes) : null})
    `);

    // Insert lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Resolve account info
      const acct = await getAccountByCode(String(line.accountCode || ""));
      if (!acct) {
        res.status(400).json({ error: `Akun dengan kode ${line.accountCode} tidak ditemukan` });
        return;
      }
      await db.execute(sql`
        INSERT INTO journal_lines (id, journal_entry_id, account_id, account_code, account_name, description, debit, credit, sort_order)
        VALUES (
          ${crypto.randomUUID()},
          ${id},
          ${acct.id},
          ${acct.code},
          ${acct.name},
          ${line.description ? String(line.description) : null},
          ${Number(line.debit || 0)},
          ${Number(line.credit || 0)},
          ${i}
        )
      `);
    }

    // Fetch created entry with lines
    const entryResult = await db.execute(sql`SELECT * FROM journal_entries WHERE id = ${id} LIMIT 1`);
    const entryRows = (entryResult as any).rows || entryResult;
    const linesResult = await db.execute(sql`SELECT * FROM journal_lines WHERE journal_entry_id = ${id} ORDER BY sort_order`);
    const lineRows = (linesResult as any).rows || linesResult;

    res.status(201).json(mapEntry(Array.isArray(entryRows) ? entryRows[0] : entryRows, Array.isArray(lineRows) ? lineRows : []));
  } catch (err) {
    console.error("[journal POST]", err);
    res.status(500).json({ error: "Gagal membuat jurnal" });
  }
});

// ── GET /journal — list semua jurnal entries ──────────────────────────────────
router.get("/journal", async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, type, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    let where = "WHERE 1=1";
    if (from)   where += ` AND je.date >= '${from}'`;
    if (to)     where += ` AND je.date <= '${to}'`;
    if (type)   where += ` AND je.type = '${type}'`;
    if (status) where += ` AND je.status = '${status}'`;

    const result = await db.execute(sql.raw(`
      SELECT
        je.*,
        COALESCE(SUM(jl.debit), 0)  AS total_debit,
        COALESCE(SUM(jl.credit), 0) AS total_credit
      FROM journal_entries je
      LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
      ${where}
      GROUP BY je.id
      ORDER BY je.date DESC, je.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `));
    const rows = (result as any).rows || result;
    res.json(Array.isArray(rows) ? rows.map(r => mapEntry(r)) : []);
  } catch (err) {
    console.error("[journal GET]", err);
    res.status(500).json({ error: "Gagal mengambil jurnal" });
  }
});

// ── GET /journal/:id ──────────────────────────────────────────────────────────
router.get("/journal/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const entryResult = await db.execute(sql`
      SELECT je.*,
        COALESCE(SUM(jl.debit), 0)  AS total_debit,
        COALESCE(SUM(jl.credit), 0) AS total_credit
      FROM journal_entries je
      LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
      WHERE je.id = ${req.params.id}
      GROUP BY je.id
      LIMIT 1
    `);
    const entryRows = (entryResult as any).rows || entryResult;
    const entry = Array.isArray(entryRows) ? entryRows[0] : null;
    if (!entry) { res.status(404).json({ error: "Jurnal tidak ditemukan" }); return; }

    const linesResult = await db.execute(sql`
      SELECT * FROM journal_lines WHERE journal_entry_id = ${req.params.id} ORDER BY sort_order
    `);
    const lineRows = (linesResult as any).rows || linesResult;
    res.json(mapEntry(entry, Array.isArray(lineRows) ? lineRows : []));
  } catch (err) {
    console.error("[journal GET/:id]", err);
    res.status(500).json({ error: "Gagal mengambil jurnal" });
  }
});

// ── DELETE /journal/:id — void jurnal (tidak hapus fisik) ─────────────────────
router.delete("/journal/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    // Cek apakah auto-generated dari invoice/expense — jangan void manual
    const check = await db.execute(sql`
      SELECT source_type, status FROM journal_entries WHERE id = ${req.params.id} LIMIT 1
    `);
    const rows = (check as any).rows || check;
    const entry = Array.isArray(rows) ? rows[0] : null;
    if (!entry) { res.status(404).json({ error: "Jurnal tidak ditemukan" }); return; }
    if (entry.status === "VOID") { res.status(409).json({ error: "Jurnal sudah divoid" }); return; }

    await db.execute(sql`
      UPDATE journal_entries SET status = 'VOID', updated_at = NOW() WHERE id = ${req.params.id}
    `);
    res.json({ success: true, message: "Jurnal berhasil divoid" });
  } catch (err) {
    console.error("[journal DELETE]", err);
    res.status(500).json({ error: "Gagal memvoid jurnal" });
  }
});

// ── GET /ledger — Buku Besar per akun ────────────────────────────────────────
router.get("/ledger", async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountCode, from, to } = req.query as Record<string, string>;
    let dateFilter = "AND je.status = 'POSTED'";
    if (from) dateFilter += ` AND je.date >= '${from}'`;
    if (to)   dateFilter += ` AND je.date <= '${to}'`;
    let accountFilter = "";
    if (accountCode) accountFilter = `AND a.code = '${accountCode}'`;

    const result = await db.execute(sql.raw(`
      SELECT
        a.code        AS account_code,
        a.name        AS account_name,
        a.type        AS account_type,
        a.normal_balance,
        COALESCE(SUM(jl.debit), 0)   AS total_debit,
        COALESCE(SUM(jl.credit), 0)  AS total_credit,
        CASE
          WHEN a.normal_balance = 'DEBIT'
          THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
          ELSE COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
        END AS balance
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id ${dateFilter}
      WHERE a.is_active = true ${accountFilter}
      GROUP BY a.id, a.code, a.name, a.type, a.normal_balance
      ORDER BY a.code
    `));
    const rows = (result as any).rows || result;
    res.json(Array.isArray(rows) ? rows.map((r: any) => ({
      accountCode:   r.account_code,
      accountName:   r.account_name,
      accountType:   r.account_type,
      normalBalance: r.normal_balance,
      totalDebit:    Number(r.total_debit),
      totalCredit:   Number(r.total_credit),
      balance:       Number(r.balance),
    })) : []);
  } catch (err) {
    console.error("[ledger GET]", err);
    res.status(500).json({ error: "Gagal mengambil buku besar" });
  }
});

// ── GET /ledger/:accountCode/transactions — detail transaksi per akun ─────────
router.get("/ledger/:accountCode/transactions", async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as Record<string, string>;
    let dateFilter = "AND je.status = 'POSTED'";
    if (from) dateFilter += ` AND je.date >= '${from}'`;
    if (to)   dateFilter += ` AND je.date <= '${to}'`;

    const result = await db.execute(sql.raw(`
      SELECT
        je.date,
        je.ref_number,
        je.description AS entry_description,
        jl.description AS line_description,
        jl.debit,
        jl.credit,
        a.normal_balance
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      WHERE a.code = '${req.params.accountCode}' ${dateFilter}
      ORDER BY je.date ASC, je.created_at ASC
    `));
    const rows = (result as any).rows || result;

    // Hitung running balance
    let runningBalance = 0;
    const transactions = (Array.isArray(rows) ? rows : []).map((r: any) => {
      const debit  = Number(r.debit  || 0);
      const credit = Number(r.credit || 0);
      if (r.normal_balance === "DEBIT") {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }
      return {
        date:        r.date,
        refNumber:   r.ref_number,
        description: r.line_description || r.entry_description,
        debit,
        credit,
        balance:     runningBalance,
      };
    });
    res.json(transactions);
  } catch (err) {
    console.error("[ledger transactions]", err);
    res.status(500).json({ error: "Gagal mengambil transaksi buku besar" });
  }
});

// ── GET /trial-balance ─────────────────────────────────────────────────────────
router.get("/trial-balance", async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as Record<string, string>;
    let dateFilter = "WHERE je.status = 'POSTED'";
    if (from) dateFilter += ` AND je.date >= '${from}'`;
    if (to)   dateFilter += ` AND je.date <= '${to}'`;

    const result = await db.execute(sql.raw(`
      SELECT
        a.code, a.name, a.type, a.sub_type, a.normal_balance,
        COALESCE(SUM(jl.debit), 0)  AS total_debit,
        COALESCE(SUM(jl.credit), 0) AS total_credit,
        CASE
          WHEN a.normal_balance = 'DEBIT'
          THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
          ELSE COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
        END AS balance
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
      ${dateFilter.replace("WHERE", "AND")}
      WHERE a.is_active = true
      GROUP BY a.id, a.code, a.name, a.type, a.sub_type, a.normal_balance
      HAVING COALESCE(SUM(jl.debit), 0) > 0 OR COALESCE(SUM(jl.credit), 0) > 0
      ORDER BY a.code
    `));
    const rows = (result as any).rows || result;

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      code:          r.code,
      name:          r.name,
      type:          r.type,
      subType:       r.sub_type,
      normalBalance: r.normal_balance,
      totalDebit:    Number(r.total_debit),
      totalCredit:   Number(r.total_credit),
      balance:       Number(r.balance),
    }));

    const grandDebit  = items.reduce((s, i) => s + i.totalDebit,  0);
    const grandCredit = items.reduce((s, i) => s + i.totalCredit, 0);
    const isBalanced  = Math.abs(grandDebit - grandCredit) < 0.01;

    res.json({ items, grandDebit, grandCredit, isBalanced });
  } catch (err: any) {
    // If journal_lines table doesn't exist yet, return empty
    if (err.message?.includes("does not exist")) {
      res.json({ items: [], grandDebit: 0, grandCredit: 0, isBalanced: true });
      return;
    }
    console.error("[trial-balance]", err);
    res.status(500).json({ error: "Gagal mengambil neraca saldo" });
  }
});

// ── GET /financial-statements — Laba Rugi & Neraca ───────────────────────────
router.get("/financial-statements", async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query as Record<string, string>;
    let dateFilter = "AND je.status = 'POSTED'";
    if (from) dateFilter += ` AND je.date >= '${from}'`;
    if (to)   dateFilter += ` AND je.date <= '${to}'`;

    const result = await db.execute(sql.raw(`
      SELECT
        a.code, a.name, a.type, a.sub_type,
        COALESCE(SUM(
          CASE WHEN a.normal_balance = 'DEBIT' THEN jl.debit - jl.credit
               ELSE jl.credit - jl.debit END
        ), 0) AS balance
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id ${dateFilter}
      WHERE a.is_active = true
      GROUP BY a.id, a.code, a.name, a.type, a.sub_type
      ORDER BY a.code
    `));
    const rows = (result as any).rows || result;
    const accounts = Array.isArray(rows) ? rows : [];

    // ── Income Statement (Laba Rugi) ──
    const revenues = accounts.filter((a: any) => a.type === "REVENUE");
    const expenses = accounts.filter((a: any) => a.type === "EXPENSE");
    const totalRevenue  = revenues.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const totalExpenses = expenses.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const netIncome     = totalRevenue - totalExpenses;

    // ── Balance Sheet (Neraca) ──
    const assets      = accounts.filter((a: any) => a.type === "ASSET");
    const liabilities = accounts.filter((a: any) => a.type === "LIABILITY");
    const equity      = accounts.filter((a: any) => a.type === "EQUITY");
    const totalAssets       = assets.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const totalLiabilities  = liabilities.reduce((s: number, a: any) => s + Number(a.balance), 0);
    const totalEquity        = equity.reduce((s: number, a: any) => s + Number(a.balance), 0);

    res.json({
      incomeStatement: {
        revenues:      revenues.map((a: any) => ({ code: a.code, name: a.name, subType: a.sub_type, balance: Number(a.balance) })),
        expenses:      expenses.map((a: any) => ({ code: a.code, name: a.name, subType: a.sub_type, balance: Number(a.balance) })),
        totalRevenue, totalExpenses, netIncome,
        grossMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
      },
      balanceSheet: {
        assets:      assets.map((a: any) => ({ code: a.code, name: a.name, subType: a.sub_type, balance: Number(a.balance) })),
        liabilities: liabilities.map((a: any) => ({ code: a.code, name: a.name, subType: a.sub_type, balance: Number(a.balance) })),
        equity:      equity.map((a: any) => ({ code: a.code, name: a.name, subType: a.sub_type, balance: Number(a.balance) })),
        totalAssets, totalLiabilities, totalEquity,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 1,
      },
    });
  } catch (err: any) {
    if (err.message?.includes("does not exist")) {
      res.json({
        incomeStatement: { revenues: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netIncome: 0, grossMargin: 0 },
        balanceSheet: { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0, isBalanced: true },
      });
      return;
    }
    console.error("[financial-statements]", err);
    res.status(500).json({ error: "Gagal mengambil laporan keuangan" });
  }
});

// ── POST /journal/auto-post — auto posting dari invoice/expense ───────────────
// Dipanggil dari invoice payment callback dan expense creation
router.post("/journal/auto-post", async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceType, sourceId, date, amount, description, accountMappings } = req.body ?? {};
    if (!sourceType || !amount || !accountMappings?.debit || !accountMappings?.credit) {
      res.status(400).json({ error: "sourceType, amount, dan accountMappings wajib diisi" });
      return;
    }

    // Cek apakah sudah ada jurnal untuk source ini
    const existing = await db.execute(sql`
      SELECT id FROM journal_entries WHERE source_type = ${String(sourceType)} AND source_id = ${String(sourceId)} AND status != 'VOID' LIMIT 1
    `);
    const existRows = (existing as any).rows || existing;
    if (Array.isArray(existRows) && existRows.length > 0) {
      res.status(409).json({ error: "Jurnal untuk transaksi ini sudah ada", entryId: existRows[0].id });
      return;
    }

    const id        = crypto.randomUUID();
    const type      = sourceType === "invoice" ? "INVOICE" : sourceType === "expense" ? "EXPENSE" : "GENERAL";
    const refNumber = await getNextRefNumber(type);
    const entryDate = date ? new Date(date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    await db.execute(sql`
      INSERT INTO journal_entries (id, date, ref_number, type, description, source_type, source_id, status)
      VALUES (${id}, ${entryDate}::date, ${refNumber}, ${type}, ${String(description)}, ${String(sourceType)}, ${String(sourceId)}, 'POSTED')
    `);

    // Debit line
    const debitAcct = await getAccountByCode(String(accountMappings.debit));
    if (!debitAcct) { res.status(400).json({ error: `Akun debit ${accountMappings.debit} tidak ditemukan` }); return; }
    await db.execute(sql`
      INSERT INTO journal_lines (id, journal_entry_id, account_id, account_code, account_name, description, debit, credit, sort_order)
      VALUES (${crypto.randomUUID()}, ${id}, ${debitAcct.id}, ${debitAcct.code}, ${debitAcct.name}, ${String(description)}, ${Number(amount)}, 0, 0)
    `);

    // Credit line
    const creditAcct = await getAccountByCode(String(accountMappings.credit));
    if (!creditAcct) { res.status(400).json({ error: `Akun kredit ${accountMappings.credit} tidak ditemukan` }); return; }
    await db.execute(sql`
      INSERT INTO journal_lines (id, journal_entry_id, account_id, account_code, account_name, description, debit, credit, sort_order)
      VALUES (${crypto.randomUUID()}, ${id}, ${creditAcct.id}, ${creditAcct.code}, ${creditAcct.name}, ${String(description)}, 0, ${Number(amount)}, 1)
    `);

    res.status(201).json({ success: true, entryId: id, refNumber });
  } catch (err) {
    console.error("[journal/auto-post]", err);
    res.status(500).json({ error: "Gagal auto-posting jurnal" });
  }
});

export default router;