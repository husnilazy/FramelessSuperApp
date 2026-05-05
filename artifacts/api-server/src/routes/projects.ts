import { Router, type IRouter } from "express";
import { db, projectsTable, projectTasksTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const { status, search } = req.query as { status?: string; search?: string };
  let query = db.select().from(projectsTable);
  const conditions: any[] = [];
  if (status) conditions.push(eq(projectsTable.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(projectsTable.title, `%${search}%`),
        ilike(projectsTable.client as any, `%${search}%`)
      )
    );
  }
  const projects = conditions.length
    ? await db.select().from(projectsTable).where(conditions.length === 1 ? conditions[0] : conditions[0])
    : await db.select().from(projectsTable).orderBy(projectsTable.createdAt);

  res.json(
    projects.map((p) => ({
      id: p.id,
      title: p.title,
      client: p.client,
      status: p.status,
      progress: p.progress,
      deadline: p.deadline,
      description: p.description,
      projectType: p.projectType,
      priority: p.priority,
      budget: p.budget ? Number(p.budget) : null,
      startDate: p.startDate,
      notes: p.notes,
      driveUrl: p.driveFolderUrl,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  );
});

router.post("/projects", async (req, res): Promise<void> => {
  const { title, client, status, priority, description, projectType, budget, deadline, startDate, notes, driveUrl } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const [project] = await db
    .insert(projectsTable)
    .values({
      title,
      client,
      status: status || "active",
      priority: priority || "medium",
      description,
      projectType,
      budget: budget ? String(budget) : null,
      deadline,
      startDate,
      notes,
      driveFolderUrl: driveUrl,
    })
    .returning();
  await logActivity("project.created", `Project "${title}" created`, undefined, undefined);
  res.status(201).json(mapProject(project));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(mapProject(project));
});

router.put("/projects/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, client, status, priority, progress, description, projectType, budget, deadline, startDate, notes, driveUrl } = req.body;
  const [project] = await db
    .update(projectsTable)
    .set({
      ...(title && { title }),
      ...(client !== undefined && { client }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(progress !== undefined && { progress }),
      ...(description !== undefined && { description }),
      ...(projectType !== undefined && { projectType }),
      ...(budget !== undefined && { budget: budget ? String(budget) : null }),
      ...(deadline !== undefined && { deadline }),
      ...(startDate !== undefined && { startDate }),
      ...(notes !== undefined && { notes }),
      ...(driveUrl !== undefined && { driveFolderUrl: driveUrl }),
      updatedAt: new Date(),
    })
    .where(eq(projectsTable.id, id))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(mapProject(project));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.json({ success: true, message: "Project deleted" });
});

// Tasks
router.get("/projects/:id/tasks", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const tasks = await db
    .select()
    .from(projectTasksTable)
    .where(eq(projectTasksTable.projectId as any, id));
  res.json(tasks.map(mapTask));
});

router.post("/projects/:id/tasks", async (req, res): Promise<void> => {
  const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, description, status, priority, dueDate, roleLabel } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  const taskId = crypto.randomUUID();
  const [task] = await db
    .insert(projectTasksTable)
    .values({
      id: taskId,
      projectId: projectId as any,
      title,
      description,
      status: status || "TODO",
      priority: priority || "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      roleLabel,
    })
    .returning();
  res.status(201).json(mapTask(task));
});

router.put("/tasks/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, description, status, priority, dueDate, roleLabel, timeSpent } = req.body;
  const [task] = await db
    .update(projectTasksTable)
    .set({
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(roleLabel !== undefined && { roleLabel }),
      ...(timeSpent !== undefined && { timeSpent }),
      updatedAt: new Date(),
    })
    .where(eq(projectTasksTable.id, id))
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(mapTask(task));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(projectTasksTable).where(eq(projectTasksTable.id, id));
  res.json({ success: true, message: "Task deleted" });
});

function mapProject(p: any) {
  return {
    id: p.id,
    title: p.title,
    client: p.client,
    status: p.status,
    progress: p.progress,
    deadline: p.deadline,
    description: p.description,
    projectType: p.projectType,
    priority: p.priority,
    budget: p.budget ? Number(p.budget) : null,
    startDate: p.startDate,
    notes: p.notes,
    driveUrl: p.driveFolderUrl,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function mapTask(t: any) {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    roleLabel: t.roleLabel,
    timeSpent: t.timeSpent,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

async function logActivity(action: string, description: string, userId?: string, projectId?: string) {
  try {
    const { activityLogsTable } = await import("@workspace/db");
    await db.insert(activityLogsTable).values({
      id: crypto.randomUUID(),
      userId,
      projectId,
      action,
      description,
    });
  } catch (_) {}
}

export default router;
