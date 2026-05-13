import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cmsSettingsTable = pgTable("cms_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  section: text("section").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertCmsSettingSchema = createInsertSchema(cmsSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCmsSetting = z.infer<typeof insertCmsSettingSchema>;
export type CmsSetting = typeof cmsSettingsTable.$inferSelect;
