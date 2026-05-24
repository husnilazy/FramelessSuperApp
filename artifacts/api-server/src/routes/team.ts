import { Router, type IRouter } from "express";
import { db, teamMembersTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../lib/logger";
import path from "path";

function hashCrewPw(pw: string) {
  return crypto.createHash("sha256").update(pw + "frameless_crew_salt").digest("hex");
}

const router: IRouter = Router();

router.get("/team", async (_req, res): Promise<void> => {
  try {
    const r = await pool.query(`SELECT id, name, role, email, phone, department, status, avatar_url, is_active, joined_date, order_index, can_login, created_at, updated_at FROM team_members ORDER BY order_index`);
    const rows = r.rows || [];
    const normalized = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      email: row.email,
      phone: row.phone,
      department: row.department,
      status: row.status,
      avatarUrl: row.avatar_url,
      username: row.username ?? null,
      whatsapp: row.whatsapp ?? null,
      isActive: row.is_active,
      joinedDate: row.joined_date,
      orderIndex: row.order_index,
      canLogin: row.can_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json(normalized.map(mapMember));
  } catch (err: any) {
    logger.error({ err }, "team.get.error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/team", async (req, res): Promise<void> => {
  // log incoming body to debug insertion issues
  logger.info({ body: req.body }, "team.post.body");
  const { name, role, email, phone, department, status, avatarUrl, joinedDate, canLogin, password, username, whatsapp } = req.body;
  if (!name || !role) {
    res.status(400).json({ error: "Name and role are required" });
    return;
  }
  try {
      // build insert object with fixed column order and explicit nulls
      const insertObj = {
        name: name,
        role: role,
        email: email ?? null,
        phone: phone ?? null,
        department: department ?? null,
        username: username ?? null,
        status: status || "active",
        avatar_url: avatarUrl ?? null,
        whatsapp: whatsapp ?? null,
        is_active: true,
        joined_date: joinedDate ?? null,
        order_index: null,
        can_login: !!canLogin,
        password: password ? hashCrewPw(password) : null,
      } as any;
      try {
        // Dynamically inspect existing columns and only insert supported ones
        const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='team_members' ORDER BY ordinal_position");
        const existingCols = new Set(colRes.rows.map((r: any) => r.column_name));

        const colMap: { [k: string]: string } = {
          name: "name",
          role: "role",
          email: "email",
          phone: "phone",
          department: "department",
          status: "status",
          avatar_url: "avatar_url",
          is_active: "is_active",
          joined_date: "joined_date",
          order_index: "order_index",
          can_login: "can_login",
          password: "password",
          username: "username",
          avatarUrl: "avatar_url",
          isActive: "is_active",
          joinedDate: "joined_date",
          orderIndex: "order_index",
          canLogin: "can_login",
          whatsapp: "whatsapp"
        };

        const insertCols: string[] = [];
        const values: any[] = [];
        for (const key of Object.keys(insertObj)) {
          const pgCol = colMap[key] || key;
          if (existingCols.has(pgCol) && pgCol !== "id" && pgCol !== "created_at" && pgCol !== "updated_at") {
            insertCols.push(pgCol);
            values.push((insertObj as any)[key]);
          }
        }

        if (insertCols.length === 0) {
          throw new Error("No valid columns to insert for team_members");
        }

        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(",");
        const text = `INSERT INTO team_members (${insertCols.join(",")}) VALUES (${placeholders}) RETURNING *`;
        const r = await pool.query(text, values);
        const row = r.rows?.[0];

        const normalized = {
          id: row?.id,
          name: row?.name,
          role: row?.role,
          email: row?.email,
          phone: row?.phone,
          department: row?.department,
          status: row?.status,
          avatarUrl: row?.avatar_url ?? row?.avatarUrl,
          username: row?.username ?? null,
          whatsapp: row?.whatsapp ?? null,
          isActive: row?.is_active ?? row?.isActive,
          joinedDate: row?.joined_date ?? row?.joinedDate,
          orderIndex: row?.order_index ?? row?.orderIndex,
          canLogin: row?.can_login ?? row?.canLogin,
          password: row?.password,
          createdAt: row?.created_at ?? row?.createdAt,
          updatedAt: row?.updated_at ?? row?.updatedAt
        };
        res.status(201).json(mapMember(normalized));
        return;
      } catch (rawErr) {
        logger.error({ err: rawErr }, "raw_sql_insert_failed");
        res.status(500).json({ error: "Failed to create team member", detail: String(rawErr) });
        return;
      }
    return;
    } catch (err:any) {
      logger.error({ err }, "team.post.insert_error");
      try {
          } catch (_e) {}
          res.status(500).json({ error: "Failed to create team member", detail: String(err) });
      return;
    }
});
    // New safe endpoint: accept dynamic fields and only insert existing columns
    router.post("/team-safe", async (req, res): Promise<void> => {
      const body = req.body || {};
      if (!body.name || !body.role) return res.status(400).json({ error: "Name and role are required" });
      try {
        const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='team_members' ORDER BY ordinal_position");
        const existingCols = new Set(colRes.rows.map((r: any) => r.column_name));

        const colMap: { [k: string]: string } = {
          name: "name",
          role: "role",
          email: "email",
          phone: "phone",
          department: "department",
          status: "status",
          avatar_url: "avatar_url",
          avatarUrl: "avatar_url",
          is_active: "is_active",
          isActive: "is_active",
          joined_date: "joined_date",
          joinedDate: "joined_date",
          order_index: "order_index",
          orderIndex: "order_index",
          can_login: "can_login",
          canLogin: "can_login",
          password: "password",
          username: "username",
          whatsapp: "whatsapp",
        };

        const insertCols: string[] = [];
        const values: any[] = [];
        for (const key of Object.keys(body)) {
          const pgCol = colMap[key] || key;
          if (existingCols.has(pgCol) && pgCol !== "id" && pgCol !== "created_at" && pgCol !== "updated_at") {
            insertCols.push(pgCol);
            let v = body[key];
            if (pgCol === "password" && v) v = hashCrewPw(String(v));
            values.push(v);
          }
        }

        if (insertCols.length === 0) {
          return res.status(400).json({ error: "No valid columns to insert" });
        }

        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(",");
        const text = `INSERT INTO team_members (${insertCols.join(",")}) VALUES (${placeholders}) RETURNING *`;
        const r = await pool.query(text, values);
        const row = r.rows?.[0];

        const normalized = {
          id: row?.id,
          name: row?.name,
          role: row?.role,
          email: row?.email,
          phone: row?.phone,
          department: row?.department,
          status: row?.status,
          avatarUrl: row?.avatar_url,
          username: row?.username ?? null,
          whatsapp: row?.whatsapp ?? null,
          isActive: row?.is_active ?? row?.isActive,
          joinedDate: row?.joined_date ?? row?.joinedDate,
          orderIndex: row?.order_index ?? row?.orderIndex,
          canLogin: row?.can_login ?? row?.canLogin,
          password: row?.password,
          createdAt: row?.created_at,
          updatedAt: row?.updated_at,
        };
        return res.status(201).json(mapMember(normalized));
      } catch (err: any) {
        logger.error({ err }, "team.safe.insert_error");
        return res.status(500).json({ error: String(err) });
      }
    });

router.get("/team/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, id)).limit(1);
  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  res.json(mapMember(member));
});

router.put("/team/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, role, email, phone, department, status, avatarUrl, isActive, joinedDate, canLogin, password, username, whatsapp } = req.body;
  const [member] = await db
    .update(teamMembersTable)
    .set({
      ...(name && { name }),
      ...(role && { role }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(department !== undefined && { department }),
      ...(status && { status }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(isActive !== undefined && { isActive }),
      ...(joinedDate !== undefined && { joinedDate }),
      ...(canLogin !== undefined && { canLogin }),
      ...(password && { password: hashCrewPw(password) }),
      ...(username && { username }),
      ...(whatsapp !== undefined && { whatsapp }),
      updatedAt: new Date(),
    })
    .where(eq(teamMembersTable.id, id))
    .returning();
  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  res.json(mapMember(member));
});

router.delete("/team/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, id));
  res.json({ success: true, message: "Team member deleted" });
});

// Temporary debug: list columns for team_members table
router.get("/team-columns", async (_req, res): Promise<void> => {
  try {
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='team_members' ORDER BY ordinal_position`);
    res.json({ columns: r.rows.map((r: any) => r.column_name) });
  } catch (err: any) {
    logger.error({ err }, "team.columns.error");
    res.status(500).json({ error: String(err) });
  }
});

function mapMember(m: any) {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    email: m.email,
    phone: m.phone,
    department: m.department,
    status: m.status,
    avatarUrl: m.avatarUrl,
    username: m.username,
    whatsapp: m.whatsapp,
    isActive: m.isActive,
    joinedDate: m.joinedDate,
    orderIndex: m.orderIndex,
    canLogin: m.canLogin,
    createdAt: m.createdAt,
  };
}

export default router;
