import { Router, type IRouter } from "express";
import { db, siteLogosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

router.get("/site-logos", async (_req, res): Promise<void> => {
  const rows = await db.select().from(siteLogosTable).orderBy(siteLogosTable.orderIndex);
  res.json(rows);
});

router.post("/site-logos", requireAuth, async (req, res): Promise<void> => {
  const { name, imageUrl, isActive, orderIndex } = req.body;
  if (!name || !imageUrl) { res.status(400).json({ error: "name and imageUrl required" }); return; }
  const [row] = await db.insert(siteLogosTable).values({ name, imageUrl, isActive, orderIndex }).returning();
  res.status(201).json(row);
});

router.put("/site-logos/:id", requireAuth, async (req, res): Promise<void> => {
  const { name, imageUrl, isActive, orderIndex } = req.body;
  const [row] = await db.update(siteLogosTable).set({
    ...(name !== undefined && { name }),
    ...(imageUrl !== undefined && { imageUrl }),
    ...(isActive !== undefined && { isActive }),
    ...(orderIndex !== undefined && { orderIndex }),
    updatedAt: new Date(),
  }).where(eq(siteLogosTable.id, req.params.id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/site-logos/:id", requireAuth, async (req, res): Promise<void> => {
  await db.delete(siteLogosTable).where(eq(siteLogosTable.id, req.params.id));
  res.json({ success: true });
});

export default router;
