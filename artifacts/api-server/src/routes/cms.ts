import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cmsSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

router.get("/cms", async (req, res): Promise<void> => {
  const rows = await db.select().from(cmsSettingsTable).orderBy(cmsSettingsTable.section);
  const grouped: Record<string, Record<string, string>> = {};
  for (const r of rows) {
    if (!grouped[r.section]) grouped[r.section] = {};
    grouped[r.section][r.key] = r.value;
  }
  res.json(grouped);
});

router.put("/cms", requireAuth, async (req, res): Promise<void> => {
  const updates: { section: string; key: string; value: string }[] = req.body;
  if (!Array.isArray(updates)) { res.status(400).json({ error: "Array required" }); return; }
  for (const u of updates) {
    const existing = await db.select().from(cmsSettingsTable)
      .where(and(eq(cmsSettingsTable.section, u.section), eq(cmsSettingsTable.key, u.key)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(cmsSettingsTable).set({ value: u.value, updatedAt: new Date() })
        .where(and(eq(cmsSettingsTable.section, u.section), eq(cmsSettingsTable.key, u.key)));
    } else {
      await db.insert(cmsSettingsTable).values({ section: u.section, key: u.key, value: u.value });
    }
  }
  res.json({ success: true });
});

export default router;
