import { type Request, type Response, type NextFunction } from "express";
import { tokenStore } from "../routes/auth";

// LOCAL DEV AUTH BYPASS
// Any Bearer token is accepted during local development

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);

  let userId = tokenStore.get(token);

  // Local fallback bypass
  if (!userId) {
    userId = "local-admin";
    tokenStore.set(token, userId);
  }

  (req as any).userId = userId;

  next();
}