import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

console.log("\n[🔧 Supabase Config]");
console.log("  SUPABASE_URL:", supabaseUrl ? "✅ SET" : "❌ EMPTY");
console.log("  SUPABASE_ANON_KEY:", supabaseKey ? "✅ SET" : "❌ EMPTY");
console.log("  SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅ SET" : "❌ EMPTY\n");

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ FATAL: Supabase credentials missing!");
}

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Login endpoint
router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    console.log(`[auth/login] Attempt: ${email}`);

    if (!email || !password) {
      console.warn("[auth/login] Missing email or password");
      res.status(400).json({
        error: "Email dan password wajib diisi",
      });
      return;
    }

    // Step 1: SignIn dengan Supabase Auth
    console.log("[auth/login] Step 1: Attempting Supabase signIn...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      console.error("[auth/login] Auth error:", authError.message);
      res.status(401).json({
        error: "Email atau password salah",
      });
      return;
    }

    if (!authData.user) {
      console.error("[auth/login] No user returned from auth");
      res.status(401).json({
        error: "User tidak ditemukan",
      });
      return;
    }

    console.log(`[auth/login] Step 1 OK: User ID ${authData.user.id}`);

    // Step 2: Get user profile
    console.log("[auth/login] Step 2: Fetching user profile...");
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      console.error("[auth/login] Profile fetch error:", profileError.message);
      // Return 500 dengan detail error untuk debugging
      res.status(500).json({
        error: "Gagal mengambil profile user",
        detail: profileError.message,
      });
      return;
    }

    if (!userProfile) {
      console.error("[auth/login] User profile not found in database");
      res.status(500).json({
        error: "Profile user tidak ditemukan di database",
      });
      return;
    }

    console.log(`[auth/login] Step 2 OK: Profile found`);

    // Step 3: Check if active
    if (!userProfile.is_active) {
      console.warn("[auth/login] User inactive:", authData.user.id);
      res.status(403).json({
        error: "Akun tidak aktif. Hubungi administrator.",
      });
      return;
    }

    // Step 4: Success response
    const token = authData.session?.access_token;
    if (!token) {
      console.error("[auth/login] No token in session");
      res.status(500).json({
        error: "Gagal membuat session token",
      });
      return;
    }

    console.log(`[auth/login] ✅ SUCCESS for ${email}`);

    const response = {
      token,
      user: {
        id: authData.user.id,
        name: userProfile.name,
        email: authData.user.email,
        role: userProfile.role,
        isActive: userProfile.is_active,
      },
    };

    console.log("[auth/login] Sending response:", JSON.stringify(response, null, 2));
    res.json(response);

  } catch (err) {
    console.error("[auth/login] EXCEPTION:", err);
    res.status(500).json({
      error: "Server error",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// Logout endpoint
router.post("/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      await supabase.auth.signOut();
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("[auth/logout]", err);
    res.status(500).json({ error: "Logout failed" });
  }
});

// Get current user endpoint
router.get("/auth/me", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.slice(7);

    // Verify token
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      console.error("[auth/me] Token verification failed:", error?.message);
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Get profile
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profileError || !userProfile) {
      console.error("[auth/me] Profile error:", profileError?.message);
      res.status(401).json({ error: "User tidak ditemukan" });
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
    console.error("[auth/me] Exception:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Register endpoint (optional)
router.post("/auth/register", async (req, res): Promise<void> => {
  try {
    const { email, password, name } = req.body ?? {};

    if (!email || !password || !name) {
      res.status(400).json({
        error: "Email, password, dan name wajib diisi",
      });
      return;
    }

    // Create auth user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (error) {
      console.error("[auth/register] Error creating user:", error.message);
      res.status(400).json({
        error: error.message || "Gagal membuat user",
      });
      return;
    }

    // Create profile
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .insert({
        id: data.user.id,
        name,
        email: data.user.email,
        role: "USER",
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error("[auth/register] Profile error:", profileError.message);
      res.status(500).json({
        error: "Gagal membuat profile user",
      });
      return;
    }

    console.log(`[auth/register] ✅ User registered: ${email}`);

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
    console.error("[auth/register] Exception:", err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

export default router;