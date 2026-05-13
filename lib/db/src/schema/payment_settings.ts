import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentSettingsTable = pgTable("payment_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull().unique(),
  label: text("label").notNull(),
  isEnabled: boolean("is_enabled").default(false),
  config: text("config").default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertPaymentSettingSchema = createInsertSchema(paymentSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentSetting = z.infer<typeof insertPaymentSettingSchema>;
export type PaymentSetting = typeof paymentSettingsTable.$inferSelect;
