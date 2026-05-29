import { Router, type IRouter, type Request, type Response } from "express";
import { db, paymentSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware.js";
import { insertPaymentSettingSchema } from "@workspace/db";

const router: IRouter = Router();

router.get("/payment-settings", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const settings = await db
    .select()
    .from(paymentSettingsTable)
    .orderBy(paymentSettingsTable.provider);

  res.json(settings);
});

router.put(
  "/payment-settings/:provider",
  requireAuth,
  async (req: Request<{ provider: string }>, res: Response): Promise<void> => {
    const provider = String(req.params.provider).trim();
    if (!provider) {
      res.status(400).json({ error: "Provider is required" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const parsed = insertPaymentSettingSchema.safeParse({
      provider,
      label: String(body.label ?? "").trim(),
      isEnabled: Boolean(body.isEnabled),
      config: typeof body.config === "string" ? body.config : JSON.stringify(body.config ?? {}),
    });

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid payload",
        issues: parsed.error.flatten(),
      });
      return;
    }

    const existing = await db
      .select()
      .from(paymentSettingsTable)
      .where(eq(paymentSettingsTable.provider, provider))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(paymentSettingsTable)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(eq(paymentSettingsTable.provider, provider))
        .returning();

      res.json(updated);
      return;
    }

    const [created] = await db
      .insert(paymentSettingsTable)
      .values(parsed.data)
      .returning();

    res.json(created);
  },
);

export default router;
