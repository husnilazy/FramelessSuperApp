import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  insertPaymentSettingSchema,
  paymentSettingsTable,
  type PaymentSetting,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware.js";

const router: IRouter = Router();

// ── GET /payment-settings  — admin, semua settings ───────────────────────────
router.get(
  "/payment-settings",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const settings: PaymentSetting[] = await db
        .select()
        .from(paymentSettingsTable)
        .orderBy(paymentSettingsTable.provider);
      res.json(settings);
    } catch (err) {
      console.error("[GET /payment-settings]", err);
      res.status(500).json({ error: "Failed to load payment settings" });
    }
  }
);

// ── GET /payment-settings/public  — publik, hanya provider yang enabled ──────
// Dipakai course-page untuk load WA number tanpa auth
router.get(
  "/payment-settings/public",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const settings: PaymentSetting[] = await db
        .select()
        .from(paymentSettingsTable)
        .orderBy(paymentSettingsTable.provider);

      // Hanya return providers yang enabled, dan hapus sensitive keys
      const safe = settings
        .filter((s) => s.isEnabled)
        .map((s) => {
          try {
            const cfg = JSON.parse(s.config || "{}") as Record<string, unknown>;
            // Strip server-side keys, hanya return safe fields
            const { serverKey: _sk, ...safeCfg } = cfg as {
              serverKey?: string;
              [k: string]: unknown;
            };
            return { provider: s.provider, label: s.label, config: JSON.stringify(safeCfg) };
          } catch {
            return { provider: s.provider, label: s.label, config: "{}" };
          }
        });
      res.json(safe);
    } catch (err) {
      console.error("[GET /payment-settings/public]", err);
      res.status(500).json({ error: "Failed" });
    }
  }
);

// ── PUT /payment-settings  — admin, batch update (array) ─────────────────────
// Frontend mengirim array semua providers sekaligus
router.put(
  "/payment-settings",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body;
      const items: Array<{
        provider: string;
        label: string;
        isEnabled: boolean;
        config: string;
      }> = Array.isArray(body) ? body : [body];

      if (items.length === 0) {
        res.status(400).json({ error: "Empty payload" });
        return;
      }

      const results: unknown[] = [];

      for (const item of items) {
        const provider = String(item.provider || "").trim();
        if (!provider) continue;

        const payload = {
          provider,
          label:     String(item.label || "").trim(),
          isEnabled: Boolean(item.isEnabled),
          config:
            typeof item.config === "string"
              ? item.config
              : JSON.stringify(item.config ?? {}),
        };

        const parsed = insertPaymentSettingSchema.safeParse(payload);
        if (!parsed.success) {
          console.warn(
            `[PUT /payment-settings] Invalid data for ${provider}:`,
            parsed.error.flatten()
          );
          continue; // skip invalid, don't abort whole batch
        }

        const existing = await db
          .select()
          .from(paymentSettingsTable)
          .where(eq(paymentSettingsTable.provider, provider))
          .limit(1);

        if (existing.length > 0) {
          const [updated] = await db
            .update(paymentSettingsTable)
            .set({ ...parsed.data, updatedAt: new Date() })
            .where(eq(paymentSettingsTable.provider, provider))
            .returning();
          results.push(updated);
        } else {
          const [created] = await db
            .insert(paymentSettingsTable)
            .values(parsed.data)
            .returning();
          results.push(created);
        }
      }

      res.json({ saved: results.length, data: results });
    } catch (err) {
      console.error("[PUT /payment-settings]", err);
      res.status(500).json({ error: "Failed to save payment settings" });
    }
  }
);

// ── PUT /payment-settings/:provider  — admin, single provider update ─────────
// Kept for backward compatibility
router.put(
  "/payment-settings/:provider",
  requireAuth,
  async (req: Request<{ provider: string }>, res: Response): Promise<void> => {
    try {
      const provider = String(req.params.provider).trim();
      if (!provider) {
        res.status(400).json({ error: "Provider is required" });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const parsed = insertPaymentSettingSchema.safeParse({
        provider,
        label:     String(body.label ?? "").trim(),
        isEnabled: Boolean(body.isEnabled),
        config:
          typeof body.config === "string"
            ? body.config
            : JSON.stringify(body.config ?? {}),
      });

      if (!parsed.success) {
        res.status(400).json({
          error:  "Invalid payload",
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
          .set({ ...parsed.data, updatedAt: new Date() })
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
    } catch (err) {
      console.error("[PUT /payment-settings/:provider]", err);
      res.status(500).json({ error: "Failed to save" });
    }
  }
);

export default router;
