// artifacts/frameless/src/server/routes/equipment.ts
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

// ── Ensure table exists ───────────────────────────────────────────────────────
async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS equipment (
        id                   TEXT        PRIMARY KEY,
        name                 TEXT        NOT NULL,
        category             TEXT,
        serial_number        TEXT,
        condition            TEXT        DEFAULT 'Baik',
        purchase_date        DATE,
        purchase_price       NUMERIC     NOT NULL DEFAULT 0,
        depreciation_years   INTEGER     NOT NULL DEFAULT 5,
        notes                TEXT,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn("[equipment] ensureTable warn:", e);
  }
}
ensureTable();

// ── Helper ────────────────────────────────────────────────────────────────────
function mapEquipment(r: any) {
  return {
    id:                r.id,
    name:              r.name,
    category:          r.category || null,
    serialNumber:      r.serial_number || r.serialNumber || null,
    condition:         r.condition || "Baik",
    purchaseDate:      r.purchase_date || r.purchaseDate || null,
    purchasePrice:     Number(r.purchase_price || r.purchasePrice || 0),
    depreciationYears: Number(r.depreciation_years || r.depreciationYears || 5),
    notes:             r.notes || null,
    createdAt:         r.created_at || r.createdAt || null,
    updatedAt:         r.updated_at || r.updatedAt || null,
  };
}

// ── GET /equipment ────────────────────────────────────────────────────────────
router.get("/equipment", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM equipment ORDER BY name ASC
    `);
    const rows = (result as any).rows || result;
    res.json(Array.isArray(rows) ? rows.map(mapEquipment) : []);
  } catch (err) {
    console.error("[equipment GET]", err);
    res.status(500).json({ error: "Gagal mengambil data aset" });
  }
});

// ── POST /equipment ───────────────────────────────────────────────────────────
router.post("/equipment", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, category, serialNumber, condition,
      purchaseDate, purchasePrice, depreciationYears, notes,
    } = req.body ?? {};

    if (!name || purchasePrice === undefined) {
      res.status(400).json({ error: "Nama dan harga beli wajib diisi" });
      return;
    }

    const id = crypto.randomUUID();
    const pd = purchaseDate
      ? new Date(purchaseDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const result = await db.execute(sql`
      INSERT INTO equipment (
        id, name, category, serial_number, condition,
        purchase_date, purchase_price, depreciation_years, notes
      ) VALUES (
        ${id},
        ${String(name).trim()},
        ${category ? String(category).trim() : null},
        ${serialNumber ? String(serialNumber).trim() : null},
        ${String(condition || "Baik")},
        ${pd}::date,
        ${Number(purchasePrice)},
        ${Number(depreciationYears || 5)},
        ${notes ? String(notes).trim() : null}
      )
      RETURNING *
    `);

    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : rows;
    res.status(201).json(mapEquipment(row));
  } catch (err) {
    console.error("[equipment POST]", err);
    res.status(500).json({ error: "Gagal menyimpan aset" });
  }
});

// ── PUT /equipment/:id ────────────────────────────────────────────────────────
router.put("/equipment/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name, category, serialNumber, condition,
      purchaseDate, purchasePrice, depreciationYears, notes,
    } = req.body ?? {};

    const sets: string[] = ["updated_at = NOW()"];

    const esc = (v: string) => v.replace(/'/g, "''");
    if (name !== undefined)              sets.push(`name = '${esc(String(name))}'`);
    if (category !== undefined)          sets.push(`category = ${category ? `'${esc(String(category))}'` : "NULL"}`);
    if (serialNumber !== undefined)      sets.push(`serial_number = ${serialNumber ? `'${esc(String(serialNumber))}'` : "NULL"}`);
    if (condition !== undefined)         sets.push(`condition = '${esc(String(condition))}'`);
    if (purchaseDate !== undefined)      sets.push(`purchase_date = '${new Date(purchaseDate).toISOString().split("T")[0]}'::date`);
    if (purchasePrice !== undefined)     sets.push(`purchase_price = ${Number(purchasePrice)}`);
    if (depreciationYears !== undefined) sets.push(`depreciation_years = ${Number(depreciationYears)}`);
    if (notes !== undefined)             sets.push(`notes = ${notes ? `'${esc(String(notes))}'` : "NULL"}`);

    const result = await db.execute(sql.raw(
      `UPDATE equipment SET ${sets.join(", ")} WHERE id = '${id}' RETURNING *`
    ));

    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      res.status(404).json({ error: "Aset tidak ditemukan" });
      return;
    }

    res.json(mapEquipment(row));
  } catch (err) {
    console.error("[equipment PUT]", err);
    res.status(500).json({ error: "Gagal memperbarui aset" });
  }
});

// ── DELETE /equipment/:id ─────────────────────────────────────────────────────
router.delete("/equipment/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM equipment WHERE id = ${id}`);
    res.json({ success: true, message: "Aset dihapus" });
  } catch (err) {
    console.error("[equipment DELETE]", err);
    res.status(500).json({ error: "Gagal menghapus aset" });
  }
});

// ── GET /equipment/summary ────────────────────────────────────────────────────
router.get("/equipment/summary", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int                    AS total_items,
        COALESCE(SUM(purchase_price), 0) AS total_purchase_value,
        COALESCE(SUM(
          GREATEST(0,
            purchase_price - (
              purchase_price / NULLIF(depreciation_years, 0)
              * EXTRACT(EPOCH FROM (NOW() - purchase_date::timestamptz)) / 86400 / 365
            )
          )
        ), 0)                            AS total_book_value,
        COALESCE(SUM(
          purchase_price / NULLIF(depreciation_years, 0)
        ), 0)                            AS total_annual_depreciation
      FROM equipment
    `);

    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : rows;
    res.json({
      totalItems:              Number(row?.total_items || 0),
      totalPurchaseValue:      Number(row?.total_purchase_value || 0),
      totalBookValue:          Number(row?.total_book_value || 0),
      totalAnnualDepreciation: Number(row?.total_annual_depreciation || 0),
    });
  } catch (err) {
    console.error("[equipment summary]", err);
    res.status(500).json({ error: "Gagal mengambil ringkasan aset" });
  }
});

export default router;