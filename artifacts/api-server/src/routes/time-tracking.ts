import { Router, type IRouter } from "express";
import { db, timeEntriesTable, projectTasksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getCrewMemberIdFromToken } from "./crew.js";
import { requireAuth } from "./middleware.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── POST /api/crew/time/start ───────────────────────────────────────────────
router.post("/crew/time/start", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const memberId = getCrewMemberIdFromToken(authHeader.slice(7));
    if (!memberId) {
      res.status(401).json({ error: "Invalid crew token" });
      return;
    }

    const { taskId, projectId, description } = req.body;

    // Stop any existing running timer for this crew member
    const existingTimers = await db.select().from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.memberId, memberId), eq(timeEntriesTable.isRunning, true)));

    for (const timer of existingTimers) {
      const start = new Date(timer.startTime).getTime();
      const end = new Date().getTime();
      const diffMins = Math.floor((end - start) / 60000);

      await db.update(timeEntriesTable)
        .set({
          isRunning: false,
          endTime: new Date(),
          durationMinutes: diffMins,
          updatedAt: new Date(),
        })
        .where(eq(timeEntriesTable.id, timer.id));
    }

    // Start a new timer
    const [newTimer] = await db.insert(timeEntriesTable)
      .values({
        memberId: memberId,
        taskId: taskId || null,
        projectId: projectId || null,
        description: description || "Working on task",
        isRunning: true,
        startTime: new Date(),
      })
      .returning();

    // If task is provided and status is TODO, move to IN_PROGRESS
    if (taskId) {
      try {
        const [task] = await db.select().from(projectTasksTable).where(eq(projectTasksTable.id, taskId));
        if (task && ["TODO", "todo"].includes((task.status || "").toLowerCase())) {
          await db.update(projectTasksTable)
            .set({ status: "IN_PROGRESS", updatedAt: new Date() })
            .where(eq(projectTasksTable.id, taskId));
        }
      } catch (err) {
        logger.error({ err, taskId }, "Failed to update task status to IN_PROGRESS");
      }
    }

    res.json(newTimer);
  } catch (err) {
    logger.error({ err }, "time.start.error");
    res.status(500).json({ error: "Failed to start timer" });
  }
});

// ─── POST /api/crew/time/stop ────────────────────────────────────────────────
router.post("/crew/time/stop", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const memberId = getCrewMemberIdFromToken(authHeader.slice(7));
    if (!memberId) {
      res.status(401).json({ error: "Invalid crew token" });
      return;
    }

    // Find running timer
    const [activeTimer] = await db.select().from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.memberId, memberId), eq(timeEntriesTable.isRunning, true)));

    if (!activeTimer) {
      res.status(400).json({ error: "No active timer found" });
      return;
    }

    const start = new Date(activeTimer.startTime).getTime();
    const end = new Date().getTime();
    const diffMins = Math.floor((end - start) / 60000);

    const [stoppedTimer] = await db.update(timeEntriesTable)
      .set({
        isRunning: false,
        endTime: new Date(),
        durationMinutes: diffMins,
        updatedAt: new Date(),
      })
      .where(eq(timeEntriesTable.id, activeTimer.id))
      .returning();

    // Add spent time to task if taskId exists
    if (activeTimer.taskId) {
      try {
        const [task] = await db.select().from(projectTasksTable).where(eq(projectTasksTable.id, activeTimer.taskId));
        if (task) {
          await db.update(projectTasksTable)
            .set({ timeSpent: (task.timeSpent || 0) + diffMins, updatedAt: new Date() })
            .where(eq(projectTasksTable.id, activeTimer.taskId));
        }
      } catch (err) {
        logger.error({ err, taskId: activeTimer.taskId }, "Failed to update task timeSpent");
      }
    }

    res.json(stoppedTimer);
  } catch (err) {
    logger.error({ err }, "time.stop.error");
    res.status(500).json({ error: "Failed to stop timer" });
  }
});

// ─── GET /api/crew/time/active ───────────────────────────────────────────────
router.get("/crew/time/active", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const memberId = getCrewMemberIdFromToken(authHeader.slice(7));
    if (!memberId) {
      res.status(401).json({ error: "Invalid crew token" });
      return;
    }

    const [activeTimer] = await db.select().from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.memberId, memberId), eq(timeEntriesTable.isRunning, true)));

    res.json(activeTimer || null);
  } catch (err) {
    logger.error({ err }, "time.active.error");
    res.status(500).json({ error: "Failed to fetch active timer" });
  }
});

// ─── GET /api/crew/time/history ──────────────────────────────────────────────
router.get("/crew/time/history", async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const memberId = getCrewMemberIdFromToken(authHeader.slice(7));
    if (!memberId) {
      res.status(401).json({ error: "Invalid crew token" });
      return;
    }

    const limit = parseInt(String(req.query.limit || "50"));
    const history = await db.select().from(timeEntriesTable)
      .where(eq(timeEntriesTable.memberId, memberId))
      .orderBy(desc(timeEntriesTable.startTime))
      .limit(limit);

    // Fetch tasks to join titles
    const taskIds = [...new Set(history.map((t: any) => t.taskId).filter(Boolean))];
    let tasks: any[] = [];
    if (taskIds.length > 0) {
      tasks = await db.select().from(projectTasksTable);
    }

    const result = history.map((entry: any) => {
      const task = tasks.find(t => t.id === entry.taskId);
      return {
        ...entry,
        taskTitle: task ? task.title : null,
      };
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "time.history.error");
    res.status(500).json({ error: "Failed to fetch timer history" });
  }
});

// ─── GET /api/admin/time-entries ──────────────────────────────────────────────
router.get("/admin/time-entries", requireAuth, async (req, res): Promise<void> => {
  try {
    const limit = parseInt(String(req.query.limit || "100"));
    const entries = await db.select().from(timeEntriesTable)
      .orderBy(desc(timeEntriesTable.startTime))
      .limit(limit);

    res.json(entries);
  } catch (err) {
    logger.error({ err }, "time.admin-entries.error");
    res.status(500).json({ error: "Failed to fetch all time entries" });
  }
});

export default router;
