/**
 * Penyimpanan file di Neon Object Storage (S3-compatible, beta) — pengganti Supabase Storage.
 *
 * Env (nilai dari Neon Console → Connect → Storage, atau Project Settings → Credentials):
 *   AWS_ENDPOINT_URL_S3   mis. https://br-xxxx.storage.c-2.ap-southeast-1.aws.neon.tech
 *                         (GET /projects/{id}/branches/{id}/storage → s3_endpoint)
 *   AWS_REGION            mis. ap-southeast-1
 *   AWS_ACCESS_KEY_ID     token_id kredensial (nak_live_...)
 *   AWS_SECRET_ACCESS_KEY s3_secret_access_key (nsk_live_...)
 *   STORAGE_PUBLIC_URL    (opsional) base URL publik bila memakai domain/CDN sendiri; default = AWS_ENDPOINT_URL_S3
 *
 * Bucket dibuat dengan access level `public_read` (baca anonim, tulis wajib kredensial);
 * URL publik objek = <endpoint>/<bucket>/<key>. Nama bucket sama dengan bucket Supabase lama
 * (mis. "site-assets") sehingga URL lama dapat dipetakan 1:1 saat migrasi.
 */
import fs from "node:fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function cfg() {
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || "").replace(/\/$/, "");
  const region = process.env.AWS_REGION || "";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";
  const publicUrl = (process.env.STORAGE_PUBLIC_URL || endpoint).replace(/\/$/, "");
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("Storage belum dikonfigurasi (AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)");
  }
  return { endpoint, region, accessKeyId, secretAccessKey, publicUrl };
}

function s3(): S3Client {
  if (!client) {
    const c = cfg();
    client = new S3Client({
      region: c.region,
      endpoint: c.endpoint,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
      forcePathStyle: true, // Neon hanya mendukung path-style
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return client;
}

/** Upload file dari disk dan kembalikan URL publiknya. */
export async function uploadFromDisk(opts: {
  bucket: string;
  key: string;
  filePath: string;
  contentType: string;
}): Promise<string> {
  const c = cfg();
  // Dibaca penuh ke buffer: dokumentasi Neon hanya menjamin Body string/Buffer (bukan stream).
  // Ukuran upload dibatasi multer, dan satu PutObject maksimum 5 GiB.
  const body = await fs.promises.readFile(opts.filePath);
  await s3().send(
    new PutObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
      Body: body,
      ContentType: opts.contentType,
      CacheControl: "public, max-age=31536000",
    }),
  );
  return `${c.publicUrl}/${opts.bucket}/${opts.key.split("/").map(encodeURIComponent).join("/")}`;
}
