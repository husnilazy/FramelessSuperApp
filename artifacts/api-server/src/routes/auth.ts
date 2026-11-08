import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { findUserById, createUserProfile } from "../lib/users-repo.js";
import { getAuthUser, hashPassword, verifyPassword, signSession, findUserForLogin, DUMMY_HASH } from "../lib/auth-core.js";

const router: IRouter = Router();

if (!process.env.AUTH_JWT_SECRET && !process.env.JWT_SECRET) {
  console.error("[auth] AUTH_JWT_SECRET belum di-set — login akan gagal");
}

// ============================================================
// ⚠️  EMERGENCY BYPASS — Pintu darurat bila database/login bermasalah
//     Set env vars berikut untuk mengaktifkan:
//       EMERGENCY_BYPASS_EMAIL=<email admin>
//       EMERGENCY_BYPASS_PASSWORD=<password sementara>
//       EMERGENCY_JWT_SECRET=<random string panjang>
//     HAPUS ke-3 env vars ini setelah layanan normal
// ============================================================
const BYPASS_EMAIL    = process.env.EMERGENCY_BYPASS_EMAIL    || "";
const BYPASS_PASSWORD = process.env.EMERGENCY_BYPASS_PASSWORD || "";
const BYPASS_SECRET   = process.env.EMERGENCY_JWT_SECRET      || "";

const BYPASS_ACTIVE = !!(BYPASS_EMAIL && BYPASS_PASSWORD && BYPASS_SECRET);

if (BYPASS_ACTIVE) {
  console.warn("[auth] ⚠️  EMERGENCY BYPASS AKTIF — nonaktifkan setelah layanan normal");
}

/** Buat emergency JWT sementara (7 hari) */
function makeEmergencyToken(email: string): string {
  return jwt.sign(
    { sub: "emergency", email, role: "ADMIN", _emergency: true },
    BYPASS_SECRET,
    { expiresIn: "7d" }
  );
}

/** Cek apakah token adalah emergency JWT yang valid */
function verifyEmergencyToken(token: string): { email: string; role: string } | null {
  if (!BYPASS_SECRET) return null;
  try {
    const payload = jwt.verify(token, BYPASS_SECRET) as Record<string, unknown>;
    if (payload._emergency && typeof payload.email === "string") {
      return { email: payload.email, role: String(payload.role ?? "ADMIN") };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================

router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email dan password wajib diisi" });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // --- EMERGENCY BYPASS ---
    if (BYPASS_ACTIVE && normalizedEmail === BYPASS_EMAIL && password === BYPASS_PASSWORD) {
      console.warn("[auth/login] Emergency bypass digunakan oleh:", normalizedEmail);
      const token = makeEmergencyToken(normalizedEmail);
      res.json({
        token,
        user: {
          id: "emergency-admin",
          name: "Admin (Emergency)",
          email: normalizedEmail,
          role: "ADMIN",
          isActive: true,
        },
      });
      return;
    }
    // --- END EMERGENCY BYPASS ---

    let dbUser;
    try {
      dbUser = await findUserForLogin(normalizedEmail);
    } catch (profileError: any) {
      console.error("[auth/login] Profile fetch error:", profileError?.message);
      res.status(500).json({
        error: "Gagal mengambil profile user",
        detail: profileError?.message,
      });
      return;
    }

    // Selalu jalankan bcrypt (hash palsu bila user tidak ada) agar waktu respons tidak membocorkan keberadaan email
    const passwordOk = await verifyPassword(String(password), dbUser?.password ?? DUMMY_HASH);

    if (!dbUser || !dbUser.password || !passwordOk) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    if (!dbUser.isActive) {
      res.status(403).json({ error: "Akun tidak aktif. Hubungi administrator." });
      return;
    }

    const token = signSession({ id: dbUser.id, email: dbUser.email });

    res.json({
      token,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        isActive: dbUser.isActive,
      },
    });
  } catch (err) {
    console.error("[auth/login] EXCEPTION:", err);
    res.status(500).json({
      error: "Server error",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  try {
    res.json({ success: true });
  } catch (err) {
    console.error("[auth/logout] EXCEPTION:", err);
    res.status(500).json({ error: "Logout failed" });
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.slice(7).trim();

    // --- EMERGENCY BYPASS ---
    if (BYPASS_ACTIVE) {
      const emergencyPayload = verifyEmergencyToken(token);
      if (emergencyPayload) {
        res.json({
          id: "emergency-admin",
          name: "Admin (Emergency)",
          email: emergencyPayload.email,
          role: emergencyPayload.role,
          isActive: true,
        });
        return;
      }
    }
    // --- END EMERGENCY BYPASS ---

    const { data, error } = await getAuthUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    let userProfile;
    try {
      userProfile = await findUserById(data.user.id);
    } catch (profileError: any) {
      res.status(500).json({
        error: "Gagal mengambil profile user",
        detail: profileError?.message,
      });
      return;
    }

    if (!userProfile) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }

    res.json({
      id: data.user.id,
      name: userProfile.name,
      email: data.user.email,
      role: userProfile.role,
      isActive: userProfile.is_active,
    });
  } catch (err) {
    console.error("[auth/me] EXCEPTION:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/register", async (req, res): Promise<void> => {
  try {
    const { email, password, name } = req.body ?? {};

    if (!email || !password || !name) {
      res.status(400).json({ error: "Email, password, dan name wajib diisi" });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (String(password).length < 8) {
      res.status(400).json({ error: "Password minimal 8 karakter" });
      return;
    }

    if (await findUserForLogin(normalizedEmail)) {
      res.status(400).json({ error: "Email sudah terdaftar" });
      return;
    }

    const data = { user: { id: randomUUID(), email: normalizedEmail } };

    let userProfile;
    try {
      userProfile = await createUserProfile({
        id: data.user.id,
        name,
        email: normalizedEmail,
        passwordHash: await hashPassword(String(password)),
        role: "USER",
        isActive: true,
      });
    } catch (profileError: any) {
      console.error("[auth/register] Profile error:", profileError?.message);
      res.status(500).json({
        error: "Gagal membuat profile user",
        detail: profileError?.message || "Unknown error",
      });
      return;
    }

    res.json({
      user: {
        id: data.user.id,
        name: userProfile.name,
        email: data.user.email,
        role: userProfile.role,
        isActive: userProfile.is_active,
      },
    });
  } catch (err) {
    console.error("[auth/register] EXCEPTION:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;