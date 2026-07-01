// artifacts/frameless/src/server/routes/income.ts
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

// ── Ensure table exists (run once on startup) ────────────────────────────────
async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS income_entries (
        id            TEXT        PRIMARY KEY,
        amount        NUMERIC     NOT NULL DEFAULT 0,
        category      TEXT        NOT NULL DEFAULT 'Lainnya',
        description   TEXT        NOT NULL DEFAULT '',
        date          DATE        NOT NULL DEFAULT CURRENT_DATE,
        source        TEXT,
        notes         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn("[income] ensureTable warn:", e);
  }
}
ensureTable();

// ── Helper ────────────────────────────────────────────────────────────────────
function mapIncome(r: any) {
  return {
    id:          r.id,
    amount:      Number(r.amount || 0),
    category:    r.category || "Lainnya",
    description: r.description || "",
    date:        r.date,
    source:      r.source || null,
    notes:       r.notes || null,
    createdAt:   r.created_at || r.createdAt || null,
    updatedAt:   r.updated_at || r.updatedAt || null,
  };
}

// ── GET /income ───────────────────────────────────────────────────────────────
router.get("/income", async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, year } = req.query as { category?: string; year?: string };

    let query = `SELECT * FROM income_entries`;
    const params: any[] = [];

    const conditions: string[] = [];
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (year) {
      params.push(year);
      conditions.push(`EXTRACT(YEAR FROM date) = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY date DESC";

    const result = await db.execute(sql.raw(
      params.length > 0
        ? query.replace(/\$(\d+)/g, (_, i) => `'${params[Number(i) - 1]}'`)
        : query
    ));

    const rows = (result as any).rows || result;
    res.json(Array.isArray(rows) ? rows.map(mapIncome) : []);
  } catch (err) {
    console.error("[income GET]", err);
    res.status(500).json({ error: "Gagal mengambil data pemasukan" });
  }
});

// ── POST /income ──────────────────────────────────────────────────────────────
router.post("/income", async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, category, description, date, source, notes } = req.body ?? {};

    if (!description || amount === undefined) {
      res.status(400).json({ error: "Keterangan dan jumlah wajib diisi" });
      return;
    }

    const id = crypto.randomUUID();
    const entryDate = date ? new Date(date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    const result = await db.execute(sql`
      INSERT INTO income_entries (id, amount, category, description, date, source, notes)
      VALUES (
        ${id},
        ${Number(amount)},
        ${String(category || "Lainnya").trim()},
        ${String(description).trim()},
        ${entryDate}::date,
        ${source ? String(source).trim() : null},
        ${notes ? String(notes).trim() : null}
      )
      RETURNING *
    `);

    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : rows;
    res.status(201).json(mapIncome(row));
  } catch (err) {
    console.error("[income POST]", err);
    res.status(500).json({ error: "Gagal menyimpan pemasukan" });
  }
});

// ── PUT /income/:id ───────────────────────────────────────────────────────────
router.put("/income/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, category, description, date, source, notes } = req.body ?? {};

    const setClauses: string[] = ["updated_at = NOW()"];
    if (amount !== undefined)     setClauses.push(`amount = ${Number(amount)}`);
    if (category !== undefined)   setClauses.push(`category = '${String(category).replace(/'/g, "''")}'`);
    if (description !== undefined) setClauses.push(`description = '${String(description).replace(/'/g, "''")}'`);
    if (date !== undefined)       setClauses.push(`date = '${new Date(date).toISOString().split("T")[0]}'::date`);
    if (source !== undefined)     setClauses.push(`source = ${source ? `'${String(source).replace(/'/g, "''")}'` : "NULL"}`);
    if (notes !== undefined)      setClauses.push(`notes = ${notes ? `'${String(notes).replace(/'/g, "''")}'` : "NULL"}`);

    const result = await db.execute(sql.raw(
      `UPDATE income_entries SET ${setClauses.join(", ")} WHERE id = '${id}' RETURNING *`
    ));

    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      res.status(404).json({ error: "Pemasukan tidak ditemukan" });
      return;
    }

    res.json(mapIncome(row));
  } catch (err) {
    console.error("[income PUT]", err);
    res.status(500).json({ error: "Gagal memperbarui pemasukan" });
  }
});

// ── DELETE /income/:id ────────────────────────────────────────────────────────
router.delete("/income/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM income_entries WHERE id = ${id}`);
    res.json({ success: true, message: "Pemasukan dihapus" });
  } catch (err) {
    console.error("[income DELETE]", err);
    res.status(500).json({ error: "Gagal menghapus pemasukan" });
  }
});

// ── GET /income/summary ───────────────────────────────────────────────────────
router.get("/income/summary", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT
        category,
        COUNT(*)::int         AS count,
        SUM(amount)::numeric  AS total
      FROM income_entries
      GROUP BY category
      ORDER BY total DESC
    `);

    const rows = (result as any).rows || result;
    res.json(Array.isArray(rows) ? rows.map(r => ({
      category: r.category,
      count:    Number(r.count),
      total:    Number(r.total),
    })) : []);
  } catch (err) {
    console.error("[income summary]", err);
    res.status(500).json({ error: "Gagal mengambil ringkasan" });
  }
});

export default router;