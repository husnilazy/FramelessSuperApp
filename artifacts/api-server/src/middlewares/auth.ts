import { type Request, type Response, type NextFunction } from "express";
import { tokenStore } from "../routes/auth";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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
  (req as any).userId = userId;
  next();
}
