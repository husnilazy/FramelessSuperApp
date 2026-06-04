import { Router, type IRouter } from "express";
import { db, pool, teamMembersTable, projectsTable, projectTasksTable, calendarEventsTable, teamAvailabilityTable, timeEntriesTable, chatMessagesTable, notificationsTable } from "@workspace/db";
import { eq, and, or, desc, gte, lte } from "drizzle-orm";
import { requireAuth } from "./middleware.js";
import crypto from "crypto";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── GET /api/admin/crew-overview ────────────────────────────────────────────
// Returns all crew members with their active tasks, workload, and availability
router.get("/admin/crew-overview", requireAuth, async (_req, res): Promise<void> => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Fetch all active team members
    const members = await db.select({
      id: teamMembersTable.id,
      name: teamMembersTable.name,
      role: teamMembersTable.role,
      email: teamMembersTable.email,
      department: teamMembersTable.department,
      avatarUrl: teamMembersTable.avatarUrl,
      isActive: teamMembersTable.isActive,
      orderIndex: teamMembersTable.orderIndex,
    }).from(teamMembersTable)
      .where(eq(teamMembersTable.isActive, true))
      .orderBy(teamMembersTable.orderIndex);

    // Fetch all non-done tasks
    const tasks = await db.select().from(projectTasksTable);

    // Fetch today's availability
    const availability = await db.select().from(teamAvailabilityTable)
      .where(eq(teamAvailabilityTable.date, today));

    // Fetch today's calendar events
    const todayStart = new Date(today + "T00:00:00Z");
    const todayEnd = new Date(today + "T23:59:59Z");
    const events = await db.select().from(calendarEventsTable)
      .where(and(
        gte(calendarEventsTable.startDate, todayStart),
        lte(calendarEventsTable.startDate, todayEnd),
      ));

    // Fetch running timers
    let runningTimers: any[] = [];
    try {
      runningTimers = await db.select().from(timeEntriesTable)
        .where(eq(timeEntriesTable.isRunning, true));
    } catch { /* table might not exist yet */ }

    // Fetch active projects
    const projects = await db.select().from(projectsTable);

    // Build crew overview
    const crewOverview = members.map((member: any) => {
      const memberTasks = tasks.filter((t: any) => t.memberId === member.id);
      const activeTasks = memberTasks.filter((t: any) => !["DONE", "done", "completed"].includes((t.status || "").toLowerCase()));
      const doneTasks = memberTasks.filter((t: any) => ["DONE", "done", "completed"].includes((t.status || "").toLowerCase()));
      const reviewTasks = memberTasks.filter((t: any) => (t.status || "").toLowerCase() === "review");
      const urgentTasks = activeTasks.filter((t: any) => {
        if ((t.priority || "").toLowerCase() === "high") return true;
        if (t.dueDate) {
          const due = new Date(t.dueDate);
          due.setHours(0, 0, 0, 0);
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
          return diff <= 2;
        }
        return false;
      });

      const memberAvail = availability.find((a: any) => a.memberId === member.id);
      const memberEvents = events.filter((e: any) => e.assignedTo === member.id || e.assignedTo === "all");
      const isOnShoot = memberEvents.some((e: any) => (e.type || e.title || "").toLowerCase().includes("shoot"));
      const runningTimerRaw = runningTimers.find((t: any) => t.memberId === member.id);
      const runningTimer = runningTimerRaw ? {
        taskId: runningTimerRaw.taskId,
        startTime: runningTimerRaw.startTime,
        description: runningTimerRaw.description,
        taskTitle: runningTimerRaw.taskId ? tasks.find((t: any) => t.id === runningTimerRaw.taskId)?.title || null : null,
      } : null;

      // Determine status
      let liveStatus = "available";
      if (memberAvail) {
        liveStatus = memberAvail.status;
      } else if (isOnShoot) {
        liveStatus = "on_shoot";
      } else if (!member.isActive) {
        liveStatus = "offline";
      }

      // Get assigned projects
      const memberProjectIds = new Set(memberTasks.map((t: any) => t.projectId).filter(Boolean));
      const assignedProjects = projects.filter((p: any) =>
        p.assignedMemberId === member.id || memberProjectIds.has(p.id)
      );

      return {
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email,
        department: member.department,
        avatarUrl: member.avatarUrl,
        status: liveStatus,
        stats: {
          totalTasks: memberTasks.length,
          activeTasks: activeTasks.length,
          doneTasks: doneTasks.length,
          reviewTasks: reviewTasks.length,
          urgentTasks: urgentTasks.length,
          completionRate: memberTasks.length > 0
            ? Math.round((doneTasks.length / memberTasks.length) * 100)
            : 0,
          assignedProjects: assignedProjects.length,
        },
        activeTasks: activeTasks.slice(0, 5).map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          projectId: t.projectId,
          projectTitle: projects.find((p: any) => p.id === t.projectId)?.title || null,
          description: t.description,
          crewNotes: (() => {
            const d = t.description || "";
            const marker = "[CREW_NOTES]";
            const i = d.indexOf(marker);
            if (i === -1) return [];
            return d.slice(i + marker.length).trim().split("\n").filter(Boolean).map((line: string) => {
              const mm = line.match(/^\[([^\]]+)\]\s*(.*)$/);
              return mm ? { time: mm[1], text: mm[2] } : { time: "", text: line };
            });
          })(),
        })),
        todayEvents: memberEvents.map((e: any) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          startDate: e.startDate,
        })),
        runningTimer: runningTimer,
      };
    });

    res.json({
      crew: crewOverview,
      summary: {
        totalCrew: members.length,
        available: crewOverview.filter((c: any) => c.status === "available").length,
        onShoot: crewOverview.filter((c: any) => c.status === "on_shoot").length,
        busy: crewOverview.filter((c: any) => ["busy", "editing"].includes(c.status)).length,
        offline: crewOverview.filter((c: any) => ["offline", "leave"].includes(c.status)).length,
        totalActiveTasks: tasks.filter((t: any) => !["DONE", "done", "completed"].includes((t.status || "").toLowerCase())).length,
        totalTodayEvents: events.length,
      },
    });
  } catch (err) {
    logger.error({ err }, "admin.crew-overview.error");
    res.status(500).json({ error: "Failed to fetch crew overview" });
  }
});

// ─── GET /api/admin/workload-heatmap ─────────────────────────────────────────
// Returns 7-day workload grid for all crew
router.get("/admin/workload-heatmap", requireAuth, async (_req, res): Promise<void> => {
  try {
    const members = await db.select({
      id: teamMembersTable.id,
      name: teamMembersTable.name,
      role: teamMembersTable.role,
      avatarUrl: teamMembersTable.avatarUrl,
    }).from(teamMembersTable)
      .where(eq(teamMembersTable.isActive, true))
      .orderBy(teamMembersTable.orderIndex);

    const tasks = await db.select().from(projectTasksTable);
    const events = await db.select().from(calendarEventsTable);

    // Build 7-day grid
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }

    const heatmap = members.map((member: any) => {
      const memberTasks = tasks.filter((t: any) => t.memberId === member.id);
      const memberEvents = events.filter((e: any) => e.assignedTo === member.id || e.assignedTo === "all");

      const dayLoad = days.map(day => {
        const dayDate = new Date(day);
        const taskCount = memberTasks.filter((t: any) => {
          if (!t.dueDate) return false;
          const td = new Date(t.dueDate);
          return td.toISOString().slice(0, 10) === day;
        }).length;
        const eventCount = memberEvents.filter((e: any) => {
          const ed = new Date(e.startDate);
          return ed.toISOString().slice(0, 10) === day;
        }).length;

        const total = taskCount + eventCount;
        // 0=free, 1=light, 2=normal, 3=heavy, 4=overloaded
        const intensity = total === 0 ? 0 : total <= 1 ? 1 : total <= 3 ? 2 : total <= 5 ? 3 : 4;

        return {
          date: day,
          dayName: dayDate.toLocaleDateString("id-ID", { weekday: "short" }),
          tasks: taskCount,
          events: eventCount,
          total,
          intensity,
        };
      });

      return {
        memberId: member.id,
        name: member.name,
        role: member.role,
        avatarUrl: member.avatarUrl,
        days: dayLoad,
      };
    });

    res.json({ days, heatmap });
  } catch (err) {
    logger.error({ err }, "admin.workload-heatmap.error");
    res.status(500).json({ error: "Failed to fetch workload heatmap" });
  }
});

// ─── GET /api/admin/project-pipeline ─────────────────────────────────────────
// Returns projects grouped by phase for kanban view
router.get("/admin/project-pipeline", requireAuth, async (_req, res): Promise<void> => {
  try {
    const projects = await db.select().from(projectsTable)
      .orderBy(desc(projectsTable.updatedAt));
    const tasks = await db.select().from(projectTasksTable);
    const members = await db.select({
      id: teamMembersTable.id,
      name: teamMembersTable.name,
      role: teamMembersTable.role,
      avatarUrl: teamMembersTable.avatarUrl,
    }).from(teamMembersTable);

    const pipeline: Record<string, any[]> = {
      planning: [],
      active: [],
      shooting: [],
      editing: [],
      review: [],
      completed: [],
    };

    for (const project of projects) {
      const status = (project.status || "active").toLowerCase().replace(/\s+/g, "_");
      const projectTasks = tasks.filter((t: any) => t.projectId === project.id);
      const doneTasks = projectTasks.filter((t: any) => ["DONE", "done", "completed"].includes((t.status || "").toLowerCase()));
      const owner = members.find((m: any) => m.id === project.assignedMemberId);

      const entry = {
        id: project.id,
        title: project.title,
        client: project.client,
        status: project.status,
        progress: project.progress || 0,
        deadline: project.deadline,
        priority: project.priority,
        projectType: project.projectType,
        updatedAt: project.updatedAt,
        owner: owner ? { id: owner.id, name: owner.name, avatarUrl: owner.avatarUrl } : null,
        taskStats: {
          total: projectTasks.length,
          done: doneTasks.length,
          active: projectTasks.length - doneTasks.length,
        },
      };

      // Map status to pipeline phase
      if (["planning", "proposed", "draft"].includes(status)) {
        pipeline.planning.push(entry);
      } else if (["shooting", "on_shoot"].includes(status)) {
        pipeline.shooting.push(entry);
      } else if (["editing", "post_production"].includes(status)) {
        pipeline.editing.push(entry);
      } else if (["review", "client_review", "final", "client final"].includes(status)) {
        pipeline.review.push(entry);
      } else if (["completed", "done", "delivered", "final delivery"].includes(status)) {
        pipeline.completed.push(entry);
      } else {
        pipeline.active.push(entry);
      }
    }

    res.json({ pipeline, total: projects.length });
  } catch (err) {
    logger.error({ err }, "admin.project-pipeline.error");
    res.status(500).json({ error: "Failed to fetch project pipeline" });
  }
});

// ─── POST /api/admin/quick-assign ────────────────────────────────────────────
// Quick assign a task to a crew member
router.post("/admin/quick-assign", requireAuth, async (req, res): Promise<void> => {
  try {
    const { title, memberId, projectId, priority, dueDate, description } = req.body;

    if (!title || !memberId) {
      res.status(400).json({ error: "title and memberId are required" });
      return;
    }

    const taskId = crypto.randomUUID();
    const [task] = await db.insert(projectTasksTable).values({
      id: taskId,
      title,
      memberId,
      projectId: projectId || null,
      priority: priority || "medium",
      status: "TODO",
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    }).returning();

    // Create notification for crew member (robust fallback for schema drift)
    const notifId = crypto.randomUUID();
    let notifMessage = `Admin menugaskan task "${title}" untuk kamu.`;
    if (projectId) {
      try {
        const [proj] = await db
          .select({ title: projectsTable.title })
          .from(projectsTable)
          .where(eq(projectsTable.id as any, projectId))
          .limit(1);
        if (proj?.title) {
          notifMessage = `Admin menugaskan task "${title}" untuk kamu di project "${proj.title}".`;
        }
      } catch {}
    }
    try {
      await db.insert(notificationsTable).values({
        recipientType: "crew",
        recipientId: memberId,
        title: "Task Baru Ditugaskan",
        message: notifMessage,
        type: "info",
        category: "task",
        referenceId: taskId,
        referenceType: "task",
      });
    } catch (notifErr) {
      logger.warn({ notifErr }, "admin.quick-assign.notification.drizzle-failed, trying raw");
      try {
        await pool!.query(
          `INSERT INTO notifications (id, recipient_type, recipient_id, title, message, type, category, reference_id, reference_type, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, now())`,
          [notifId, "crew", memberId, "Task Baru Ditugaskan", notifMessage, "info", "task", taskId, "task"]
        );
      } catch (rawErr) {
        try {
          await pool!.query(
            `INSERT INTO notifications (id, recipient_type, recipient_id, title, message, type, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, false, now())`,
            [notifId, "crew", memberId, "Task Baru Ditugaskan", notifMessage, "info"]
          );
        } catch (minErr) {
          logger.error({ minErr, rawErr, notifErr }, "admin.quick-assign.notification.failed-all");
        }
      }
    }

    res.status(201).json(task);
  } catch (err) {
    logger.error({ err }, "admin.quick-assign.error");
    res.status(500).json({ error: "Failed to create task assignment" });
  }
});

// ─── POST /api/admin/broadcast ───────────────────────────────────────────────
// Send a broadcast message to all crew
router.post("/admin/broadcast", requireAuth, async (req, res): Promise<void> => {
  try {
    const { message, senderName } = req.body;
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // Get all active crew members
    const members = await db.select().from(teamMembersTable)
      .where(eq(teamMembersTable.isActive, true));

    // Send message to each crew member's chat
    const results = [];
    for (const member of members) {
      try {
        const [msg] = await db.insert(chatMessagesTable).values({
          crewId: member.id,
          senderRole: "admin",
          senderName: senderName || "Admin",
          message: `📢 BROADCAST: ${message}`,
        }).returning();
        results.push(msg);
      } catch (chatErr) {
        logger.error({ chatErr, memberId: member.id }, "broadcast.chat.error");
      }
    }

    // Also create notification
    try {
      await db.insert(notificationsTable).values({
        recipientType: "all",
        title: "Broadcast dari Admin",
        message,
        type: "info",
        category: "system",
      });
    } catch { /* notifications table might not exist yet */ }

    res.json({
      success: true,
      recipientCount: members.length,
      messagesSent: results.length,
    });
  } catch (err) {
    logger.error({ err }, "admin.broadcast.error");
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

// ─── GET /api/admin/performance ──────────────────────────────────────────────
// Crew performance metrics
router.get("/admin/performance", requireAuth, async (_req, res): Promise<void> => {
  try {
    const members = await db.select({
      id: teamMembersTable.id,
      name: teamMembersTable.name,
      role: teamMembersTable.role,
      avatarUrl: teamMembersTable.avatarUrl,
    }).from(teamMembersTable)
      .where(eq(teamMembersTable.isActive, true));
    const tasks = await db.select().from(projectTasksTable);

    const performance = members.map((member: any) => {
      const memberTasks = tasks.filter((t: any) => t.memberId === member.id);
      const done = memberTasks.filter((t: any) => ["DONE", "done", "completed"].includes((t.status || "").toLowerCase()));
      const overdue = memberTasks.filter((t: any) => {
        if (["DONE", "done", "completed"].includes((t.status || "").toLowerCase())) return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < new Date();
      });

      // On-time delivery
      const doneWithDue = done.filter((t: any) => t.dueDate);
      const onTime = doneWithDue.filter((t: any) => {
        const completed = t.updatedAt ? new Date(t.updatedAt) : new Date();
        const due = new Date(t.dueDate!);
        return completed <= due;
      });

      return {
        memberId: member.id,
        name: member.name,
        role: member.role,
        avatarUrl: member.avatarUrl,
        metrics: {
          totalTasks: memberTasks.length,
          completedTasks: done.length,
          overdueTasks: overdue.length,
          completionRate: memberTasks.length > 0
            ? Math.round((done.length / memberTasks.length) * 100) : 0,
          onTimeRate: doneWithDue.length > 0
            ? Math.round((onTime.length / doneWithDue.length) * 100) : 100,
          avgTimeSpent: done.length > 0
            ? Math.round(done.reduce((s: number, t: any) => s + (t.timeSpent || 0), 0) / done.length) : 0,
        },
      };
    });

    // Sort by completion rate descending
    performance.sort((a: any, b: any) => b.metrics.completionRate - a.metrics.completionRate);

    res.json({ performance });
  } catch (err) {
    logger.error({ err }, "admin.performance.error");
    res.status(500).json({ error: "Failed to fetch performance data" });
  }
});

// ─── GET /api/admin/notifications ────────────────────────────────────────────
router.get("/admin/notifications", requireAuth, async (req, res): Promise<void> => {
  try {
    const limit = parseInt(String(req.query.limit || "20"));
    const notifications = await db.select().from(notificationsTable)
      .where(or(
        eq(notificationsTable.recipientType, "admin"),
        eq(notificationsTable.recipientType, "all"),
      ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);
    res.json(notifications);
  } catch (err) {
    logger.error({ err }, "admin.notifications.error");
    res.json([]);
  }
});

// ─── PATCH /api/admin/notifications/:id/read ─────────────────────────────────
router.patch("/admin/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const [notif] = await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    res.json(notif || { success: true });
  } catch (err) {
    res.json({ success: true });
  }
});

export default router;
