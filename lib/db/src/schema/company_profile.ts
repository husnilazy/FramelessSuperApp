import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Singleton table — selalu 1 row dengan id "default".
// Sumber data resmi perusahaan (logo, alamat, kontak) untuk semua dokumen.
export const companyProfileTable = pgTable("company_profile", {
  id: text("id").primaryKey().notNull().default("default"),
  companyName: text("companyName").notNull().default("Frameless Creative"),
  tagline: text("tagline").default("Creative Production House"),
  address: text("address"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  logoUrl: text("logoUrl"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const insertCompanyProfileSchema = createInsertSchema(companyProfileTable).omit({
  updatedAt: true,
});
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;
export type CompanyProfile = typeof companyProfileTable.$inferSelect;