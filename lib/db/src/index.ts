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
  console.warn("⚠️ WARNING: DATABASE_URL belum terdeteksi saat inisialisasi modul.");
}

// Inisialisasi pool secara aman tanpa langsung throw error
export const pool = connectionString ? new Pool({ connectionString }) : null;

// Gunakan Proxy Fallback agar tidak memicu Fatal Crash 500 jika DB belum siap dibaca Vercel
export const db = pool
  ? drizzle(pool, { schema })
  : new Proxy({} as any, {
      get(target, prop) {
        return () => {
          throw new Error(`Database belum siap atau DATABASE_URL kosong. Gagal memanggil method .${String(prop)}()`);
        };
      }
    });

// Debug query jika DB_DEBUG aktif
if (process.env.DB_DEBUG === "true" && pool) {
  const origQuery = pool.query.bind(pool);
  // @ts-ignore
  pool.query = async function (text: any, params: any) {
    try {
      console.log("[db] QUERY:", typeof text === "string" ? text : (text && text.text) || text);
      console.log("[db] PARAMS:", params);
    } catch (e) {}
    // @ts-ignore
    return origQuery(text, params);
  };
  
  try {
    // @ts-ignore
    const origClientQuery = (pg.Client.prototype as any).query;
    // @ts-ignore
    pg.Client.prototype.query = function (config: any, values?: any, callback?: any) {
      try {
        if (typeof config === 'string') {
          console.log('[db][client] QUERY:', config);
          console.log('[db][client] PARAMS:', values);
        } else if (config && typeof config === 'object') {
          console.log('[db][client] QUERY:', config.text || config.name || config);
          console.log('[db][client] PARAMS:', config.values || values);
        }
      } catch (e) {}
      return origClientQuery.call(this, config, values, callback);
    };
  } catch (e) {}
}

// Ekspor kembali semuanya agar aman digunakan di tempat lain
export * from "./schema";