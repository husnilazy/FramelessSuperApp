// @workspace/db/src/index.ts
// Postgres via node-postgres. Target: Neon (pooled endpoint, `-pooler` di hostname).

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

// Neon wajib TLS dan memakai sertifikat publik valid → verifikasi tetap aktif.
// Postgres lokal (localhost) berjalan tanpa TLS. Host lain (mis. Supabase lama) tetap
// diterima dengan rejectUnauthorized=false agar rollback ke Supabase masih berfungsi.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
const isNeon = /\.neon\.tech/.test(connectionString);

// Di serverless (Vercel) tiap instance membuka pool sendiri; PgBouncer Neon yang
// mengurus koneksi sebenarnya, jadi pool per instance cukup kecil.
export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: isLocal ? false : isNeon ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

// Neon bisa menutup koneksi idle (scale-to-zero) → jangan biarkan crash proses.
pool?.on("error", (err) => {
  console.error("[db] idle client error:", err.message);
});

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
