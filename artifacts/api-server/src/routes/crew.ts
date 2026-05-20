import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { teamMembersTable, projectsTable, projectTasksTable, chatMessagesTable, calendarEventsTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "./middleware";
import crypto from "crypto";

const router: IRouter = Router();

export const crewTokenStore = new Map<string, string>();

function hashPw(pw: string) {
  return crypto.createHash("sha256").update(pw + "frameless_crew_salt").digest("hex");
}

router.post("/crew/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Missing credentials" }); return; }

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.email, email), eq(teamMembersTable.canLogin, true))).limit(1);

  if (!member) { res.status(401).json({ error: "Invalid credentials or access not enabled" }); return; }

  const hashed = hashPw(password);
  if (member.password !== hashed && member.password !== password) {
    res.status(401).json({ error: "Invalid credentials" }); return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  crewTokenStore.set(token, member.id);

  res.json({ member: { id: member.id, name: member.name, role: member.role, email: member.email, department: member.department, avatarUrl: member.avatarUrl }, token });
});

router.post("/crew/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) crewTokenStore.delete(authHeader.slice(7));
  res.json({ success: true });
});

router.get("/crew/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const memberId = crewTokenStore.get(authHeader.slice(7));
  if (!memberId) { res.status(401).json({ error: "Invalid token" }); return; }
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, memberId)).limit(1);
  if (!member) { res.status(401).json({ error: "Not found" }); return; }
  res.json({ id: member.id, name: member.name, role: member.role, email: member.email, department: member.department, avatarUrl: member.avatarUrl });
});

function requireCrewAuth(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const memberId = crewTokenStore.get(authHeader.slice(7));
  if (!memberId) { res.status(401).json({ error: "Invalid token" }); return; }
  req.crewMemberId = memberId;
  next();
}

router.get("/crew/projects", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const projects = await db.select().from(projectsTable)
    .where(or(eq(projectsTable.status, "active"), eq(projectsTable.status, "IN_PROGRESS")))
    .orderBy(desc(projectsTable.createdAt)).limit(20);
  res.json(projects);
});

router.get("/crew/tasks", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const tasks = await db.select().from(projectTasksTable)
    .where(eq(projectTasksTable.memberId, req.crewMemberId))
    .orderBy(desc(projectTasksTable.createdAt)).limit(50);
  res.json(tasks);
});

router.patch("/crew/tasks/:id", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const { status, progress } = req.body;
  const [task] = await db.update(projectTasksTable).set({ status, progress, updatedAt: new Date() })
    .where(eq(projectTasksTable.id, req.params.id)).returning();
  res.json(task);
});

router.get("/crew/chat", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.crewId, req.crewMemberId))
    .orderBy(chatMessagesTable.createdAt).limit(100);
  res.json(messages);
});

router.post("/crew/chat", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const [msg] = await db.insert(chatMessagesTable).values({
    crewId: req.crewMemberId,
    senderRole: "crew",
    senderName: req.body.senderName || "Crew",
    message: req.body.message,
  }).returning();
  res.status(201).json(msg);
});

router.get("/crew/calendar", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const events = await db.select().from(calendarEventsTable)
    .where(or(
      eq(calendarEventsTable.assignedTo, req.crewMemberId),
      eq(calendarEventsTable.assignedTo, "all"),
    ))
    .orderBy(calendarEventsTable.startDate).limit(100);
  res.json(events);
});

router.get("/admin/chat/:crewId", requireAuth, async (req, res): Promise<void> => {
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.crewId, req.params.crewId))
    .orderBy(chatMessagesTable.createdAt).limit(200);
  res.json(messages);
});

router.post("/admin/chat/:crewId", requireAuth, async (req, res): Promise<void> => {
  const [msg] = await db.insert(chatMessagesTable).values({
    crewId: req.params.crewId,
    senderRole: "admin",
    senderName: req.body.senderName || "Admin",
    message: req.body.message,
  }).returning();
  await db.update(chatMessagesTable).set({ isRead: true })
    .where(and(eq(chatMessagesTable.crewId, req.params.crewId), eq(chatMessagesTable.senderRole, "crew")));
  res.status(201).json(msg);
});

export default router;
