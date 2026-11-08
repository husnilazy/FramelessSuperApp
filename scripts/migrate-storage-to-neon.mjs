#!/usr/bin/env node
/**
 * Migrasi file Supabase Storage → Neon Object Storage, lalu ganti URL lama di database Neon.
 *
 *   node scripts/migrate-storage-to-neon.mjs plan    # daftar bucket/file/ukuran, tidak menulis apa pun
 *   node scripts/migrate-storage-to-neon.mjs files   # salin file (bisa diulang; yang sudah ada & ukurannya sama dilewati)
 *   node scripts/migrate-storage-to-neon.mjs urls    # ganti URL Supabase → Neon di semua kolom teks/json
 *   node scripts/migrate-storage-to-neon.mjs all     # files → urls
 *
 * Prasyarat: buat bucket dengan nama SAMA seperti di Supabase, access level public_read (bila bucket Supabase-nya public):
 *   neon buckets create site-assets --access-level public_read
 *
 * Konfigurasi di scripts/migration.neon.env (tidak di-commit), selain NEON_DATABASE_URL:
 *   AWS_ENDPOINT_URL_S3=https://br-xxxx.storage.c-N.<region>.aws.neon.tech
 *   AWS_REGION=<region>   AWS_ACCESS_KEY_ID=nak_live_...   AWS_SECRET_ACCESS_KEY=nsk_live_...
 *   STORAGE_PUBLIC_URL=   (opsional; default = AWS_ENDPOINT_URL_S3)
 * Sumber Supabase dibaca dari artifacts/api-server/.env.old-supabase (atau .env):
 *   DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Skrip HANYA MEMBACA dari Supabase. Objek disimpan di bucket Neon bernama sama: <bucket>/<nama-objek>.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = (pkg) => createRequire(path.join(root, pkg, "package.json"));
const pg = req("lib/db")("pg");
const { S3Client, PutObjectCommand, HeadObjectCommand, HeadBucketCommand } = req("artifacts/api-server")("@aws-sdk/client-s3");

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const oldFile = ["artifacts/api-server/.env.old-supabase", "artifacts/api-server/.env"].map((f) => path.join(root, f)).find((f) => fs.existsSync(f));
const old = parseEnv(oldFile);
const cfg = parseEnv(path.join(root, "scripts/migration.neon.env"));

const SRC_DB = cfg.SOURCE_DATABASE_URL || old.DATABASE_URL;
const SB_URL = (old.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = old.SUPABASE_SERVICE_ROLE_KEY;
const NEON = cfg.NEON_DATABASE_URL;
const ST = {
  endpoint: (cfg.AWS_ENDPOINT_URL_S3 || "").replace(/[/]+$/, ""), region: cfg.AWS_REGION,
  accessKeyId: cfg.AWS_ACCESS_KEY_ID, secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY,
  publicUrl: (cfg.STORAGE_PUBLIC_URL || cfg.AWS_ENDPOINT_URL_S3 || "").replace(/[/]+$/, ""),
};

const phase = process.argv[2] || "plan";
if (!["plan", "files", "urls", "all"].includes(phase)) { console.error("Tahap: plan | files | urls | all"); process.exit(1); }

const need = (pairs) => {
  const miss = pairs.filter(([, v]) => !v).map(([k]) => k);
  if (miss.length) { console.error("Konfigurasi belum lengkap:\n - " + miss.join("\n - ")); process.exit(1); }
};

pg.types.setTypeParser(114, (v) => v);
pg.types.setTypeParser(3802, (v) => v);
const q = (pool, sql, params) => pool.query(sql, params).then((r) => r.rows);
const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;
const log = console.log;
const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

async function listObjects() {
  const pool = new pg.Pool({ connectionString: SRC_DB, ssl: { rejectUnauthorized: false }, max: 2 });
  try {
    const buckets = await q(pool, `SELECT id, public FROM storage.buckets`);
    const objects = await q(pool, `SELECT bucket_id, name, metadata FROM storage.objects ORDER BY bucket_id, name`);
    return { buckets, objects };
  } finally { await pool.end(); }
}

const metaOf = (o) => (typeof o.metadata === "string" ? JSON.parse(o.metadata) : o.metadata) || {};

async function doPlan() {
  need([["DATABASE_URL Supabase", SRC_DB]]);
  const { buckets, objects } = await listObjects();
  log("\n=== RENCANA MIGRASI STORAGE (hanya baca) ===");
  for (const b of buckets) {
    const os = objects.filter((o) => o.bucket_id === b.id);
    const bytes = os.reduce((a, o) => a + Number(metaOf(o).size ?? 0), 0);
    log(`Bucket ${b.id.padEnd(16)} public=${b.public}  ${String(os.length).padStart(5)} file  ${(bytes / 1048576).toFixed(1)} MB`);
  }
  log(`Total: ${objects.length} file`);
}

async function doFiles() {
  need([["DATABASE_URL Supabase", SRC_DB], ["SUPABASE_URL", SB_URL], ["SUPABASE_SERVICE_ROLE_KEY", SB_KEY],
    ["AWS_ENDPOINT_URL_S3", ST.endpoint], ["AWS_REGION", ST.region], ["AWS_ACCESS_KEY_ID", ST.accessKeyId], ["AWS_SECRET_ACCESS_KEY", ST.secretAccessKey]]);
  const s3 = new S3Client({
    region: ST.region, endpoint: ST.endpoint, forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: ST.accessKeyId, secretAccessKey: ST.secretAccessKey },
  });
  const { buckets, objects } = await listObjects();
  for (const b of buckets) {
    try { await s3.send(new HeadBucketCommand({ Bucket: b.id })); }
    catch {
      console.error(`Bucket "${b.id}" belum ada di Neon. Buat dulu:
  neon buckets create ${b.id} --access-level ${b.public ? "public_read" : "private"}`);
      process.exit(1);
    }
  }
  const isPublic = Object.fromEntries(buckets.map((b) => [b.id, b.public]));
  const queue = [...objects];
  let done = 0, skipped = 0, failed = 0, bytes = 0;

  const worker = async () => {
    while (queue.length) {
      const o = queue.shift();
      const meta = metaOf(o);
      const size = Number(meta.size ?? -1);
      const mime = meta.mimetype || "application/octet-stream";
      const key = `${o.bucket_id}/${o.name}`; // untuk log; di Neon: Bucket=o.bucket_id, Key=o.name
      try {
        try {
          const head = await s3.send(new HeadObjectCommand({ Bucket: o.bucket_id, Key: o.name }));
          if (size < 0 || Number(head.ContentLength) === size) { skipped++; continue; }
        } catch { /* belum ada → lanjut salin */ }

        const url = isPublic[o.bucket_id]
          ? `${SB_URL}/storage/v1/object/public/${o.bucket_id}/${encPath(o.name)}`
          : `${SB_URL}/storage/v1/object/authenticated/${o.bucket_id}/${encPath(o.name)}`;
        const res = await fetch(url, isPublic[o.bucket_id] ? {} : { headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY } });
        if (!res.ok) throw new Error(`download ${res.status}${res.status === 402 || res.status === 429 ? " (kuota egress Supabase habis?)" : ""}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await s3.send(new PutObjectCommand({ Bucket: o.bucket_id, Key: o.name, Body: buf, ContentType: mime, ContentLength: buf.length }));
        done++; bytes += buf.length;
        if ((done + skipped) % 10 === 0) log(`  … ${done + skipped}/${objects.length} (${(bytes / 1048576).toFixed(0)} MB)`);
      } catch (e) {
        failed++;
        console.error(`✗ ${key}: ${e.message || e}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  log(`\nStorage: ${done} disalin, ${skipped} dilewati (sudah ada), ${failed} gagal, ${(bytes / 1048576).toFixed(1)} MB`);
  if (failed) process.exitCode = 2;
}

async function doUrls() {
  need([["NEON_DATABASE_URL", NEON], ["SUPABASE_URL", SB_URL], ["AWS_ENDPOINT_URL_S3 / STORAGE_PUBLIC_URL", ST.publicUrl]]);
  if (!/neon\.tech/.test(NEON)) { console.error("NEON_DATABASE_URL bukan host *.neon.tech — dibatalkan."); process.exit(1); }
  const dst = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: true }, max: 2 });
  const from = `${SB_URL}/storage/v1/object/public/`;
  const to = `${ST.publicUrl}/`;
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
         WHERE ${qi(c.column_name)}::text LIKE '%' || $1 || '%'`, [from, to]);
      if (res.rowCount) { log(`✓ ${c.table_name}.${c.column_name}: ${res.rowCount} baris`); total += res.rowCount; }
    }
    log(`Selesai: ${total} nilai diperbarui (${from} → ${to}).`);
  } finally { await dst.end(); }
}

try {
  if (phase === "plan") await doPlan();
  if (phase === "files" || phase === "all") await doFiles();
  if (phase === "urls" || phase === "all") await doUrls();
} catch (e) {
  console.error("\nGAGAL:", e.message || e);
  process.exit(1);
}
