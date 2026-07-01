// @workspace/db/src/schema/courses.ts
// UPDATED: Tambah originalPrice, discountLabel, discountEndDate ke coursePackagesTable

import { pgTable, text, timestamp, uuid, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Courses ──────────────────────────────────────────────────────────────────

export const coursesTable = pgTable("courses", {
  id:                uuid("id").primaryKey().defaultRandom(),
  slug:              text("slug").notNull().unique(),
  title:             text("title").notNull(),
  subtitle:          text("subtitle"),
  description:       text("description"),
  thumbnail:         text("thumbnail"),
  highlightVideoUrl: text("highlight_video_url"),
  instructor:        text("instructor"),
  category:          text("category").default("videography"),
  level:             text("level").default("beginner"),
  curriculumPdfUrl:  text("curriculum_pdf_url"),
  isPublished:       boolean("is_published").default(true),
  orderIndex:        integer("order_index").default(0),
  createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Packages ─────────────────────────────────────────────────────────────────

export const coursePackagesTable = pgTable("course_packages", {
  id:              uuid("id").primaryKey().defaultRandom(),
  courseId:        uuid("course_id").references(() => coursesTable.id, { onDelete: "cascade" }),
  name:            text("name").notNull(),
  description:     text("description"),
  price:           numeric("price", { precision: 15, scale: 2 }).notNull().default("0"),
  // ── Diskon ──
  originalPrice:   numeric("original_price", { precision: 15, scale: 2 }),   // Harga sebelum diskon
  discountLabel:   text("discount_label"),                                     // "Early Bird", "Promo Ramadan", dll
  discountEndDate: timestamp("discount_end_date", { withTimezone: true }),     // Kapan diskon berakhir
  // ────────────
  isTrial:         boolean("is_trial").default(false),
  durationDays:    integer("duration_days"),
  features:        text("features"),
  orderIndex:      integer("order_index").default(0),
  isActive:        boolean("is_active").default(true),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Enrollments ──────────────────────────────────────────────────────────────

export const courseEnrollmentsTable = pgTable("course_enrollments", {
  id:               uuid("id").primaryKey().defaultRandom(),
  courseId:         uuid("course_id").references(() => coursesTable.id),
  packageId:        uuid("package_id").references(() => coursePackagesTable.id),
  name:             text("name").notNull(),
  email:            text("email").notNull(),
  phone:            text("phone"),
  status:           text("status").default("pending"),
  paymentStatus:    text("payment_status").default("unpaid"),
  midtransOrderId:  text("midtrans_order_id"),
  paymentToken:     text("payment_token"),
  paymentMethod:    text("payment_method"),
  paymentRaw:       text("payment_raw"),
  memberCode:       text("member_code"),
  invoiceNumber:    text("invoice_number"),
  accessLastSentAt: timestamp("access_last_sent_at", { withTimezone: true }),
  paidAt:           timestamp("paid_at", { withTimezone: true }),
  notes:            text("notes"),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Materials ────────────────────────────────────────────────────────────────

export const courseMaterialsTable = pgTable("course_materials", {
  id:              uuid("id").primaryKey().defaultRandom(),
  courseId:        uuid("course_id").references(() => coursesTable.id, { onDelete: "cascade" }),
  title:           text("title").notNull(),
  description:     text("description").default(""),
  url:             text("url").notNull(),
  type:            text("type").default("video"),
  orderIndex:      integer("order_index").default(0),
  isActive:        boolean("is_active").default(true),
  durationMinutes: integer("duration_minutes"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Workshops ────────────────────────────────────────────────────────────────

export const courseWorkshopsTable = pgTable("course_workshops", {
  id:              uuid("id").primaryKey().defaultRandom(),
  courseId:        uuid("course_id").references(() => coursesTable.id, { onDelete: "cascade" }),
  title:           text("title").notNull(),
  description:     text("description"),
  date:            timestamp("date", { withTimezone: true }).notNull(),
  endDate:         timestamp("end_date", { withTimezone: true }),
  location:        text("location").notNull(),
  locationUrl:     text("location_url"),
  price:           numeric("price", { precision: 15, scale: 2 }).notNull().default("0"),
  quota:           integer("quota").notNull().default(20),
  registeredCount: integer("registered_count").default(0),
  registrationUrl: text("registration_url"),
  posterUrl:       text("poster_url"),
  videoUrl:        text("video_url"),
  highlights:      text("highlights"),
  isActive:        boolean("is_active").default(true),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Gallery ──────────────────────────────────────────────────────────────────

export const courseGalleryTable = pgTable("course_gallery", {
  id:         uuid("id").primaryKey().defaultRandom(),
  courseId:   uuid("course_id").references(() => coursesTable.id, { onDelete: "cascade" }),
  url:        text("url").notNull(),
  caption:    text("caption"),
  orderIndex: integer("order_index").default(0),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const insertCourseSchema         = createInsertSchema(coursesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCoursePackageSchema  = createInsertSchema(coursePackagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEnrollmentSchema     = createInsertSchema(courseEnrollmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCourseMaterialSchema = createInsertSchema(courseMaterialsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCourseWorkshopSchema = createInsertSchema(courseWorkshopsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCourseGallerySchema  = createInsertSchema(courseGalleryTable).omit({ id: true, createdAt: true });

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type Course           = typeof coursesTable.$inferSelect;
export type CoursePackage    = typeof coursePackagesTable.$inferSelect;
export type CourseEnrollment = typeof courseEnrollmentsTable.$inferSelect;
export type CourseMaterial   = typeof courseMaterialsTable.$inferSelect;
export type CourseWorkshop   = typeof courseWorkshopsTable.$inferSelect;
export type CourseGallery    = typeof courseGalleryTable.$inferSelect;

export type InsertCourse          = z.infer<typeof insertCourseSchema>;
export type InsertCoursePackage   = z.infer<typeof insertCoursePackageSchema>;
export type InsertEnrollment      = z.infer<typeof insertEnrollmentSchema>;
export type InsertCourseMaterial  = z.infer<typeof insertCourseMaterialSchema>;
export type InsertCourseWorkshop  = z.infer<typeof insertCourseWorkshopSchema>;
export type InsertCourseGallery   = z.infer<typeof insertCourseGallerySchema>;