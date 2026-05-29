import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  invoicesTable,
  invoiceItemsTable,
  paymentsTable,
  clientsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

type InvoiceRow = {
  invoice: any;
  clientName: string | null;
};

type InvoiceParams = {
  id: string;
};

type InvoiceItemInput = {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  total?: unknown;
};

function toStr(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return String(v).trim();
}

function toNumStr(v: unknown, fallback = "0"): string {
  if (v === null || v === undefined || v === "") return fallback;

  const n = Number(v);
  return Number.isFinite(n) ? String(n) : fallback;
}

function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;

  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

router.get("/invoices", async (req, res): Promise<void> => {
  const status =
    typeof req.query.status === "string"
      ? req.query.status.trim()
      : undefined;

  const clientId =
    typeof req.query.clientId === "string"
      ? req.query.clientId.trim()
      : undefined;

  const invoices = await db
    .select({
      invoice: invoicesTable,
      clientName: clientsTable.name,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(invoicesTable.createdAt);

  let result = invoices.map((r: InvoiceRow) => ({
    ...mapInvoice(r.invoice),
    clientName: r.clientName,
  }));

  if (status) {
    result = result.filter((i: any) => i.status === status);
  }

  if (clientId) {
    result = result.filter((i: any) => i.clientId === clientId);
  }

  res.json(result);
});

router.post("/invoices", async (req, res): Promise<void> => {
  const {
    clientId,
    projectId,
    status,
    type,
    subtotal,
    tax,
    discount,
    total,
    dueDate,
    notes,
    terms,
    billTo,
    items,
  } = req.body ?? {};

  const client = toStr(clientId);

  if (!client) {
    res.status(400).json({ error: "Client ID is required" });
    return;
  }

  const count = await db.select().from(invoicesTable);

  const number = `INV-${String(count.length + 1).padStart(4, "0")}`;

  const invoiceId = crypto.randomUUID();

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      id: invoiceId,
      number,
      clientId: client,
      projectId: toStr(projectId) || null,
      status: toStr(status) || "DRAFT",
      type: toStr(type) || "FULL",
      subtotal: toNumStr(subtotal),
      tax: toNumStr(tax),
      discount: toNumStr(discount),
      total: toNumStr(total),
      paidAmount: "0",
      dueDate: toDateOrNull(dueDate),
      notes: toStr(notes) || null,
      terms: toStr(terms) || null,
      billTo: toStr(billTo) || null,
    })
    .returning();

  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as InvoiceItemInput;

      await db.insert(invoiceItemsTable).values({
        id: crypto.randomUUID(),
        invoiceId,
        description: toStr(item?.description),
        quantity: toNumStr(item?.quantity, "1"),
        unitPrice: toNumStr(item?.unitPrice),
        total: toNumStr(item?.total),
        sortOrder: String(i),
      });
    }
  }

  await logActivity("invoice.created", `Invoice ${number} created`);

  res.status(201).json(mapInvoice(invoice));
});

router.get(
  "/invoices/:id",
  async (
    req: Request<InvoiceParams>,
    res: Response,
  ): Promise<void> => {
    const id = toStr(req.params.id);

    if (!id) {
      res.status(400).json({ error: "Invoice ID is required" });
      return;
    }

    const [invoiceRow] = await db
      .select({
        invoice: invoicesTable,
        clientName: clientsTable.name,
      })
      .from(invoicesTable)
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(eq(invoicesTable.id, id))
      .limit(1);

    if (!invoiceRow) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const items = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    const payments = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.invoiceId, id));

    res.json({
      ...mapInvoice(invoiceRow.invoice),
      clientName: invoiceRow.clientName,
      items: items.map((i: any) => mapItem(i)),
      payments: payments.map((p: any) => mapPayment(p)),
    });
  },
);

router.put(
  "/invoices/:id",
  async (
    req: Request<InvoiceParams>,
    res: Response,
  ): Promise<void> => {
    const id = toStr(req.params.id);

    if (!id) {
      res.status(400).json({ error: "Invoice ID is required" });
      return;
    }

    const {
      status,
      type,
      subtotal,
      tax,
      discount,
      dueDate,
      paidAmount,
      notes,
      terms,
      billTo,
      shipTo,
      items,
    } = req.body ?? {};

    const [invoice] = await db
      .update(invoicesTable)
      .set({
        ...(status !== undefined && { status: toStr(status) }),
        ...(type !== undefined && { type: toStr(type) }),
        ...(subtotal !== undefined && {
          subtotal: toNumStr(subtotal),
        }),
        ...(tax !== undefined && { tax: toNumStr(tax) }),
        ...(discount !== undefined && {
          discount: toNumStr(discount),
        }),
        ...(paidAmount !== undefined && {
          paidAmount: toNumStr(paidAmount),
        }),
        ...(dueDate !== undefined && {
          dueDate: toDateOrNull(dueDate),
        }),
        ...(notes !== undefined && { notes: toStr(notes) }),
        ...(terms !== undefined && { terms: toStr(terms) }),
        ...(billTo !== undefined && {
          billTo: toStr(billTo),
        }),
        ...(shipTo !== undefined && {
          shipTo: toStr(shipTo),
        }),
        updatedAt: new Date(),
      })
      .where(eq(invoicesTable.id, id))
      .returning();

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    if (Array.isArray(items)) {
      await db
        .delete(invoiceItemsTable)
        .where(eq(invoiceItemsTable.invoiceId, id));

      for (let i = 0; i < items.length; i++) {
        const item = items[i] as InvoiceItemInput;

        await db.insert(invoiceItemsTable).values({
          id: crypto.randomUUID(),
          invoiceId: id,
          description: toStr(item?.description),
          quantity: toNumStr(item?.quantity, "1"),
          unitPrice: toNumStr(item?.unitPrice),
          total: toNumStr(item?.total),
          sortOrder: String(i),
        });
      }
    }

    const updatedItems = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    res.json({
      ...mapInvoice(invoice),
      items: updatedItems.map((i: any) => mapItem(i)),
    });
  },
);

router.delete(
  "/invoices/:id",
  async (
    req: Request<InvoiceParams>,
    res: Response,
  ): Promise<void> => {
    const id = toStr(req.params.id);

    if (!id) {
      res.status(400).json({ error: "Invoice ID is required" });
      return;
    }

    await db
      .delete(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id));

    await db
      .delete(paymentsTable)
      .where(eq(paymentsTable.invoiceId, id));

    await db
      .delete(invoicesTable)
      .where(eq(invoicesTable.id, id));

    res.json({
      success: true,
      message: "Invoice deleted",
    });
  },
);

router.post(
  "/invoices/:id/payments",
  async (
    req: Request<InvoiceParams>,
    res: Response,
  ): Promise<void> => {
    const invoiceId = toStr(req.params.id);

    if (!invoiceId) {
      res.status(400).json({ error: "Invoice ID is required" });
      return;
    }

    const { amount, method, reference, notes, paidAt } =
      req.body ?? {};

    if (amount === undefined || !method) {
      res.status(400).json({
        error: "Amount and method are required",
      });
      return;
    }

    const paymentId = crypto.randomUUID();

    const [payment] = await db
      .insert(paymentsTable)
      .values({
        id: paymentId,
        invoiceId,
        amount: toNumStr(amount),
        method: toStr(method),
        reference: toStr(reference) || null,
        paidAt: toDateOrNull(paidAt) ?? new Date(),
        notes: toStr(notes) || null,
      })
      .returning();

    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId))
      .limit(1);

    if (invoice) {
      const newPaid =
        Number(invoice.paidAmount) + Number(amount);

      const newStatus =
        newPaid >= Number(invoice.total)
          ? "PAID"
          : invoice.status;

      await db
        .update(invoicesTable)
        .set({
          paidAmount: String(newPaid),
          status: newStatus,
          paidAt:
            newStatus === "PAID"
              ? new Date()
              : invoice.paidAt,
        })
        .where(eq(invoicesTable.id, invoiceId));
    }

    res.status(201).json(mapPayment(payment));
  },
);

function mapInvoice(i: any) {
  return {
    id: i.id,
    number: i.number,
    clientId: i.clientId,
    projectId: i.projectId,
    status: i.status,
    type: i.type,
    subtotal: Number(i.subtotal),
    tax: Number(i.tax),
    discount: Number(i.discount),
    total: Number(i.total),
    paidAmount: Number(i.paidAmount),
    dueDate: i.dueDate,
    paidAt: i.paidAt,
    notes: i.notes,
    terms: i.terms,
    createdAt: i.createdAt,
  };
}

function mapItem(i: any) {
  return {
    id: i.id,
    invoiceId: i.invoiceId,
    description: i.description,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    total: Number(i.total),
    sortOrder: Number(i.sortOrder),
  };
}

function mapPayment(p: any) {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    amount: Number(p.amount),
    method: p.method,
    reference: p.reference,
    paidAt: p.paidAt,
    notes: p.notes,
  };
}

async function logActivity(
  action: string,
  description: string,
) {
  try {
    const {
      activityLogsTable,
      db: database,
    } = await import("@workspace/db");

    await database.insert(activityLogsTable).values({
      id: crypto.randomUUID(),
      action,
      description,
    });
  } catch {}
}

export default router;