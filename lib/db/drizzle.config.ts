// lib/db/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema:      "./src/schema/index.ts",
  dialect:     "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict:  false,
});