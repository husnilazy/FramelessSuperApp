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
