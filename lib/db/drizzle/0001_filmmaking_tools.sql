-- =============================================
-- Migration: Create Filmmaking Tools Tables
-- =============================================

-- Tabel: filmmaking_documents
CREATE TABLE IF NOT EXISTS "filmmaking_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid REFERENCES "projects"("id") ON DELETE cascade,
	"crew_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
	"doc_type" text NOT NULL,
	"title" text NOT NULL,
	"content" json,
	"is_draft" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

-- Index untuk queries umum
CREATE INDEX IF NOT EXISTS "idx_filmmaking_documents_crew_id" ON "filmmaking_documents"("crew_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_documents_project_id" ON "filmmaking_documents"("project_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_documents_doc_type" ON "filmmaking_documents"("doc_type");

-- Tabel: filmmaking_collaborators
CREATE TABLE IF NOT EXISTS "filmmaking_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL REFERENCES "filmmaking_documents"("id") ON DELETE cascade,
	"crew_member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
	"role" text NOT NULL,
	"added_by" uuid NOT NULL REFERENCES "team_members"("id"),
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS "idx_filmmaking_collaborators_document_id" ON "filmmaking_collaborators"("document_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_collaborators_crew_member_id" ON "filmmaking_collaborators"("crew_member_id");

-- Tabel: filmmaking_submissions
CREATE TABLE IF NOT EXISTS "filmmaking_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL REFERENCES "filmmaking_documents"("id") ON DELETE cascade,
	"submitted_by" uuid NOT NULL REFERENCES "team_members"("id"),
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL DEFAULT 'pending',
	"admin_notes" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid REFERENCES "team_members"("id")
);

-- Index
CREATE INDEX IF NOT EXISTS "idx_filmmaking_submissions_document_id" ON "filmmaking_submissions"("document_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_submissions_status" ON "filmmaking_submissions"("status");

-- Tabel: filmmaking_revisions
CREATE TABLE IF NOT EXISTS "filmmaking_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL REFERENCES "filmmaking_documents"("id") ON DELETE cascade,
	"content_snapshot" json NOT NULL,
	"changed_by" uuid NOT NULL REFERENCES "team_members"("id"),
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS "idx_filmmaking_revisions_document_id" ON "filmmaking_revisions"("document_id");

-- Tabel: filmmaking_comments
CREATE TABLE IF NOT EXISTS "filmmaking_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL REFERENCES "filmmaking_documents"("id") ON DELETE cascade,
	"crew_member_id" uuid NOT NULL REFERENCES "team_members"("id"),
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS "idx_filmmaking_comments_document_id" ON "filmmaking_comments"("document_id");
