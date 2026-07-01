ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "payment_raw" text;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "member_code" text;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "invoice_number" text;
ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "access_last_sent_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "course_enrollments_member_code_unique"
  ON "course_enrollments" ("member_code")
  WHERE "member_code" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "course_enrollments_invoice_number_unique"
  ON "course_enrollments" ("invoice_number")
  WHERE "invoice_number" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "course_enrollments_email_idx"
  ON "course_enrollments" ("email");

CREATE INDEX IF NOT EXISTS "course_enrollments_midtrans_order_id_idx"
  ON "course_enrollments" ("midtrans_order_id");
