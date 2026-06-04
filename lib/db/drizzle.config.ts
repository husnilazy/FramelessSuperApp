// lib/db/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load local first, then .env.supabase to override for Supabase deployments
dotenv.config({ path: path.resolve(__dirname, "../../artifacts/api-server/.env") });
// Prefer .env.supabase for Supabase deployments if present
dotenv.config({ path: path.resolve(__dirname, ".env.supabase") });

export default defineConfig({
  schema:      "./src/schema/index.ts",
  dialect:     "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict:  false,
});