#!/usr/bin/env node
/**
 * Migrasi Supabase lama → project Supabase baru (schema public, data, user login, file storage).
 *
 *   node scripts/migrate-supabase.mjs plan      # cek saja, TIDAK menulis apa pun
 *   node scripts/migrate-supabase.mjs all       # jalankan semua tahap berurutan
 *   node scripts/migrate-supabase.mjs schema|data|auth|storage|urls|verify   # per tahap
 *
 * Konfigurasi:
 *  - Project LAMA dibaca dari artifacts/api-server/.env (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *  - Project BARU dibaca dari scripts/migration.new.env (tidak di-commit):
 *        NEW_DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:5432/postgres
 *        NEW_SUPABASE_URL=https://<ref>.supabase.co
 *        NEW_SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Aman: skrip TIDAK PERNAH menulis ke project lama. Setiap tahap bisa diulang (idempoten).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFrom = (pkgJson) => createRequire(path.join(root, pkgJson));
const pg = requireFrom("lib/db/package.json")("pg");
const { createClient } = requireFrom("artifacts/api-server/package.json")("@supabase/supabase-js");

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

// Setelah env dialihkan ke project baru, kredensial lama ada di backup .env.old-supabase
const oldEnvFile = ["artifacts/api-server/.env.old-supabase", "artifacts/api-server/.env"].map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
const oldEnv = parseEnv(oldEnvFile);
const newEnv = parseEnv(path.join(root, "scripts/migration.new.env"));

const OLD = {
  db: oldEnv.DATABASE_URL,
  url: (oldEnv.SUPABASE_URL || "").replace(/\/$/, ""),
  key: oldEnv.SUPABASE_SERVICE_ROLE_KEY,
};
const NEW = {
  db: newEnv.NEW_DATABASE_URL,
  url: (newEnv.NEW_SUPABASE_URL || "").replace(/\/$/, ""),
  key: newEnv.NEW_SUPABASE_SERVICE_ROLE_KEY,
};

const phase = process.argv[2] || "plan";
const PHASES = ["plan", "schema", "data", "auth", "storage", "urls", "verify", "all"];
if (!PHASES.includes(phase)) {
  console.error(`Tahap tidak dikenal: ${phase}\nPilihan: ${PHASES.join(" | ")}`);
  process.exit(1);
}

const hostOf = (u) => (u || "").replace(/^.*@/, "").replace(/^https?:\/\//, "").replace(/[/?].*$/, "");
const refOf = (u) => (/([a-z0-9]{20})\.supabase\.co/.exec(u || "") || [])[1] || "";

function requireConfig({ needNew }) {
  const missing = [];
  if (!OLD.db) missing.push("DATABASE_URL (artifacts/api-server/.env)");
  if (!OLD.url) missing.push("SUPABASE_URL (artifacts/api-server/.env)");
  if (needNew) {
    if (!NEW.db) missing.push("NEW_DATABASE_URL (scripts/migration.new.env)");
    if (!NEW.url) missing.push("NEW_SUPABASE_URL (scripts/migration.new.env)");
    if (!NEW.key) missing.push("NEW_SUPABASE_SERVICE_ROLE_KEY (scripts/migration.new.env)");
  }
  if (missing.length) {
    console.error("Konfigurasi belum lengkap:\n - " + missing.join("\n - "));
    process.exit(1);
  }
  if (needNew && (hostOf(NEW.url) === hostOf(OLD.url) || refOf(NEW.db) && refOf(NEW.db) === refOf(OLD.url))) {
    console.error("NEW dan OLD menunjuk project yang sama — dibatalkan.");
    process.exit(1);
  }
  if (needNew && NEW.db.includes(":6543")) {
    console.warn("⚠️  NEW_DATABASE_URL memakai port 6543 (transaction pooler). Disarankan port 5432 (session pooler) untuk migrasi.");
  }
}

// Kembalikan nilai mentah (string) agar timestamp/numeric/json tidak berubah saat dipindah.
const RAW_OIDS = [1082, 1083, 1114, 1184, 1186, 1700, 114, 3802, 1182, 1115, 1185, 1231, 199, 3807];
for (const oid of RAW_OIDS) pg.types.setTypeParser(oid, (v) => v);

const mkPool = (url) => new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4 });
const q = (pool, sql, params) => pool.query(sql, params).then((r) => r.rows);
const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Schema introspection (schema public) ───────────────────────────────────

async function readSchema(pool) {
  const tables = (await q(pool, `
    SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') ORDER BY c.relname`));

  const sequences = await q(pool, `
    SELECT sequencename, data_type, start_value, min_value, max_value, increment_by, cycle, last_value
    FROM pg_sequences WHERE schemaname = 'public'`);

  for (const t of tables) {
    t.columns = await q(pool, `
      SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull,
             pg_get_expr(d.adbin, d.adrelid) AS def, a.attidentity AS identity, a.attgenerated AS generated
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [t.oid]);
    t.constraints = await q(pool, `
      SELECT conname AS name, contype AS type, pg_get_constraintdef(oid) AS def,
             confrelid::regclass::text AS ref
      FROM pg_constraint WHERE conrelid = $1 ORDER BY contype, conname`, [t.oid]);
    t.indexes = await q(pool, `
      SELECT pg_get_indexdef(i.indexrelid) AS def FROM pg_index i
      WHERE i.indrelid = $1 AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)`, [t.oid]);
    t.triggers = await q(pool, `SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = $1 AND NOT tgisinternal`, [t.oid]);
  }

  const functions = await q(pool, `
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')`);
  const views = await q(pool, `SELECT viewname AS name, definition AS def FROM pg_views WHERE schemaname = 'public'`);
  const extensions = await q(pool, `SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql','pg_stat_statements','supabase_vault','pg_graphql','pgsodium')`);
  return { tables, sequences, functions, views, extensions };
}

function columnDDL(c) {
  let s = `${qi(c.name)} ${c.type}`;
  if (c.identity === "a") s += " GENERATED ALWAYS AS IDENTITY";
  else if (c.identity === "d") s += " GENERATED BY DEFAULT AS IDENTITY";
  else if (c.generated === "s") s += ` GENERATED ALWAYS AS (${c.def}) STORED`;
  else if (c.def !== null) s += ` DEFAULT ${c.def}`;
  if (c.notnull && !c.identity) s += " NOT NULL";
  return s;
}

function buildDDL(schema) {
  const ddl = { extensions: [], sequences: [], tables: [], fks: [], indexes: [], functions: [], triggers: [], views: [] };
  for (const e of schema.extensions) ddl.extensions.push(`CREATE EXTENSION IF NOT EXISTS ${qi(e.extname)} WITH SCHEMA extensions`);
  for (const s of schema.sequences) {
    ddl.sequences.push(
      `CREATE SEQUENCE IF NOT EXISTS public.${qi(s.sequencename)} AS ${s.data_type} START ${s.start_value} INCREMENT ${s.increment_by} MINVALUE ${s.min_value} MAXVALUE ${s.max_value} ${s.cycle ? "CYCLE" : "NO CYCLE"}`,
    );
  }
  for (const t of schema.tables) {
    const parts = t.columns.map(columnDDL);
    for (const c of t.constraints.filter((x) => x.type !== "f")) parts.push(`CONSTRAINT ${qi(c.name)} ${c.def}`);
    ddl.tables.push(`CREATE TABLE public.${qi(t.relname)} (\n  ${parts.join(",\n  ")}\n)`);
    for (const c of t.constraints.filter((x) => x.type === "f")) {
      ddl.fks.push(`ALTER TABLE public.${qi(t.relname)} ADD CONSTRAINT ${qi(c.name)} ${c.def}`);
    }
    for (const i of t.indexes) ddl.indexes.push(i.def.replace(/^CREATE (UNIQUE )?INDEX/, "CREATE $1INDEX IF NOT EXISTS"));
    for (const tr of t.triggers) ddl.triggers.push(tr.def);
  }
  for (const f of schema.functions) ddl.functions.push(f.def);
  for (const v of schema.views) ddl.views.push(`CREATE OR REPLACE VIEW public.${qi(v.name)} AS ${v.def}`);
  return ddl;
}

// ─── Tahap: plan ────────────────────────────────────────────────────────────

async function doPlan() {
  requireConfig({ needNew: false });
  const pool = mkPool(OLD.db);
  try {
    const schema = await readSchema(pool);
    const ddl = buildDDL(schema);
    const counts = {};
    for (const t of schema.tables) counts[t.relname] = Number((await q(pool, `SELECT count(*) AS c FROM public.${qi(t.relname)}`))[0].c);
    const authUsers = Number((await q(pool, `SELECT count(*) AS c FROM auth.users`))[0].c);
    const objs = await q(pool, `SELECT bucket_id, count(*)::int AS files, coalesce(sum((metadata->>'size')::bigint),0)::bigint AS bytes FROM storage.objects GROUP BY 1`);
    const buckets = await q(pool, `SELECT id, public, file_size_limit FROM storage.buckets`);

    log("\n=== RENCANA MIGRASI (hanya baca, belum ada yang ditulis) ===");
    log(`Sumber : ${hostOf(OLD.url)}`);
    log(`Tujuan : ${NEW.url ? hostOf(NEW.url) : "(belum dikonfigurasi — scripts/migration.new.env)"}\n`);
    log(`Tabel public     : ${schema.tables.length} (${Object.values(counts).reduce((a, b) => a + b, 0)} baris total)`);
    log(`Sequence         : ${ddl.sequences.length}   Index: ${ddl.indexes.length}   FK: ${ddl.fks.length}`);
    log(`Function/Trigger : ${ddl.functions.length} / ${ddl.triggers.length}   View: ${ddl.views.length}`);
    log(`Ekstensi         : ${ddl.extensions.map((e) => e.match(/"(.+?)"/)[1]).join(", ") || "-"}`);
    log(`User login       : ${authUsers}`);
    for (const b of buckets) {
      const o = objs.find((x) => x.bucket_id === b.id);
      log(`Bucket ${b.id.padEnd(12)} public=${b.public} : ${o?.files ?? 0} file, ${((Number(o?.bytes ?? 0)) / 1048576).toFixed(1)} MB`);
    }
    const out = path.join(root, "scripts", "migration.plan.sql");
    const all = [...ddl.extensions, ...ddl.sequences, ...ddl.tables, ...ddl.fks, ...ddl.indexes, ...ddl.functions, ...ddl.triggers, ...ddl.views];
    fs.writeFileSync(out, all.map((s) => s.trim() + ";").join("\n\n") + "\n");
    log(`\nDDL lengkap disimpan ke ${path.relative(root, out)} untuk ditinjau.`);
  } finally {
    await pool.end();
  }
}

// ─── Tahap: schema ──────────────────────────────────────────────────────────

async function doSchema() {
  requireConfig({ needNew: true });
  const src = mkPool(OLD.db);
  const dst = mkPool(NEW.db);
  try {
    const existing = await q(dst, `SELECT count(*)::int AS c FROM pg_tables WHERE schemaname = 'public'`);
    if (existing[0].c > 0) {
      log(`Project baru sudah punya ${existing[0].c} tabel di schema public — tahap schema dilewati (sudah dibuat).`);
      return;
    }
    const ddl = buildDDL(await readSchema(src));
    const run = async (label, list) => {
      for (const sql of list) {
        try { await dst.query(sql); } catch (e) { console.error(`\n✗ ${label} gagal: ${e.message}\n${sql.slice(0, 300)}`); throw e; }
      }
      log(`✓ ${label}: ${list.length}`);
    };
    // Urutan: ekstensi → sequence → tabel (+PK/unique/check) → [data] → FK → index → function → trigger → view
    await run("ekstensi", ddl.extensions);
    await run("sequence", ddl.sequences);
    await run("tabel", ddl.tables);
    await run("function", ddl.functions);
    log("Schema dasar selesai. FK, index, trigger dibuat setelah data dicopy (tahap data).");
    fs.writeFileSync(path.join(root, "scripts", ".migration.post.json"), JSON.stringify({ fks: ddl.fks, indexes: ddl.indexes, triggers: ddl.triggers, views: ddl.views }));
  } finally {
    await src.end(); await dst.end();
  }
}

// ─── Tahap: data ────────────────────────────────────────────────────────────

async function doData() {
  requireConfig({ needNew: true });
  const src = mkPool(OLD.db);
  const dst = mkPool(NEW.db);
  try {
    const tables = await q(src, `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY 1`);
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
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const params = [];
        const tuples = chunk.map((r) => `(${names.map((n) => { params.push(r[n]); return `$${params.length}`; }).join(", ")})`);
        await dst.query(`INSERT INTO public.${qi(relname)} (${names.map(qi).join(", ")}) OVERRIDING SYSTEM VALUE VALUES ${tuples.join(", ")}`, params);
      }
      log(`✓ ${relname}: ${rows.length} baris`);
    }

    // sinkronkan sequence
    const seqs = await q(src, `SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public' AND last_value IS NOT NULL`);
    for (const s of seqs) await dst.query(`SELECT setval('public.${qi(s.sequencename)}', $1, true)`, [s.last_value]);
    if (seqs.length) log(`✓ sequence disinkronkan: ${seqs.length}`);

    // objek yang sengaja dibuat SETELAH data
    const postFile = path.join(root, "scripts", ".migration.post.json");
    let post = fs.existsSync(postFile) ? JSON.parse(fs.readFileSync(postFile, "utf8")) : null;
    if (!post) post = (({ fks, indexes, triggers, views }) => ({ fks, indexes, triggers, views }))(buildDDL(await readSchema(src)));
    for (const [label, list] of Object.entries(post)) {
      for (const sql of list) {
        try { await dst.query(sql); }
        catch (e) { if (/already exists/i.test(e.message)) continue; console.error(`✗ ${label}: ${e.message}\n${sql.slice(0, 250)}`); throw e; }
      }
      log(`✓ ${label}: ${list.length}`);
    }
  } finally {
    await src.end(); await dst.end();
  }
}

// ─── Tahap: auth (user login + password hash tetap sama) ────────────────────

async function copyAuthTable(src, dst, table) {
  const cols = (pool) => q(pool, `
    SELECT column_name AS name FROM information_schema.columns
    WHERE table_schema='auth' AND table_name=$1 AND is_generated='NEVER' ORDER BY ordinal_position`, [table]);
  const dstCols = new Set((await cols(dst)).map((c) => c.name));
  const names = (await cols(src)).map((c) => c.name).filter((n) => dstCols.has(n));
  const rows = await q(src, `SELECT ${names.map(qi).join(", ")} FROM auth.${qi(table)}`);
  let n = 0;
  for (const r of rows) {
    const params = names.map((c) => r[c]);
    const res = await dst.query(
      `INSERT INTO auth.${qi(table)} (${names.map(qi).join(", ")}) VALUES (${names.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT DO NOTHING`,
      params,
    );
    n += res.rowCount;
  }
  log(`✓ auth.${table}: ${n}/${rows.length} baris`);
}

async function doAuth() {
  requireConfig({ needNew: true });
  const src = mkPool(OLD.db);
  const dst = mkPool(NEW.db);
  try {
    await copyAuthTable(src, dst, "users");
    await copyAuthTable(src, dst, "identities");
    log("Catatan: session lama tidak dipindah — semua user perlu login ulang sekali. Password tetap sama.");
  } finally {
    await src.end(); await dst.end();
  }
}

// ─── Tahap: storage ─────────────────────────────────────────────────────────

async function doStorage() {
  requireConfig({ needNew: true });
  const src = mkPool(OLD.db);
  const supNew = createClient(NEW.url, NEW.key, { auth: { persistSession: false } });
  try {
    const buckets = await q(src, `SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets`);
    for (const b of buckets) {
      const { error } = await supNew.storage.createBucket(b.id, {
        public: b.public,
        ...(b.file_size_limit ? { fileSizeLimit: Number(b.file_size_limit) } : {}),
        ...(b.allowed_mime_types ? { allowedMimeTypes: b.allowed_mime_types } : {}),
      });
      if (error && !/already exists/i.test(error.message)) throw new Error(`bucket ${b.id}: ${error.message}`);
      log(`✓ bucket ${b.id} ${error ? "(sudah ada)" : "dibuat"}`);
    }

    const objects = await q(src, `SELECT bucket_id, name, metadata FROM storage.objects ORDER BY bucket_id, name`);
    const bucketPublic = Object.fromEntries(buckets.map((b) => [b.id, b.public]));
    const oldClient = createClient(OLD.url, OLD.key, { auth: { persistSession: false } });
    let done = 0, skipped = 0, failed = 0, bytes = 0;
    const queue = [...objects];

    const worker = async () => {
      while (queue.length) {
        const o = queue.shift();
        // jsonb dibaca mentah (string) oleh parser di atas → parse dulu
        const meta = typeof o.metadata === "string" ? JSON.parse(o.metadata) : o.metadata || {};
        const size = Number(meta.size ?? 0);
        const mime = meta.mimetype || "application/octet-stream";
        try {
          // lewati bila sudah ada di tujuan dengan ukuran sama (resume)
          const dir = o.name.includes("/") ? o.name.slice(0, o.name.lastIndexOf("/")) : "";
          const base = o.name.slice(o.name.lastIndexOf("/") + 1);
          const { data: found } = await supNew.storage.from(o.bucket_id).list(dir, { search: base, limit: 5 });
          const hit = (found || []).find((f) => f.name === base);
          if (hit && Number(hit.metadata?.size ?? -1) === size && (hit.metadata?.mimetype || "") === mime) { skipped++; continue; }

          // upsert tidak memperbarui tipe file pada objek yang sudah ada → hapus dulu bila tipenya salah
          if (hit) await supNew.storage.from(o.bucket_id).remove([o.name]);

          let buf;
          if (bucketPublic[o.bucket_id]) {
            const url = `${OLD.url}/storage/v1/object/public/${o.bucket_id}/${o.name.split("/").map(encodeURIComponent).join("/")}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`download ${res.status}`);
            buf = Buffer.from(await res.arrayBuffer());
          } else {
            const { data, error } = await oldClient.storage.from(o.bucket_id).download(o.name);
            if (error) throw error;
            buf = Buffer.from(await data.arrayBuffer());
          }
          // Blob membawa tipe file; Buffer polos membuat contentType diabaikan (jadi application/octet-stream)
          const { error: upErr } = await supNew.storage.from(o.bucket_id).upload(o.name, new Blob([buf], { type: mime }), { contentType: mime, upsert: true });
          if (upErr) throw upErr;
          done++; bytes += buf.length;
          if ((done + skipped) % 10 === 0) log(`  … ${done + skipped}/${objects.length} (${(bytes / 1048576).toFixed(0)} MB)`);
        } catch (e) {
          failed++;
          console.error(`✗ ${o.bucket_id}/${o.name}: ${e.message || e}`);
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    log(`\nStorage: ${done} dicopy, ${skipped} dilewati (sudah ada), ${failed} gagal, ${(bytes / 1048576).toFixed(1)} MB`);
    if (failed) process.exitCode = 2;
  } finally {
    await src.end();
  }
}

// ─── Tahap: urls (ganti host Supabase lama di isi database BARU) ────────────

async function doUrls() {
  requireConfig({ needNew: true });
  const dst = mkPool(NEW.db);
  const oldHost = hostOf(OLD.url);
  const newHost = hostOf(NEW.url);
  try {
    const cols = await q(dst, `
      SELECT c.table_name, c.column_name, format_type(a.atttypid, a.atttypmod) AS type
      FROM information_schema.columns c
      JOIN pg_attribute a ON a.attrelid = ('public.' || quote_ident(c.table_name))::regclass AND a.attname = c.column_name
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public'
        AND (c.data_type IN ('text','character varying','json','jsonb') OR (c.data_type = 'ARRAY' AND c.udt_name IN ('_text','_varchar')))`);
    let total = 0;
    for (const c of cols) {
      const res = await dst.query(
        `UPDATE public.${qi(c.table_name)} SET ${qi(c.column_name)} = replace(${qi(c.column_name)}::text, $1, $2)::${c.type}
         WHERE ${qi(c.column_name)}::text LIKE '%' || $1 || '%'`,
        [oldHost, newHost],
      );
      if (res.rowCount) { log(`✓ ${c.table_name}.${c.column_name}: ${res.rowCount} baris`); total += res.rowCount; }
    }
    log(`Selesai: ${total} nilai diperbarui (${oldHost} → ${newHost}).`);
  } finally {
    await dst.end();
  }
}

// ─── Tahap: verify ──────────────────────────────────────────────────────────

async function doVerify() {
  requireConfig({ needNew: true });
  const src = mkPool(OLD.db);
  const dst = mkPool(NEW.db);
  let bad = 0;
  try {
    const tables = await q(src, `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY 1`);
    for (const { relname } of tables) {
      const a = Number((await q(src, `SELECT count(*) AS c FROM public.${qi(relname)}`))[0].c);
      let b = -1;
      try { b = Number((await q(dst, `SELECT count(*) AS c FROM public.${qi(relname)}`))[0].c); } catch {}
      if (a !== b) { bad++; console.log(`✗ ${relname}: lama=${a} baru=${b}`); }
    }
    log(bad ? `\n${bad} tabel TIDAK cocok.` : `✓ ${tables.length} tabel: jumlah baris cocok.`);

    for (const t of ["users", "identities"]) {
      const a = Number((await q(src, `SELECT count(*) AS c FROM auth.${t}`))[0].c);
      const b = Number((await q(dst, `SELECT count(*) AS c FROM auth.${t}`))[0].c);
      log(`${a === b ? "✓" : "✗"} auth.${t}: lama=${a} baru=${b}`); if (a !== b) bad++;
    }
    const so = (p) => q(p, `SELECT bucket_id, count(*)::int AS n FROM storage.objects GROUP BY 1 ORDER BY 1`);
    const [sa, sb] = [await so(src), await so(dst)];
    for (const x of sa) {
      const y = sb.find((r) => r.bucket_id === x.bucket_id)?.n ?? 0;
      log(`${x.n === y ? "✓" : "✗"} storage ${x.bucket_id}: lama=${x.n} baru=${y}`); if (x.n !== y) bad++;
    }
    const leftover = await q(dst, `SELECT count(*)::int AS c FROM public.cms_settings WHERE value::text LIKE '%' || $1 || '%'`, [hostOf(OLD.url)]).catch(() => [{ c: "?" }]);
    log(`Sisa referensi host lama di cms_settings: ${leftover[0].c}`);
    process.exitCode = bad ? 2 : 0;
  } finally {
    await src.end(); await dst.end();
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

const runners = { plan: doPlan, schema: doSchema, data: doData, auth: doAuth, storage: doStorage, urls: doUrls, verify: doVerify };
try {
  if (phase === "all") {
    for (const p of ["schema", "data", "auth", "storage", "urls", "verify"]) { log(`\n━━ ${p.toUpperCase()} ━━`); await runners[p](); }
  } else {
    await runners[phase]();
  }
} catch (e) {
  console.error("\nGAGAL:", e.message || e);
  process.exit(1);
}
