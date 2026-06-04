import { Router, type IRouter } from "express";
import { db, pool, projectsTable, clientsTable, teamMembersTable, invoicesTable, expensesTable, activityLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

type ProjectRow = {
  status: string;
};

type InvoiceRow = {
  status: string;
  total: unknown;
  paidAmount?: unknown;
  dueDate?: string | Date | null;
  paidAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type ExpenseRow = {
  amount: unknown;
  category: string;
  date?: string | Date | null;
};

type ActivityRow = {
  id: unknown;
  userId: unknown;
  projectId: unknown;
  action: unknown;
  description: unknown;
  createdAt: unknown;
};

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  try {
    let projects: any[] = [];
    let clients: any[] = [];
    let team: any[] = [];
    let invoices: any[] = [];
    let expenses: any[] = [];

    if (pool) {
      // Safe raw queries using only guaranteed columns to survive schema drift
      try {
        const p = await pool.query('SELECT status, client FROM projects');
        projects = p.rows;
      } catch (e) { logger.error({ err: e }, 'dashboard.projects.raw.fail'); }

      try {
        const c = await pool.query('SELECT id, name, status, notes FROM clients');
        clients = c.rows;
      } catch (e) {
        // fallback core only
        try {
          const c = await pool.query('SELECT id, name, notes FROM clients');
          clients = c.rows.map((r: any) => ({ ...r, status: null }));
        } catch (e2) { logger.error({ err: e2 }, 'dashboard.clients.raw.fail'); }
      }

      try {
        const t = await pool.query(`SELECT id FROM team_members WHERE "isActive" = true OR is_active = true`);
        team = t.rows;
      } catch (e) {
        try {
          const t = await pool.query('SELECT id FROM team_members WHERE is_active = true');
          team = t.rows;
        } catch (e2) { logger.error({ err: e2 }, 'dashboard.team.raw.fail'); }
      }

      try {
        const i = await pool.query('SELECT status, total, "paidAmount", "dueDate", "paidAt", "updatedAt" FROM invoices');
        invoices = i.rows;
      } catch (e) { logger.error({ err: e }, 'dashboard.invoices.raw.fail'); }

      try {
        const e = await pool.query('SELECT amount, date FROM expenses');
        expenses = e.rows;
      } catch (e) { logger.error({ err: e }, 'dashboard.expenses.raw.fail'); }
    } else {
      // Fallback to drizzle (may fail on drift)
      try {
        projects = await db.select({ status: projectsTable.status, client: projectsTable.client }).from(projectsTable);
        clients = await db.select({ id: clientsTable.id, name: clientsTable.name, status: clientsTable.status, notes: clientsTable.notes }).from(clientsTable);
        team = await db.select({ id: teamMembersTable.id }).from(teamMembersTable).where(eq(teamMembersTable.isActive, true));
        invoices = await db.select().from(invoicesTable);
        expenses = await db.select().from(expensesTable);
      } catch (e) { logger.error({ err: e }, 'dashboard.drizzle.fallback.fail'); }
    }

    // Active / ongoing projects (match the kanban "sedang berjalan")
    const completed = ['completed', 'done', 'delivered', 'cancelled'];
    const activeProjects = projects.filter((p: any) => {
      const st = String(p.status || '').toLowerCase();
      return !completed.includes(st);
    }).length;

    // Use actual collected (paidAmount) for revenue/net profit.
    // This way only real payments count (including partial/DP), not full invoice totals 
    // or "total semua project" budgets. Unpaid invoices don't inflate the profit.
    const totalRevenue = invoices.reduce((s: number, i: any) => s + Number(i.paidAmount || 0), 0);
    const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    const pendingInvoices = invoices.filter((i: any) => i.status === "DRAFT" || i.status === "SENT" || (i.status !== "PAID" && Number(i.paidAmount || 0) < Number(i.total || 0)));
    const now = new Date();
    const overdueInvoices = invoices.filter((i: any) => i.status !== "PAID" && i.dueDate && new Date(i.dueDate) < now).length;

    // Leads from clients (prospect or inquiry notes) - for dashboard info
    const leads = clients.filter((c: any) =>
      c.status === 'prospect' || (c.notes && /Inquiry/i.test(String(c.notes || '')))
    ).length;

    res.json({
      totalProjects: projects.length,
      activeProjects,
      totalClients: clients.length,
      totalTeam: team.length,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices,
      pendingInvoiceAmount: pendingInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0),
      leads,
    });
  } catch (err) {
    logger.error({ err }, "dashboard.stats.error");
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
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
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit) as ActivityRow[];

  res.json(
    activities.map((a: ActivityRow) => ({
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
    db.select().from(expensesTable),
  ]) as [InvoiceRow[], ExpenseRow[]];

  // Use actual paidAmount for totalIncome (consistent with dashboard net profit)
  const totalIncome = invoices.reduce((s: number, i: InvoiceRow) => s + Number(i.paidAmount || 0), 0);
  const totalExpenses = expenses.reduce((s: number, e: ExpenseRow) => s + Number(e.amount), 0);
  const invoicedAmount = invoices.reduce((s: number, i: InvoiceRow) => s + Number(i.total), 0);
  const paidAmount = invoices.reduce((s: number, i: InvoiceRow) => s + Number(i.paidAmount), 0);

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
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit)
    .offset(offset) as ActivityRow[];

  if (projectId) {
    activities = activities.filter((a: ActivityRow) => String(a.projectId) === projectId);
  }

  res.json(
    activities.map((a: ActivityRow) => ({
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
  ]) as [InvoiceRow[], ExpenseRow[]];

  const result: { month: string; income: number; expenses: number; net: number; profit: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" });

    const income = invoices
      .filter((inv: InvoiceRow) => {
        if (inv.status !== "PAID") return false;
        const ref = inv.paidAt ? new Date(inv.paidAt) : inv.updatedAt ? new Date(inv.updatedAt) : null;
        return !!ref && ref >= date && ref < nextDate;
      })
      .reduce((s: number, inv: InvoiceRow) => s + Number(inv.paidAmount || inv.total), 0);

    const expense = expenses
      .filter((e: ExpenseRow) => e.date && new Date(e.date) >= date && new Date(e.date) < nextDate)
      .reduce((s: number, e: ExpenseRow) => s + Number(e.amount), 0);

    result.push({ month: monthLabel, income, expenses: expense, net: income - expense, profit: income - expense });
  }

  return result;
}

export default router;