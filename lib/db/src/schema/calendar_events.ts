import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const calendarEventsTable = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  allDay: boolean("all_day").default(true),
  color: text("color").default("#ff6b35"),
  type: text("type").default("event"),
  createdBy: text("created_by"),
  assignedTo: text("assigned_to"),
  projectId: uuid("project_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEventsTable.$inferSelect;
