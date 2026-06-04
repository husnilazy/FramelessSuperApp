import { pgTable, text, boolean, timestamp, integer, date, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamMembersTable = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
  phone: text("phone"),
  department: text("department"),
  status: text("status").notNull().default("active"),
  avatarUrl: text("avatar_url"),
  // Note: `username` and `whatsapp` columns are not present in some DBs — omit to match runtime schema
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  website: text("website"),
  isActive: boolean("is_active").notNull().default(true),
  joinedDate: date("joined_date"),
  orderIndex: integer("order_index").notNull().default(0),
  canLogin: boolean("can_login").default(false),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembersTable.$inferSelect;
