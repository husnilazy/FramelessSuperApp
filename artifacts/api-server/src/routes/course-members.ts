// artifacts/api-server/src/routes/course-members.ts
// UPDATED: Tambah /mark-completed, /progress endpoint + improve portal route

import { Router, type IRouter } from "express";
import { db, courseEnrollmentsTable, courseMaterialsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  getPortalPayload,
  normalizeCourseEmail,
  sendCourseAccessEmail,
} from "../lib/course-access.js";

const router: IRouter = Router();

// ─── GET /portal/:id ──────────────────────────────────────────────────────────
router.get("/portal/:id", async (req, res): Promise<void> => {
  try {
    const payload = await getPortalPayload(String(req.params.id));
    if (!payload) {
      res.status(404).json({ error: "Portal tidak ditemukan" });
      return;
    }
    res.json(payload);
  } catch (err) {
    console.error("[GET /portal/:id]", err);
    res.status(500).json({ error: "Gagal memuat portal kelas" });
  }
});

// ─── Login handler (shared) ───────────────────────────────────────────────────
async function loginMember(req: any, res: any): Promise<void> {
  try {
    const email = normalizeCourseEmail(String(req.body?.email || ""));
    const code  = String(req.body?.code || req.body?.memberCode || "").trim().toUpperCase();

    if (!email || !code) {
      res.status(400).json({ error: "Email dan kode member wajib diisi" });
      return;
    }

    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(
        and(
          eq(courseEnrollmentsTable.email, email),
          eq(courseEnrollmentsTable.memberCode, code),
        ),
      )
      .orderBy(desc(courseEnrollmentsTable.createdAt))
      .limit(1);

    if (!enrollment || (enrollment.status !== "active" && enrollment.paymentStatus !== "paid")) {
      res.status(401).json({ error: "Email atau kode member tidak valid, atau akses belum aktif" });
      return;
    }

    const payload = await getPortalPayload(enrollment.id);
    if (!payload) {
      res.status(404).json({ error: "Portal tidak ditemukan" });
      return;
    }

    res.json({
      enrollmentId: enrollment.id,
      portalUrl: `/portal/${enrollment.id}`,
      member: {
        name:       enrollment.name,
        email:      enrollment.email,
        memberCode: (enrollment as any).memberCode,
      },
      data: payload,
    });
  } catch (err) {
    console.error("[POST /academy/login]", err);
    res.status(500).json({ error: "Login member gagal" });
  }
}

router.post("/academy/login",       loginMember);
router.post("/course-members/login", loginMember);

// ─── POST /course-members/resend-access ──────────────────────────────────────
router.post("/course-members/resend-access", async (req, res): Promise<void> => {
  try {
    const email = normalizeCourseEmail(String(req.body?.email || ""));
    if (!email) {
      res.status(400).json({ error: "Email wajib diisi" });
      return;
    }

    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.email, email))
      .orderBy(desc(courseEnrollmentsTable.createdAt))
      .limit(1);

    // Selalu kembalikan ok:true supaya tidak bocorkan info email terdaftar
    if (!enrollment || (enrollment.status !== "active" && enrollment.paymentStatus !== "paid")) {
      res.json({ ok: true });
      return;
    }

    await sendCourseAccessEmail(enrollment);
    res.json({ ok: true });
  } catch (err) {
    console.error("[POST /course-members/resend-access]", err);
    res.status(500).json({ error: "Gagal mengirim ulang akses" });
  }
});

// ─── POST /course-members/mark-completed ─────────────────────────────────────
// Tandai material sebagai selesai dan update progress
router.post("/course-members/mark-completed", async (req, res): Promise<void> => {
  try {
    const { enrollmentId, materialId } = req.body as {
      enrollmentId?: string;
      materialId?: string;
    };

    if (!enrollmentId || !materialId) {
      res.status(400).json({ error: "enrollmentId dan materialId wajib diisi" });
      return;
    }

    // Pastikan enrollment ada dan aktif
    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.id, enrollmentId))
      .limit(1);

    if (!enrollment || enrollment.status !== "active") {
      res.status(403).json({ error: "Akses tidak valid" });
      return;
    }

    // Pastikan material ada di kelas yang benar
    const [material] = await db
      .select({ id: courseMaterialsTable.id, courseId: courseMaterialsTable.courseId })
      .from(courseMaterialsTable)
      .where(eq(courseMaterialsTable.id, materialId))
      .limit(1);

    if (!material || String(material.courseId) !== String(enrollment.courseId)) {
      res.status(403).json({ error: "Material tidak ditemukan di kelas ini" });
      return;
    }

    const now = new Date().toISOString();

    // Upsert material view
    try {
      await db.execute(`
        INSERT INTO course_material_views (enrollment_id, material_id, is_completed, completed_at, last_watched_at)
        VALUES ('${enrollmentId}', '${materialId}', true, '${now}', '${now}')
        ON CONFLICT (enrollment_id, material_id)
        DO UPDATE SET
          is_completed    = true,
          completed_at    = COALESCE(course_material_views.completed_at, '${now}'),
          last_watched_at = '${now}',
          view_count      = course_material_views.view_count + 1
      `);
    } catch (viewErr: any) {
      // Jika tabel belum ada, skip saja (graceful)
      console.warn("[mark-completed] course_material_views upsert skipped:", viewErr?.message?.slice(0, 80));
    }

    // Hitung progress terbaru
    let completedCount = 0;
    let totalCount     = 0;
    let percentage     = 0;

    try {
      const totalRes = await db.execute(`
        SELECT COUNT(*) as cnt
        FROM course_materials
        WHERE course_id = '${enrollment.courseId}'
          AND is_active IS NOT FALSE
      `);
      totalCount = Number((totalRes as any)?.rows?.[0]?.cnt || 0);

      const doneRes = await db.execute(`
        SELECT COUNT(*) as cnt
        FROM course_material_views
        WHERE enrollment_id = '${enrollmentId}'
          AND is_completed = true
      `);
      completedCount = Number((doneRes as any)?.rows?.[0]?.cnt || 0);
      percentage     = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      // Update course_progress summary
      await db.execute(`
        INSERT INTO course_progress (enrollment_id, course_id, total_materials, completed_materials, completion_percentage, last_accessed_at, updated_at)
        VALUES ('${enrollmentId}', '${enrollment.courseId}', ${totalCount}, ${completedCount}, ${percentage}, '${now}', '${now}')
        ON CONFLICT (enrollment_id)
        DO UPDATE SET
          completed_materials   = ${completedCount},
          total_materials       = ${totalCount},
          completion_percentage = ${percentage},
          current_material_id   = '${materialId}',
          last_accessed_at      = '${now}',
          updated_at            = '${now}',
          completed_at          = CASE WHEN ${percentage} >= 100 THEN '${now}' ELSE course_progress.completed_at END
      `);
    } catch (progressErr: any) {
      console.warn("[mark-completed] Progress update skipped:", progressErr?.message?.slice(0, 80));
    }

    res.json({ ok: true, progress: { completedCount, totalCount, percentage } });
  } catch (err) {
    console.error("[POST /course-members/mark-completed]", err);
    res.status(500).json({ error: "Gagal menandai materi selesai" });
  }
});

// ─── GET /course-members/progress/:enrollmentId ───────────────────────────────
// Get progress summary untuk enrollment tertentu
router.get("/course-members/progress/:enrollmentId", async (req, res): Promise<void> => {
  try {
    const { enrollmentId } = req.params;

    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.id, enrollmentId))
      .limit(1);

    if (!enrollment) {
      res.status(404).json({ error: "Enrollment tidak ditemukan" });
      return;
    }

    let progress = { completedCount: 0, totalCount: 0, percentage: 0, completedMaterialIds: [] as string[] };

    try {
      const totalRes = await db.execute(`
        SELECT COUNT(*) as cnt
        FROM course_materials
        WHERE course_id = '${enrollment.courseId}'
          AND is_active IS NOT FALSE
      `);
      const totalCount = Number((totalRes as any)?.rows?.[0]?.cnt || 0);

      const viewsRes = await db.execute(`
        SELECT material_id
        FROM course_material_views
        WHERE enrollment_id = '${enrollmentId}'
          AND is_completed = true
      `);
      const completedIds = ((viewsRes as any)?.rows || []).map((r: any) => r.material_id);
      const completedCount = completedIds.length;
      const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      progress = { completedCount, totalCount, percentage, completedMaterialIds: completedIds };
    } catch {
      // table belum ada — return default
    }

    res.json({ ok: true, progress });
  } catch (err) {
    console.error("[GET /course-members/progress/:enrollmentId]", err);
    res.status(500).json({ error: "Gagal mengambil progress" });
  }
});

// ─── PUT /course-members/update-profile ──────────────────────────────────────
// Update nama, phone member
router.put("/course-members/update-profile", async (req, res): Promise<void> => {
  try {
    const { enrollmentId, name, phone } = req.body as {
      enrollmentId?: string;
      name?: string;
      phone?: string;
    };

    if (!enrollmentId) {
      res.status(400).json({ error: "enrollmentId wajib diisi" });
      return;
    }

    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.id, enrollmentId))
      .limit(1);

    if (!enrollment) {
      res.status(404).json({ error: "Enrollment tidak ditemukan" });
      return;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name?.trim())  updateData.name  = name.trim();
    if (phone?.trim()) updateData.phone = phone.trim();

    const [updated] = await db
      .update(courseEnrollmentsTable)
      .set(updateData as any)
      .where(eq(courseEnrollmentsTable.id, enrollmentId))
      .returning();

    res.json({
      ok: true,
      member: {
        name:  updated.name,
        email: updated.email,
        phone: updated.phone,
      },
    });
  } catch (err) {
    console.error("[PUT /course-members/update-profile]", err);
    res.status(500).json({ error: "Gagal update profil" });
  }
});

export default router;