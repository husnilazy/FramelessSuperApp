import { Router, type IRouter, type Request, type Response } from "express";
import { db, digitalAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware.js";

const router: IRouter = Router();

type DigitalAssetBody = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  price?: unknown;
  fileUrl?: unknown;
  thumbnailUrl?: unknown;
  previewImages?: unknown;
  isActive?: unknown;
  isFeatured?: unknown;
};

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function toNullableString(value: unknown): string | null {
  const str = toStringValue(value);
  return str.length ? str : null;
}

function toNumberValue(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    return normalized === "true" || normalized === "1";
  }
  if (typeof value === "number") return value === 1;
  return fallback;
}

function normalizePreviewImages(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(
      value
        .map((item) => toStringValue(item))
        .filter(Boolean)
    );
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return JSON.stringify(parsed);
      }
    } catch {
      return JSON.stringify([value]);
    }
  }

  return "[]";
}

router.get("/digital-assets", async (req: Request, res: Response): Promise<void> => {
  try {
    const isActiveParam = (req.query as any)?.isActive;

    let query = db.select().from(digitalAssetsTable);

    if (isActiveParam === "true") {
      query = query.where(eq(digitalAssetsTable.isActive, true)) as any;
    } else if (isActiveParam === "false") {
      query = query.where(eq(digitalAssetsTable.isActive, false)) as any;
    }

    const rows = await query.orderBy(digitalAssetsTable.createdAt);

    res.json(rows);
  } catch (error) {
    console.error("[GET /digital-assets]", error);

    res.status(500).json({
      error: "Failed to fetch digital assets",
    });
  }
});

router.get("/digital-assets/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id =
      typeof req.params.id === "string"
        ? req.params.id
        : Array.isArray(req.params.id)
        ? req.params.id[0]
        : "";

    const [row] = await db
      .select()
      .from(digitalAssetsTable)
      .where(eq(digitalAssetsTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({
        error: "Digital asset not found",
      });
      return;
    }

    res.json(row);
  } catch (error) {
    console.error("[GET /digital-assets/:id]", error);

    res.status(500).json({
      error: "Failed to fetch digital asset",
    });
  }
});

router.post(
  "/digital-assets",
  requireAuth,
  async (req: Request<unknown, unknown, DigitalAssetBody>, res: Response): Promise<void> => {
    try {
      const {
        title,
        description,
        category,
        price,
        fileUrl,
        thumbnailUrl,
        previewImages,
        isActive,
        isFeatured,
      } = req.body ?? {};

      const normalizedTitle = toStringValue(title);

      if (!normalizedTitle) {
        res.status(400).json({
          error: "Title is required",
        });
        return;
      }

      const [row] = await db
        .insert(digitalAssetsTable)
        .values({
          title: normalizedTitle,
          description: toNullableString(description),
          category: toStringValue(category, "preset"),
          price: toNumberValue(price, 0),
          fileUrl: toNullableString(fileUrl),
          thumbnailUrl: toNullableString(thumbnailUrl),
          previewImages: normalizePreviewImages(previewImages),
          isActive: toBooleanValue(isActive, true),
          isFeatured: toBooleanValue(isFeatured, false),
        })
        .returning();

      res.status(201).json(row);
    } catch (error) {
      console.error("[POST /digital-assets]", error);

      res.status(500).json({
        error: "Failed to create digital asset",
      });
    }
  }
);

router.put(
  "/digital-assets/:id",
  requireAuth,
  async (req: Request<{ id: string }, unknown, DigitalAssetBody>, res: Response): Promise<void> => {
    try {
      const id =
        typeof req.params.id === "string"
          ? req.params.id
          : Array.isArray(req.params.id)
          ? req.params.id[0]
          : "";

      const {
        title,
        description,
        category,
        price,
        fileUrl,
        thumbnailUrl,
        previewImages,
        isActive,
        isFeatured,
      } = req.body ?? {};

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (title !== undefined) {
        updateData.title = toStringValue(title);
      }

      if (description !== undefined) {
        updateData.description = toNullableString(description);
      }

      if (category !== undefined) {
        updateData.category = toStringValue(category);
      }

      if (price !== undefined) {
        updateData.price = toNumberValue(price);
      }

      if (fileUrl !== undefined) {
        updateData.fileUrl = toNullableString(fileUrl);
      }

      if (thumbnailUrl !== undefined) {
        updateData.thumbnailUrl = toNullableString(thumbnailUrl);
      }

      if (previewImages !== undefined) {
        updateData.previewImages = normalizePreviewImages(previewImages);
      }

      if (isActive !== undefined) {
        updateData.isActive = toBooleanValue(isActive);
      }

      if (isFeatured !== undefined) {
        updateData.isFeatured = toBooleanValue(isFeatured);
      }

      const [row] = await db
        .update(digitalAssetsTable)
        .set(updateData)
        .where(eq(digitalAssetsTable.id, id))
        .returning();

      if (!row) {
        res.status(404).json({
          error: "Digital asset not found",
        });
        return;
      }

      res.json(row);
    } catch (error) {
      console.error("[PUT /digital-assets/:id]", error);

      res.status(500).json({
        error: "Failed to update digital asset",
      });
    }
  }
);

router.delete(
  "/digital-assets/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id =
        typeof req.params.id === "string"
          ? req.params.id
          : Array.isArray(req.params.id)
          ? req.params.id[0]
          : "";

      await db
        .delete(digitalAssetsTable)
        .where(eq(digitalAssetsTable.id, id));

      res.json({
        success: true,
      });
    } catch (error) {
      console.error("[DELETE /digital-assets/:id]", error);

      res.status(500).json({
        error: "Failed to delete digital asset",
      });
    }
  }
);

export default router;
