import { Router, type IRouter } from "express";
import { db, expensesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

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

    res.json(
      expenses.map((e: ExpenseRecord) => mapExpense(e))
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

    res.status(201).json(
      mapExpense(expense as ExpenseRecord)
    );
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

    res.json(
      mapExpense(expense as ExpenseRecord)
    );
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