import { Router, type IRouter } from "express";
import { db, siteVideosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

router.get("/site-videos", async (_req, res): Promise<void> => {
  const rows = await db.select().from(siteVideosTable).orderBy(siteVideosTable.orderIndex);
  res.json(rows);
});

router.post("/site-videos", requireAuth, async (req, res): Promise<void> => {
  const { title, description, embedUrl, thumbnailUrl, category, tags, isActive, orderIndex } = req.body;
  if (!title || !embedUrl) { res.status(400).json({ error: "title and embedUrl required" }); return; }
  const [row] = await db.insert(siteVideosTable).values({
    title, description, embedUrl, thumbnailUrl, category: category || "portfolio",
    tags: tags ? JSON.stringify(tags) : "[]", isActive, orderIndex,
  }).returning();
  res.status(201).json(row);
});

router.put("/site-videos/:id", requireAuth, async (req, res): Promise<void> => {
  const { title, description, embedUrl, thumbnailUrl, category, tags, isActive, orderIndex } = req.body;
  const [row] = await db.update(siteVideosTable).set({
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(embedUrl !== undefined && { embedUrl }),
    ...(thumbnailUrl !== undefined && { thumbnailUrl }),
    ...(category !== undefined && { category }),
    ...(tags !== undefined && { tags: JSON.stringify(tags) }),
    ...(isActive !== undefined && { isActive }),
    ...(orderIndex !== undefined && { orderIndex }),
    updatedAt: new Date(),
  }).where(eq(siteVideosTable.id, req.params.id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/site-videos/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(siteVideosTable).where(eq(siteVideosTable.id, req.params.id));
  res.json({ success: true });
});

export default router;
