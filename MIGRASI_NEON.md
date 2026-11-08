# Migrasi Frameless Creative: Supabase → Neon (database + auth + storage)

## Cakupan

| Komponen | Sebelumnya | Sekarang |
|---|---|---|
| Database | Supabase Postgres | **Neon Postgres** |
| Login | Supabase Auth | **Auth sendiri**: hash bcrypt di `users.password` (Neon) + JWT session |
| File upload | Supabase Storage | **Neon Object Storage** (S3-compatible, beta) |

Neon tidak punya layanan auth terkelola yang stabil untuk kasus ini, jadi login dipindah ke tabel `users` di Neon.
Password user lama tetap berlaku (hash bcrypt `auth.users` disalin). Token login lama tidak berlaku, jadi semua user login ulang sekali.

**Perhatian Neon Object Storage (beta):**
- Region project Neon harus salah satu: `aws-us-east-2`, `aws-us-east-1`, `aws-eu-central-1`, `aws-ap-southeast-1` (Singapore).
- Gratis 5 GB; berbayar $0.023/GB-bulan. Egress masuk kuota network transfer project (5 GB/bln gratis, 500 GB di Launch/Scale, lalu $0.10/GB) — dibagi dengan Postgres. Kalau limit Supabase tadi karena egress file, pantau ini.
- Satu PutObject maksimum 5 GiB; hanya path-style; bucket per *branch*.

## Perubahan kode

- `lib/db/src/index.ts` — pool `pg` siap Neon.
- `api-server/src/lib/auth-core.ts` — bcrypt + JWT (`AUTH_JWT_SECRET`), pengganti `supabase.auth.*`.
- `api-server/src/lib/users-repo.ts` — akses tabel `users` via Drizzle (pengganti PostgREST).
- `api-server/src/lib/storage.ts` — upload ke Neon Object Storage via `@aws-sdk/client-s3`; dipakai `routes/uploads.ts` dan `routes/crew-linkinbio.ts` (bucket `site-assets`).
- `routes/auth.ts`, `routes/middleware.ts`, `middlewares/auth.ts` memakai modul di atas. `/auth/register` kini menolak email duplikat dan password < 8 karakter.
- Paket `@supabase/supabase-js` dan `ws` dihapus; `bcryptjs`, `@aws-sdk/client-s3`, `pg` ditambah.
- Skrip: `scripts/migrate-to-neon.mjs` (db + hash password), `scripts/migrate-storage-to-neon.mjs` (file + URL), `scripts/set-password.mjs`.

## Persiapan di Neon

1. Project Neon di region yang didukung object storage (mis. Singapore). Salin string Postgres *direct* (tanpa `-pooler`) dan *pooled*.
2. Buat bucket dengan nama **sama** seperti di Supabase (jalankan `node scripts/migrate-storage-to-neon.mjs plan` untuk melihat daftarnya), access level `public_read` untuk bucket yang publik:
   ```bash
   neon buckets create site-assets --access-level public_read
   ```
3. Buat kredensial storage (Console → Project Settings → Credentials, scope `storage:read` + `storage:write`):
   `token_id` (nak_live_…) → `AWS_ACCESS_KEY_ID`, `s3_secret_access_key` (nsk_live_…) → `AWS_SECRET_ACCESS_KEY`.
   Endpoint & region: Console → Connect → Storage (atau `GET /projects/{id}/branches/{id}/storage` → `s3_endpoint`, `region`).
4. Buat `scripts/migration.neon.env` (sudah di-gitignore):
   ```
   NEON_DATABASE_URL=postgresql://USER:PASS@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   AWS_ENDPOINT_URL_S3=https://br-xxxx.storage.c-N.ap-southeast-1.aws.neon.tech
   AWS_REGION=ap-southeast-1
   AWS_ACCESS_KEY_ID=nak_live_...
   AWS_SECRET_ACCESS_KEY=nsk_live_...
   ```
   Kredensial Supabase dibaca dari `artifacts/api-server/.env` (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Salin dulu ke `.env.old-supabase` bila nanti `.env` diganti.

## Urutan menjalankan

Semua perintah hanya MEMBACA dari Supabase dan aman diulang.

```bash
node scripts/migrate-to-neon.mjs plan
node scripts/migrate-to-neon.mjs all
node scripts/migrate-storage-to-neon.mjs plan
node scripts/migrate-storage-to-neon.mjs all
```

- `migrate-to-neon.mjs all` = schema → data → auth (salin hash password) → verify.
- `migrate-storage-to-neon.mjs all` = salin semua file lalu ganti URL `…supabase.co/storage/v1/object/public/` di database Neon dengan URL bucket Neon.
- User tanpa hash bcrypt (mis. dulu login via OAuth) ditampilkan skrip. Beri password baru: `node scripts/set-password.mjs email@contoh.com PasswordBaru123`.
- Download file gagal 402/429 = kuota egress Supabase masih habis; ulangi setelah reset (yang sudah tersalin dilewati).

## Environment variable (Vercel dan `.env` lokal)

| Variabel | Nilai |
|---|---|
| `DATABASE_URL` | string Neon **pooled** |
| `DATABASE_URL_DIRECT` | string Neon **direct** (hanya untuk `pnpm --filter @workspace/db push`) |
| `AUTH_JWT_SECRET` | string acak panjang, mis. `openssl rand -base64 48` |
| `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | dari Neon Storage |
| `STORAGE_PUBLIC_URL` | opsional, bila memakai domain/CDN sendiri di depan bucket (URL di DB harus diganti sesuai) |
| `SHARE_SECRET` | **isi dengan nilai lama `SUPABASE_SERVICE_ROLE_KEY`** bila `JWT_SECRET`/`SHARE_SECRET` sebelumnya tidak di-set, agar link share yang sudah beredar tetap valid |

`SUPABASE_*` tidak dipakai lagi dan boleh dihapus setelah semuanya terverifikasi.

## Uji sebelum menghapus Supabase

1. Login dengan akun lama (password lama), buka dashboard.
2. Upload gambar di halaman admin dan di link-in-bio crew; URL hasilnya harus berawalan endpoint Neon dan bisa dibuka tanpa login.
3. Buka halaman yang menampilkan gambar lama (logo, video, aset).
4. Daftarkan user baru lewat `/auth/register`, lalu login.

## Rollback

Selama project Supabase masih ada, kembalikan commit sebelumnya dan env lama lalu redeploy. Data/file yang dibuat setelah cut-over tidak kembali otomatis. Jangan hapus project Supabase sebelum pengujian selesai.

## Catatan

- Pintu darurat (`EMERGENCY_*`) tetap ada dan hanya aktif bila ketiga env-nya di-set; nonaktifkan setelah stabil.
- Rate limit login/register sudah terpasang di `routes/index.ts`.
- Row Level Security Supabase tidak dipindah; akses data lewat API server.
- Upload dibaca penuh ke memori sebelum dikirim, karena dokumentasi Neon hanya menjamin body string/Buffer; batas ukuran tetap dari multer.
- Belum diuji terhadap Neon sungguhan; uji upload pertama di staging.
