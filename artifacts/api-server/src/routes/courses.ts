import { Router, type IRouter } from "express";
import { db, coursesTable, coursePackagesTable, courseEnrollmentsTable, courseMaterialsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

function slugifyCourseValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isUrlLike(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function coursePayload(body: any) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
  const slugSource = isUrlLike(rawSlug) ? title : rawSlug || title;

  return {
    slug: slugifyCourseValue(slugSource),
    title,
    subtitle: typeof body.subtitle === "string" && body.subtitle.trim() ? body.subtitle.trim() : null,
    description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    thumbnail: typeof body.thumbnail === "string" && body.thumbnail.trim() ? body.thumbnail.trim() : null,
    highlightVideoUrl: typeof body.highlightVideoUrl === "string" && body.highlightVideoUrl.trim() ? body.highlightVideoUrl.trim() : null,
    instructor: typeof body.instructor === "string" && body.instructor.trim() ? body.instructor.trim() : null,
    category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : "videography",
    level: typeof body.level === "string" && body.level.trim() ? body.level.trim() : "beginner",
    curriculumPdfUrl: typeof body.curriculumPdfUrl === "string" && body.curriculumPdfUrl.trim() ? body.curriculumPdfUrl.trim() : null,
    isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : true,
    orderIndex: Number.isFinite(Number(body.orderIndex)) ? Number(body.orderIndex) : 0,
  };
}

function courseErrorMessage(err: unknown) {
  const raw = (err as any)?.cause?.message || (err as Error)?.message || "Gagal menyimpan course";
  if (/duplicate key|unique/i.test(raw)) return "Slug course sudah dipakai. Gunakan slug lain.";
  return raw;
}

// ── Courses ──────────────────────────────────────────────────────────
router.get("/courses", async (_req, res): Promise<void> => {
  const courses = await db.select().from(coursesTable).orderBy(coursesTable.orderIndex);
  const withPackages = await Promise.all(courses.map(async (c) => {
    const packages = await db.select().from(coursePackagesTable).where(eq(coursePackagesTable.courseId, c.id)).orderBy(coursePackagesTable.orderIndex);
    return { ...c, packages };
  }));
  res.json(withPackages);
});

router.get("/courses/:slug", async (req, res): Promise<void> => {
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.slug, req.params.slug)).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  const packages = await db.select().from(coursePackagesTable).where(eq(coursePackagesTable.courseId, course.id)).orderBy(coursePackagesTable.orderIndex);
  const materials = await db.select().from(courseMaterialsTable).where(eq(courseMaterialsTable.courseId, course.id)).orderBy(courseMaterialsTable.orderIndex);
  res.json({ ...course, packages, materials: materials.filter(m => m.isActive) });
});

router.post("/courses", async (req, res): Promise<void> => {
  try {
    const payload = coursePayload(req.body);
    if (!payload.slug || !payload.title) {
      res.status(400).json({ error: "Slug dan judul course wajib diisi" });
      return;
    }
    const [course] = await db.insert(coursesTable).values(payload).returning();
    res.status(201).json(course);
  } catch (err) {
    console.error("[courses POST]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

router.put("/courses/:id", async (req, res): Promise<void> => {
  try {
    const payload = coursePayload(req.body);
    if (!payload.slug || !payload.title) {
      res.status(400).json({ error: "Slug dan judul course wajib diisi" });
      return;
    }
    const updateData = {
      slug: payload.slug,
      title: payload.title,
      subtitle: payload.subtitle,
      description: payload.description,
      thumbnail: payload.thumbnail,
      highlightVideoUrl: payload.highlightVideoUrl,
      instructor: payload.instructor,
      category: payload.category,
      level: payload.level,
      curriculumPdfUrl: payload.curriculumPdfUrl,
      isPublished: payload.isPublished,
      orderIndex: payload.orderIndex,
      updatedAt: new Date(),
    };
    const [course] = await db.update(coursesTable).set(updateData).where(eq(coursesTable.id, req.params.id)).returning();
    res.json(course);
  } catch (err) {
    console.error("[courses PUT]", err);
    res.status(400).json({ error: courseErrorMessage(err) });
  }
});

router.delete("/courses/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(coursesTable).where(eq(coursesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error("[courses DELETE]", err);
    res.status(400).json({ error: (err as Error).message });
  }
});

// ── Packages ──────────────────────────────────────────────────────────
router.post("/courses/:id/packages", async (req, res): Promise<void> => {
  try {
    const [pkg] = await db.insert(coursePackagesTable).values({ ...req.body, courseId: req.params.id }).returning();
    res.status(201).json(pkg);
  } catch (err) {
    console.error("[packages POST]", err);
    res.status(400).json({ error: (err as Error).message });
  }
});
router.put("/course-packages/:id", async (req, res): Promise<void> => {
  const [pkg] = await db.update(coursePackagesTable).set(req.body).where(eq(coursePackagesTable.id, req.params.id)).returning();
  res.json(pkg);
});
router.delete("/course-packages/:id", async (req, res): Promise<void> => {
  await db.delete(coursePackagesTable).where(eq(coursePackagesTable.id, req.params.id));
  res.json({ success: true });
});

// ── Materials ──────────────────────────────────────────────────────────
router.get("/courses/:id/materials", requireAuth, async (req, res): Promise<void> => {
  const materials = await db.select().from(courseMaterialsTable).where(eq(courseMaterialsTable.courseId, req.params.id)).orderBy(courseMaterialsTable.orderIndex);
  res.json(materials);
});
router.post("/courses/:id/materials", requireAuth, async (req, res): Promise<void> => {
  const [mat] = await db.insert(courseMaterialsTable).values({ ...req.body, courseId: req.params.id }).returning();
  res.status(201).json(mat);
});
router.put("/course-materials/:id", requireAuth, async (req, res): Promise<void> => {
  const [mat] = await db.update(courseMaterialsTable).set(req.body).where(eq(courseMaterialsTable.id, req.params.id)).returning();
  res.json(mat);
});
router.delete("/course-materials/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(courseMaterialsTable).where(eq(courseMaterialsTable.id, req.params.id));
  res.json({ success: true });
});

// ── Enrollments ──────────────────────────────────────────────────────
router.post("/courses/:id/enroll", async (req, res): Promise<void> => {
  const [enrollment] = await db.insert(courseEnrollmentsTable).values({ ...req.body, courseId: req.params.id }).returning();
  res.status(201).json(enrollment);
});
router.get("/enrollments", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(courseEnrollmentsTable).orderBy(desc(courseEnrollmentsTable.createdAt));
  res.json(rows);
});
router.patch("/enrollments/:id", requireAuth, async (req, res): Promise<void> => {
  const [enrollment] = await db.update(courseEnrollmentsTable).set(req.body).where(eq(courseEnrollmentsTable.id, req.params.id)).returning();
  res.json(enrollment);
});

// ── Portal ──────────────────────────────────────────────────────────
router.get("/portal/:enrollmentId", async (req, res): Promise<void> => {
  const [enrollment] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, req.params.enrollmentId)).limit(1);
  if (!enrollment) { res.status(404).json({ error: "Enrollment not found" }); return; }
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, enrollment.courseId!)).limit(1);
  const [pkg] = enrollment.packageId ? await db.select().from(coursePackagesTable).where(eq(coursePackagesTable.id, enrollment.packageId)).limit(1) : [null];
  const materials = await db.select().from(courseMaterialsTable).where(eq(courseMaterialsTable.courseId, enrollment.courseId!)).orderBy(courseMaterialsTable.orderIndex);
  res.json({ enrollment, course, package: pkg, materials: materials.filter(m => m.isActive) });
});

export default router;
