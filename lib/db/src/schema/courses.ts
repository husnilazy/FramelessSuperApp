import { pgTable, text, timestamp, uuid, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coursesTable = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  thumbnail: text("thumbnail"),
  highlightVideoUrl: text("highlight_video_url"),
  instructor: text("instructor"),
  category: text("category").default("videography"),
  level: text("level").default("beginner"),
  curriculumPdfUrl: text("curriculum_pdf_url"),
  isPublished: boolean("is_published").default(true),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const coursePackagesTable = pgTable("course_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").references(() => coursesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 15, scale: 2 }).notNull().default("0"),
  isTrial: boolean("is_trial").default(false),
  durationDays: integer("duration_days"),
  features: text("features"),
  orderIndex: integer("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const courseEnrollmentsTable = pgTable("course_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").references(() => coursesTable.id),
  packageId: uuid("package_id").references(() => coursePackagesTable.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").default("pending"),
  paymentStatus: text("payment_status").default("unpaid"),
  midtransOrderId: text("midtrans_order_id"),
  paymentToken: text("payment_token"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const courseMaterialsTable = pgTable("course_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").references(() => coursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").default(""),
  url: text("url").notNull(),
  type: text("type").default("video"),
  orderIndex: integer("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertCourseSchema = createInsertSchema(coursesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCoursePackageSchema = createInsertSchema(coursePackagesTable).omit({ id: true, createdAt: true });
export const insertEnrollmentSchema = createInsertSchema(courseEnrollmentsTable).omit({ id: true, createdAt: true });
export const insertCourseMaterialSchema = createInsertSchema(courseMaterialsTable).omit({ id: true, createdAt: true });

export type Course = typeof coursesTable.$inferSelect;
export type CoursePackage = typeof coursePackagesTable.$inferSelect;
export type CourseEnrollment = typeof courseEnrollmentsTable.$inferSelect;
export type CourseMaterial = typeof courseMaterialsTable.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertCoursePackage = z.infer<typeof insertCoursePackageSchema>;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
