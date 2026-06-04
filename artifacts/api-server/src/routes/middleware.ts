import { type Request, type Response, type NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getCrewMemberIdFromToken } from "./crew.js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

type TokenPayload = {
  sub: string; // Supabase user ID
};

// Middleware: Require authentication
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const token = authHeader.slice(7).trim();

    // Verify token dengan Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        error: "Invalid or expired token",
      });
      return;
    }

    (req as any).userId = data.user.id;
    (req as any).user = data.user;

    next();

  } catch (err) {
    console.error("[requireAuth]", err);
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

// Middleware: Require admin role
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const token = authHeader.slice(7).trim();

    // Verify token
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        error: "Invalid or expired token",
      });
      return;
    }

    const userId = data.user.id;

    // Get user profile untuk check role
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      res.status(403).json({
        error: "User not found",
      });
      return;
    }

    // Check if user is admin
    if (userProfile.role !== "ADMIN") {
      res.status(403).json({
        error: "Admin access required",
      });
      return;
    }

    (req as any).userId = userId;
    (req as any).user = data.user;
    (req as any).userProfile = userProfile;

    next();

  } catch (err) {
    console.error("[requireAdmin]", err);
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

// Helper: Get user ID dari token
export async function getTokenUserId(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.slice(7).trim();

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return data.user.id;

  } catch (err) {
    console.error("[getTokenUserId]", err);
    return null;
  }
}

// Helper: Get full user profile
export async function getUserProfile(userId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      return null;
    }

    return data;

  } catch (err) {
    console.error("[getUserProfile]", err);
    return null;
  }
}

// Middleware: Require Universal Auth (Admin or Crew)
export async function requireUniversalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const token = authHeader.slice(7).trim();

    // 1. Check if it is a Crew Token
    const crewMemberId = getCrewMemberIdFromToken(token);
    if (crewMemberId) {
      (req as any).userId = crewMemberId;
      (req as any).user = {
        id: crewMemberId,
        role: "crew",
      };
      return next();
    }

    // 2. Fallback to Supabase token
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({
        error: "Invalid or expired token",
      });
      return;
    }

    const { data: userProfile } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    (req as any).userId = data.user.id;
    (req as any).user = {
      id: data.user.id,
      email: data.user.email,
      role: userProfile?.role?.toLowerCase() || "user",
      isActive: userProfile?.is_active || false,
    };

    next();

  } catch (err) {
    console.error("[requireUniversalAuth]", err);
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}