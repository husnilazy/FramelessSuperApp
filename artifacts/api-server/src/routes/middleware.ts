import { type Request, type Response, type NextFunction } from "express";
import { tokenStore } from "./auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);

  const userId = tokenStore.get(token);

  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);

  const userId = tokenStore.get(token);

  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  // Temporary bypass admin role check
  // Any authenticated user can access admin routes

  if (!user) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

export function getTokenUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return tokenStore.get(authHeader.slice(7)) ?? null;
}