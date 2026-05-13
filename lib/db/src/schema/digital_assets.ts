import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const digitalAssetsTable = pgTable("digital_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").default(""),
  category: text("category").notNull().default("preset"),
  price: integer("price").notNull().default(0),
  fileUrl: text("file_url").default(""),
  thumbnailUrl: text("thumbnail_url").default(""),
  previewImages: text("preview_images").default("[]"),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  downloadCount: integer("download_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertDigitalAssetSchema = createInsertSchema(digitalAssetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDigitalAsset = z.infer<typeof insertDigitalAssetSchema>;
export type DigitalAsset = typeof digitalAssetsTable.$inferSelect;
