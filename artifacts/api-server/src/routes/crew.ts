import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { teamMembersTable, projectsTable, projectTasksTable, chatMessagesTable, calendarEventsTable, notificationsTable, projectFilesTable } from "@workspace/db";
import { eq, and, or, desc, not } from "drizzle-orm";
import { requireAuth } from "./middleware.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "changeme-crew-secret-key-please-set-in-env";

export const crewTokenStore = new Map<string, string>(); // populated at login (JWT as key → memberId). Provides compatibility for uploads + project-files routes.

function hashPw(pw: string) {
  return crypto.createHash("sha256").update(pw + "frameless_crew_salt").digest("hex");
}

// Robust extractor: supports JWT (primary, survives restart) + legacy Map tokens
export function getCrewMemberIdFromToken(token: string): string | null {
  if (!token) return null;
  const fromMap = crewTokenStore.get(token);
  if (fromMap) return fromMap;
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    if (payload?.role === "crew" && payload?.memberId) {
      crewTokenStore.set(token, payload.memberId); // rehydrate for legacy check sites
      return payload.memberId;
    }
  } catch {}
  return null;
}

router.post("/crew/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "Missing credentials" }); return; }

    const [member] = await db.select().from(teamMembersTable)
      .where(and(eq(teamMembersTable.email, email), eq(teamMembersTable.canLogin, true))).limit(1);

    if (!member) { res.status(401).json({ error: "Invalid credentials or access not enabled" }); return; }

    const hashed = hashPw(password);
    if (member.password !== hashed && member.password !== password) {
      res.status(401).json({ error: "Invalid credentials" }); return;
    }

    // Issue JWT (survives backend restarts). Also populate Map so legacy code (uploads.ts, project-files.ts) that still reads crewTokenStore works immediately.
    const token = jwt.sign(
      { 
        memberId: member.id, 
        role: "crew" 
      }, 
      JWT_SECRET, 
      { expiresIn: "7d" }
    );
    crewTokenStore.set(token, member.id);

    res.json({ 
      member: { 
        id: member.id, 
        name: member.name, 
        role: member.role, 
        email: member.email, 
        department: member.department, 
        avatarUrl: member.avatarUrl 
      }, 
      token 
    });
  } catch (err) {
    console.error("[crew/login] Error:", err);
    res.status(500).json({ error: "Server error during login", details: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/crew/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) crewTokenStore.delete(authHeader.slice(7));
  res.json({ success: true });
});

router.get("/crew/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const token = authHeader.slice(7);
  const memberId = getCrewMemberIdFromToken(token);
  if (!memberId) { res.status(401).json({ error: "Invalid token" }); return; }
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, memberId)).limit(1);
  if (!member) { res.status(401).json({ error: "Not found" }); return; }
  res.json({ id: member.id, name: member.name, role: member.role, email: member.email, department: member.department, avatarUrl: member.avatarUrl });
});

function requireCrewAuth(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const token = authHeader.slice(7);
  const memberId = getCrewMemberIdFromToken(token);
  if (!memberId) { res.status(401).json({ error: "Invalid token" }); return; }
  req.crewMemberId = memberId;
  next();
}

router.get("/crew/projects", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const memberId = req.crewMemberId;

  try {
    // Get projects where this crew has tasks assigned (rich fields for UI)
    const assignedProjects = await db
      .selectDistinct({
        id: projectsTable.id,
        title: projectsTable.title,
        client: projectsTable.client,
        status: projectsTable.status,
        deadline: projectsTable.deadline,
        progress: projectsTable.progress,
        startDate: projectsTable.startDate,
        priority: projectsTable.priority,
        projectType: projectsTable.projectType,
        description: projectsTable.description,
        notes: projectsTable.notes,
        driveFolderUrl: projectsTable.driveFolderUrl,
        driveUrl: projectsTable.driveFolderUrl, // alias for frontend compatibility
        assignedMemberId: projectsTable.assignedMemberId,
        createdAt: projectsTable.createdAt,
      })
      .from(projectsTable)
      .innerJoin(projectTasksTable, eq(projectTasksTable.projectId, projectsTable.id))
      .where(eq(projectTasksTable.memberId, memberId));

    // Return ALL projects (crew can browse + upload to any). Rich fields for Project Detail modal + upload dropdown.
    const allProjects = await db
      .select({
        id: projectsTable.id,
        title: projectsTable.title,
        client: projectsTable.client,
        status: projectsTable.status,
        deadline: projectsTable.deadline,
        progress: projectsTable.progress,
        startDate: projectsTable.startDate,
        priority: projectsTable.priority,
        projectType: projectsTable.projectType,
        description: projectsTable.description,
        notes: projectsTable.notes,
        driveFolderUrl: projectsTable.driveFolderUrl,
        driveUrl: projectsTable.driveFolderUrl, // alias for frontend compatibility
        assignedMemberId: projectsTable.assignedMemberId,
        createdAt: projectsTable.createdAt,
      })
      .from(projectsTable)
      .orderBy(desc(projectsTable.createdAt))
      .limit(50);

    // Merge + deduplicate + mark hasTask
    const projectMap = new Map<string, any>();

    allProjects.forEach((p: any) => {
      projectMap.set(p.id, { ...p, hasTask: false });
    });

    assignedProjects.forEach((p: any) => {
      projectMap.set(p.id, { ...p, hasTask: true });
    });

    const result = Array.from(projectMap.values())
      .sort((a, b) => {
        if (a.hasTask && !b.hasTask) return -1;
        if (!a.hasTask && b.hasTask) return 1;
        return new Date(b.deadline || 0).getTime() - new Date(a.deadline || 0).getTime();
      });

    res.json(result);
  } catch (err) {
    console.error("[crew/projects] error", err);
    res.status(500).json({ error: "Failed to load projects" });
  }
});

router.get("/crew/tasks", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const tasks = await db.select().from(projectTasksTable)
    .where(eq(projectTasksTable.memberId, req.crewMemberId))
    .orderBy(desc(projectTasksTable.createdAt)).limit(50);
  res.json(tasks);
});

router.patch("/crew/tasks/:id", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const { status, timeSpent, description } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (timeSpent !== undefined) updates.timeSpent = timeSpent;
  if (description !== undefined) updates.description = description;

  const [task] = await db.update(projectTasksTable).set(updates)
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

// Get all files uploaded by this crew member (for My Portfolio page)
router.get("/crew/my-files", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  try {
    const files = await db
      .select({
        id: projectFilesTable.id,
        title: projectFilesTable.title,
        fileUrl: projectFilesTable.fileUrl,
        category: projectFilesTable.category,
        createdAt: projectFilesTable.createdAt,
        projectId: projectsTable.id,
        projectTitle: projectsTable.title,
        client: projectsTable.client,
        projectStatus: projectsTable.status,
      })
      .from(projectFilesTable)
      .leftJoin(projectsTable, eq(projectFilesTable.projectId, projectsTable.id))
      .where(eq(projectFilesTable.uploadedBy, req.crewMemberId))
      .orderBy(desc(projectFilesTable.createdAt));

    res.json(files);
  } catch (err) {
    console.error("[crew/my-files]", err);
    res.status(500).json({ error: "Failed to fetch your files" });
  }
});

router.get("/crew/notifications", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit || "20"));
  const notifications = await db.select().from(notificationsTable)
    .where(or(
      and(eq(notificationsTable.recipientType, "crew"), eq(notificationsTable.recipientId, req.crewMemberId)),
      eq(notificationsTable.recipientType, "all")
    ))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit);
  res.json(notifications);
});

router.patch("/crew/notifications/:id/read", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  const [notif] = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, req.params.id))
    .returning();
  res.json(notif || { success: true });
});

router.get("/admin/chat/:crewId", requireAuth, async (req, res): Promise<void> => {
  const crewId = req.params.crewId as string;
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.crewId, crewId))
    .orderBy(chatMessagesTable.createdAt).limit(200);
  res.json(messages);
});

router.post("/admin/chat/:crewId", requireAuth, async (req, res): Promise<void> => {
  const crewId = req.params.crewId as string;
  const [msg] = await db.insert(chatMessagesTable).values({
    crewId,
    senderRole: "admin",
    senderName: req.body.senderName || "Admin",
    message: req.body.message,
  }).returning();
  await db.update(chatMessagesTable).set({ isRead: true })
    .where(and(eq(chatMessagesTable.crewId, crewId), eq(chatMessagesTable.senderRole, "crew")));
  res.status(201).json(msg);
});

export default router;
