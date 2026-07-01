// @workspace/db/src/index.ts
// UPDATED: Tambah export course-tracking schema

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Ambil koneksi string secara aman
const connectionString =
  process.env.DATABASE_URL ||
  process.env.NEXT_PUBLIC_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

if (!connectionString) {
  console.warn("⚠️  WARNING: DATABASE_URL belum terdeteksi saat inisialisasi modul.");
}

// Inisialisasi pool dengan SSL untuk Supabase
export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : null;

// Proxy Fallback agar tidak crash jika DB belum siap
export const db = pool
  ? drizzle(pool, { schema })
  : new Proxy({} as ReturnType<typeof drizzle>, {
      get(_target, prop) {
        return () => {
          throw new Error(
            `Database belum siap atau DATABASE_URL kosong. Gagal memanggil .${String(prop)}()`,
          );
        };
      },
    });

// Debug query jika DB_DEBUG=true
if (process.env.DB_DEBUG === "true" && pool) {
  const origQuery = pool.query.bind(pool);
  // @ts-ignore
  pool.query = async function (text: any, params: any) {
    try {
      const sql = typeof text === "string" ? text : text?.text ?? text;
      console.log("[db] QUERY:", sql);
      if (params) console.log("[db] PARAMS:", params);
    } catch {}
    // @ts-ignore
    return origQuery(text, params);
  };
}

// ─── Schema exports ────────────────────────────────────────────────────────────

export * from "./schema";
// Note: course-tracking (course_material_views, course_progress) dimanage
// via raw SQL (db.execute) karena tabel baru — tidak perlu Drizzle schema
// untuk sekarang, cukup query raw agar tidak break existing build