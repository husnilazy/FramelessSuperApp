import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, teamAvailabilityTable, teamMembersTable } from "@workspace/db";
import { requireAuth } from "./middleware.js";
import { getCrewMemberIdFromToken } from "./crew.js";

const router: IRouter = Router();

const VALID_STATUS = new Set(["available", "on_shoot", "offline", "leave", "busy"]);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return todayKey();
  return value.slice(0, 10);
}

function normalizeStatus(value: unknown) {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "available";
  return VALID_STATUS.has(status) ? status : "available";
}

function mapAvailability(row: any) {
  return {
    id: row.id,
    memberId: row.memberId ?? row.member_id,
    status: row.status,
    note: row.note,
    date: row.date,
    startTime: row.startTime ?? row.start_time,
    endTime: row.endTime ?? row.end_time,
    source: row.source,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
    member: row.member
      ? {
          id: row.member.id,
          name: row.member.name,
          role: row.member.role,
          department: row.member.department,
          avatarUrl: row.member.avatarUrl ?? row.member.avatar_url,
          status: row.member.status,
        }
      : undefined,
  };
}

function requireCrewAuth(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const memberId = getCrewMemberIdFromToken(token);
  if (!memberId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  req.crewMemberId = memberId;
  next();
}

async function fetchAvailability(date: string) {
  const rows = await db
    .select({
      id: teamAvailabilityTable.id,
      memberId: teamAvailabilityTable.memberId,
      status: teamAvailabilityTable.status,
      note: teamAvailabilityTable.note,
      date: teamAvailabilityTable.date,
      startTime: teamAvailabilityTable.startTime,
      endTime: teamAvailabilityTable.endTime,
      source: teamAvailabilityTable.source,
      createdAt: teamAvailabilityTable.createdAt,
      updatedAt: teamAvailabilityTable.updatedAt,
      member: teamMembersTable,
    })
    .from(teamAvailabilityTable)
    .leftJoin(teamMembersTable, eq(teamAvailabilityTable.memberId, teamMembersTable.id))
    .where(eq(teamAvailabilityTable.date, date));

  return rows.map(mapAvailability);
}

router.get("/availability", requireAuth, async (req, res): Promise<void> => {
  try {
    const date = normalizeDate(req.query.date);
    res.json(await fetchAvailability(date));
  } catch (err) {
    console.error("[availability] GET error:", err);
    res.status(500).json({ error: "Failed to fetch team availability" });
  }
});

router.post("/availability", requireAuth, async (req, res): Promise<void> => {
  try {
    const memberId = String(req.body?.memberId || "");
    if (!memberId) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }

    const [row] = await db
      .insert(teamAvailabilityTable)
      .values({
        memberId,
        status: normalizeStatus(req.body?.status),
        note: typeof req.body?.note === "string" ? req.body.note : null,
        date: normalizeDate(req.body?.date),
        startTime: typeof req.body?.startTime === "string" ? req.body.startTime : null,
        endTime: typeof req.body?.endTime === "string" ? req.body.endTime : null,
        source: "admin",
      })
      .returning();

    res.status(201).json(mapAvailability(row));
  } catch (err) {
    console.error("[availability] POST error:", err);
    res.status(500).json({ error: "Failed to create availability record" });
  }
});

router.put("/availability/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .update(teamAvailabilityTable)
      .set({
        ...(req.body?.status !== undefined && { status: normalizeStatus(req.body.status) }),
        ...(req.body?.note !== undefined && { note: typeof req.body.note === "string" ? req.body.note : null }),
        ...(req.body?.date !== undefined && { date: normalizeDate(req.body.date) }),
        ...(req.body?.startTime !== undefined && { startTime: typeof req.body.startTime === "string" ? req.body.startTime : null }),
        ...(req.body?.endTime !== undefined && { endTime: typeof req.body.endTime === "string" ? req.body.endTime : null }),
        updatedAt: new Date(),
      })
      .where(eq(teamAvailabilityTable.id, String(req.params.id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Availability record not found" });
      return;
    }

    res.json(mapAvailability(row));
  } catch (err) {
    console.error("[availability] PUT error:", err);
    res.status(500).json({ error: "Failed to update availability record" });
  }
});

router.get("/crew/availability", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  try {
    const date = normalizeDate(req.query.date);
    res.json(await fetchAvailability(date));
  } catch (err) {
    console.error("[crew/availability] GET error:", err);
    res.status(500).json({ error: "Failed to fetch team availability" });
  }
});

router.post("/crew/availability", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  try {
    const date = normalizeDate(req.body?.date);
    const [existing] = await db
      .select()
      .from(teamAvailabilityTable)
      .where(and(eq(teamAvailabilityTable.memberId, req.crewMemberId), eq(teamAvailabilityTable.date, date)))
      .limit(1);

    const payload = {
      status: normalizeStatus(req.body?.status),
      note: typeof req.body?.note === "string" ? req.body.note : null,
      startTime: typeof req.body?.startTime === "string" ? req.body.startTime : null,
      endTime: typeof req.body?.endTime === "string" ? req.body.endTime : null,
      source: "crew",
      updatedAt: new Date(),
    };

    const [row] = existing
      ? await db
          .update(teamAvailabilityTable)
          .set(payload)
          .where(eq(teamAvailabilityTable.id, existing.id))
          .returning()
      : await db
          .insert(teamAvailabilityTable)
          .values({
            memberId: req.crewMemberId,
            date,
            ...payload,
          })
          .returning();

    res.status(existing ? 200 : 201).json(mapAvailability(row));
  } catch (err) {
    console.error("[crew/availability] POST error:", err);
    res.status(500).json({ error: "Failed to update crew availability" });
  }
});

export default router;
