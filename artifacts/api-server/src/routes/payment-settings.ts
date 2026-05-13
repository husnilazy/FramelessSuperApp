import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paymentSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

router.get("/payment-settings", requireAuth, async (req, res): Promise<void> => {
  const settings = await db.select().from(paymentSettingsTable).orderBy(paymentSettingsTable.provider);
  res.json(settings);
});

router.put("/payment-settings/:provider", requireAuth, async (req, res): Promise<void> => {
  const { provider } = req.params;
  const existing = await db.select().from(paymentSettingsTable).where(eq(paymentSettingsTable.provider, provider)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(paymentSettingsTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(paymentSettingsTable.provider, provider)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(paymentSettingsTable).values({ provider, ...req.body }).returning();
    res.json(created);
  }
});

export default router;
