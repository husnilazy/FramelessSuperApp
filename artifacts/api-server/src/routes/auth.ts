// artifacts/api-server/src/routes/auth.ts
import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

// ── In-memory token store (exported for middleware) ───────────────────────────
export const tokenStore = new Map<string, string>();

// ── Helpers ───────────────────────────────────────────────────────────────────
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "frameless_salt").digest("hex");
}

function generateId(): string {
  return crypto.randomBytes(12).toString("hex");
}

// ── Auto-seed default admin if users table is empty ───────────────────────────
async function ensureDefaultAdmin() {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (users.length === 0) {
      const defaultEmail    = process.env.DEFAULT_ADMIN_EMAIL    || "admin@frameless.com";
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
      await db.insert(usersTable).values({
        id:       generateId(),
        name:     "Admin Frameless",
        email:    defaultEmail,
        password: hashPassword(defaultPassword),
        role:     "ADMIN",
        isActive: true,
      });
      console.log(`[auth] Default admin created: ${defaultEmail} / ${defaultPassword}`);
    }
  } catch (err) {
    // Table might not exist yet — migrations haven't run
    console.warn("[auth] Could not check/seed admin user:", (err as Error).message);
  }
}

// Run once at startup (non-blocking)
ensureDefaultAdmin();

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email dan password wajib diisi" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.trim().toLowerCase()))
      .limit(1);

    if (!user) {
      // Try case-insensitive fallback
      const allUsers = await db.select().from(usersTable).limit(100);
      const found = allUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!found) {
        res.status(401).json({ error: "Email atau password salah" });
        return;
      }
      // redirect to found user
      const hashed = hashPassword(password);
      if (found.password !== hashed && found.password !== password) {
        res.status(401).json({ error: "Email atau password salah" });
        return;
      }
      if (!found.isActive) {
        res.status(403).json({ error: "Akun tidak aktif. Hubungi administrator." });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      tokenStore.set(token, found.id);
      res.json({
        token,
        user: { id: found.id, name: found.name, email: found.email, role: found.role },
      });
      return;
    }

    // Check password — support both hashed and plain (legacy)
    const hashed = hashPassword(password);
    const valid  = user.password === hashed || user.password === password;

    if (!valid) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Akun tidak aktif. Hubungi administrator." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    tokenStore.set(token, user.id);

    res.json({
      token,
      user: {
        id:        user.id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        isActive:  user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[auth/login] Error:", err);

    // Give a helpful message if DB is not connected
    const msg = (err as Error).message || "";
    if (msg.includes("DATABASE_URL") || msg.includes("ECONNREFUSED") || msg.includes("connect")) {
      res.status(503).json({ error: "Database tidak terhubung. Pastikan DATABASE_URL sudah di-set dan PostgreSQL berjalan." });
    } else if (msg.includes("relation") || msg.includes("does not exist")) {
      res.status(503).json({ error: "Tabel database belum dibuat. Jalankan: pnpm db:push" });
    } else {
      res.status(500).json({ error: "Server error. Cek log untuk detail." });
    }
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post("/auth/logout", (req, res): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    tokenStore.delete(authHeader.slice(7));
  }
  res.json({ success: true });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token  = authHeader.slice(7);
    const userId = tokenStore.get(token);
    if (!userId) {
      res.status(401).json({ error: "Token tidak valid atau sudah expired. Silakan login ulang." });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      tokenStore.delete(token);
      res.status(401).json({ error: "User tidak ditemukan atau tidak aktif" });
      return;
    }

    res.json({
      id:        user.id,
      name:      user.name,
      email:     user.email,
      role:      user.role,
      isActive:  user.isActive,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("[auth/me] Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /auth/change-password ────────────────────────────────────────────────
router.post("/auth/change-password", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = tokenStore.get(authHeader.slice(7));
    if (!userId) {
      res.status(401).json({ error: "Token tidak valid" });
      return;
    }

    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current dan new password wajib diisi" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password baru minimal 6 karakter" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }

    const hashedCurrent = hashPassword(currentPassword);
    if (user.password !== hashedCurrent && user.password !== currentPassword) {
      res.status(401).json({ error: "Password saat ini tidak cocok" });
      return;
    }

    await db
      .update(usersTable)
      .set({ password: hashPassword(newPassword) })
      .where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Password berhasil diubah" });
  } catch (err) {
    console.error("[auth/change-password] Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;