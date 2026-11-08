/**
 * Akses tabel `users` langsung lewat Drizzle (Postgres/Neon).
 *
 * Sebelumnya memakai PostgREST milik Supabase (`supabase.from("users")`), yang tidak
 * ada di Neon. Bentuk hasil sengaja dibuat snake_case agar sama dengan kontrak lama
 * sehingga pemanggil tidak perlu diubah.
 */
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
};

const toRow = (u: typeof usersTable.$inferSelect): UserRow => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  is_active: u.isActive,
  avatar_url: u.avatarUrl,
  created_at: u.createdAt,
  updated_at: u.updatedAt,
});

/** Ambil profil user berdasarkan id; null bila tidak ada. Melempar error bila DB gagal. */
export async function findUserById(id: string): Promise<UserRow | null> {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return u ? toRow(u) : null;
}

/** Buat profil user baru. */
export async function createUserProfile(input: {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role?: string;
  isActive?: boolean;
}): Promise<UserRow> {
  const [u] = await db
    .insert(usersTable)
    .values({
      id: input.id,
      name: input.name,
      email: input.email,
      password: input.passwordHash ?? null,
      role: input.role ?? "USER",
      isActive: input.isActive ?? true,
    })
    .returning();
  return toRow(u);
}
