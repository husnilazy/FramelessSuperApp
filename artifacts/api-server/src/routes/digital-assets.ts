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

// ── POST /digital-assets/:id/purchase ────────────────────────────────────────
// Initiate payment for a paid asset via Midtrans Snap
router.post(
  "/digital-assets/:id/purchase",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id);
      const { name, email, phone } = req.body as Record<string, string | undefined>;

      if (!name?.trim() || !email?.trim()) {
        res.status(400).json({ error: "Nama dan email wajib diisi" });
        return;
      }

      const [asset] = await db
        .select()
        .from(digitalAssetsTable)
        .where(eq(digitalAssetsTable.id, id))
        .limit(1);

      if (!asset || !asset.isActive) {
        res.status(404).json({ error: "Aset tidak ditemukan" });
        return;
      }

      const price = Number(asset.price);

      // Free asset — return download URL directly
      if (price === 0) {
        // Increment download count
        await db
          .update(digitalAssetsTable)
          .set({ downloadCount: (asset.downloadCount ?? 0) + 1 })
          .where(eq(digitalAssetsTable.id, id));
        res.json({ free: true, fileUrl: asset.fileUrl });
        return;
      }

      // Paid asset — check Midtrans config
      const { db: _db, paymentSettingsTable } = await import("@workspace/db");
      const { eq: _eq }  = await import("drizzle-orm");
      const [row] = await _db
        .select()
        .from(paymentSettingsTable)
        .where(_eq(paymentSettingsTable.provider, "midtrans"))
        .limit(1);

      if (!row?.isEnabled) {
        res.json({ noGateway: true });
        return;
      }

      const cfg = JSON.parse(row.config || "{}");
      if (!cfg.serverKey?.trim()) {
        res.json({ noGateway: true });
        return;
      }

      const isProduction = cfg.isProduction === true || cfg.isProduction === "true";
      const serverKey    = cfg.serverKey.trim() as string;
      const clientKey    = (cfg.clientKey || "").trim() as string;
      const orderId      = `DA-${id.slice(0, 8)}-${Date.now()}`;

      const snapBody = {
        transaction_details: { order_id: orderId, gross_amount: Math.round(price) },
        customer_details:    { first_name: name.trim(), email: email.trim(), phone: phone?.trim() || undefined },
        item_details: [{ id: asset.id, price: Math.round(price), quantity: 1, name: asset.title }],
        callbacks: { finish: `${process.env.APP_URL || ""}/store` },
      };

      // Use native https to avoid importing the payments router
      const https   = (await import("https")).default;
      const auth    = Buffer.from(serverKey + ":").toString("base64");
      const payload = JSON.stringify(snapBody);
      const host    = isProduction ? "app.midtrans.com" : "app.sandbox.midtrans.com";

      const snapResult = await new Promise<any>((resolve, reject) => {
        const req2 = https.request(
          { hostname: host, port: 443, path: "/snap/v1/transactions", method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Basic ${auth}`, "Content-Length": Buffer.byteLength(payload) } },
          (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } }); }
        );
        req2.on("error", reject);
        req2.write(payload);
        req2.end();
      });

      if (!snapResult?.token) {
        console.error("[DA purchase] No snap token:", snapResult);
        res.json({ noGateway: true });
        return;
      }

      res.json({ snapToken: snapResult.token, clientKey, isProduction, orderId });
    } catch (err) {
      console.error("[POST /digital-assets/:id/purchase]", err);
      res.status(500).json({ error: "Gagal membuat transaksi" });
    }
  }
);

// ── POST /digital-assets/:id/download ────────────────────────────────────────
// Called after successful payment to get download URL and increment counter
router.post(
  "/digital-assets/:id/download",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id);
      const [asset] = await db
        .select()
        .from(digitalAssetsTable)
        .where(eq(digitalAssetsTable.id, id))
        .limit(1);

      if (!asset) { res.status(404).json({ error: "Not found" }); return; }

      await db
        .update(digitalAssetsTable)
        .set({ downloadCount: (asset.downloadCount ?? 0) + 1 })
        .where(eq(digitalAssetsTable.id, id));

      res.json({ fileUrl: asset.fileUrl, title: asset.title });
    } catch (err) {
      console.error("[POST /digital-assets/:id/download]", err);
      res.status(500).json({ error: "Failed" });
    }
  }
);

export default router;