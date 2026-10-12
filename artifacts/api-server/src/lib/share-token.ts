import crypto from "crypto";

/**
 * Token link publik untuk invoice / kwitansi (tanpa login, bisa dikirim ke client).
 * Bentuk: base64url("<invoiceId>|<doc>|<paymentId>") + "." + HMAC-SHA256.
 * Tidak bisa ditebak atau dipalsukan tanpa secret server; ganti SHARE_SECRET untuk mencabut semua link.
 */
function secret(): string {
  return process.env.SHARE_SECRET || process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export type ShareDoc = { invoiceId: string; doc: "invoice" | "receipt"; paymentId: string };

export function makeShareToken(d: ShareDoc): string {
  if (!secret()) throw new Error("SHARE_SECRET / JWT_SECRET belum diset");
  const payload = b64(`${d.invoiceId}|${d.doc}|${d.paymentId}`);
  return `${payload}.${sign(payload)}`;
}

export function readShareToken(token: string): ShareDoc | null {
  if (!secret()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [invoiceId, doc, paymentId] = Buffer.from(payload, "base64url").toString("utf8").split("|");
  if (!invoiceId || (doc !== "invoice" && doc !== "receipt")) return null;
  return { invoiceId, doc, paymentId: paymentId || "" };
}
