import { Router, type IRouter } from "express";
import { db, projectsTable, projectTasksTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../lib/logger.js";
import { chatCompletion, ADMIN_SYSTEM } from "./ai.js";

const router: IRouter = Router();

type ProjectRecord = {
  id: string;
  title: string;
  client: string | null;
  status: string | null;
  progress: number | null;
  deadline: Date | null;
  description: string | null;
  projectType: string | null;
  priority: string | null;
  budget: string | null;
  startDate: Date | null;
  notes: string | null;
  driveFolderUrl: string | null;
  assignedMemberId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type TaskRecord = {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  dueDate: Date | null;
  roleLabel: string | null;
  memberId: string | null;
  timeSpent: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

router.get("/projects", async (req, res): Promise<void> => {
  try {
    const { status, search } = req.query as {
      status?: string;
      search?: string;
    };

    const conditions = [];

    if (status) {
      conditions.push(eq(projectsTable.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(projectsTable.title, `%${search}%`),
          ilike(projectsTable.client as any, `%${search}%`)
        )
      );
    }

    const projects =
      conditions.length > 0
        ? await db
            .select()
            .from(projectsTable)
            .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        : await db
            .select()
            .from(projectsTable)
            .orderBy(projectsTable.createdAt);

    res.json(projects.map((p: ProjectRecord) => mapProject(p)));
  } catch (err) {
    logger.error({ err }, "projects.get.error");
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/projects", async (req, res): Promise<void> => {
  try {
    const {
      title,
      client,
      status,
      priority,
      description,
      projectType,
      budget,
      deadline,
      startDate,
      notes,
      driveUrl,
      assignedMemberId,
    } = req.body;

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
        deadline: deadline ? new Date(deadline) : null,
        startDate: startDate ? new Date(startDate) : null,
        notes,
        driveFolderUrl: driveUrl,
        assignedMemberId,
      })
      .returning();

    await logActivity(
      "project.created",
      `Project "${title}" created`
    );

    res.status(201).json(mapProject(project as ProjectRecord));
  } catch (err) {
    logger.error({ err }, "projects.post.error");
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(mapProject(project as ProjectRecord));
  } catch (err) {
    logger.error({ err }, "projects.detail.error");
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.put("/projects/:id", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const {
      title,
      client,
      status,
      priority,
      progress,
      description,
      projectType,
      budget,
      deadline,
      startDate,
      notes,
      driveUrl,
      assignedMemberId,
    } = req.body;

    const [prevProject] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .limit(1);

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
        ...(budget !== undefined && {
          budget: budget ? String(budget) : null,
        }),
        ...(deadline !== undefined && {
          deadline: deadline ? new Date(deadline) : null,
        }),
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
        ...(notes !== undefined && { notes }),
        ...(driveUrl !== undefined && {
          driveFolderUrl: driveUrl,
        }),
        ...(assignedMemberId !== undefined && {
          assignedMemberId,
        }),
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, id))
      .returning();

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    try {
      const prevAssigned = prevProject?.assignedMemberId;

      if (
        assignedMemberId &&
        assignedMemberId !== prevAssigned
      ) {
        logger.info(
          { projectId: id, assignedMemberId },
          "Project reassigned - generating AI suggestion"
        );

        try {
          const prompt = `You are asked to suggest onboarding steps and first tasks for a crew member assigned to project: ${project.title}. Provide concise actionable steps.`;

          const reply = await chatCompletion(
            [{ role: "user", content: prompt }],
            ADMIN_SYSTEM
          );

          if (reply) {
            const { chatMessagesTable } = await import("@workspace/db");

            await db.insert(chatMessagesTable).values({
              crewId: assignedMemberId,
              senderRole: "system",
              senderName: "AI Assistant",
              message: reply,
            });

            logger.info(
              { projectId: id, assignedMemberId },
              "AI suggestion stored in chat_messages"
            );
          }
        } catch (aiErr) {
          logger.error(
            { err: aiErr, projectId: id },
            "AI suggestion failed"
          );
        }
      }
    } catch (flowErr) {
      logger.error(
        { err: flowErr, projectId: id },
        "Error handling assignment AI flow"
      );
    }

    res.json(mapProject(project as ProjectRecord));
  } catch (err) {
    logger.error({ err }, "projects.update.error");
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    await db.delete(projectsTable).where(eq(projectsTable.id, id));

    res.json({
      success: true,
      message: "Project deleted",
    });
  } catch (err) {
    logger.error({ err }, "projects.delete.error");
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// TASKS

router.get("/projects/:id/tasks", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const tasks = await db
      .select()
      .from(projectTasksTable)
      .where(eq(projectTasksTable.projectId as any, id));

    res.json(tasks.map((t: TaskRecord) => mapTask(t)));
  } catch (err) {
    logger.error({ err }, "tasks.get.error");
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/projects/:id/tasks", async (req, res): Promise<void> => {
  try {
    const projectId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const {
      title,
      description,
      status,
      priority,
      dueDate,
      roleLabel,
      memberId,
    } = req.body;

    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const taskId = crypto.randomUUID();

    const [task] = await db
      .insert(projectTasksTable)
      .values({
        id: taskId,
        projectId,
        title,
        description,
        status: status || "TODO",
        priority: priority || "medium",
        dueDate: dueDate ? new Date(dueDate) : null,
        roleLabel,
        memberId,
      })
      .returning();

    res.status(201).json(mapTask(task as TaskRecord));
  } catch (err) {
    logger.error({ err }, "tasks.post.error");
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.put("/tasks/:id", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const {
      title,
      description,
      status,
      priority,
      dueDate,
      roleLabel,
      timeSpent,
      memberId,
    } = req.body;

    const [task] = await db
      .update(projectTasksTable)
      .set({
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && {
          dueDate: dueDate ? new Date(dueDate) : null,
        }),
        ...(roleLabel !== undefined && { roleLabel }),
        ...(memberId !== undefined && { memberId }),
        ...(timeSpent !== undefined && { timeSpent }),
        updatedAt: new Date(),
      })
      .where(eq(projectTasksTable.id, id))
      .returning();

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(mapTask(task as TaskRecord));
  } catch (err) {
    logger.error({ err }, "tasks.update.error");
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    await db
      .delete(projectTasksTable)
      .where(eq(projectTasksTable.id, id));

    res.json({
      success: true,
      message: "Task deleted",
    });
  } catch (err) {
    logger.error({ err }, "tasks.delete.error");
    res.status(500).json({ error: "Failed to delete task" });
  }
});

function mapProject(p: ProjectRecord) {
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
    assignedMemberId: p.assignedMemberId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function mapTask(t: TaskRecord) {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    roleLabel: t.roleLabel,
    memberId: t.memberId,
    timeSpent: t.timeSpent,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

async function logActivity(
  action: string,
  description: string,
  userId?: string,
  projectId?: string
) {
  try {
    const { activityLogsTable } = await import("@workspace/db");

    await db.insert(activityLogsTable).values({
      id: crypto.randomUUID(),
      userId,
      projectId,
      action,
      description,
    });
  } catch {
    // ignore logging errors
  }
}

export default router;
