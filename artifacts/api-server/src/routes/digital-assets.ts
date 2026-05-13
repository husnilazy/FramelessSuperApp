import { Router, type IRouter } from "express";
import { db, digitalAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

router.get("/digital-assets", async (_req, res): Promise<void> => {
  const rows = await db.select().from(digitalAssetsTable).orderBy(digitalAssetsTable.createdAt);
  res.json(rows);
});

router.get("/digital-assets/:id", async (req, res): Promise<void> => {
  const [row] = await db.select().from(digitalAssetsTable).where(eq(digitalAssetsTable.id, req.params.id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/digital-assets", requireAuth, async (req, res): Promise<void> => {
  const { title, description, category, price, fileUrl, thumbnailUrl, previewImages, isActive, isFeatured } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [row] = await db.insert(digitalAssetsTable).values({
    title, description, category: category || "preset", price: price || 0,
    fileUrl, thumbnailUrl, previewImages: previewImages ? JSON.stringify(previewImages) : "[]",
    isActive, isFeatured,
  }).returning();
  res.status(201).json(row);
});

router.put("/digital-assets/:id", requireAuth, async (req, res): Promise<void> => {
  const { title, description, category, price, fileUrl, thumbnailUrl, previewImages, isActive, isFeatured } = req.body;
  const [row] = await db.update(digitalAssetsTable).set({
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(category !== undefined && { category }),
    ...(price !== undefined && { price }),
    ...(fileUrl !== undefined && { fileUrl }),
    ...(thumbnailUrl !== undefined && { thumbnailUrl }),
    ...(previewImages !== undefined && { previewImages: JSON.stringify(previewImages) }),
    ...(isActive !== undefined && { isActive }),
    ...(isFeatured !== undefined && { isFeatured }),
    updatedAt: new Date(),
  }).where(eq(digitalAssetsTable.id, req.params.id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/digital-assets/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(digitalAssetsTable).where(eq(digitalAssetsTable.id, req.params.id));
  res.json({ success: true });
});

export default router;
