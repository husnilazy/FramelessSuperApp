import { pgTable, text, uuid, timestamp, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamMembersTable } from "./team_members";
import { projectsTable } from "./projects";

// =============================================
// Tabel: filmmaking_documents
// Menyimpan dokumen (konsep, script breakdown, shotlist)
// =============================================
export const filmmakingDocumentsTable = pgTable("filmmaking_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "cascade" }),
  crewId: uuid("crew_id").notNull().references(() => teamMembersTable.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(), // "concept" | "script" | "shotlist"
  title: text("title").notNull(),
  content: json("content"), // Flexible JSON untuk berbagai format
  isDraft: boolean("is_draft").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }), // Soft delete
});

export const insertFilmmakingDocumentSchema = createInsertSchema(filmmakingDocumentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});
export type InsertFilmmakingDocument = z.infer<typeof insertFilmmakingDocumentSchema>;
export type FilmmakingDocument = typeof filmmakingDocumentsTable.$inferSelect;

// =============================================
// Tabel: filmmaking_collaborators
// Menyimpan akses kolaborasi
// =============================================
export const filmmakingCollaboratorsTable = pgTable("filmmaking_collaborators", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => filmmakingDocumentsTable.id, { onDelete: "cascade" }),
  crewMemberId: uuid("crew_member_id").notNull().references(() => teamMembersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "owner" | "editor" | "viewer"
  addedBy: uuid("added_by").notNull().references(() => teamMembersTable.id),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFilmmakingCollaboratorSchema = createInsertSchema(filmmakingCollaboratorsTable).omit({
  id: true,
  addedAt: true,
});
export type InsertFilmmakingCollaborator = z.infer<typeof insertFilmmakingCollaboratorSchema>;
export type FilmmakingCollaborator = typeof filmmakingCollaboratorsTable.$inferSelect;

// =============================================
// Tabel: filmmaking_submissions
// Menyimpan submission ke admin untuk review
// =============================================
export const filmmakingSubmissionsTable = pgTable("filmmaking_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => filmmakingDocumentsTable.id, { onDelete: "cascade" }),
  submittedBy: uuid("submitted_by").notNull().references(() => teamMembersTable.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "revision_requested"
  adminNotes: text("admin_notes"), // Catatan dari admin
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by").references(() => teamMembersTable.id),
});

export const insertFilmmakingSubmissionSchema = createInsertSchema(filmmakingSubmissionsTable).omit({
  id: true,
  submittedAt: true,
  approvedAt: true,
});
export type InsertFilmmakingSubmission = z.infer<typeof insertFilmmakingSubmissionSchema>;
export type FilmmakingSubmission = typeof filmmakingSubmissionsTable.$inferSelect;

// =============================================
// Tabel: filmmaking_revisions
// Menyimpan history perubahan dokumen
// =============================================
export const filmmakingRevisionsTable = pgTable("filmmaking_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => filmmakingDocumentsTable.id, { onDelete: "cascade" }),
  contentSnapshot: json("content_snapshot").notNull(), // Snapshot dari content saat perubahan
  changedBy: uuid("changed_by").notNull().references(() => teamMembersTable.id),
  changeSummary: text("change_summary"), // Deskripsi perubahan (optional)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFilmmakingRevisionSchema = createInsertSchema(filmmakingRevisionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFilmmakingRevision = z.infer<typeof insertFilmmakingRevisionSchema>;
export type FilmmakingRevision = typeof filmmakingRevisionsTable.$inferSelect;

// =============================================
// Tabel: filmmaking_comments
// Menyimpan komentar inline untuk kolaborasi
// =============================================
export const filmmakingCommentsTable = pgTable("filmmaking_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => filmmakingDocumentsTable.id, { onDelete: "cascade" }),
  crewMemberId: uuid("crew_member_id").notNull().references(() => teamMembersTable.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFilmmakingCommentSchema = createInsertSchema(filmmakingCommentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFilmmakingComment = z.infer<typeof insertFilmmakingCommentSchema>;
export type FilmmakingComment = typeof filmmakingCommentsTable.$inferSelect;
