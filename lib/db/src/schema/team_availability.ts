import { date, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamMembersTable } from "./team_members";

export const teamAvailabilityTable = pgTable("team_availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => teamMembersTable.id),
  status: text("status").notNull().default("available"),
  note: text("note"),
  date: date("date").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertTeamAvailabilitySchema = createInsertSchema(teamAvailabilityTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTeamAvailability = z.infer<typeof insertTeamAvailabilitySchema>;
export type TeamAvailability = typeof teamAvailabilityTable.$inferSelect;
