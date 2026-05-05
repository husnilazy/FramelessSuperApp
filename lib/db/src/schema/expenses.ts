import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const expensesTable = pgTable("expenses", {
  id: text("id").primaryKey().notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  projectId: text("projectId"),
  receiptUrl: text("receiptUrl"),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
