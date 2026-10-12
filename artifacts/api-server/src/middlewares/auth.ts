import { type Request, type Response, type NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

type AuthedRequest = Request & {
  user?: {
    id: string;
    name: string;
    email: string | null;
    role: string;
    isActive: boolean;
  };
};

async function loadUserProfile(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("users")
    .select("id,name,email,role,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return profile;
}

const emergencySecret = process.env.EMERGENCY_JWT_SECRET || "";

/** Token darurat (lihat routes/auth.ts) — hanya valid jika EMERGENCY_JWT_SECRET di-set. */
function verifyEmergency(token: string) {
  if (!emergencySecret) return null;
  try {
    const p = jwt.verify(token, emergencySecret) as Record<string, unknown>;
    if (p._emergency && typeof p.email === "string") {
      return {
        id: "emergency",
        name: "Emergency Admin",
        email: p.email,
        role: "ADMIN",
        is_active: true,
      };
    }
  } catch {
    /* bukan token darurat */
  }
  return null;
}

/** Cek admin tanpa menulis response. Dipakai route publik yang isinya bergantung siapa pemanggilnya. */
export async function isAdminRequest(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return false;
    const token = authHeader.slice(7).trim();
    if (verifyEmergency(token)) return true;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return false;
    const profile = await loadUserProfile(data.user.id);
    return !!profile?.is_active && profile.role === "ADMIN";
  } catch {
    return false;
  }
}

async function authenticate(req: AuthedRequest, res: Response) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const token = authHeader.slice(7).trim();

  const emergency = verifyEmergency(token);
  if (emergency) {
    req.user = {
      id: emergency.id,
      name: emergency.name,
      email: emergency.email,
      role: emergency.role,
      isActive: true,
    };
    return emergency;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }

  const profile = await loadUserProfile(data.user.id);
  if (!profile) {
    res.status(403).json({ error: "Profile not found" });
    return null;
  }

  if (!profile.is_active) {
    res.status(403).json({ error: "Account is inactive" });
    return null;
  }

  req.user = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    isActive: profile.is_active,
  };

  return profile;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await authenticate(req, res);
    if (!profile) return;
    next();
  } catch (err) {
    console.error("[middleware/auth] requireAuth EXCEPTION:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export async function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await authenticate(req, res);
    if (!profile) return;

    if (profile.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  } catch (err) {
    console.error("[middleware/auth] requireAdmin EXCEPTION:", err);
    res.status(500).json({ error: "Server error" });
  }
}