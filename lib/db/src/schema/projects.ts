import { pgTable, text, integer, timestamp, numeric, date, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamMembersTable } from "./team_members";

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  client: text("client"),
  status: text("status").notNull().default("active"),
  progress: integer("progress").notNull().default(0),
  deadline: date("deadline"),
  description: text("description"),
  projectType: text("project_type"),
  priority: text("priority").notNull().default("medium"),
  budget: numeric("budget"),
  startDate: date("start_date"),
  notes: text("notes"),
  projectUrl: text("project_url"),
  driveFolderUrl: text("drive_folder_url"),
  assignedMemberId: uuid("assigned_member_id").references(() => teamMembersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
