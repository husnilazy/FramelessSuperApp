import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamMembersTable } from "./team_members";
import { projectsTable } from "./projects";

export const timeEntriesTable = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => teamMembersTable.id, { onDelete: "cascade" }),
  taskId: text("task_id"),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull().defaultNow(),
  endTime: timestamp("end_time", { withTimezone: true }),
  durationMinutes: integer("duration_minutes").default(0),
  isRunning: boolean("is_running").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertTimeEntrySchema = createInsertSchema(timeEntriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntriesTable.$inferSelect;
