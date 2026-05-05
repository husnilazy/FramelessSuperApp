import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { teamMembersTable } from "./team_members";

export const projectTasksTable = pgTable("project_tasks", {
  id: text("id").primaryKey().notNull(),
  projectId: uuid("projectId").notNull().references(() => projectsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("TODO"),
  priority: text("priority").notNull().default("medium"),
  dueDate: timestamp("dueDate"),
  roleLabel: text("role_label"),
  timeSpent: integer("time_spent").notNull().default(0),
  memberId: uuid("member_id").references(() => teamMembersTable.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const insertProjectTaskSchema = createInsertSchema(projectTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type ProjectTask = typeof projectTasksTable.$inferSelect;
