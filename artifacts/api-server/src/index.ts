// artifacts/api-server/src/index.ts
import app from "./app";
import { logger } from "./lib/logger";

import { fileURLToPath } from "url";
import path from "path";

// ── Load .env if present (dotenv optional) ─────────────────────────────────
// Works without dotenv too — just set env vars manually
try {
  const { config } = await import("dotenv");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // From dist/index.mjs -> api-server -> artifacts -> workspace root
  const envPath = path.resolve(__dirname, "../../../.env");
  config({ path: envPath });
} catch {
  // dotenv not installed — env vars must be set externally
}

// ── PORT: env var → default 8080 ──────────────────────────────────────────
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 8080;

if (Number.isNaN(port) || port <= 0) {
  logger.error(`Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

// ── Start server ───────────────────────────────────────────────────────────
app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, `✅ Frameless API Server listening on port ${port}`);
  logger.info(`   http://localhost:${port}/api`);
});