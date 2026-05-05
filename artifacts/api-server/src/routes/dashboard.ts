import { Router, type IRouter } from "express";
import { db, projectsTable, clientsTable, teamMembersTable, invoicesTable, expensesTable, activityLogsTable } from "@workspace/db";
import { eq, sql, gte } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const [projects, clients, team, invoices, expenses] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(clientsTable),
    db.select().from(teamMembersTable).where(eq(teamMembersTable.isActive, true)),
    db.select().from(invoicesTable),
    db.select().from(expensesTable),
  ]);

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const totalRevenue = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const pendingInvoices = invoices.filter((i) => i.status === "DRAFT" || i.status === "SENT");
  const now = new Date();
  const overdueInvoices = invoices.filter((i) => i.status !== "PAID" && i.dueDate && new Date(i.dueDate) < now).length;

  res.json({
    totalProjects: projects.length,
    activeProjects,
    totalClients: clients.length,
    totalTeamMembers: team.length,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    pendingInvoices: pendingInvoices.length,
    overdueInvoices,
    pendingInvoiceAmount: pendingInvoices.reduce((s, i) => s + Number(i.total), 0),
  });
});

router.get("/dashboard/cash-flow", async (req, res): Promise<void> => {
  const months = parseInt(String(req.query.months || "6"));
  const result = await getCashFlowData(months);
  res.json(result);
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit || "10"));
  const activities = await db
    .select()
    .from(activityLogsTable)
    .orderBy(sql`${activityLogsTable.createdAt} DESC`)
    .limit(limit);
  res.json(
    activities.map((a) => ({
      id: a.id,
      userId: a.userId,
      projectId: a.projectId,
      action: a.action,
      description: a.description,
      createdAt: a.createdAt,
    }))
  );
});

router.get("/finance/summary", async (req, res): Promise<void> => {
  const year = parseInt(String(req.query.year || new Date().getFullYear()));
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const [invoices, expenses] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(expensesTable).where(
      sql`${expensesTable.date} >= ${startDate} AND ${expensesTable.date} < ${endDate}`
    ),
  ]);

  const paidInvoices = invoices.filter((i) => i.status === "PAID");
  const totalIncome = paidInvoices.reduce((s, i) => s + Number(i.paidAmount || i.total), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const invoicedAmount = invoices.reduce((s, i) => s + Number(i.total), 0);
  const paidAmount = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);

  const expenseByCategory: Record<string, number> = {};
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
  }

  res.json({
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    profitMargin: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
    invoicedAmount,
    paidAmount,
    unpaidAmount: invoicedAmount - paidAmount,
    expenseByCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({
      category,
      amount,
    })),
  });
});

router.get("/finance/cash-flow", async (req, res): Promise<void> => {
  const months = parseInt(String(req.query.months || "12"));
  const result = await getCashFlowData(months);
  res.json(result);
});

router.get("/activity", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = parseInt(String(req.query.offset || "0"));
  const { projectId } = req.query as { projectId?: string };

  let activities = await db
    .select()
    .from(activityLogsTable)
    .orderBy(sql`${activityLogsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  if (projectId) {
    activities = activities.filter((a) => a.projectId === projectId);
  }

  res.json(
    activities.map((a) => ({
      id: a.id,
      userId: a.userId,
      projectId: a.projectId,
      action: a.action,
      description: a.description,
      createdAt: a.createdAt,
    }))
  );
});

async function getCashFlowData(months: number) {
  const [invoices, expenses] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(expensesTable),
  ]);

  const result: { month: string; income: number; expenses: number; net: number; profit: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" });

    const income = invoices
      .filter((inv) => {
        if (inv.status !== "PAID") return false;
        const ref = inv.paidAt ? new Date(inv.paidAt) : inv.updatedAt ? new Date(inv.updatedAt) : null;
        return ref && ref >= date && ref < nextDate;
      })
      .reduce((s, inv) => s + Number(inv.paidAmount || inv.total), 0);

    const expense = expenses
      .filter((e) => e.date && new Date(e.date) >= date && new Date(e.date) < nextDate)
      .reduce((s, e) => s + Number(e.amount), 0);

    result.push({ month: monthLabel, income, expenses: expense, net: income - expense, profit: income - expense });
  }

  return result;
}

export default router;
