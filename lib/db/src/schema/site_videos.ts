import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const siteVideosTable = pgTable("site_videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").default(""),
  embedUrl: text("embed_url").notNull(),
  thumbnailUrl: text("thumbnail_url").default(""),
  category: text("category").notNull().default("portfolio"),
  tags: text("tags").default("[]"),
  isActive: boolean("is_active").default(true),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertSiteVideoSchema = createInsertSchema(siteVideosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSiteVideo = z.infer<typeof insertSiteVideoSchema>;
export type SiteVideo = typeof siteVideosTable.$inferSelect;
