import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { coursesTable, coursePackagesTable, courseEnrollmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

router.get("/courses", async (req, res): Promise<void> => {
  const courses = await db.select().from(coursesTable).orderBy(coursesTable.orderIndex);
  const withPackages = await Promise.all(
    courses.map(async (c) => {
      const packages = await db.select().from(coursePackagesTable)
        .where(eq(coursePackagesTable.courseId, c.id))
        .orderBy(coursePackagesTable.orderIndex);
      return { ...c, packages };
    })
  );
  res.json(withPackages);
});

router.get("/courses/:slug", async (req, res): Promise<void> => {
  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.slug, req.params.slug)).limit(1);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  const packages = await db.select().from(coursePackagesTable).where(eq(coursePackagesTable.courseId, course.id)).orderBy(coursePackagesTable.orderIndex);
  res.json({ ...course, packages });
});

router.post("/courses", requireAuth, async (req, res): Promise<void> => {
  const [course] = await db.insert(coursesTable).values(req.body).returning();
  res.status(201).json(course);
});

router.put("/courses/:id", requireAuth, async (req, res): Promise<void> => {
  const [course] = await db.update(coursesTable).set({ ...req.body, updatedAt: new Date() })
    .where(eq(coursesTable.id, req.params.id)).returning();
  res.json(course);
});

router.delete("/courses/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(coursesTable).where(eq(coursesTable.id, req.params.id));
  res.json({ success: true });
});

router.post("/courses/:id/packages", requireAuth, async (req, res): Promise<void> => {
  const [pkg] = await db.insert(coursePackagesTable).values({ ...req.body, courseId: req.params.id }).returning();
  res.status(201).json(pkg);
});

router.put("/course-packages/:id", requireAuth, async (req, res): Promise<void> => {
  const [pkg] = await db.update(coursePackagesTable).set(req.body)
    .where(eq(coursePackagesTable.id, req.params.id)).returning();
  res.json(pkg);
});

router.delete("/course-packages/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(coursePackagesTable).where(eq(coursePackagesTable.id, req.params.id));
  res.json({ success: true });
});

router.post("/courses/:id/enroll", async (req, res): Promise<void> => {
  const [enrollment] = await db.insert(courseEnrollmentsTable).values({ ...req.body, courseId: req.params.id }).returning();
  res.status(201).json(enrollment);
});

router.get("/enrollments", requireAuth, async (req, res): Promise<void> => {
  const enrollments = await db.select().from(courseEnrollmentsTable).orderBy(courseEnrollmentsTable.createdAt);
  res.json(enrollments);
});

router.patch("/enrollments/:id", requireAuth, async (req, res): Promise<void> => {
  const [enrollment] = await db.update(courseEnrollmentsTable).set(req.body)
    .where(eq(courseEnrollmentsTable.id, req.params.id)).returning();
  res.json(enrollment);
});

export default router;
