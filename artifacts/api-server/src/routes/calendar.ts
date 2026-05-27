import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

router.get("/calendar", requireAuth, async (req, res): Promise<void> => {
  const events = await db
    .select()
    .from(calendarEventsTable)
    .orderBy(calendarEventsTable.startDate);

  res.json(events);
});

router.post("/calendar", requireAuth, async (req, res): Promise<void> => {
  const [event] = await db
    .insert(calendarEventsTable)
    .values(req.body)
    .returning();

  res.status(201).json(event);
});

router.put("/calendar/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);

  const [event] = await db
    .update(calendarEventsTable)
    .set(req.body)
    .where(eq(calendarEventsTable.id, id))
    .returning();

  res.json(event);
});

router.delete("/calendar/:id", requireAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);

  await db
    .delete(calendarEventsTable)
    .where(eq(calendarEventsTable.id, id));

  res.json({ success: true });
});

export default router;