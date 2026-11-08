// lib/db/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATABASE_URL untuk drizzle-kit (push/migrate) HARUS memakai endpoint Neon *direct*
// (tanpa "-pooler"), karena DDL tidak cocok dengan PgBouncer transaction mode.
// Isi DATABASE_URL_DIRECT di .env bila DATABASE_URL Anda memakai pooler.
dotenv.config({ path: path.resolve(__dirname, "../../artifacts/api-server/.env") });
dotenv.config({ path: path.resolve(__dirname, ".env.neon"), override: true });

export default defineConfig({
  schema:      "./src/schema/index.ts",
  dialect:     "postgresql",
  dbCredentials: {
    url: (process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL)!,
  },
  verbose: true,
  strict:  false,
});