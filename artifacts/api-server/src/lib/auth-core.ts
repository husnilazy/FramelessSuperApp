/**
 * Autentikasi milik sendiri (menggantikan Supabase Auth).
 *
 * - Password disimpan sebagai hash bcrypt di kolom `users.password` (Neon).
 *   Hash bcrypt dari Supabase (`auth.users.encrypted_password`) kompatibel,
 *   jadi user lama login dengan password yang sama (lihat scripts/migrate-to-neon.mjs auth).
 * - Session = JWT HS256 yang ditandatangani dengan AUTH_JWT_SECRET.
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const SESSION_TTL = process.env.AUTH_SESSION_TTL || "7d";

function secret(): string {
  const s = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || "";
  if (!s) throw new Error("AUTH_JWT_SECRET belum di-set");
  return s;
}

/** Hash valid untuk dibandingkan saat email tidak ditemukan (menyamakan waktu respons). */
export const DUMMY_HASH = bcrypt.hashSync("tidak-dipakai", 10);

export const hashPassword =(plain: string) => bcrypt.hash(plain, 10);

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function signSession(user: { id: string; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email, typ: "session" }, secret(), {
    algorithm: "HS256",
    expiresIn: SESSION_TTL as jwt.SignOptions["expiresIn"],
  });
}

export type AuthUser = { id: string; email: string };

/**
 * Pengganti `supabase.auth.getUser(token)` dengan bentuk hasil yang sama,
 * agar pemanggil lama tidak perlu diubah.
 */
export async function getAuthUser(
  token: string,
): Promise<{ data: { user: AuthUser | null }; error: Error | null }> {
  try {
    const p = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as Record<string, unknown>;
    if (p.typ !== "session" || typeof p.sub !== "string") throw new Error("bukan token session");
    return { data: { user: { id: p.sub, email: String(p.email ?? "") } }, error: null };
  } catch (e) {
    return { data: { user: null }, error: e as Error };
  }
}

/** Cari user (termasuk hash password) berdasarkan email, tanpa membedakan huruf besar/kecil. */
export async function findUserForLogin(email: string) {
  const [u] = await db
    .select()
    .from(usersTable)
    .where(eq(sql`lower(${usersTable.email})`, email.toLowerCase()))
    .limit(1);
  return u ?? null;
}
