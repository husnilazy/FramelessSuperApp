import { Router, type IRouter } from "express";
import { db, siteLogosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware.js";

const router: IRouter = Router();

type SiteLogoRecord = {
  id: string;
  name: string;
  imageUrl: string;
  isActive: boolean | null;
  orderIndex: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

router.get("/site-logos", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(siteLogosTable)
      .orderBy(siteLogosTable.orderIndex);

    res.json(rows.map((row: SiteLogoRecord) => mapLogo(row)));
  } catch (err) {
    console.error("[site-logos GET]", err);

    res.status(500).json({
      error: "Failed to fetch site logos",
    });
  }
});

router.post(
  "/site-logos",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const {
        name,
        imageUrl,
        isActive,
        orderIndex,
      } = req.body ?? {};

      if (!name || !imageUrl) {
        res.status(400).json({
          error: "name and imageUrl required",
        });
        return;
      }

      const [row] = await db
        .insert(siteLogosTable)
        .values({
          name: String(name).trim(),
          imageUrl: String(imageUrl).trim(),
          isActive:
            isActive !== undefined
              ? Boolean(isActive)
              : true,
          orderIndex:
            orderIndex !== undefined
              ? Number(orderIndex)
              : 0,
        })
        .returning();

      res.status(201).json(
        mapLogo(row as SiteLogoRecord)
      );
    } catch (err) {
      console.error("[site-logos POST]", err);

      res.status(500).json({
        error: "Failed to create site logo",
      });
    }
  }
);

router.put(
  "/site-logos/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      const {
        name,
        imageUrl,
        isActive,
        orderIndex,
      } = req.body ?? {};

      const [row] = await db
        .update(siteLogosTable)
        .set({
          ...(name !== undefined && {
            name: String(name).trim(),
          }),

          ...(imageUrl !== undefined && {
            imageUrl: String(imageUrl).trim(),
          }),

          ...(isActive !== undefined && {
            isActive: Boolean(isActive),
          }),

          ...(orderIndex !== undefined && {
            orderIndex: Number(orderIndex),
          }),

          updatedAt: new Date(),
        })
        .where(eq(siteLogosTable.id, id))
        .returning();

      if (!row) {
        res.status(404).json({
          error: "Logo not found",
        });
        return;
      }

      res.json(mapLogo(row as SiteLogoRecord));
    } catch (err) {
      console.error("[site-logos PUT]", err);

      res.status(500).json({
        error: "Failed to update site logo",
      });
    }
  }
);

router.delete(
  "/site-logos/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      await db
        .delete(siteLogosTable)
        .where(eq(siteLogosTable.id, id));

      res.json({
        success: true,
      });
    } catch (err) {
      console.error("[site-logos DELETE]", err);

      res.status(500).json({
        error: "Failed to delete site logo",
      });
    }
  }
);

function mapLogo(row: SiteLogoRecord) {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    isActive: row.isActive ?? true,
    orderIndex: row.orderIndex ?? 0,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export default router;
