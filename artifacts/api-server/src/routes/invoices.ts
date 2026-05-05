import { Router, type IRouter } from "express";
import { db, invoicesTable, invoiceItemsTable, paymentsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/invoices", async (req, res): Promise<void> => {
  const { status, clientId } = req.query as { status?: string; clientId?: string };
  const invoices = await db.select({
    invoice: invoicesTable,
    clientName: clientsTable.name,
  })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(invoicesTable.createdAt);

  let result = invoices.map((r) => ({
    ...mapInvoice(r.invoice),
    clientName: r.clientName,
  }));

  if (status) result = result.filter((i) => i.status === status);
  if (clientId) result = result.filter((i) => i.clientId === clientId);

  res.json(result);
});

router.post("/invoices", async (req, res): Promise<void> => {
  const { clientId, projectId, status, type, subtotal, tax, discount, total, dueDate, notes, terms, billTo, items } = req.body;
  if (!clientId) {
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
      clientId,
      projectId,
      status: status || "DRAFT",
      type: type || "FULL",
      subtotal: String(subtotal || 0),
      tax: String(tax || 0),
      discount: String(discount || 0),
      total: String(total || 0),
      paidAmount: "0",
      dueDate: dueDate ? new Date(dueDate) : null,
      notes,
      terms,
      billTo,
    })
    .returning();

  if (items && Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await db.insert(invoiceItemsTable).values({
        id: crypto.randomUUID(),
        invoiceId,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        total: String(item.total),
        sortOrder: String(i),
      });
    }
  }

  await logActivity("invoice.created", `Invoice ${number} created`);
  res.status(201).json(mapInvoice(invoice));
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [invoiceRow] = await db.select({
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

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, id));

  res.json({
    ...mapInvoice(invoiceRow.invoice),
    clientName: invoiceRow.clientName,
    items: items.map(mapItem),
    payments: payments.map(mapPayment),
  });
});

router.put("/invoices/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status, type, subtotal, tax, discount, total, dueDate, notes, terms, billTo } = req.body;
  const [invoice] = await db
    .update(invoicesTable)
    .set({
      ...(status && { status }),
      ...(type && { type }),
      ...(subtotal !== undefined && { subtotal: String(subtotal) }),
      ...(tax !== undefined && { tax: String(tax) }),
      ...(discount !== undefined && { discount: String(discount) }),
      ...(total !== undefined && { total: String(total) }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(notes !== undefined && { notes }),
      ...(terms !== undefined && { terms }),
      ...(billTo !== undefined && { billTo }),
      updatedAt: new Date(),
    })
    .where(eq(invoicesTable.id, id))
    .returning();
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(mapInvoice(invoice));
});

router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  await db.delete(paymentsTable).where(eq(paymentsTable.invoiceId, id));
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  res.json({ success: true, message: "Invoice deleted" });
});

router.post("/invoices/:id/payments", async (req, res): Promise<void> => {
  const invoiceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { amount, method, reference, notes, paidAt } = req.body;
  if (!amount || !method) {
    res.status(400).json({ error: "Amount and method are required" });
    return;
  }

  const paymentId = crypto.randomUUID();
  const [payment] = await db
    .insert(paymentsTable)
    .values({
      id: paymentId,
      invoiceId,
      amount: String(amount),
      method,
      reference,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      notes,
    })
    .returning();

  // Update paidAmount on invoice
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (invoice) {
    const newPaid = Number(invoice.paidAmount) + Number(amount);
    const newStatus = newPaid >= Number(invoice.total) ? "PAID" : invoice.status;
    await db
      .update(invoicesTable)
      .set({ paidAmount: String(newPaid), status: newStatus, paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt })
      .where(eq(invoicesTable.id, invoiceId));
  }

  res.status(201).json(mapPayment(payment));
});

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

async function logActivity(action: string, description: string) {
  try {
    const { activityLogsTable } = await import("@workspace/db");
    const { db: database } = await import("@workspace/db");
    await database.insert(activityLogsTable).values({
      id: crypto.randomUUID(),
      action,
      description,
    });
  } catch (_) {}
}

export default router;
