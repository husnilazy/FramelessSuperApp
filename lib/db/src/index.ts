import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Optional debug: when DB_DEBUG=true, log all queries and parameters to console
if (process.env.DB_DEBUG === "true") {
  const origQuery = pool.query.bind(pool);
  // @ts-ignore
  pool.query = async function (text: any, params: any) {
    try {
      console.log("[db] QUERY:", typeof text === "string" ? text : (text && text.text) || text);
      console.log("[db] PARAMS:", params);
    } catch (e) {
      // ignore logging errors
    }
    // forward to original
    // @ts-ignore
    return origQuery(text, params);
  };
  try {
    // also wrap Client.prototype.query to catch queries executed on client instances
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
      // call original
      return origClientQuery.call(this, config, values, callback);
    };
  } catch (e) {
    console.error('Failed to wrap pg.Client.prototype.query', e);
  }
}

export const db = drizzle(pool, { schema });

export * from "./schema";
