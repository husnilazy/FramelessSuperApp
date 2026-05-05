import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const invoicesTable = pgTable("invoices", {
  id: text("id").primaryKey().notNull(),
  number: text("number").notNull(),
  clientId: text("clientId").notNull().references(() => clientsTable.id),
  projectId: text("projectId"),
  status: text("status").notNull().default("DRAFT"),
  type: text("type").notNull().default("FULL"),
  subtotal: numeric("subtotal").notNull(),
  tax: numeric("tax").notNull().default("0"),
  discount: numeric("discount").notNull().default("0"),
  total: numeric("total").notNull(),
  paidAmount: numeric("paidAmount").notNull().default("0"),
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  terms: text("terms"),
  billTo: text("billTo"),
  shipTo: text("shipTo"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const invoiceItemsTable = pgTable("invoice_items", {
  id: text("id").primaryKey().notNull(),
  invoiceId: text("invoiceId").notNull().references(() => invoicesTable.id),
  description: text("description").notNull(),
  quantity: numeric("quantity").notNull(),
  unitPrice: numeric("unitPrice").notNull(),
  total: numeric("total").notNull(),
  sortOrder: numeric("sortOrder").notNull().default("0"),
});

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey().notNull(),
  invoiceId: text("invoiceId").notNull().references(() => invoicesTable.id),
  amount: numeric("amount").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  paidAt: timestamp("paidAt").notNull().defaultNow(),
  notes: text("notes"),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true });

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
