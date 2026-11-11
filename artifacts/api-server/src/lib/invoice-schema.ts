import { pool } from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Menambah kolom invoice baru secara idempoten. Dijalankan sekali per instance
 * sebelum route /invoices dipakai, sehingga tidak perlu `drizzle-kit push` manual
 * ke database produksi. Aman dipanggil berulang (ADD COLUMN IF NOT EXISTS).
 */
let ready: Promise<void> | null = null;

export function ensureInvoiceColumns(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (!pool) return;
      // Cek read-only dulu: ALTER TABLE mengambil kunci tabel dan 1 round-trip tiap perintah, sia-sia bila kolom sudah lengkap.
      const need = [
        ["invoices", ["invoiceDate", "paymentTerms", "poNumber", "taxRate", "shipping"]],
        ["company_profile", ["bankName", "bankNumber", "bankHolder", "signerName", "logoDarkUrl"]],
      ] as const;
      const have = await pool.query(
        `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ANY($1)`,
        [need.map(([t]) => t)],
      ).catch(() => null);
      const present = new Set((have?.rows ?? []).map((r: any) => `${r.table_name}.${r.column_name}`));
      const complete = have !== null && need.every(([t, cols]) => cols.every((c) => present.has(`${t}.${c}`)));
      if (complete) return;
      await pool.query(`
        ALTER TABLE invoices
          ADD COLUMN IF NOT EXISTS "invoiceDate"  timestamp,
          ADD COLUMN IF NOT EXISTS "paymentTerms" text,
          ADD COLUMN IF NOT EXISTS "poNumber"     text,
          ADD COLUMN IF NOT EXISTS "taxRate"      numeric DEFAULT 11,
          ADD COLUMN IF NOT EXISTS "shipping"     numeric NOT NULL DEFAULT 0
      `);
      await pool.query(`
        ALTER TABLE company_profile
          ADD COLUMN IF NOT EXISTS "bankName"   text,
          ADD COLUMN IF NOT EXISTS "bankNumber" text,
          ADD COLUMN IF NOT EXISTS "bankHolder" text,
          ADD COLUMN IF NOT EXISTS "signerName" text,
          ADD COLUMN IF NOT EXISTS "logoDarkUrl" text
      `).catch((e) => logger.warn({ err: e?.message }, "company_profile.ensure_columns.skipped"));
    })().catch((err) => {
      ready = null; // coba lagi di request berikutnya
      logger.error({ err }, "invoices.ensure_columns.error");
      throw err;
    });
  }
  return ready;
}
