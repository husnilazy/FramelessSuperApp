import { Router, type IRouter } from "express";
import { db, teamMembersTable, projectTasksTable, teamAvailabilityTable, projectsTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../lib/logger.js";
import { isAdminRequest } from "../middlewares/auth.js";
import { getCrewMemberIdFromToken } from "./crew.js";

const router: IRouter = Router();

// Fix TS18047
const dbPool = pool!;

function hashCrewPw(pw: string) {
  return crypto
    .createHash("sha256")
    .update(pw + "frameless_crew_salt")
    .digest("hex");
}
function mapMember(m: any) {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    email: m.email,
    phone: m.phone,
    department: m.department,
    status: m.status,
    avatarUrl: m.avatarUrl ?? m.avatar_url,
    username: m.username ?? null,
    whatsapp: m.whatsapp ?? null,
    instagram: m.instagram ?? null,
    linkedin: m.linkedin ?? null,
    twitter: m.twitter ?? null,
    website: m.website ?? null,
    isActive: m.isActive ?? m.is_active,
    joinedDate: m.joinedDate ?? m.joined_date,
    orderIndex: m.orderIndex ?? m.order_index,
    canLogin: m.canLogin ?? m.can_login,
    createdAt: m.createdAt ?? m.created_at,
    updatedAt: m.updatedAt ?? m.updated_at,
  };
}

/** Field yang aman ditampilkan di landing page publik (tanpa email/telepon/status login). */
function mapPublicMember(m: any) {
  const full = mapMember(m);
  return {
    id: full.id,
    name: full.name,
    role: full.role,
    department: full.department,
    avatarUrl: full.avatarUrl,
    username: full.username,
    whatsapp: full.whatsapp,
    instagram: full.instagram,
    linkedin: full.linkedin,
    twitter: full.twitter,
    website: full.website,
    isActive: full.isActive,
    orderIndex: full.orderIndex,
  };
}

/** Admin atau crew yang login boleh melihat detail lengkap. */
async function canSeeTeamDetails(req: any): Promise<boolean> {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) {
    if (getCrewMemberIdFromToken(h.slice(7).trim())) return true;
  }
  return isAdminRequest(req);
}

const columnMap: Record<string, string> = {
  name: "name",
  role: "role",
  email: "email",
  phone: "phone",
  department: "department",
  status: "status",
  avatarUrl: "avatar_url",
  avatar_url: "avatar_url",
  username: "username",
  whatsapp: "whatsapp",
  instagram: "instagram",
  linkedin: "linkedin",
  twitter: "twitter",
  website: "website",
  isActive: "is_active",
  is_active: "is_active",
  joinedDate: "joined_date",
  joined_date: "joined_date",
  orderIndex: "order_index",
  order_index: "order_index",
  canLogin: "can_login",
  can_login: "can_login",
  password: "password"
};

async function buildInsertData(body: any) {
  const colRes = await dbPool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='team_members'
  `);

  const existingCols = new Set(
    colRes.rows.map((r: any) => r.column_name)
  );

  const insertCols: string[] = [];
  const values: any[] = [];

  for (const key of Object.keys(body)) {
    const col = columnMap[key] || key;

    if (
      existingCols.has(col) &&
      !["id", "created_at", "updated_at"].includes(col)
    ) {
      insertCols.push(col);

      let value = body[key];

      if (col === "password" && value) {
        value = hashCrewPw(String(value));
      }

      values.push(value);
    }
  }

  return { insertCols, values };
}

/* ================= GET ALL ================= */

router.get("/team", async (_req, res): Promise<void> => {
  try {
    const r = await dbPool.query(`
        SELECT *
        FROM team_members
        ORDER BY order_index
    `);

    const detailed = await canSeeTeamDetails(_req);
    // Publik (landing) hanya melihat anggota aktif; admin/crew melihat semuanya.
    const rows = detailed ? r.rows : r.rows.filter((m: any) => (m.is_active ?? m.isActive) !== false);
    res.setHeader("Cache-Control", "no-store");
    res.json(rows.map(detailed ? mapMember : mapPublicMember));

  } catch (err) {
    logger.error({ err }, "team.get.error");

    res.status(500).json({
      error: "Failed to fetch team"
    });
  }
});

/* ================= GET BY ID ================= */

router.get("/team/:id", async (req, res): Promise<void> => {
  try {
    if (!(await canSeeTeamDetails(req))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = String(req.params.id);

    const [member] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, id))
      .limit(1);

    if (!member) {
      res.status(404).json({
        error: "Team member not found"
      });
      return;
    }

    res.json(mapMember(member));

  } catch (err) {
    logger.error({ err }, "team.getbyid.error");

    res.status(500).json({
      error: "Failed to fetch member"
    });
  }
});

/* ================= CREATE ================= */

router.post("/team", async (req, res): Promise<void> => {
  try {
    if (!req.body.name || !req.body.role) {
      res.status(400).json({
        error: "Name and role required"
      });
      return;
    }

    const { insertCols, values } =
      await buildInsertData(req.body);

    const placeholders = insertCols.map(
      (_, i) => `$${i + 1}`
    );

    const sql = `
      INSERT INTO team_members
      (${insertCols.join(",")})
      VALUES (${placeholders.join(",")})
      RETURNING *
    `;

    const result = await dbPool.query(
      sql,
      values
    );

    res
      .status(201)
      .json(
        mapMember(
          result.rows[0]
        )
      );

  } catch (err) {
    logger.error({ err }, "team.post.error");

    res.status(500).json({
      error: "Failed creating team member"
    });
  }
});

/* ================= SAFE CREATE ================= */

router.post("/team-safe", async (req, res): Promise<void> => {
  try {
    const { insertCols, values } =
      await buildInsertData(req.body);

    const placeholders = insertCols.map(
      (_, i) => `$${i + 1}`
    );

    const sql = `
      INSERT INTO team_members
      (${insertCols.join(",")})
      VALUES (${placeholders.join(",")})
      RETURNING *
    `;

    const result = await dbPool.query(
      sql,
      values
    );

    res
      .status(201)
      .json(
        mapMember(
          result.rows[0]
        )
      );

  } catch (err) {
    logger.error({ err }, "team.safe.error");

    res.status(500).json({
      error: "Failed creating member"
    });
  }
});

/* ================= UPDATE ================= */

router.put("/team/:id", async (req, res): Promise<void> => {
  try {

    const id = String(req.params.id);

    const payload = {
      ...req.body,
      ...(req.body.password && {
        password: hashCrewPw(req.body.password)
      }),
      updatedAt: new Date()
    };

    const [member] = await db
      .update(teamMembersTable)
      .set(payload)
      .where(eq(teamMembersTable.id, id))
      .returning();

    if (!member) {
      res.status(404).json({
        error: "Member not found"
      });
      return;
    }

    res.json(
      mapMember(member)
    );

  } catch (err) {

    logger.error({ err }, "team.update.error");

    res.status(500).json({
      error: "Failed updating member"
    });
  }
});

/* ================= DELETE ================= */

router.delete("/team/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    // Bersihkan data ringan yang memang milik anggota ini.
    await db.delete(projectTasksTable).where(eq(projectTasksTable.memberId, id));
    await db.delete(teamAvailabilityTable).where(eq(teamAvailabilityTable.memberId, id));
    // Lepas penugasan di project agar FK tidak menghalangi.
    await db.update(projectsTable).set({ assignedMemberId: null }).where(eq(projectsTable.assignedMemberId, id));

    await db.delete(teamMembersTable).where(eq(teamMembersTable.id, id));
    res.json({ success: true, archived: false });
  } catch (err: any) {
    // 23503 = foreign_key_violation: anggota punya riwayat (dokumen filmmaking, file, dll.).
    // Jangan hilangkan riwayat itu: nonaktifkan akun & sembunyikan dari landing.
    if (err?.code === "23503" || err?.cause?.code === "23503") {
      try {
        await dbPool.query(
          `UPDATE team_members SET is_active = false, can_login = false, status = 'inactive' WHERE id = $1`,
          [id],
        );
        res.json({ success: true, archived: true });
        return;
      } catch (e2) {
        logger.error({ err: e2 }, "team.delete.archive.error");
      }
    }
    logger.error({ err }, "team.delete.error");
    res.status(500).json({ error: "Failed deleting member" });
  }
});

/* ================= DEBUG ================= */

router.get("/team-columns", async (_req, res): Promise<void> => {

  try {

    const r = await dbPool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='team_members'
      ORDER BY ordinal_position
    `);

    res.json({
      columns: r.rows.map(
        (r: any) => r.column_name
      )
    });

  } catch (err) {

    logger.error(
      { err },
      "team.columns.error"
    );

    res.status(500).json({
      error: "Failed"
    });
  }
});

export default router;
