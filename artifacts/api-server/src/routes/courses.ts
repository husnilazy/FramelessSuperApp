import { Router, type IRouter } from "express";
import { db, coursesTable, coursePackagesTable, courseEnrollmentsTable, courseMaterialsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

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

router.post("/courses", requireAuth, async (req, res): Promise<void> => {
  const [course] = await db.insert(coursesTable).values(req.body).returning();
  res.status(201).json(course);
});

router.put("/courses/:id", requireAuth, async (req, res): Promise<void> => {
  const [course] = await db.update(coursesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(coursesTable.id, req.params.id)).returning();
  res.json(course);
});

router.delete("/courses/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(coursesTable).where(eq(coursesTable.id, req.params.id));
  res.json({ success: true });
});

// ── Packages ──────────────────────────────────────────────────────────
router.post("/courses/:id/packages", requireAuth, async (req, res): Promise<void> => {
  const [pkg] = await db.insert(coursePackagesTable).values({ ...req.body, courseId: req.params.id }).returning();
  res.status(201).json(pkg);
});
router.put("/course-packages/:id", requireAuth, async (req, res): Promise<void> => {
  const [pkg] = await db.update(coursePackagesTable).set(req.body).where(eq(coursePackagesTable.id, req.params.id)).returning();
  res.json(pkg);
});
router.delete("/course-packages/:id", requireAuth, async (req, res): Promise<void> => {
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
