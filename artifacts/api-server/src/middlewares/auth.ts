import { type Request, type Response, type NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

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

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.slice(7).trim();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id,name,email,role,is_active")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      res.status(403).json({ error: "Profile not found" });
      return;
    }

    if (!profile.is_active) {
      res.status(403).json({ error: "Account is inactive" });
      return;
    }

    req.user = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      isActive: profile.is_active,
    };

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
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.slice(7).trim();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id,name,email,role,is_active")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      res.status(403).json({ error: "Profile not found" });
      return;
    }

    if (!profile.is_active) {
      res.status(403).json({ error: "Account is inactive" });
      return;
    }

    if (profile.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    req.user = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      isActive: profile.is_active,
    };

    next();
  } catch (err) {
    console.error("[middleware/auth] requireAdmin EXCEPTION:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export function getTokenUserId(_req: Request): string | null {
  return null;
}