import { Router, type IRouter } from "express";
import {
  db,
  coursesTable,
  coursePackagesTable,
  courseEnrollmentsTable,
  courseMaterialsTable,
  courseWorkshopsTable,
  courseGalleryTable,
} from "@workspace/db";

import {
  eq,
  desc,
  asc,
  type InferSelectModel,
} from "drizzle-orm";

import { requireAuth } from "./middleware.js";

const router: IRouter = Router();

type Course      = InferSelectModel<typeof coursesTable>;
type CourseMaterial = InferSelectModel<typeof courseMaterialsTable>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugifyCourseValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function coursePayload(body: Record<string, unknown>) {
  const title    = typeof body.title === "string" ? body.title.trim() : "";
  const rawSlug  = typeof body.slug  === "string" ? body.slug.trim()  : "";
  const slugSource = isUrlLike(rawSlug) ? title : rawSlug || title;

  return {
    slug:  slugifyCourseValue(slugSource),
    title,
    subtitle:         strOrNull(body.subtitle),
    description:      strOrNull(body.description),
    thumbnail:        strOrNull(body.thumbnail),
    highlightVideoUrl: strOrNull(body.highlightVideoUrl),
    instructor:       strOrNull(body.instructor),
    category:         (typeof body.category === "string" && body.category.trim()) ? body.category.trim() : "videography",
    level:            (typeof body.level    === "string" && body.level.trim())    ? body.level.trim()    : "beginner",
    curriculumPdfUrl: strOrNull(body.curriculumPdfUrl),
    isPublished:      body.isPublished !== undefined ? Boolean(body.isPublished) : true,
    orderIndex:       Number.isFinite(Number(body.orderIndex)) ? Number(body.orderIndex) : 0,
  };
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function packagePayload(body: Record<string, unknown>, courseId: string) {
  return {
    courseId,
    name:        typeof body.name === "string" ? body.name.trim() : "",
    description: strOrNull(body.description),
    price:       String(Number.isFinite(Number(body.price)) ? Number(body.price) : 0),
    isTrial:        Boolean(body.isTrial),
    originalPrice:  body.originalPrice != null ? String(body.originalPrice) : null,
    discountLabel:  body.discountLabel  ? String(body.discountLabel).trim() : null,
    discountEndDate: body.discountEndDate ? new Date(String(body.discountEndDate)) : null,
    isActive:    body.isActive !== undefined ? Boolean(body.isActive) : true,
    durationDays: Number.isFinite(Number(body.durationDays)) && Number(body.durationDays) > 0
      ? Number(body.durationDays) : null,
    features:    typeof body.features === "string" ? body.features : null,
    orderIndex:  Number.isFinite(Number(body.orderIndex)) ? Number(body.orderIndex) : 0,
  };
}

function materialPayload(body: Record<string, unknown>, courseId: string) {
  return {
    courseId,
    title:           typeof body.title === "string" ? body.title.trim() : "",
    description:     strOrNull(body.description) ?? "",
    url:             typeof body.url === "string" ? body.url.trim() : "",
    type:            typeof body.type === "string" ? body.type : "video",
    orderIndex:      Number.isFinite(Number(body.orderIndex)) ? Number(body.orderIndex) : 0,
    isActive:        body.isActive !== undefined ? Boolean(body.isActive) : true,
    durationMinutes: Number.isFinite(Number(body.durationMinutes)) && Number(body.durationMinutes) > 0
      ? Number(body.durationMinutes) : null,
  };
}

function courseErrorMessage(err: unknown): string {
  const raw =
    (err as { cause?: { message?: string } })?.cause?.message ||
    (err as Error)?.message ||
    "Gagal menyimpan";
  if (/duplicate key|unique/i.test(raw)) return "Slug course sudah dipakai. Gunakan slug lain.";
  return raw;
}

// ─── COURSES ──────────────────────────────────────────────────────────────────


// ── Helper: ambil packages dengan kolom diskon (raw SQL fallback) ─────────────
// Pakai raw SQL supaya tidak tergantung Drizzle schema rebuild
async function getPackagesWithDiscount(courseId: string) {
  try {
    // Coba Drizzle dulu (bekerja jika schema sudah di-rebuild)
    const pkgs = await db
      .select()
      .from(coursePackagesTable)
      .where(eq(coursePackagesTable.courseId, courseId))
      .orderBy(asc(coursePackagesTable.orderIndex));

    // Jika kolom diskon belum ada di Drizzle result, fetch via raw SQL
    const firstPkg = pkgs[0] as any;
    if (pkgs.length > 0 && firstPkg.originalPrice === undefined) {
      throw new Error("schema_outdated");
    }
    return pkgs;
  } catch (err: any) {
    // Fallback: raw SQL yang explicit include kolom diskon
    const { pool } = await import("@workspace/db");
    const result = await pool!.query(
      `SELECT id, course_id as "courseId", name, description,
              price, original_price as "originalPrice",
              discount_label as "discountLabel",
              discount_end_date as "discountEndDate",
              is_trial as "isTrial", duration_days as "durationDays",
              features, order_index as "orderIndex",
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM course_packages
       WHERE course_id = $1
       ORDER BY order_index ASC`,
      [courseId]
    );
    return result.rows;
  }
}

// GET /courses  — publik, untuk listing page
router.get("/courses", async (_req, res): Promise<void> => {
  try {
    const courses = await db
      .select()
      .from(coursesTable)
      .orderBy(asc(coursesTable.orderIndex));

    const withPackages = await Promise.all(
      courses.map(async (c: Course) => {
        const packages = await getPackagesWithDiscount(String(c.id));
        return { ...c, packages };
      })
    );

    res.json(withPackages);
  } catch (err) {
    console.error("[GET /courses]", err);
    res.status(500).json({ error: "Failed loading courses" });
  }
});

// GET /courses/:slug  — publik, halaman detail course
router.get("/courses/:slug", async (req, res): Promise<void> => {
  try {
    const slug = String(req.params.slug);

    const [course] = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.slug, slug))
      .limit(1);

    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const [packages, materials, workshops, gallery] = await Promise.all([
      getPackagesWithDiscount(String(course.id)),
      db.select().from(courseMaterialsTable)
        .where(eq(courseMaterialsTable.courseId, String(course.id)))
        .orderBy(asc(courseMaterialsTable.orderIndex)),
      db.select().from(courseWorkshopsTable)
        .where(eq(courseWorkshopsTable.courseId, String(course.id)))
        .orderBy(asc(courseWorkshopsTable.date)),
      db.select().from(courseGalleryTable)
        .where(eq(courseGalleryTable.courseId, String(course.id)))
        .orderBy(asc(courseGalleryTable.orderIndex)),
    ]);

    res.json({
      ...course,
      packages,
      materials: materials.filter((m: any) => m.isActive),
      workshops: workshops.filter((w: any) => w.isActive !== false),
      gallery,
    });
  } catch (err) {
    console.error("[GET /courses/:slug]", err);
    res.status(500).json({ error: "Failed loading course" });
  }
});

// POST /courses  — admin, buat course baru
router.post("/courses", requireAuth, async (req, res): Promise<void> => {
  try {
    const [course] = await db
      .insert(coursesTable)
      .values(coursePayload(req.body as Record<string, unknown>))
      .returning();
    res.status(201).json(course);
  } catch (err) {
    console.error("[POST /courses]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// PUT /courses/:id  — admin, update course
router.put("/courses/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const [course] = await db
      .update(coursesTable)
      .set({ ...coursePayload(req.body as Record<string, unknown>), updatedAt: new Date() })
      .where(eq(coursesTable.id, id))
      .returning();
    res.json(course);
  } catch (err) {
    console.error("[PUT /courses/:id]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// DELETE /courses/:id  — admin
router.delete("/courses/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    // Cascade: hapus materi & paket dulu biar tidak orphan (kalau DB constraint belum setup)
    await db.delete(courseMaterialsTable).where(eq(courseMaterialsTable.courseId, id));
    await db.delete(coursePackagesTable).where(eq(coursePackagesTable.courseId, id));
    await db.delete(coursesTable).where(eq(coursesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /courses/:id]", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── PACKAGES ─────────────────────────────────────────────────────────────────

// GET /courses/:id/packages  — admin
router.get("/courses/:id/packages", requireAuth, async (req, res): Promise<void> => {
  try {
    const packages = await getPackagesWithDiscount(String(req.params.id));
    res.json(packages);
  } catch (err) {
    console.error("[GET /courses/:id/packages]", err);
    res.status(500).json({ error: "Failed loading packages" });
  }
});

// POST /courses/:id/packages  — admin, tambah paket baru
router.post("/courses/:id/packages", requireAuth, async (req, res): Promise<void> => {
  try {
    const courseId  = String(req.params.id);
    const body      = req.body as Record<string, unknown>;
    const { pool }  = await import("@workspace/db");

    const price        = body.price           != null ? Number(body.price)         : 0;
    const origPrice    = body.originalPrice   != null ? Number(body.originalPrice) || null : null;
    const discLabel    = body.discountLabel   ? String(body.discountLabel).trim()  : null;
    const discEnd      = body.discountEndDate ? new Date(String(body.discountEndDate)) : null;
    const name         = body.name            ? String(body.name).trim()           : "Paket Baru";
    const description  = body.description     ? String(body.description).trim()    : null;
    const isTrial      = Boolean(body.isTrial);
    const durationDays = body.durationDays    ? Number(body.durationDays) || null  : null;
    const features     = body.features        ? String(body.features).trim()       : null;
    const orderIndex   = body.orderIndex      != null ? Number(body.orderIndex)    : 0;
    const isActive     = body.isActive        != null ? Boolean(body.isActive)     : true;

    const result = await pool!.query(
      `INSERT INTO course_packages
        (id, course_id, name, description, price, original_price, discount_label,
         discount_end_date, is_trial, duration_days, features, order_index, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       RETURNING id, course_id as "courseId", name, description,
                 price, original_price as "originalPrice",
                 discount_label as "discountLabel",
                 discount_end_date as "discountEndDate",
                 is_trial as "isTrial", duration_days as "durationDays",
                 features, order_index as "orderIndex",
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [courseId, name, description, price, origPrice, discLabel, discEnd,
       isTrial, durationDays, features, orderIndex, isActive]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[POST /courses/:id/packages]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// PUT /course-packages/:id  — admin, edit paket
router.put("/course-packages/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    // ambil courseId dari DB supaya tidak bisa di-spoof
    const [existing] = await db
      .select()
      .from(coursePackagesTable)
      .where(eq(coursePackagesTable.id, id))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Package not found" }); return; }

    // Raw SQL update — bypass Drizzle schema supaya kolom diskon bisa tersimpan
    // tanpa perlu rebuild @workspace/db
    const { pool } = await import("@workspace/db");
    const body = req.body as Record<string, unknown>;
    const price        = body.price           != null ? Number(body.price)        : Number(existing.price);
    const origPrice    = body.originalPrice   != null ? Number(body.originalPrice) || null : null;
    const discLabel    = body.discountLabel   ? String(body.discountLabel).trim()  : null;
    const discEnd      = body.discountEndDate ? new Date(String(body.discountEndDate)) : null;
    const name         = body.name            ? String(body.name).trim()           : existing.name;
    const description  = body.description     != null ? String(body.description).trim() : null;
    const isTrial      = body.isTrial         != null ? Boolean(body.isTrial)      : existing.isTrial;
    const durationDays = body.durationDays    ? Number(body.durationDays) || null  : existing.durationDays;
    const features     = body.features        != null ? String(body.features).trim() : null;
    const orderIndex   = body.orderIndex      != null ? Number(body.orderIndex)    : existing.orderIndex;
    const isActive     = body.isActive        != null ? Boolean(body.isActive)     : existing.isActive;

    await pool!.query(
      `UPDATE course_packages SET
        name             = $1,
        description      = $2,
        price            = $3,
        original_price   = $4,
        discount_label   = $5,
        discount_end_date = $6,
        is_trial         = $7,
        duration_days    = $8,
        features         = $9,
        order_index      = $10,
        is_active        = $11,
        updated_at       = NOW()
       WHERE id = $12`,
      [name, description, price, origPrice, discLabel, discEnd, isTrial, durationDays, features, orderIndex, isActive, id]
    );

    // Return data terbaru via raw SQL
    const result = await pool!.query(
      `SELECT id, course_id as "courseId", name, description,
              price, original_price as "originalPrice",
              discount_label as "discountLabel",
              discount_end_date as "discountEndDate",
              is_trial as "isTrial", duration_days as "durationDays",
              features, order_index as "orderIndex",
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM course_packages WHERE id = $1`,
      [id]
    );
    res.json(result.rows[0] || existing);
  } catch (err) {
    console.error("[PUT /course-packages/:id]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// DELETE /course-packages/:id  — admin
router.delete("/course-packages/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(coursePackagesTable).where(eq(coursePackagesTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /course-packages/:id]", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── MATERIALS ────────────────────────────────────────────────────────────────

// GET /courses/:id/materials  — admin (semua materi, termasuk draft)
router.get("/courses/:id/materials", requireAuth, async (req, res): Promise<void> => {
  try {
    const materials = await db
      .select()
      .from(courseMaterialsTable)
      .where(eq(courseMaterialsTable.courseId, String(req.params.id)))
      .orderBy(asc(courseMaterialsTable.orderIndex));
    res.json(materials);
  } catch (err) {
    console.error("[GET /courses/:id/materials]", err);
    res.status(500).json({ error: "Failed loading materials" });
  }
});

// POST /courses/:id/materials  — admin, tambah materi
router.post("/courses/:id/materials", requireAuth, async (req, res): Promise<void> => {
  try {
    const courseId = String(req.params.id);
    const [mat] = await db
      .insert(courseMaterialsTable)
      .values(materialPayload(req.body as Record<string, unknown>, courseId))
      .returning();
    res.status(201).json(mat);
  } catch (err) {
    console.error("[POST /courses/:id/materials]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// PUT /course-materials/:id  — admin, edit materi (termasuk reorder)
router.put("/course-materials/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const [existing] = await db
      .select()
      .from(courseMaterialsTable)
      .where(eq(courseMaterialsTable.id, id))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Material not found" }); return; }

    const [mat] = await db
      .update(courseMaterialsTable)
      .set({
        ...materialPayload(req.body as Record<string, unknown>, String(existing.courseId ?? "")),
        updatedAt: new Date(),
      })
      .where(eq(courseMaterialsTable.id, id))
      .returning();
    res.json(mat);
  } catch (err) {
    console.error("[PUT /course-materials/:id]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// DELETE /course-materials/:id  — admin
router.delete("/course-materials/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    await db
      .delete(courseMaterialsTable)
      .where(eq(courseMaterialsTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /course-materials/:id]", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

// GET /enrollments  — admin, semua pendaftar
router.get("/enrollments", requireAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(courseEnrollmentsTable)
      .orderBy(desc(courseEnrollmentsTable.createdAt));
    res.json(rows);
  } catch (err: any) {
    const msg = err?.message || String(err);
    // Kolom baru belum ada di DB → minta jalankan migration
    if (/column.*does not exist|undefined column/i.test(msg)) {
      console.error("[GET /enrollments] Kolom DB belum up-to-date. Jalankan migration-enrollment-fix.sql di Supabase.");
      // Fallback: select hanya kolom yang pasti ada
      try {
        const fallback = await db
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
            paidAt:          courseEnrollmentsTable.paidAt,
            notes:           courseEnrollmentsTable.notes,
            createdAt:       courseEnrollmentsTable.createdAt,
          })
          .from(courseEnrollmentsTable)
          .orderBy(desc(courseEnrollmentsTable.createdAt));
        res.json(fallback);
        return;
      } catch (fb) {
        console.error("[GET /enrollments] Fallback juga gagal:", fb);
      }
    }
    console.error("[GET /enrollments]", err);
    res.status(500).json({ error: "Failed loading enrollments", detail: msg });
  }
});

// GET /enrollments/:id  — admin, detail satu enrollment (untuk portal)
router.get("/enrollments/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.id, String(req.params.id)))
      .limit(1);
    if (!row) { res.status(404).json({ error: "Enrollment not found" }); return; }
    res.json(row);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/column.*does not exist|undefined column/i.test(msg)) {
      // Fallback: select base columns only
      try {
        const [row] = await db
          .select({
            id:            courseEnrollmentsTable.id,
            courseId:      courseEnrollmentsTable.courseId,
            packageId:     courseEnrollmentsTable.packageId,
            name:          courseEnrollmentsTable.name,
            email:         courseEnrollmentsTable.email,
            phone:         courseEnrollmentsTable.phone,
            status:        courseEnrollmentsTable.status,
            paymentStatus: courseEnrollmentsTable.paymentStatus,
            paidAt:        courseEnrollmentsTable.paidAt,
            notes:         courseEnrollmentsTable.notes,
            createdAt:     courseEnrollmentsTable.createdAt,
          })
          .from(courseEnrollmentsTable)
          .where(eq(courseEnrollmentsTable.id, String(req.params.id)))
          .limit(1);
        if (!row) { res.status(404).json({ error: "Enrollment not found" }); return; }
        res.json(row);
        return;
      } catch { /* fall through */ }
    }
    console.error("[GET /enrollments/:id]", err);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /enrollments/:id  — admin, update status / payment / notes
router.patch("/enrollments/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id   = String(req.params.id);
    const body = req.body as Record<string, unknown>;

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.status        === "string") updates.status        = body.status;
    if (typeof body.paymentStatus === "string") updates.paymentStatus = body.paymentStatus;
    if (typeof body.notes         === "string") updates.notes         = body.notes;
    if (typeof body.paidAt        === "string") updates.paidAt        = new Date(body.paidAt);
    if (body.paidAt instanceof Date)            updates.paidAt        = body.paidAt;
    // New columns — only set if provided
    if (typeof body.memberCode    === "string") updates.memberCode    = body.memberCode;
    if (typeof body.invoiceNumber === "string") updates.invoiceNumber = body.invoiceNumber;
    if (typeof body.paymentMethod === "string") updates.paymentMethod = body.paymentMethod;

    const [row] = await db
      .update(courseEnrollmentsTable)
      .set(updates as any)
      .where(eq(courseEnrollmentsTable.id, id))
      .returning();

    if (!row) { res.status(404).json({ error: "Enrollment not found" }); return; }
    res.json(row);
  } catch (err: any) {
    const msg = err?.message || String(err);
    // If new columns don't exist yet, do a minimal update
    if (/column.*does not exist|undefined column/i.test(msg)) {
      try {
        const id   = String(req.params.id);
        const body = req.body as Record<string, unknown>;
        const safe: Record<string, unknown> = { updatedAt: new Date() };
        if (typeof body.status        === "string") safe.status        = body.status;
        if (typeof body.paymentStatus === "string") safe.paymentStatus = body.paymentStatus;
        if (typeof body.notes         === "string") safe.notes         = body.notes;
        if (typeof body.paidAt        === "string") safe.paidAt        = new Date(body.paidAt as string);
        const [row] = await db.update(courseEnrollmentsTable).set(safe as any)
          .where(eq(courseEnrollmentsTable.id, id)).returning();
        res.json(row || { id, ...safe });
        return;
      } catch (fb) {
        console.error("[PATCH /enrollments/:id] safe fallback failed:", fb);
      }
    }
    console.error("[PATCH /enrollments/:id]", err);
    res.status(500).json({ error: "Update failed" });
  }
});

// ─── WORKSHOPS ────────────────────────────────────────────────────────────────

function workshopPayload(body: Record<string, unknown>, courseId: string) {
  return {
    courseId,
    title:           typeof body.title === "string" ? body.title.trim() : "",
    description:     strOrNull(body.description),
    date:            new Date(String(body.date)),
    endDate:         body.endDate ? new Date(String(body.endDate)) : null,
    location:        typeof body.location === "string" ? body.location.trim() : "",
    locationUrl:     strOrNull(body.locationUrl),
    price:           String(Number.isFinite(Number(body.price)) ? Number(body.price) : 0),
    quota:           Number.isFinite(Number(body.quota)) ? Number(body.quota) : 20,
    registrationUrl: strOrNull(body.registrationUrl),
    posterUrl:       strOrNull(body.posterUrl),
    videoUrl:        strOrNull(body.videoUrl),
    highlights:      strOrNull(body.highlights),
    isActive:        body.isActive !== undefined ? Boolean(body.isActive) : true,
  };
}

// GET /courses/:id/workshops  — admin (semua, termasuk inactive)
router.get("/courses/:id/workshops", requireAuth, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(courseWorkshopsTable)
      .where(eq(courseWorkshopsTable.courseId, String(req.params.id)))
      .orderBy(asc(courseWorkshopsTable.date));
    res.json(rows);
  } catch (err) {
    console.error("[GET /courses/:id/workshops]", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /courses/:id/workshops
router.post("/courses/:id/workshops", requireAuth, async (req, res): Promise<void> => {
  try {
    const courseId = String(req.params.id);
    const [row] = await db
      .insert(courseWorkshopsTable)
      .values(workshopPayload(req.body as Record<string, unknown>, courseId))
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[POST /courses/:id/workshops]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// PUT /course-workshops/:id
router.put("/course-workshops/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const [existing] = await db
      .select().from(courseWorkshopsTable)
      .where(eq(courseWorkshopsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Workshop not found" }); return; }

    const [row] = await db
      .update(courseWorkshopsTable)
      .set({ ...workshopPayload(req.body as Record<string, unknown>, String(existing.courseId ?? "")), updatedAt: new Date() })
      .where(eq(courseWorkshopsTable.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    console.error("[PUT /course-workshops/:id]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// PATCH /course-workshops/:id/increment — tambah registered count
router.patch("/course-workshops/:id/increment", async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const [existing] = await db
      .select().from(courseWorkshopsTable)
      .where(eq(courseWorkshopsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Workshop not found" }); return; }

    const currentCount = (existing as any).registeredCount ?? 0;
    if (currentCount >= existing.quota) {
      res.status(400).json({ error: "Workshop sudah penuh" }); return;
    }
    const [row] = await db
      .update(courseWorkshopsTable)
      .set({ registeredCount: currentCount + 1, updatedAt: new Date() } as any)
      .where(eq(courseWorkshopsTable.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    console.error("[PATCH /course-workshops/:id/increment]", err);
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /course-workshops/:id
router.delete("/course-workshops/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(courseWorkshopsTable).where(eq(courseWorkshopsTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /course-workshops/:id]", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── GALLERY ──────────────────────────────────────────────────────────────────

// GET /courses/:id/gallery  — admin
router.get("/courses/:id/gallery", requireAuth, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(courseGalleryTable)
      .where(eq(courseGalleryTable.courseId, String(req.params.id)))
      .orderBy(asc(courseGalleryTable.orderIndex));
    res.json(rows);
  } catch (err) {
    console.error("[GET /courses/:id/gallery]", err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /courses/:id/gallery  — upload satu foto
router.post("/courses/:id/gallery", requireAuth, async (req, res): Promise<void> => {
  try {
    const courseId = String(req.params.id);
    const body     = req.body as Record<string, unknown>;
    const url      = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) { res.status(400).json({ error: "URL wajib diisi" }); return; }

    // Cari orderIndex tertinggi dulu
    const existing = await db
      .select()
      .from(courseGalleryTable)
      .where(eq(courseGalleryTable.courseId, courseId))
      .orderBy(desc(courseGalleryTable.orderIndex))
      .limit(1);
    const nextOrder = existing.length > 0 ? ((existing[0] as any).orderIndex ?? 0) + 10 : 0;

    const [row] = await db
      .insert(courseGalleryTable)
      .values({
        courseId,
        url,
        caption:    strOrNull(body.caption),
        orderIndex: nextOrder,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[POST /courses/:id/gallery]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

// PUT /course-gallery/:id  — edit caption / urutan
router.put("/course-gallery/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id   = String(req.params.id);
    const body = req.body as Record<string, unknown>;
    const [row] = await db
      .update(courseGalleryTable)
      .set({
        caption:    strOrNull(body.caption),
        orderIndex: Number.isFinite(Number(body.orderIndex)) ? Number(body.orderIndex) : undefined,
      } as any)
      .where(eq(courseGalleryTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Photo not found" }); return; }
    res.json(row);
  } catch (err) {
    console.error("[PUT /course-gallery/:id]", err);
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /course-gallery/:id
router.delete("/course-gallery/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(courseGalleryTable).where(eq(courseGalleryTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /course-gallery/:id]", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── CMS: academy_stats ───────────────────────────────────────────────────────
// Endpoint GET/PUT /cms/academy_stats — dipakai courses.tsx & landing.tsx
// Disimpan sebagai JSON string di DB (pakai cmsSettingsTable jika ada,
// fallback ke file-level Map agar tidak crash jika tabel belum exist)

const academyStatsCache = new Map<string, string>();

router.get("/cms/academy_stats", async (_req, res): Promise<void> => {
  // Coba baca dari DB dulu
  try {
    const { cmsSettingsTable } = await import("@workspace/db") as any;
    if (cmsSettingsTable) {
      const [row] = await db
        .select()
        .from(cmsSettingsTable)
        .where(eq((cmsSettingsTable as any).key, "academy_stats"))
        .limit(1);
      if (row) {
        res.json({ key: "academy_stats", value: (row as any).value });
        return;
      }
    }
  } catch { /* tabel mungkin belum ada / berbeda nama */ }

  // Fallback: in-memory cache atau default
  const cached = academyStatsCache.get("academy_stats");
  res.json({
    key:   "academy_stats",
    value: cached || JSON.stringify({ alumni: "500+", rating: "4.9/5", tagline: "Kuasai videografi dari sineas profesional" }),
  });
});

router.put("/cms/academy_stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const value = typeof req.body.value === "string"
      ? req.body.value
      : JSON.stringify(req.body.value ?? req.body);

    // Cache in memory (selalu)
    academyStatsCache.set("academy_stats", value);

    // Coba simpan ke DB jika cmsSettingsTable ada
    try {
      const { cmsSettingsTable } = await import("@workspace/db") as any;
      if (cmsSettingsTable) {
        const existing = await db
          .select()
          .from(cmsSettingsTable)
          .where(eq((cmsSettingsTable as any).key, "academy_stats"))
          .limit(1);

        if (existing.length > 0) {
          await db.update(cmsSettingsTable).set({ value, updatedAt: new Date() } as any)
            .where(eq((cmsSettingsTable as any).key, "academy_stats"));
        } else {
          await db.insert(cmsSettingsTable).values({ key: "academy_stats", value } as any);
        }
      }
    } catch { /* graceful — already cached in memory */ }

    res.json({ key: "academy_stats", value });
  } catch (err) {
    console.error("[PUT /cms/academy_stats]", err);
    res.status(500).json({ error: "Failed to save" });
  }
});

export default router;