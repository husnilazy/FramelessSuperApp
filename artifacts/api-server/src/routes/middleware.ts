import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getCrewMemberIdFromToken } from "./crew.js";
import { findUserById } from "../lib/users-repo.js";
import { getAuthUser } from "../lib/auth-core.js";

/** Token darurat (aktif hanya bila EMERGENCY_JWT_SECRET di-set) — sama dengan penjaga di middlewares/auth.ts */
function emergencyUser(token: string): { id: string; email: string; role: string } | null {
  const secret = process.env.EMERGENCY_JWT_SECRET || "";
  if (!secret) return null;
  try {
    const p = jwt.verify(token, secret) as Record<string, unknown>;
    if (p._emergency && typeof p.email === "string") return { id: "emergency", email: p.email, role: "ADMIN" };
  } catch {
    /* bukan token darurat */
  }
  return null;
}

type TokenPayload = {
  sub: string; // ID user (users.id)
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

    const emergency = emergencyUser(token);
    if (emergency) {
      (req as any).userId = emergency.id;
      (req as any).user = emergency;
      next();
      return;
    }

    // Verifikasi token session (JWT)
    const { data, error } = await getAuthUser(token);

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

    const emergency = emergencyUser(token);
    if (emergency) {
      (req as any).userId = emergency.id;
      (req as any).user = emergency;
      (req as any).userProfile = { id: emergency.id, role: "ADMIN", email: emergency.email };
      next();
      return;
    }

    // Verify token
    const { data, error } = await getAuthUser(token);

    if (error || !data.user) {
      res.status(401).json({
        error: "Invalid or expired token",
      });
      return;
    }

    const userId = data.user.id;

    // Get user profile untuk check role
    const userProfile = await findUserById(userId);

    if (!userProfile) {
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

    const { data, error } = await getAuthUser(token);

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
    return await findUserById(userId);

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

    // 2. Token darurat
    const emergency = emergencyUser(token);
    if (emergency) {
      (req as any).userId = emergency.id;
      (req as any).user = { id: emergency.id, email: emergency.email, role: "admin", isActive: true };
      return next();
    }

    // 3. Token session user
    const { data, error } = await getAuthUser(token);

    if (error || !data.user) {
      res.status(401).json({
        error: "Invalid or expired token",
      });
      return;
    }

    const userProfile = await findUserById(data.user.id).catch(() => null);

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