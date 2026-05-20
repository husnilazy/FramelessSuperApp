import { Router, type IRouter } from "express";
import { db, teamMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function hashCrewPw(pw: string) {
  return crypto.createHash("sha256").update(pw + "frameless_crew_salt").digest("hex");
}

const router: IRouter = Router();

router.get("/team", async (_req, res): Promise<void> => {
  const members = await db
    .select()
    .from(teamMembersTable)
    .orderBy(teamMembersTable.orderIndex);
  res.json(members.map(mapMember));
});

router.post("/team", async (req, res): Promise<void> => {
  const { name, role, email, phone, department, status, avatarUrl, joinedDate, canLogin, password } = req.body;
  if (!name || !role) {
    res.status(400).json({ error: "Name and role are required" });
    return;
  }
  const [member] = await db
    .insert(teamMembersTable)
    .values({
      name,
      role,
      email,
      phone,
      department,
      status: status || "active",
      avatarUrl,
      joinedDate,
      isActive: true,
      canLogin: canLogin || false,
      password: password ? hashCrewPw(password) : null,
    })
    .returning();
  res.status(201).json(mapMember(member));
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
  const { name, role, email, phone, department, status, avatarUrl, isActive, joinedDate, canLogin, password } = req.body;
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
    isActive: m.isActive,
    joinedDate: m.joinedDate,
    orderIndex: m.orderIndex,
    canLogin: m.canLogin,
    createdAt: m.createdAt,
  };
}

export default router;
