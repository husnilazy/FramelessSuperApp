import { Router, type IRouter } from "express";
import { db, siteVideosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware.js";

const router: IRouter = Router();

function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

// GET
router.get("/site-videos", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(siteVideosTable)
      .orderBy(siteVideosTable.orderIndex);

    res.json(rows);
  } catch (err) {
    console.error("[site-videos GET]", err);
    res.status(500).json({
      error: "Failed to fetch videos",
    });
  }
});

// CREATE
router.post(
  "/site-videos",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const {
        title,
        description,
        embedUrl,
        thumbnailUrl,
        category,
        tags,
        isActive,
        orderIndex,
      } = req.body;

      if (!title || !embedUrl) {
        res.status(400).json({
          error: "title and embedUrl required",
        });
        return;
      }

      const [row] = await db
        .insert(siteVideosTable)
        .values({
          title,
          description: description ?? null,
          embedUrl,
          thumbnailUrl: thumbnailUrl ?? null,
          category: category ?? "portfolio",
          tags: JSON.stringify(tags ?? []),
          isActive: isActive ?? true,
          orderIndex: Number(orderIndex) || 0,
        })
        .returning();

      res.status(201).json(row);
    } catch (err) {
      console.error("[site-videos POST]", err);

      res.status(500).json({
        error: "Failed to create video",
      });
    }
  }
);

// UPDATE
router.put(
  "/site-videos/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = getParam(req.params.id);

      const {
        title,
        description,
        embedUrl,
        thumbnailUrl,
        category,
        tags,
        isActive,
        orderIndex,
      } = req.body;

      const [row] = await db
        .update(siteVideosTable)
        .set({
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(embedUrl !== undefined && { embedUrl }),
          ...(thumbnailUrl !== undefined && { thumbnailUrl }),
          ...(category !== undefined && { category }),
          ...(tags !== undefined && {
            tags: JSON.stringify(tags),
          }),
          ...(isActive !== undefined && { isActive }),
          ...(orderIndex !== undefined && {
            orderIndex: Number(orderIndex),
          }),
          updatedAt: new Date(),
        })
        .where(eq(siteVideosTable.id, id))
        .returning();

      if (!row) {
        res.status(404).json({
          error: "Video not found",
        });
        return;
      }

      res.json(row);
    } catch (err) {
      console.error("[site-videos PUT]", err);

      res.status(500).json({
        error: "Failed to update video",
      });
    }
  }
);

// DELETE
router.delete(
  "/site-videos/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = getParam(req.params.id);

      await db
        .delete(siteVideosTable)
        .where(eq(siteVideosTable.id, id));

      res.json({
        success: true,
      });
    } catch (err) {
      console.error("[site-videos DELETE]", err);

      res.status(500).json({
        error: "Failed to delete video",
      });
    }
  }
);

export default router;
