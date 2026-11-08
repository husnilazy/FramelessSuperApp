#!/usr/bin/env node
/**
 * Migrasi database Supabase (schema public) → Neon.
 *
 *   node scripts/migrate-to-neon.mjs plan     # cek saja, TIDAK menulis apa pun (juga menulis scripts/migration.neon.plan.sql)
 *   node scripts/migrate-to-neon.mjs all      # schema → data → auth → verify
 *   node scripts/migrate-to-neon.mjs auth     # salin hash password bcrypt dari auth.users Supabase ke public.users.password (Neon)
 *   node scripts/migrate-to-neon.mjs schema|data|verify   # per tahap
 *
 * Konfigurasi:
 *  - SUMBER (Supabase) dibaca dari artifacts/api-server/.env  → DATABASE_URL
 *    (atau dari scripts/migration.neon.env → SOURCE_DATABASE_URL bila diisi).
 *  - TUJUAN (Neon) dibaca dari scripts/migration.neon.env (JANGAN di-commit):
 *        NEON_DATABASE_URL=postgresql://user:pass@ep-xxx.<region>.aws.neon.tech/neondb?sslmode=require
 *    Pakai endpoint *direct* (tanpa "-pooler") untuk migrasi.
 *
 * Aman: skrip HANYA MEMBACA dari Supabase. Tahap bisa diulang (idempoten):
 *  - schema dilewati bila Neon sudah punya tabel di schema public
 *  - data melewati tabel yang jumlah barisnya sudah sama, dan mengosongkan tabel yang tidak lengkap
 *
 * File storage dipindah terpisah: node scripts/migrate-storage-to-r2.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pg = createRequire(path.join(root, "lib/db/package.json"))("pg");

// ─── Config ─────────────────────────────────────────────────────────────────

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

// Setelah DATABASE_URL di .env dialihkan ke Neon, simpan kredensial Supabase lama di .env.old-supabase
const oldEnvFile = ["artifacts/api-server/.env.old-supabase", "artifacts/api-server/.env"]
  .map((f) => path.join(root, f))
  .find((f) => fs.existsSync(f));
const oldEnv = parseEnv(oldEnvFile);
const neonEnv = parseEnv(path.join(root, "scripts/migration.neon.env"));

const SRC = neonEnv.SOURCE_DATABASE_URL || oldEnv.DATABASE_URL;
const DST = neonEnv.NEON_DATABASE_URL;

const phase = process.argv[2] || "plan";
const PHASES = ["plan", "schema", "data", "auth", "verify", "all"];
if (!PHASES.includes(phase)) {
  console.error(`Tahap tidak dikenal: ${phase}\nPilihan: ${PHASES.join(" | ")}`);
  process.exit(1);
}

const hostOf = (u) => (u || "").replace(/^.*@/, "").replace(/[/?].*$/, "");

function requireConfig({ needDst }) {
  const missing = [];
  if (!SRC) missing.push("DATABASE_URL Supabase (artifacts/api-server/.env atau SOURCE_DATABASE_URL di scripts/migration.neon.env)");
  if (needDst && !DST) missing.push("NEON_DATABASE_URL (scripts/migration.neon.env)");
  if (missing.length) {
    console.error("Konfigurasi belum lengkap:\n - " + missing.join("\n - "));
    process.exit(1);
  }
  if (needDst) {
    if (hostOf(SRC) === hostOf(DST)) {
      console.error("Sumber dan tujuan menunjuk host yang sama — dibatalkan.");
      process.exit(1);
    }
    if (!/neon\.tech/.test(DST)) {
      console.error("NEON_DATABASE_URL bukan host *.neon.tech — dibatalkan agar tidak salah menulis ke database lain.");
      process.exit(1);
    }
    if (/-pooler\./.test(DST)) {
      console.warn("⚠️  NEON_DATABASE_URL memakai endpoint pooler. Disarankan endpoint direct (tanpa '-pooler') untuk migrasi.");
    }
  }
}

// Kembalikan nilai mentah (string) agar timestamp/numeric/json/array tidak berubah saat dipindah.
const RAW_OIDS = [1082, 1083, 1114, 1184, 1186, 1700, 114, 3802, 1182, 1115, 1185, 1231, 199, 3807, 1266, 1270];
for (const oid of RAW_OIDS) pg.types.setTypeParser(oid, (v) => v);

const mkPool = (url, ssl) => new pg.Pool({ connectionString: url, ssl, max: 4 });
const srcPool = () => mkPool(SRC, { rejectUnauthorized: false }); // Supabase
const dstPool = () => mkPool(DST, { rejectUnauthorized: true }); // Neon (sertifikat publik valid)
const q = (pool, sql, params) => pool.query(sql, params).then((r) => r.rows);
const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;
const log = (...a) => console.log(...a);

// ─── Schema introspection (schema public) ───────────────────────────────────

// Ekstensi bawaan Supabase yang tidak ada / tidak relevan di Neon
const SKIP_EXT = ["plpgsql", "pg_stat_statements", "supabase_vault", "pg_graphql", "pgsodium", "pg_net", "pgjwt", "pg_cron"];

/** Hapus kualifikasi schema khusus Supabase dari definisi (mis. extensions.uuid_generate_v4()). */
const clean = (s) => (s == null ? s : String(s).replace(/\bextensions\./g, "").replace(/\bpublic\./g, "public."));
/** True bila definisi merujuk objek schema Supabase yang tidak ada di Neon. */
const usesSupabaseOnly = (s) => /\b(auth|storage|realtime|vault|graphql_public|supabase_functions)\./.test(String(s));

async function readSchema(pool) {
  const tables = await q(pool, `
    SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') ORDER BY c.relname`);

  // Sequence identity dibuat otomatis oleh GENERATED ... AS IDENTITY → jangan dibuat dua kali
  const sequences = await q(pool, `
    SELECT s.sequencename, s.data_type, s.start_value, s.min_value, s.max_value, s.increment_by, s.cycle, s.last_value
    FROM pg_sequences s
    WHERE s.schemaname = 'public' AND NOT EXISTS (
      SELECT 1 FROM pg_depend d JOIN pg_class c ON c.oid = d.objid
      WHERE d.deptype = 'i' AND c.relkind = 'S' AND c.relname = s.sequencename
        AND c.relnamespace = 'public'::regnamespace)`);

  const enums = await q(pool, `
    SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typnamespace = 'public'::regnamespace GROUP BY t.typname`);

  for (const t of tables) {
    t.columns = await q(pool, `
      SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull,
             pg_get_expr(d.adbin, d.adrelid) AS def, a.attidentity AS identity, a.attgenerated AS generated
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [t.oid]);
    t.constraints = await q(pool, `
      SELECT conname AS name, contype AS type, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE conrelid = $1 ORDER BY contype, conname`, [t.oid]);
    t.indexes = await q(pool, `
      SELECT pg_get_indexdef(i.indexrelid) AS def FROM pg_index i
      WHERE i.indrelid = $1 AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)`, [t.oid]);
    t.triggers = await q(pool, `SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = $1 AND NOT tgisinternal`, [t.oid]);
  }

  const functions = await q(pool, `
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f','p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`);
  const views = await q(pool, `SELECT viewname AS name, definition AS def FROM pg_views WHERE schemaname = 'public'`);
  const extensions = await q(pool, `SELECT extname FROM pg_extension WHERE extname <> ALL($1)`, [SKIP_EXT]);
  return { tables, sequences, enums, functions, views, extensions };
}

function columnDDL(c) {
  let s = `${qi(c.name)} ${c.type}`;
  if (c.identity === "a") s += " GENERATED ALWAYS AS IDENTITY";
  else if (c.identity === "d") s += " GENERATED BY DEFAULT AS IDENTITY";
  else if (c.generated === "s") s += ` GENERATED ALWAYS AS (${clean(c.def)}) STORED`;
  else if (c.def !== null) s += ` DEFAULT ${clean(c.def)}`;
  if (c.notnull && !c.identity) s += " NOT NULL";
  return s;
}

function buildDDL(schema) {
  const ddl = { extensions: [], enums: [], sequences: [], tables: [], fks: [], indexes: [], functions: [], triggers: [], views: [], skipped: [] };
  for (const e of schema.extensions) ddl.extensions.push(`CREATE EXTENSION IF NOT EXISTS ${qi(e.extname)}`);
  for (const e of schema.enums) {
    ddl.enums.push(`CREATE TYPE public.${qi(e.name)} AS ENUM (${e.labels.map((l) => `'${l.replace(/'/g, "''")}'`).join(", ")})`);
  }
  for (const s of schema.sequences) {
    ddl.sequences.push(
      `CREATE SEQUENCE IF NOT EXISTS public.${qi(s.sequencename)} AS ${s.data_type} START ${s.start_value} INCREMENT ${s.increment_by} MINVALUE ${s.min_value} MAXVALUE ${s.max_value} ${s.cycle ? "CYCLE" : "NO CYCLE"}`,
    );
  }
  for (const t of schema.tables) {
    const parts = t.columns.map(columnDDL);
    for (const c of t.constraints.filter((x) => x.type !== "f")) parts.push(`CONSTRAINT ${qi(c.name)} ${clean(c.def)}`);
    ddl.tables.push(`CREATE TABLE public.${qi(t.relname)} (\n  ${parts.join(",\n  ")}\n)`);
    for (const c of t.constraints.filter((x) => x.type === "f")) {
      if (usesSupabaseOnly(c.def)) {
        // mis. FOREIGN KEY (id) REFERENCES auth.users(id): auth tetap di Supabase, jadi FK tidak bisa dibawa
        ddl.skipped.push(`FK ${t.relname}.${c.name}: ${c.def}`);
        continue;
      }
      ddl.fks.push(`ALTER TABLE public.${qi(t.relname)} ADD CONSTRAINT ${qi(c.name)} ${c.def}`);
    }
    for (const i of t.indexes) ddl.indexes.push(i.def.replace(/^CREATE (UNIQUE )?INDEX/, "CREATE $1INDEX IF NOT EXISTS"));
    for (const tr of t.triggers) {
      if (usesSupabaseOnly(tr.def)) ddl.skipped.push(`TRIGGER: ${tr.def}`);
      else ddl.triggers.push(tr.def);
    }
  }
  for (const f of schema.functions) {
    if (usesSupabaseOnly(f.def)) ddl.skipped.push(`FUNCTION ${f.name} (memakai auth./storage.)`);
    else ddl.functions.push(clean(f.def));
  }
  for (const v of schema.views) {
    if (usesSupabaseOnly(v.def)) ddl.skipped.push(`VIEW ${v.name} (memakai auth./storage.)`);
    else ddl.views.push(`CREATE OR REPLACE VIEW public.${qi(v.name)} AS ${clean(v.def)}`);
  }
  return ddl;
}

/** Jalankan daftar DDL; kegagalan non-fatal hanya dilaporkan (untuk ekstensi/function/trigger/view). */
async function runList(dst, label, list, { fatal }) {
  let ok = 0;
  for (const sql of list) {
    try {
      await dst.query(sql);
      ok++;
    } catch (e) {
      if (/already exists/i.test(e.message)) { ok++; continue; }
      console.error(`✗ ${label}: ${e.message}\n   ${sql.replace(/\s+/g, " ").slice(0, 200)}`);
      if (fatal) throw e;
    }
  }
  log(`✓ ${label}: ${ok}/${list.length}`);
}

// ─── Tahap: plan ────────────────────────────────────────────────────────────

async function doPlan() {
  requireConfig({ needDst: false });
  const pool = srcPool();
  try {
    const schema = await readSchema(pool);
    const ddl = buildDDL(schema);
    const counts = {};
    for (const t of schema.tables) counts[t.relname] = Number((await q(pool, `SELECT count(*) AS c FROM public.${qi(t.relname)}`))[0].c);
    const size = (await q(pool, `SELECT pg_size_pretty(pg_database_size(current_database())) AS s`))[0].s;

    log("\n=== RENCANA MIGRASI Supabase → Neon (hanya baca, belum ada yang ditulis) ===");
    log(`Sumber : ${hostOf(SRC)}`);
    log(`Tujuan : ${DST ? hostOf(DST) : "(belum dikonfigurasi — scripts/migration.neon.env)"}\n`);
    log(`Ukuran database  : ${size}`);
    log(`Tabel public     : ${schema.tables.length} (${Object.values(counts).reduce((a, b) => a + b, 0)} baris total)`);
    log(`Enum/Sequence    : ${ddl.enums.length} / ${ddl.sequences.length}   Index: ${ddl.indexes.length}   FK: ${ddl.fks.length}`);
    log(`Function/Trigger : ${ddl.functions.length} / ${ddl.triggers.length}   View: ${ddl.views.length}`);
    log(`Ekstensi         : ${schema.extensions.map((e) => e.extname).join(", ") || "-"}`);
    if (ddl.skipped.length) {
      log(`\nTidak dibawa ke Neon (bergantung pada auth/storage Supabase):`);
      for (const s of ddl.skipped) log(`  - ${s}`);
    }
    const big = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    log(`\nTabel terbesar: ${big.map(([n, c]) => `${n}=${c}`).join(", ")}`);

    const out = path.join(root, "scripts", "migration.neon.plan.sql");
    const all = [...ddl.extensions, ...ddl.enums, ...ddl.sequences, ...ddl.tables, ...ddl.fks, ...ddl.indexes, ...ddl.functions, ...ddl.triggers, ...ddl.views];
    fs.writeFileSync(out, all.map((s) => s.trim() + ";").join("\n\n") + "\n");
    log(`\nDDL lengkap disimpan ke ${path.relative(root, out)} untuk ditinjau.`);
  } finally {
    await pool.end();
  }
}

// ─── Tahap: schema ──────────────────────────────────────────────────────────

const POST_FILE = path.join(root, "scripts", ".migration.neon.post.json");

async function doSchema() {
  requireConfig({ needDst: true });
  const src = srcPool();
  const dst = dstPool();
  try {
    const existing = await q(dst, `SELECT count(*)::int AS c FROM pg_tables WHERE schemaname = 'public'`);
    if (existing[0].c > 0) {
      log(`Neon sudah punya ${existing[0].c} tabel di schema public — tahap schema dilewati (sudah dibuat).`);
      return;
    }
    const ddl = buildDDL(await readSchema(src));
    // Urutan: ekstensi → enum → sequence → tabel (+PK/unique/check) → function → [data] → FK → index → trigger → view
    await runList(dst, "ekstensi", ddl.extensions, { fatal: false });
    await runList(dst, "enum", ddl.enums, { fatal: true });
    await runList(dst, "sequence", ddl.sequences, { fatal: true });
    await runList(dst, "tabel", ddl.tables, { fatal: true });
    await runList(dst, "function", ddl.functions, { fatal: false });
    log("Schema dasar selesai. FK, index, trigger, view dibuat setelah data dicopy (tahap data).");
    fs.writeFileSync(POST_FILE, JSON.stringify({ fks: ddl.fks, indexes: ddl.indexes, triggers: ddl.triggers, views: ddl.views }));
  } finally {
    await src.end();
    await dst.end();
  }
}

// ─── Tahap: data ────────────────────────────────────────────────────────────

async function doData() {
  requireConfig({ needDst: true });
  const src = srcPool();
  const dst = dstPool();
  try {
    const tables = await q(src, `SELECT relname FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p') ORDER BY 1`);
    // Constraint FK belum ada saat data masuk, jadi urutan tabel tidak masalah.
    for (const { relname } of tables) {
      const cols = await q(src, `
        SELECT a.attname AS name FROM pg_attribute a WHERE a.attrelid = $1::regclass AND a.attnum > 0
          AND NOT a.attisdropped AND a.attgenerated = '' ORDER BY a.attnum`, [`public.${qi(relname)}`]);
      const names = cols.map((c) => c.name);
      const total = Number((await q(src, `SELECT count(*) AS c FROM public.${qi(relname)}`))[0].c);
      const have = Number((await q(dst, `SELECT count(*) AS c FROM public.${qi(relname)}`))[0].c);
      if (total === have && have > 0) { log(`= ${relname}: ${have} baris (sudah sama, dilewati)`); continue; }
      if (have > 0) await dst.query(`TRUNCATE public.${qi(relname)} CASCADE`);
      if (total === 0) { log(`· ${relname}: kosong`); continue; }

      const rows = await q(src, `SELECT ${names.map(qi).join(", ")} FROM public.${qi(relname)}`);
      // Batas 65535 parameter per query → batch menyesuaikan jumlah kolom
      const BATCH = Math.max(1, Math.min(200, Math.floor(60000 / names.length)));
      const client = await dst.connect();
      try {
        await client.query("BEGIN");
        for (let i = 0; i < rows.length; i += BATCH) {
          const chunk = rows.slice(i, i + BATCH);
          const params = [];
          const tuples = chunk.map((r) => `(${names.map((n) => { params.push(r[n]); return `$${params.length}`; }).join(", ")})`);
          await client.query(`INSERT INTO public.${qi(relname)} (${names.map(qi).join(", ")}) OVERRIDING SYSTEM VALUE VALUES ${tuples.join(", ")}`, params);
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`✗ ${relname}: ${e.message}`);
        throw e;
      } finally {
        client.release();
      }
      log(`✓ ${relname}: ${rows.length} baris`);
    }

    // sinkronkan sequence (termasuk sequence identity)
    const seqs = await q(src, `SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public' AND last_value IS NOT NULL`);
    let synced = 0;
    for (const s of seqs) {
      try { await dst.query(`SELECT setval('public.${qi(s.sequencename)}', $1, true)`, [s.last_value]); synced++; }
      catch (e) { console.error(`✗ sequence ${s.sequencename}: ${e.message}`); }
    }
    if (seqs.length) log(`✓ sequence disinkronkan: ${synced}/${seqs.length}`);

    // objek yang sengaja dibuat SETELAH data
    let post = fs.existsSync(POST_FILE) ? JSON.parse(fs.readFileSync(POST_FILE, "utf8")) : null;
    if (!post) {
      const d = buildDDL(await readSchema(src));
      post = { fks: d.fks, indexes: d.indexes, triggers: d.triggers, views: d.views };
    }
    await runList(dst, "foreign key", post.fks, { fatal: true });
    await runList(dst, "index", post.indexes, { fatal: true });
    await runList(dst, "trigger", post.triggers, { fatal: false });
    await runList(dst, "view", post.views, { fatal: false });
  } finally {
    await src.end();
    await dst.end();
  }
}

// ─── Tahap: auth (hash password bcrypt Supabase → users.password di Neon) ──

async function doAuth() {
  requireConfig({ needDst: true });
  const src = srcPool();
  const dst = dstPool();
  try {
    const rows = await q(src, `SELECT id, lower(email) AS email, encrypted_password AS hash FROM auth.users`);
    let ok = 0, noHash = 0, noProfile = 0;
    for (const r of rows) {
      if (!r.hash || !r.hash.startsWith("$2")) { noHash++; console.warn(`! ${r.email}: tidak punya hash bcrypt (login via OAuth/magic link?) — perlu reset password`); continue; }
      const res = await dst.query(
        `UPDATE public.users SET password = $1 WHERE id = $2 OR lower(email) = $3`,
        [r.hash, r.id, r.email],
      );
      if (res.rowCount) ok++; else { noProfile++; console.warn(`! ${r.email}: tidak ada baris di public.users — dilewati`); }
    }
    const orphan = await q(dst, `SELECT email FROM public.users WHERE password IS NULL OR password NOT LIKE '$2%'`);
    log(`✓ hash password disalin: ${ok}/${rows.length} (tanpa hash: ${noHash}, tanpa profil: ${noProfile})`);
    if (orphan.length) {
      log(`⚠️  ${orphan.length} user di Neon belum bisa login (tanpa hash bcrypt): ${orphan.map((o) => o.email).join(", ")}`);
      log("   Beri password baru lewat: node scripts/set-password.mjs <email> <password-baru>");
    }
    log("Catatan: token login lama (Supabase) tidak berlaku lagi — semua user login ulang sekali, password tetap sama.");
  } finally {
    await src.end();
    await dst.end();
  }
}

// ─── Tahap: verify ──────────────────────────────────────────────────────────

async function doVerify() {
  requireConfig({ needDst: true });
  const src = srcPool();
  const dst = dstPool();
  let bad = 0;
  try {
    const tables = await q(src, `SELECT relname FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p') ORDER BY 1`);
    for (const { relname } of tables) {
      const a = Number((await q(src, `SELECT count(*) AS c FROM public.${qi(relname)}`))[0].c);
      let b = -1;
      try { b = Number((await q(dst, `SELECT count(*) AS c FROM public.${qi(relname)}`))[0].c); } catch {}
      if (a !== b) { bad++; console.log(`✗ ${relname}: supabase=${a} neon=${b}`); }
    }
    log(bad ? `\n${bad} tabel TIDAK cocok.` : `✓ ${tables.length} tabel: jumlah baris cocok.`);

    // Bandingkan struktur secara kasar: jumlah kolom, index, constraint per tabel
    const shape = (p) => q(p, `
      SELECT c.relname,
        (SELECT count(*) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)::int AS cols,
        (SELECT count(*) FROM pg_index i WHERE i.indrelid=c.oid)::int AS idx
      FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') ORDER BY 1`);
    const [sa, sb] = [await shape(src), await shape(dst)];
    for (const x of sa) {
      const y = sb.find((r) => r.relname === x.relname);
      if (!y || y.cols !== x.cols || y.idx !== x.idx) { bad++; console.log(`✗ struktur ${x.relname}: supabase cols/idx=${x.cols}/${x.idx} neon=${y ? `${y.cols}/${y.idx}` : "tidak ada"}`); }
    }
    if (!bad) log("✓ struktur kolom & index cocok.");
    process.exitCode = bad ? 2 : 0;
  } finally {
    await src.end();
    await dst.end();
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

const runners = { plan: doPlan, schema: doSchema, data: doData, auth: doAuth, verify: doVerify };
try {
  if (phase === "all") {
    for (const p of ["schema", "data", "auth", "verify"]) { log(`\n━━ ${p.toUpperCase()} ━━`); await runners[p](); }
  } else {
    await runners[phase]();
  }
} catch (e) {
  console.error("\nGAGAL:", e.message || e);
  process.exit(1);
}
