import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const siteLogosTable = pgTable("site_logos", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  isActive: boolean("is_active").default(true),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertSiteLogoSchema = createInsertSchema(siteLogosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSiteLogo = z.infer<typeof insertSiteLogoSchema>;
export type SiteLogo = typeof siteLogosTable.$inferSelect;
