// artifacts/api-server/src/lib/course-access.ts
// UPDATED: Tambah progress tracking saat activation

import crypto from "crypto";
import {
  db,
  coursesTable,
  courseEnrollmentsTable,
  courseMaterialsTable,
  coursePackagesTable,
  type Course,
  type CourseEnrollment,
  type CourseMaterial,
  type CoursePackage,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";

type EmailResult = { sent: boolean; skipped?: boolean; error?: string };

export interface PortalPayload {
  enrollment: CourseEnrollment;
  course: Course;
  package: CoursePackage | null;
  materials: CourseMaterial[];
  progress: {
    completedCount: number;
    totalCount: number;
    percentage: number;
  };
}

function appUrl(): string {
  return (process.env.APP_URL || process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/$/, "");
}

export function normalizeCourseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function makeMemberCode(): string {
  return `FRM-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export function makeInvoiceNumber(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `FC-${y}${m}${d}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function formatRupiah(value: string | number | null | undefined): string {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(value: string | null | undefined): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Frameless Academy <academy@framelesscreative.com>";

  if (!apiKey) {
    console.info("[course-email] RESEND_API_KEY belum diset. Email dev log:", { to, subject, text });
    return { sent: false, skipped: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { sent: false, error: body || `HTTP ${response.status}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function getCourseAndPackage(enrollment: CourseEnrollment) {
  const [course] = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.id, String(enrollment.courseId)))
    .limit(1);

  const [pkg] = enrollment.packageId
    ? await db
        .select()
        .from(coursePackagesTable)
        .where(eq(coursePackagesTable.id, String(enrollment.packageId)))
        .limit(1)
    : [];

  return { course: course || null, pkg: pkg || null };
}

export async function ensureEnrollmentAccessFields(
  enrollment: CourseEnrollment,
): Promise<CourseEnrollment> {
  const updates: Partial<CourseEnrollment> = {};
  if (!(enrollment as any).memberCode)    (updates as any).memberCode    = makeMemberCode();
  if (!(enrollment as any).invoiceNumber) (updates as any).invoiceNumber = makeInvoiceNumber();

  if (Object.keys(updates).length === 0) return enrollment;

  try {
    const [updated] = await db
      .update(courseEnrollmentsTable)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(courseEnrollmentsTable.id, enrollment.id))
      .returning();
    return updated || { ...enrollment, ...updates } as CourseEnrollment;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/column.*does not exist|undefined column/i.test(msg)) {
      console.warn("[ensureEnrollmentAccessFields] Kolom baru belum ada di DB.");
      return { ...enrollment, ...updates } as CourseEnrollment;
    }
    throw err;
  }
}

export async function sendCourseAccessEmail(enrollment: CourseEnrollment): Promise<EmailResult> {
  const enriched = await ensureEnrollmentAccessFields(enrollment);
  const { course, pkg } = await getCourseAndPackage(enriched);
  if (!course) return { sent: false, error: "Course not found" };

  const portalUrl  = `${appUrl()}/portal/${enriched.id}`;
  const loginUrl   = `${appUrl()}/academy/login`;
  const invoiceNumber = (enriched as any).invoiceNumber || "-";
  const memberCode    = (enriched as any).memberCode    || "-";
  const courseTitle   = course.title;
  const packageName   = pkg?.name || "Paket kelas";
  const price         = formatRupiah(pkg?.price || 0);
  const supportEmail  = process.env.COURSE_SUPPORT_EMAIL || "support@framelesscreative.com";
  const waNumber      = process.env.WA_NUMBER || "6281234567890";

  const subject = `Akses Kelas ${courseTitle} – Kode Member: ${memberCode}`;

  const text = [
    `Halo ${enriched.name},`,
    "",
    `Pembayaran kelas ${courseTitle} sudah kami terima. Akses kelas kamu sudah aktif!`,
    "",
    `KODE MEMBER KAMU: ${memberCode}`,
    "",
    `Invoice  : ${invoiceNumber}`,
    `Paket    : ${packageName}`,
    `Total    : ${price}`,
    "",
    `Link kelas    : ${portalUrl}`,
    `Login member  : ${loginUrl}`,
    "",
    `Gunakan email ${enriched.email} + kode member di atas untuk masuk kembali.`,
    "",
    `Butuh bantuan? Email: ${supportEmail} | WA: wa.me/${waNumber}`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:'Inter',Arial,sans-serif">
<div style="max-width:620px;margin:0 auto;padding:32px 16px">

  <!-- Header -->
  <div style="margin-bottom:24px">
    <span style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#F03820;font-weight:800">Frameless Academy</span>
  </div>

  <!-- Card -->
  <div style="background:#111315;border:1px solid rgba(255,255,255,.1);border-radius:20px;overflow:hidden">

    <!-- Top bar -->
    <div style="height:4px;background:linear-gradient(90deg,#F03820,#ff8c6a)"></div>

    <!-- Body -->
    <div style="padding:32px 28px">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#ffffff;line-height:1.2">
        ✅ Akses kelas aktif!
      </h1>
      <p style="margin:0 0 24px;color:rgba(255,255,255,.6);font-size:15px;line-height:1.6">
        Halo <strong style="color:#fff">${escapeHtml(enriched.name)}</strong>, pembayaran untuk
        <strong style="color:#fff">${escapeHtml(courseTitle)}</strong> sudah kami terima.
        Selamat bergabung! 🎬
      </p>

      <!-- Member code box -->
      <div style="background:rgba(240,56,32,.1);border:1.5px solid rgba(240,56,32,.3);border-radius:16px;padding:20px 22px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);font-weight:700">
          Kode Member Kamu
        </p>
        <div style="font-size:34px;font-weight:900;letter-spacing:.1em;color:#F03820;font-family:monospace">
          ${escapeHtml(memberCode)}
        </div>
        <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,.35)">
          Simpan kode ini. Gunakan bersama email untuk login kapan saja.
        </p>
      </div>

      <!-- Invoice summary -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
        <tr style="border-bottom:1px solid rgba(255,255,255,.06)">
          <td style="padding:10px 0;font-size:13px;color:rgba(255,255,255,.4)">Invoice</td>
          <td style="padding:10px 0;font-size:13px;color:#fff;text-align:right;font-weight:700;font-family:monospace">${escapeHtml(invoiceNumber)}</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,.06)">
          <td style="padding:10px 0;font-size:13px;color:rgba(255,255,255,.4)">Paket</td>
          <td style="padding:10px 0;font-size:13px;color:#fff;text-align:right;font-weight:700">${escapeHtml(packageName)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;color:rgba(255,255,255,.4)">Total</td>
          <td style="padding:10px 0;font-size:15px;color:#F03820;text-align:right;font-weight:800">${escapeHtml(price)}</td>
        </tr>
      </table>

      <!-- CTA button -->
      <a href="${portalUrl}"
         style="display:block;text-align:center;background:#F03820;color:#fff;text-decoration:none;
                font-weight:800;font-size:15px;padding:16px 24px;border-radius:100px;
                box-shadow:0 8px 24px rgba(240,56,32,.35)">
        🚀 Masuk ke Kelas Sekarang
      </a>

      <!-- Login note -->
      <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,.4);text-align:center;line-height:1.6">
        Bisa juga login dari
        <a href="${loginUrl}" style="color:#F03820;text-decoration:none">halaman member</a>
        pakai email + kode di atas.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 28px;border-top:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;color:rgba(255,255,255,.25)">© Frameless Creative</span>
      <span style="font-size:12px;color:rgba(255,255,255,.25)">
        Butuh bantuan?
        <a href="mailto:${supportEmail}" style="color:#F03820;text-decoration:none">${supportEmail}</a>
      </span>
    </div>
  </div>

</div>
</body>
</html>`;

  const result = await sendEmail(enriched.email, subject, html, text);

  if (result.sent) {
    try {
      await db
        .update(courseEnrollmentsTable)
        .set({ accessLastSentAt: new Date(), updatedAt: new Date() } as any)
        .where(eq(courseEnrollmentsTable.id, enriched.id));
    } catch (err: any) {
      if (!/column.*does not exist|undefined column/i.test(err?.message || "")) {
        console.warn("[sendCourseAccessEmail] accessLastSentAt update failed:", err?.message);
      }
    }
  } else if (result.error) {
    console.warn("[course-email] gagal kirim email:", result.error);
  }

  return result;
}

export async function activateCourseEnrollment(
  enrollmentId: string,
  payment?: { method?: string | null; raw?: unknown; paidAt?: Date },
): Promise<CourseEnrollment> {
  const [current] = await db
    .select()
    .from(courseEnrollmentsTable)
    .where(eq(courseEnrollmentsTable.id, enrollmentId))
    .limit(1);

  if (!current) throw new Error(`Enrollment not found: ${enrollmentId}`);

  // Jika sudah aktif, skip re-activation
  if (current.status === "active" && current.paymentStatus === "paid") {
    console.log(`[activateCourseEnrollment] Already active: ${enrollmentId}`);
    return current;
  }

  const enriched = await ensureEnrollmentAccessFields(current);
  const shouldSendEmail = !(enriched as any).accessLastSentAt || enriched.paymentStatus !== "paid";

  const setData: Record<string, unknown> = {
    status:        "active",
    paymentStatus: "paid",
    paidAt:        enriched.paidAt || payment?.paidAt || new Date(),
    updatedAt:     new Date(),
  };

  const anyEnriched = enriched as any;
  if (anyEnriched.memberCode)    setData.memberCode    = anyEnriched.memberCode;
  if (anyEnriched.invoiceNumber) setData.invoiceNumber = anyEnriched.invoiceNumber;
  if (payment?.method)           setData.paymentMethod = payment.method;
  if (payment?.raw)              setData.paymentRaw    = JSON.stringify(payment.raw);

  let result: CourseEnrollment;
  try {
    const [updated] = await db
      .update(courseEnrollmentsTable)
      .set(setData as any)
      .where(eq(courseEnrollmentsTable.id, enrollmentId))
      .returning();
    result = updated || enriched;
    console.log(`[activateCourseEnrollment] ✓ Activated: ${enrollmentId}, memberCode: ${(result as any).memberCode}`);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/column.*does not exist|undefined column/i.test(msg)) {
      console.warn("[activateCourseEnrollment] Kolom baru belum ada — fallback minimal update");
      const [updated] = await db
        .update(courseEnrollmentsTable)
        .set({ status: "active", paymentStatus: "paid", paidAt: setData.paidAt as Date, updatedAt: new Date() } as any)
        .where(eq(courseEnrollmentsTable.id, enrollmentId))
        .returning();
      result = updated || enriched;
    } else {
      throw err;
    }
  }

  // Init course_progress record jika table sudah ada
  try {
    const materials = await db
      .select({ id: courseMaterialsTable.id })
      .from(courseMaterialsTable)
      .where(eq(courseMaterialsTable.courseId, String(result.courseId)));

    await db.execute(`
      INSERT INTO course_progress (enrollment_id, course_id, total_materials, completed_materials, completion_percentage)
      VALUES ('${result.id}', '${result.courseId}', ${materials.length}, 0, 0)
      ON CONFLICT (enrollment_id) DO NOTHING
    `);
    console.log(`[activateCourseEnrollment] ✓ Progress record created for ${enrollmentId}`);
  } catch (progressErr: any) {
    // Non-fatal — table mungkin belum ada atau sudah ada row
    console.warn("[activateCourseEnrollment] Progress init skipped:", progressErr?.message?.slice(0, 80));
  }

  if (shouldSendEmail) {
    try {
      await sendCourseAccessEmail(result);
    } catch (emailErr) {
      console.error("[activateCourseEnrollment] Email gagal:", emailErr);
    }
  }

  return result;
}

export async function getPortalPayload(enrollmentId: string): Promise<PortalPayload | null> {
  let enrollment: CourseEnrollment | null = null;

  try {
    const [row] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.id, enrollmentId))
      .limit(1);
    enrollment = row || null;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/column.*does not exist|undefined column/i.test(msg)) {
      // Fallback: select hanya kolom base
      const [row] = await db
        .select({
          id:              courseEnrollmentsTable.id,
          courseId:        courseEnrollmentsTable.courseId,
          packageId:       courseEnrollmentsTable.packageId,
          name:            courseEnrollmentsTable.name,
          email:           courseEnrollmentsTable.email,
          phone:           courseEnrollmentsTable.phone,
          status:          courseEnrollmentsTable.status,
          paymentStatus:   courseEnrollmentsTable.paymentStatus,
          midtransOrderId: courseEnrollmentsTable.midtransOrderId,
          paymentToken:    courseEnrollmentsTable.paymentToken,
          paidAt:          courseEnrollmentsTable.paidAt,
          notes:           courseEnrollmentsTable.notes,
          createdAt:       courseEnrollmentsTable.createdAt,
          updatedAt:       courseEnrollmentsTable.updatedAt,
        })
        .from(courseEnrollmentsTable)
        .where(eq(courseEnrollmentsTable.id, enrollmentId))
        .limit(1);
      enrollment = row as any || null;
    } else {
      throw err;
    }
  }

  if (!enrollment) return null;

  const enriched = await ensureEnrollmentAccessFields(enrollment);
  const { course, pkg } = await getCourseAndPackage(enriched);
  if (!course) return null;

  const isActive = enriched.status === "active" || enriched.paymentStatus === "paid";

  const materials = await db
    .select()
    .from(courseMaterialsTable)
    .where(eq(courseMaterialsTable.courseId, String(enriched.courseId)))
    .orderBy(asc(courseMaterialsTable.orderIndex));

  const activeMaterials = materials.filter((m: typeof materials[number]) => m.isActive !== false);

  // Fetch progress dari course_progress table (safe — jika table belum ada, fallback 0)
  let completedCount = 0;
  let totalCount = activeMaterials.length;
  try {
    const rows = await db.execute(`
      SELECT completed_materials, total_materials
      FROM course_progress
      WHERE enrollment_id = '${enriched.id}'
      LIMIT 1
    `);
    const row = (rows as any)?.rows?.[0];
    if (row) {
      completedCount = Number(row.completed_materials) || 0;
      totalCount     = Number(row.total_materials)     || totalCount;
    }
  } catch {
    // table belum ada — pakai default
  }

  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    enrollment: enriched,
    course,
    package: pkg,
    materials: activeMaterials.map((m: typeof activeMaterials[number]) => (isActive ? m : { ...m, url: "" })),
    progress: { completedCount, totalCount, percentage },
  };
}