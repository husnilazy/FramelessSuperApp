import { Router, type IRouter } from "express";
import {
  db,
  coursesTable,
  coursePackagesTable,
  courseEnrollmentsTable,
  courseMaterialsTable,
} from "@workspace/db";

import {
  eq,
  desc,
  type InferSelectModel,
} from "drizzle-orm";

import { requireAuth } from "./middleware.js";

const router: IRouter = Router();

type Course = InferSelectModel<typeof coursesTable>;
type CourseMaterial = InferSelectModel<typeof courseMaterialsTable>;

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

function coursePayload(
  body: Record<string, unknown>
) {
  const title =
    typeof body.title === "string"
      ? body.title.trim()
      : "";

  const rawSlug =
    typeof body.slug === "string"
      ? body.slug.trim()
      : "";

  const slugSource =
    isUrlLike(rawSlug)
      ? title
      : rawSlug || title;

  return {
    slug: slugifyCourseValue(slugSource),

    title,

    subtitle:
      typeof body.subtitle === "string" &&
      body.subtitle.trim()
        ? body.subtitle.trim()
        : null,

    description:
      typeof body.description === "string" &&
      body.description.trim()
        ? body.description.trim()
        : null,

    thumbnail:
      typeof body.thumbnail === "string" &&
      body.thumbnail.trim()
        ? body.thumbnail.trim()
        : null,

    highlightVideoUrl:
      typeof body.highlightVideoUrl === "string" &&
      body.highlightVideoUrl.trim()
        ? body.highlightVideoUrl.trim()
        : null,

    instructor:
      typeof body.instructor === "string" &&
      body.instructor.trim()
        ? body.instructor.trim()
        : null,

    category:
      typeof body.category === "string" &&
      body.category.trim()
        ? body.category.trim()
        : "videography",

    level:
      typeof body.level === "string" &&
      body.level.trim()
        ? body.level.trim()
        : "beginner",

    curriculumPdfUrl:
      typeof body.curriculumPdfUrl === "string" &&
      body.curriculumPdfUrl.trim()
        ? body.curriculumPdfUrl.trim()
        : null,

    isPublished:
      body.isPublished !== undefined
        ? Boolean(body.isPublished)
        : true,

    orderIndex:
      Number.isFinite(
        Number(body.orderIndex)
      )
        ? Number(body.orderIndex)
        : 0,
  };
}

function courseErrorMessage(
  err: unknown
): string {

  const raw =
    (err as { cause?: { message?: string } })
      ?.cause?.message ||
    (err as Error)?.message ||
    "Gagal menyimpan course";

  if (
    /duplicate key|unique/i.test(raw)
  ) {
    return "Slug course sudah dipakai. Gunakan slug lain.";
  }

  return raw;
}

/* ==========================
   COURSES
========================== */

router.get(
  "/courses",
  async (_req, res): Promise<void> => {
    try {

      const courses =
        await db
          .select()
          .from(coursesTable)
          .orderBy(
            coursesTable.orderIndex
          );

      const withPackages =
        await Promise.all(
          courses.map(
            async (
              c: Course
            ) => {

              const packages =
                await db
                  .select()
                  .from(
                    coursePackagesTable
                  )
                  .where(
                    eq(
                      coursePackagesTable.courseId,
                      String(c.id)
                    )
                  )
                  .orderBy(
                    coursePackagesTable.orderIndex
                  );

              return {
                ...c,
                packages,
              };
            }
          )
        );

      res.json(
        withPackages
      );

    } catch (err) {

      console.error(
        "[GET COURSES]",
        err
      );

      res.status(500)
        .json({
          error:
            "Failed loading courses",
        });
    }
  }
);

router.get(
  "/courses/:slug",
  async (
    req,
    res
  ): Promise<void> => {

    try {

      const slug =
        String(
          req.params.slug
        );

      const [course] =
        await db
          .select()
          .from(
            coursesTable
          )
          .where(
            eq(
              coursesTable.slug,
              slug
            )
          )
          .limit(1);

      if (!course) {
        res.status(404)
          .json({
            error:
              "Course not found",
          });

        return;
      }

      const packages =
        await db
          .select()
          .from(
            coursePackagesTable
          )
          .where(
            eq(
              coursePackagesTable.courseId,
              String(course.id)
            )
          )
          .orderBy(
            coursePackagesTable.orderIndex
          );

      const materials =
        await db
          .select()
          .from(
            courseMaterialsTable
          )
          .where(
            eq(
              courseMaterialsTable.courseId,
              String(course.id)
            )
          )
          .orderBy(
            courseMaterialsTable.orderIndex
          );

      res.json({
        ...course,
        packages,
        materials:
          materials.filter(
            (
              m: CourseMaterial
            ) =>
              m.isActive
          ),
      });

    } catch (err) {

      console.error(
        "[GET COURSE]",
        err
      );

      res.status(500)
        .json({
          error:
            "Failed loading course",
        });
    }
  }
);

router.post(
  "/courses",
  async (
    req,
    res
  ): Promise<void> => {

    try {

      const payload =
        coursePayload(
          req.body as Record<
            string,
            unknown
          >
        );

      const [course] =
        await db
          .insert(
            coursesTable
          )
          .values(
            payload
          )
          .returning();

      res.status(201)
        .json(
          course
        );

    } catch (err) {

      console.error(
        "[POST COURSE]",
        err
      );

      res.status(400)
        .json({
          error:
            courseErrorMessage(
              err
            ),
        });
    }
  }
);

router.put(
  "/courses/:id",
  async (
    req,
    res
  ): Promise<void> => {

    try {

      const id =
        String(
          req.params.id
        );

      const payload =
        coursePayload(
          req.body as Record<
            string,
            unknown
          >
        );

      const [course] =
        await db
          .update(
            coursesTable
          )
          .set({
            ...payload,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              coursesTable.id,
              id
            )
          )
          .returning();

      res.json(
        course
      );

    } catch (err) {

      console.error(
        "[PUT COURSE]",
        err
      );

      res.status(400)
        .json({
          error:
            courseErrorMessage(
              err
            ),
        });
    }
  }
);

router.delete(
  "/courses/:id",
  async (
    req,
    res
  ): Promise<void> => {

    try {

      await db
        .delete(
          coursesTable
        )
        .where(
          eq(
            coursesTable.id,
            String(
              req.params.id
            )
          )
        );

      res.json({
        success:
          true,
      });

    } catch (err) {

      console.error(
        "[DELETE COURSE]",
        err
      );

      res.status(500)
        .json({
          error:
            "Delete failed",
        });
    }
  }
);

/* ==========================
MATERIALS
========================== */

router.get(
  "/courses/:id/materials",
  requireAuth,
  async (
    req,
    res
  ): Promise<void> => {

    const materials =
      await db
        .select()
        .from(
          courseMaterialsTable
        )
        .where(
          eq(
            courseMaterialsTable.courseId,
            String(
              req.params.id
            )
          )
        );

    res.json(
      materials
    );
  }
);

/* ==========================
ENROLLMENTS
========================== */

router.get(
  "/enrollments",
  requireAuth,
  async (
    _req,
    res
  ): Promise<void> => {

    const rows =
      await db
        .select()
        .from(
          courseEnrollmentsTable
        )
        .orderBy(
          desc(
            courseEnrollmentsTable.createdAt
          )
        );

    res.json(
      rows
    );
  }
);

export default router;
