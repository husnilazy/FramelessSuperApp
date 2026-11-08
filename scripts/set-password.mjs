#!/usr/bin/env node
/**
 * Set / reset password user langsung di Neon.
 *   node scripts/set-password.mjs <email> <password-baru>
 * Memakai DATABASE_URL dari artifacts/api-server/.env (atau NEON_DATABASE_URL di scripts/migration.neon.env).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = (pkg) => createRequire(path.join(root, pkg, "package.json"));
const pg = req("lib/db")("pg");
const bcrypt = req("artifacts/api-server")("bcryptjs");

const parse = (file) => {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const l of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
};
const url = parse(path.join(root, "scripts/migration.neon.env")).NEON_DATABASE_URL || parse(path.join(root, "artifacts/api-server/.env")).DATABASE_URL;
const [email, password] = process.argv.slice(2);
if (!url || !email || !password) { console.error("Pakai: node scripts/set-password.mjs <email> <password-baru>"); process.exit(1); }
if (password.length < 8) { console.error("Password minimal 8 karakter"); process.exit(1); }

const pool = new pg.Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true } });
const hash = await bcrypt.hash(password, 10);
const r = await pool.query("UPDATE public.users SET password = $1, updated_at = now() WHERE lower(email) = lower($2)", [hash, email]);
console.log(r.rowCount ? `✓ password ${email} diperbarui` : `✗ user ${email} tidak ditemukan`);
await pool.end();
process.exit(r.rowCount ? 0 : 1);
