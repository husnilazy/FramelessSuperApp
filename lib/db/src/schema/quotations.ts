import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const quotationsTable = pgTable("quotations", {
  id: text("id").primaryKey().notNull(),
  number: text("number").notNull(),
  clientId: text("clientId").notNull().references(() => clientsTable.id),
  projectId: text("projectId"),
  projectType: text("projectType"),
  title: text("title").notNull(),
  status: text("status").notNull().default("DRAFT"),
  validUntil: timestamp("validUntil"),
  subtotal: numeric("subtotal").notNull().default("0"),
  tax: numeric("tax").notNull().default("0"),
  discount: numeric("discount").notNull().default("0"),
  total: numeric("total").notNull().default("0"),
  estimatedCost: numeric("estimatedCost").notNull().default("0"),
  dpPercentage: numeric("dpPercentage").notNull().default("50"),
  notes: text("notes"),
  terms: text("terms"),
  billTo: text("billTo"),
  logoUrl: text("logoUrl"),
  paperSize: text("paperSize").notNull().default("A4"),
  marginTop: text("marginTop").notNull().default("16mm"),
  marginBottom: text("marginBottom").notNull().default("16mm"),
  marginLeft: text("marginLeft").notNull().default("14mm"),
  marginRight: text("marginRight").notNull().default("14mm"),
  convertedProjectId: text("convertedProjectId"),
  convertedInvoiceId: text("convertedInvoiceId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const quotationItemsTable = pgTable("quotation_items", {
  id: text("id").primaryKey().notNull(),
  quotationId: text("quotationId").notNull().references(() => quotationsTable.id),
  phase: text("phase").notNull().default("lain"),
  label: text("label"),
  components: text("components"),
  description: text("description").notNull(),
  quantity: numeric("quantity").notNull(),
  unitPrice: numeric("unitPrice").notNull(),
  total: numeric("total").notNull(),
  sortOrder: numeric("sortOrder").notNull().default("0"),
});

export const quotationRabItemsTable = pgTable("quotation_rab_items", {
  id: text("id").primaryKey().notNull(),
  quotationId: text("quotationId").notNull().references(() => quotationsTable.id),
  category: text("category").notNull(),
  itemName: text("itemName").notNull(),
  quantity: numeric("quantity").notNull().default("1"),
  unit: text("unit"),
  unitCost: numeric("unitCost").notNull().default("0"),
  total: numeric("total").notNull().default("0"),
  notes: text("notes"),
  sortOrder: numeric("sortOrder").notNull().default("0"),
});

export const insertQuotationSchema = createInsertSchema(quotationsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertQuotationItemSchema = createInsertSchema(quotationItemsTable).omit({ id: true });
export const insertQuotationRabItemSchema = createInsertSchema(quotationRabItemsTable).omit({ id: true });

export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotationsTable.$inferSelect;
export type QuotationItem = typeof quotationItemsTable.$inferSelect;
export type QuotationRabItem = typeof quotationRabItemsTable.$inferSelect;