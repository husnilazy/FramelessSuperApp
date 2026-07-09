-- =============================================
-- Migration: Add Quotations Module Tables
-- =============================================

-- Add columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

-- Add columns to team_members table
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "instagram" text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "linkedin" text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "twitter" text;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "website" text;

-- Add columns to clients table
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "website" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'prospect';
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'new';

-- Add columns to course_enrollments table
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "payment_raw" text;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "member_code" text;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "invoice_number" text;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "access_last_sent_at" timestamp with time zone;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

-- Add columns to course_materials table
ALTER TABLE "course_materials" ADD COLUMN IF NOT EXISTS "duration_minutes" integer;
ALTER TABLE "course_materials" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

-- Add columns to course_packages table
ALTER TABLE "course_packages" ADD COLUMN IF NOT EXISTS "original_price" numeric(15, 2);
ALTER TABLE "course_packages" ADD COLUMN IF NOT EXISTS "discount_label" text;
ALTER TABLE "course_packages" ADD COLUMN IF NOT EXISTS "discount_end_date" timestamp with time zone;
ALTER TABLE "course_packages" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

-- Create quotations table
CREATE TABLE IF NOT EXISTS "quotations" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"clientId" text NOT NULL,
	"projectId" text,
	"projectType" text,
	"title" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"validUntil" timestamp,
	"subtotal" numeric DEFAULT '0' NOT NULL,
	"tax" numeric DEFAULT '0' NOT NULL,
	"discount" numeric DEFAULT '0' NOT NULL,
	"total" numeric DEFAULT '0' NOT NULL,
	"estimatedCost" numeric DEFAULT '0' NOT NULL,
	"dpPercentage" numeric DEFAULT '50' NOT NULL,
	"notes" text,
	"terms" text,
	"billTo" text,
	"logoUrl" text,
	"paperSize" text DEFAULT 'A4' NOT NULL,
	"marginTop" text DEFAULT '16mm' NOT NULL,
	"marginBottom" text DEFAULT '16mm' NOT NULL,
	"marginLeft" text DEFAULT '14mm' NOT NULL,
	"marginRight" text DEFAULT '14mm' NOT NULL,
	"convertedProjectId" text,
	"convertedInvoiceId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_clientId_fk" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE no action
);

-- Create quotation_items table
CREATE TABLE IF NOT EXISTS "quotation_items" (
	"id" text PRIMARY KEY NOT NULL,
	"quotationId" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric DEFAULT '1' NOT NULL,
	"unitPrice" numeric DEFAULT '0' NOT NULL,
	"total" numeric DEFAULT '0' NOT NULL,
	"sortOrder" numeric DEFAULT '0' NOT NULL,
	CONSTRAINT "quotation_items_quotationId_fk" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE cascade
);

-- Create quotation_rab_items table
CREATE TABLE IF NOT EXISTS "quotation_rab_items" (
	"id" text PRIMARY KEY NOT NULL,
	"quotationId" text NOT NULL,
	"category" text NOT NULL,
	"itemName" text NOT NULL,
	"quantity" numeric DEFAULT '1' NOT NULL,
	"unit" text,
	"unitCost" numeric DEFAULT '0' NOT NULL,
	"total" numeric DEFAULT '0' NOT NULL,
	"notes" text,
	"sortOrder" numeric DEFAULT '0' NOT NULL,
	CONSTRAINT "quotation_rab_items_quotationId_fk" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE cascade
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_quotations_clientId" ON "quotations"("clientId");
CREATE INDEX IF NOT EXISTS "idx_quotations_status" ON "quotations"("status");
CREATE INDEX IF NOT EXISTS "idx_quotations_createdAt" ON "quotations"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_quotation_items_quotationId" ON "quotation_items"("quotationId");
CREATE INDEX IF NOT EXISTS "idx_quotation_rab_items_quotationId" ON "quotation_rab_items"("quotationId");

-- Create filmmaking module tables
CREATE TABLE IF NOT EXISTS "course_gallery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid REFERENCES "courses"("id") ON DELETE cascade,
	"url" text NOT NULL,
	"caption" text,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "course_workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid REFERENCES "courses"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"description" text,
	"date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"location" text NOT NULL,
	"location_url" text,
	"price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"quota" integer DEFAULT 20 NOT NULL,
	"registered_count" integer DEFAULT 0,
	"registration_url" text,
	"poster_url" text,
	"video_url" text,
	"highlights" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS "filmmaking_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL REFERENCES "filmmaking_documents"("id") ON DELETE cascade,
	"crew_member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE cascade,
	"role" text NOT NULL,
	"added_by" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE no action,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "filmmaking_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL REFERENCES "filmmaking_documents"("id") ON DELETE cascade,
	"submitted_by" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE no action,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid REFERENCES "team_members"("id") ON DELETE no action
);

CREATE TABLE IF NOT EXISTS "filmmaking_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL REFERENCES "filmmaking_documents"("id") ON DELETE cascade,
	"content_snapshot" json NOT NULL,
	"changed_by" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE no action,
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "filmmaking_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL REFERENCES "filmmaking_documents"("id") ON DELETE cascade,
	"crew_member_id" uuid NOT NULL REFERENCES "team_members"("id") ON DELETE no action,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for filmmaking tables
CREATE INDEX IF NOT EXISTS "idx_filmmaking_documents_crew_id" ON "filmmaking_documents"("crew_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_documents_project_id" ON "filmmaking_documents"("project_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_documents_doc_type" ON "filmmaking_documents"("doc_type");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_collaborators_document_id" ON "filmmaking_collaborators"("document_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_collaborators_crew_member_id" ON "filmmaking_collaborators"("crew_member_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_submissions_document_id" ON "filmmaking_submissions"("document_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_submissions_status" ON "filmmaking_submissions"("status");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_revisions_document_id" ON "filmmaking_revisions"("document_id");
CREATE INDEX IF NOT EXISTS "idx_filmmaking_comments_document_id" ON "filmmaking_comments"("document_id");
