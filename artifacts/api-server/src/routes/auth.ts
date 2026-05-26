import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("[auth] Missing Supabase env vars");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email dan password wajib diisi" });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (authError || !authData.user) {
      console.error("[auth/login] Auth error:", authError?.message);
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id,name,email,role,is_active")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[auth/login] Profile fetch error:", profileError.message);
      res.status(500).json({
        error: "Gagal mengambil profile user",
        detail: profileError.message,
      });
      return;
    }

    if (!userProfile) {
      res.status(404).json({
        error: "Profile user belum dibuat",
      });
      return;
    }

    if (!userProfile.is_active) {
      res.status(403).json({
        error: "Akun tidak aktif. Hubungi administrator.",
      });
      return;
    }

    const token = authData.session?.access_token;
    if (!token) {
      res.status(500).json({ error: "Gagal membuat session token" });
      return;
    }

    res.json({
      token,
      user: {
        id: authData.user.id,
        name: userProfile.name,
        email: authData.user.email,
        role: userProfile.role,
        isActive: userProfile.is_active,
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

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id,name,email,role,is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) {
      res.status(500).json({
        error: "Gagal mengambil profile user",
        detail: profileError.message,
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
      res.status(400).json({
        error: "Email, password, dan name wajib diisi",
      });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      console.error("[auth/register] Error creating user:", error?.message);
      res.status(400).json({
        error: error?.message || "Gagal membuat user",
      });
      return;
    }

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .insert({
        id: data.user.id,
        name,
        email: data.user.email,
        role: "USER",
        is_active: true,
      })
      .select("id,name,email,role,is_active")
      .maybeSingle();

    if (profileError || !userProfile) {
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
    res.status(500).json({
      error: "Server error",
    });
  }
});

export default router;