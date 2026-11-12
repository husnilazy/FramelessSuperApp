import { Router, type IRouter } from "express";
import { db, expensesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { postExpenseJournal } from "../lib/journal-poster.js";

const router: IRouter = Router();

// Kolom tambahan (vendor, metode bayar, catatan) lewat SQL mentah supaya skema drizzle bersama
// (dipakai dashboard/quotations) tidak berubah. Idempoten, dijalankan sekali per instance.
let extraReady: Promise<void> | null = null;
function ensureExtra(): Promise<void> {
  if (!extraReady) {
    extraReady = (async () => {
      await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor TEXT`);
      await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT`);
      await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT`);
    })().catch((e) => { extraReady = null; throw e; });
  }
  return extraReady;
}
const clean = (v: unknown) => { const t = String(v ?? "").trim(); return t ? t.slice(0, 500) : null; };

async function saveExtra(id: string, body: any) {
  const fields: [string, string, any][] = [["vendor", "vendor", body?.vendor], ["payment_method", "paymentMethod", body?.paymentMethod], ["notes", "notes", body?.notes]];
  if (!fields.some(([, , v]) => v !== undefined)) return;
  await ensureExtra();
  if (body.vendor !== undefined) await db.execute(sql`UPDATE expenses SET vendor = ${clean(body.vendor)} WHERE id = ${id}`);
  if (body.paymentMethod !== undefined) await db.execute(sql`UPDATE expenses SET payment_method = ${clean(body.paymentMethod)} WHERE id = ${id}`);
  if (body.notes !== undefined) await db.execute(sql`UPDATE expenses SET notes = ${clean(body.notes)} WHERE id = ${id}`);
}

async function readExtra(ids?: string[]): Promise<Map<string, { vendor: string | null; paymentMethod: string | null; notes: string | null }>> {
  const m = new Map<string, { vendor: string | null; paymentMethod: string | null; notes: string | null }>();
  try {
    await ensureExtra();
    const r: any = await db.execute(sql`SELECT id, vendor, payment_method, notes FROM expenses WHERE vendor IS NOT NULL OR payment_method IS NOT NULL OR notes IS NOT NULL`);
    for (const x of (Array.isArray(r) ? r : r?.rows ?? [])) {
      if (!ids || ids.includes(x.id)) m.set(x.id, { vendor: x.vendor ?? null, paymentMethod: x.payment_method ?? null, notes: x.notes ?? null });
    }
  } catch (e: any) { console.warn("[expenses] extra columns:", e?.message); }
  return m;
}
const withExtra = (mapped: any, extra: Map<string, any>) => ({ ...mapped, vendor: null, paymentMethod: null, notes: null, ...(extra.get(mapped.id) ?? {}) });

type ExpenseRecord = {
  id: string;
  category: string;
  description: string;
  amount: string | number;
  projectId: string | null;
  receiptUrl: string | null;
  date: Date | null;
  createdAt?: Date | null;
};

router.get("/expenses", async (req, res): Promise<void> => {
  try {
    const {
      projectId,
      category,
    } = req.query as {
      projectId?: string;
      category?: string;
    };

    let expenses = await db
      .select()
      .from(expensesTable)
      .orderBy(expensesTable.date);

    if (projectId) {
      expenses = expenses.filter(
        (e: ExpenseRecord) => e.projectId === projectId
      );
    }

    if (category) {
      expenses = expenses.filter(
        (e: ExpenseRecord) => e.category === category
      );
    }

    const extra = await readExtra();
    res.json(
      expenses.map((e: ExpenseRecord) => withExtra(mapExpense(e), extra))
    );
  } catch (err) {
    console.error("[expenses GET]", err);

    res.status(500).json({
      error: "Failed to fetch expenses",
    });
  }
});

router.post("/expenses", async (req, res): Promise<void> => {
  try {
    const {
      category,
      description,
      amount,
      projectId,
      receiptUrl,
      date,
    } = req.body ?? {};

    if (
      !category ||
      !description ||
      amount === undefined
    ) {
      res.status(400).json({
        error:
          "Category, description, and amount are required",
      });
      return;
    }

    const [expense] = await db
      .insert(expensesTable)
      .values({
        id: crypto.randomUUID(),
        category: String(category).trim(),
        description: String(description).trim(),
        amount: String(amount),
        projectId: projectId ?? null,
        receiptUrl: receiptUrl ?? null,
        date: date ? new Date(date) : new Date(),
      })
      .returning();

    let mapped: any = mapExpense(expense as ExpenseRecord);
    try {
      await saveExtra(mapped.id, req.body);
      mapped = withExtra(mapped, await readExtra([mapped.id]));
    } catch (e: any) { console.warn("[expenses POST] extra:", e?.message); }

    // Auto-post ke jurnal akuntansi (fire-and-forget, non-blocking)
    postExpenseJournal(mapped.id).then(result => {
      if (!result.success && !result.skipped) {
        console.warn("[expenses POST] journal post error:", result.error);
      }
    }).catch(e => console.warn("[expenses POST] journal post failed:", e?.message));

    res.status(201).json(mapped);
  } catch (err) {
    console.error("[expenses POST]", err);

    res.status(500).json({
      error: "Failed to create expense",
    });
  }
});

router.put("/expenses/:id", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const {
      category,
      description,
      amount,
      projectId,
      receiptUrl,
      date,
    } = req.body ?? {};

    const [expense] = await db
      .update(expensesTable)
      .set({
        ...(category !== undefined && {
          category: String(category).trim(),
        }),

        ...(description !== undefined && {
          description: String(description).trim(),
        }),

        ...(amount !== undefined && {
          amount: String(amount),
        }),

        ...(projectId !== undefined && {
          projectId,
        }),

        ...(receiptUrl !== undefined && {
          receiptUrl,
        }),

        ...(date !== undefined && {
          date: date ? new Date(date) : undefined,
        }),
      })
      .where(eq(expensesTable.id, id))
      .returning();

    if (!expense) {
      res.status(404).json({
        error: "Expense not found",
      });
      return;
    }

    let out: any = mapExpense(expense as ExpenseRecord);
    try {
      await saveExtra(id, req.body);
      out = withExtra(out, await readExtra([id]));
    } catch (e: any) { console.warn("[expenses PUT] extra:", e?.message); }
    res.json(out);
  } catch (err) {
    console.error("[expenses PUT]", err);

    res.status(500).json({
      error: "Failed to update expense",
    });
  }
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    await db
      .delete(expensesTable)
      .where(eq(expensesTable.id, id));

    // Jurnal otomatis pengeluaran ini ikut dibatalkan (sebelumnya tertinggal sebagai jurnal yatim).
    await db
      .execute(sql`UPDATE journal_entries SET status = 'VOID', updated_at = NOW() WHERE source_type = 'expense' AND source_id = ${id} AND status != 'VOID'`)
      .catch((e: any) => console.warn("[expenses DELETE] void journal:", e?.message));

    res.json({
      success: true,
      message: "Expense deleted",
    });
  } catch (err) {
    console.error("[expenses DELETE]", err);

    res.status(500).json({
      error: "Failed to delete expense",
    });
  }
});

function mapExpense(e: ExpenseRecord) {
  return {
    id: e.id,
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    projectId: e.projectId,
    receiptUrl: e.receiptUrl,
    date: e.date,
    createdAt: e.createdAt ?? null,
  };
}

export default router;