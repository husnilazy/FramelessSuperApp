// artifacts/frameless/src/server/lib/journal-poster.ts
// Core auto-posting logic — callable directly (no HTTP self-call needed).
// Import dan panggil dari invoices.ts, expenses.ts, income.ts, dll.
// Ini solusi untuk serverless environment (Vercel) di mana localhost self-call tidak bisa.

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

// ── Resolve account mapping ───────────────────────────────────────────────────
async function resolveMapping(
  mappingType: string,
  key: string
): Promise<{ debitCode: string; creditCode: string } | null> {
  try {
    const result = await db.execute(sql`
      SELECT debit_code, credit_code FROM account_mappings
      WHERE mapping_type = ${mappingType} AND key = ${key}
      LIMIT 1
    `);
    const rows = (result as any).rows || result;
    const row  = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return { debitCode: row.debit_code, creditCode: row.credit_code };
  } catch {
    return null;
  }
}

// ── Get account by code ───────────────────────────────────────────────────────
async function getAccount(code: string): Promise<{ id: string; name: string } | null> {
  try {
    const result = await db.execute(sql`
      SELECT id, name FROM accounts WHERE code = ${code} LIMIT 1
    `);
    const rows = (result as any).rows || result;
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch {
    return null;
  }
}

// ── Get next ref number ───────────────────────────────────────────────────────
async function getNextRef(type: string): Promise<string> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM journal_entries WHERE type = ${type}
    `);
    const cnt = Number((result as any).rows?.[0]?.cnt || 0);
    const prefix =
      type === "INVOICE"     ? "JNL-INV" :
      type === "EXPENSE"     ? "JNL-EXP" :
      type === "INCOME"      ? "JNL-INC" :
      type === "DEPRECIATION"? "JNL-DEP" : "JNL";
    return `${prefix}-${String(cnt + 1).padStart(4, "0")}`;
  } catch {
    return `JNL-${Date.now()}`;
  }
}

// ── Core: create one journal entry + debit + credit lines ─────────────────────
export type PostResult =
  | { success: true;  entryId: string; refNumber: string }
  | { success: false; skipped: true;  reason: string }
  | { success: false; skipped: false; error: string };

export async function createDoubleEntry(opts: {
  date:        string;
  type:        string;          // INVOICE | EXPENSE | INCOME | DEPRECIATION | GENERAL
  description: string;
  sourceType:  string;          // "invoice" | "expense" | "income" | "depreciation"
  sourceId:    string;          // unique per source record — prevents duplicates
  debitCode:   string;
  creditCode:  string;
  amount:      number;
  notes?:      string;
}): Promise<PostResult> {
  // ── Idempotency guard ────────────────────────────────────────────────────────
  try {
    const dup = await db.execute(sql`
      SELECT id FROM journal_entries
      WHERE source_type = ${opts.sourceType}
        AND source_id   = ${opts.sourceId}
        AND status     != 'VOID'
      LIMIT 1
    `);
    const dupRows = (dup as any).rows || dup;
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      return { success: false, skipped: true, reason: `Jurnal untuk ${opts.sourceType}/${opts.sourceId} sudah ada` };
    }
  } catch (e: any) {
    // journal_entries table may not exist yet on first deploy
    if (e?.message?.includes("does not exist")) {
      return { success: false, skipped: true, reason: "Tabel journal_entries belum ada — jalankan setup SQL dulu" };
    }
    throw e;
  }

  // ── Resolve accounts ─────────────────────────────────────────────────────────
  const debitAcct  = await getAccount(opts.debitCode);
  const creditAcct = await getAccount(opts.creditCode);

  if (!debitAcct) {
    return { success: false, skipped: false, error: `Akun debit ${opts.debitCode} tidak ditemukan di chart of accounts` };
  }
  if (!creditAcct) {
    return { success: false, skipped: false, error: `Akun kredit ${opts.creditCode} tidak ditemukan di chart of accounts` };
  }

  // ── Insert entry + lines ─────────────────────────────────────────────────────
  const id        = crypto.randomUUID();
  const refNumber = await getNextRef(opts.type);
  const entryDate = opts.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  await db.execute(sql`
    INSERT INTO journal_entries
      (id, date, ref_number, type, description, source_type, source_id, status, notes)
    VALUES
      (${id}, ${entryDate}::date, ${refNumber}, ${opts.type},
       ${opts.description}, ${opts.sourceType}, ${opts.sourceId},
       'POSTED', ${opts.notes ?? null})
  `);

  // Debit line
  await db.execute(sql`
    INSERT INTO journal_lines
      (id, journal_entry_id, account_id, account_code, account_name, description, debit, credit, sort_order)
    VALUES
      (${crypto.randomUUID()}, ${id}, ${debitAcct.id}, ${opts.debitCode},
       ${debitAcct.name}, ${opts.description}, ${opts.amount}, 0, 0)
  `);

  // Credit line
  await db.execute(sql`
    INSERT INTO journal_lines
      (id, journal_entry_id, account_id, account_code, account_name, description, debit, credit, sort_order)
    VALUES
      (${crypto.randomUUID()}, ${id}, ${creditAcct.id}, ${opts.creditCode},
       ${creditAcct.name}, ${opts.description}, 0, ${opts.amount}, 1)
  `);

  return { success: true, entryId: id, refNumber };
}

// ── Public helpers ────────────────────────────────────────────────────────────
// These are called directly from invoices.ts, expenses.ts, income.ts

export async function postInvoiceJournal(invoiceId: string): Promise<PostResult> {
  try {
    const invResult = await db.execute(sql`
      SELECT i.*, c.name AS client_name
      FROM invoices i
      LEFT JOIN clients c ON c.id = i."clientId"
      WHERE i.id = ${invoiceId}
      LIMIT 1
    `);
    const rows = (invResult as any).rows || invResult;
    const inv  = Array.isArray(rows) ? rows[0] : null;

    if (!inv) return { success: false, skipped: false, error: "Invoice tidak ditemukan" };
    if (inv.status !== "PAID") {
      return { success: false, skipped: true, reason: "Invoice belum PAID — skip" };
    }

    const paidAmount = Number(inv.paidAmount ?? inv.paid_amount ?? 0);
    if (paidAmount <= 0) return { success: false, skipped: true, reason: "paidAmount = 0, skip" };

    const mapping = await resolveMapping("default", "invoice_payment")
      ?? { debitCode: "1-1200", creditCode: "4-1000" };

    const refDate  = inv.paidAt ?? inv.paid_at ?? inv.updatedAt ?? inv.updated_at ?? new Date().toISOString();
    const invNum   = inv.number ?? invoiceId;
    const client   = inv.client_name ?? "Klien";

    return createDoubleEntry({
      date:        new Date(refDate).toISOString().slice(0, 10),
      type:        "INVOICE",
      description: `Pembayaran invoice ${invNum} — ${client}`,
      sourceType:  "invoice",
      sourceId:    invoiceId,
      debitCode:   mapping.debitCode,
      creditCode:  mapping.creditCode,
      amount:      paidAmount,
      notes:       `Invoice #${invNum}, Klien: ${client}`,
    });
  } catch (e: any) {
    return { success: false, skipped: false, error: e?.message ?? String(e) };
  }
}

export async function postExpenseJournal(expenseId: string): Promise<PostResult> {
  try {
    const result = await db.execute(sql`SELECT * FROM expenses WHERE id = ${expenseId} LIMIT 1`);
    const rows = (result as any).rows || result;
    const exp  = Array.isArray(rows) ? rows[0] : null;

    if (!exp) return { success: false, skipped: false, error: "Expense tidak ditemukan" };

    const amount   = Number(exp.amount ?? 0);
    if (amount <= 0) return { success: false, skipped: true, reason: "amount = 0, skip" };

    const category = exp.category ?? "Lainnya";
    const mapping  = await resolveMapping("expense_category", category)
      ?? { debitCode: "6-9000", creditCode: "1-1200" };

    const expDate  = exp.date
      ? new Date(exp.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    return createDoubleEntry({
      date:        expDate,
      type:        "EXPENSE",
      description: `${exp.description} [${category}]`,
      sourceType:  "expense",
      sourceId:    expenseId,
      debitCode:   mapping.debitCode,
      creditCode:  mapping.creditCode,
      amount,
    });
  } catch (e: any) {
    return { success: false, skipped: false, error: e?.message ?? String(e) };
  }
}

export async function postIncomeJournal(incomeId: string): Promise<PostResult> {
  try {
    const result = await db.execute(sql`SELECT * FROM income_entries WHERE id = ${incomeId} LIMIT 1`);
    const rows = (result as any).rows || result;
    const inc  = Array.isArray(rows) ? rows[0] : null;

    if (!inc) return { success: false, skipped: false, error: "Income entry tidak ditemukan" };

    const amount   = Number(inc.amount ?? 0);
    if (amount <= 0) return { success: false, skipped: true, reason: "amount = 0, skip" };

    const category = inc.category ?? "Manual";
    const mapping  = await resolveMapping("income_source", category)
      ?? { debitCode: "1-1200", creditCode: "4-9000" };

    const incDate  = inc.date
      ? new Date(inc.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    return createDoubleEntry({
      date:        incDate,
      type:        "INCOME",
      description: `${inc.description} [${category}]`,
      sourceType:  "income",
      sourceId:    incomeId,
      debitCode:   mapping.debitCode,
      creditCode:  mapping.creditCode,
      amount,
      notes:       inc.source ? `Sumber: ${inc.source}` : undefined,
    });
  } catch (e: any) {
    return { success: false, skipped: false, error: e?.message ?? String(e) };
  }
}

export async function postDepreciationJournal(
  equipmentId: string,
  monthlyAmount: number,
  assetName: string,
  periodDate: string
): Promise<PostResult> {
  const sourceId = `dep-${equipmentId}-${periodDate.slice(0, 7)}`;
  const mapping  = await resolveMapping("default", "depreciation_equipment")
    ?? { debitCode: "6-1000", creditCode: "1-5100" };

  return createDoubleEntry({
    date:        periodDate,
    type:        "DEPRECIATION",
    description: `Penyusutan ${assetName} — ${new Date(periodDate).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`,
    sourceType:  "depreciation",
    sourceId,
    debitCode:   mapping.debitCode,
    creditCode:  mapping.creditCode,
    amount:      monthlyAmount,
    notes:       `Aset: ${assetName}`,
  });
}