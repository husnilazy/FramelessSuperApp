// artifacts/api-server/src/index.ts
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { fileURLToPath } from "url";
import path from "path";

// ── Load .env if present (dotenv optional) ─────────────────────────────────
try {
  const { config } = await import("dotenv");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, "../../../.env");
  config({ path: envPath });
} catch {
  // dotenv not installed — env vars must be set externally
}

// ── Export app untuk Vercel serverless ─────────────────────────────────────
export default app;

// ── Start server hanya di local dev ────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const rawPort = process.env.PORT;
  const port = rawPort ? Number(rawPort) : 8080;

  if (Number.isNaN(port) || port <= 0) {
    logger.error(`Invalid PORT value: "${rawPort}"`);
    process.exit(1);
  }

  app.listen(port, "0.0.0.0", () => {
    logger.info({ port }, `✅ Frameless API Server listening on port ${port}`);
    logger.info(`   http://localhost:${port}/api`);
  });
}
