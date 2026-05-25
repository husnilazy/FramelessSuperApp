import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET =
  process.env.JWT_SECRET || "frameless-dev-secret";

type TokenPayload = {
  userId: string;
};

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

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as TokenPayload;

    (req as any).userId = decoded.userId;

    next();

  } catch {
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

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

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as TokenPayload;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .limit(1);

    if (!user) {
      res.status(403).json({
        error: "User not found",
      });
      return;
    }

    (req as any).userId = user.id;

    next();

  } catch {
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}

export function getTokenUserId(
  req: Request
): string | null {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token =
      authHeader.slice(7).trim();

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as TokenPayload;

    return decoded.userId;

  } catch {
    return null;
  }
}