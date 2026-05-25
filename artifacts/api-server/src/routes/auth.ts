import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "frameless-dev-secret";

function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + "frameless_salt")
    .digest("hex");
}

function generateId(): string {
  return crypto.randomBytes(12).toString("hex");
}

function generateToken(userId: string): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function ensureDefaultAdmin() {
  try {
    const users = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .limit(1);

    if (users.length === 0) {
      const defaultEmail =
        process.env.DEFAULT_ADMIN_EMAIL ||
        "admin@frameless.com";

      const defaultPassword =
        process.env.DEFAULT_ADMIN_PASSWORD ||
        "admin123";

      await db.insert(usersTable).values({
        id: generateId(),
        name: "Admin Frameless",
        email: defaultEmail,
        password: hashPassword(defaultPassword),
        role: "ADMIN",
        isActive: true,
      });

      console.log(
        `[auth] Default admin created`
      );
    }
  } catch (err) {
    console.warn(
      "[auth] seed failed:",
      (err as Error).message
    );
  }
}

ensureDefaultAdmin();

router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({
        error: "Email dan password wajib diisi",
      });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        eq(
          usersTable.email,
          email.trim().toLowerCase()
        )
      )
      .limit(1);

    if (!user) {
      res.status(401).json({
        error: "Email atau password salah",
      });
      return;
    }

    const hashed = hashPassword(password);

    const valid =
      user.password === hashed ||
      user.password === password;

    if (!valid) {
      res.status(401).json({
        error: "Email atau password salah",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error:
          "Akun tidak aktif. Hubungi administrator.",
      });
      return;
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });

  } catch (err) {
    console.error("[auth/login]", err);

    res.status(500).json({
      error: "Server error",
    });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({
    success: true,
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const token = authHeader.slice(7);

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    ) as { userId: string };

    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        eq(usersTable.id, decoded.userId)
      )
      .limit(1);

    if (!user) {
      res.status(401).json({
        error: "User tidak ditemukan",
      });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });

  } catch {
    res.status(401).json({
      error: "Token expired",
    });
  }
});

export default router;