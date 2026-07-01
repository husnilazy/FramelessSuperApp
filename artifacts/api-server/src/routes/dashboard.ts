import { Router, type IRouter } from "express";
import { db, pool, projectsTable, clientsTable, teamMembersTable, invoicesTable, expensesTable, activityLogsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
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
  createdAt?: string | Date | null;
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
    let incomeEntries: any[] = [];

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
        const i = await pool.query('SELECT status, total, "paidAmount", "dueDate", "paidAt", "updatedAt", "createdAt" FROM invoices');
        invoices = i.rows;
      } catch (e) { logger.error({ err: e }, 'dashboard.invoices.raw.fail'); }

      try {
        const e = await pool.query('SELECT amount, date FROM expenses');
        expenses = e.rows;
      } catch (e) { logger.error({ err: e }, 'dashboard.expenses.raw.fail'); }

      try {
        const inc = await pool.query('SELECT amount, date, category FROM income_entries');
        incomeEntries = inc.rows;
      } catch (e) {
        incomeEntries = [];
      }
    } else {
      // Fallback to drizzle (may fail on drift)
      try {
        projects = await db.select({ status: projectsTable.status, client: projectsTable.client }).from(projectsTable);
        clients = await db.select({ id: clientsTable.id, name: clientsTable.name, status: clientsTable.status, notes: clientsTable.notes }).from(clientsTable);
        team = await db.select({ id: teamMembersTable.id }).from(teamMembersTable).where(eq(teamMembersTable.isActive, true));
        invoices = await db.select().from(invoicesTable);
        expenses = await db.select().from(expensesTable);
        try {
          const incResult: any = await db.execute(sql`SELECT amount, date, category FROM income_entries`);
          incomeEntries = incResult.rows || incResult || [];
        } catch { incomeEntries = []; }
      } catch (e) { logger.error({ err: e }, 'dashboard.drizzle.fallback.fail'); }
    }

    // Active / ongoing projects (match the kanban "sedang berjalan")
    const completed = ['completed', 'done', 'delivered', 'cancelled'];
    const activeProjects = projects.filter((p: any) => {
      const st = String(p.status || '').toLowerCase();
      return !completed.includes(st);
    }).length;

    // Use actual collected (paidAmount) for revenue/net profit, PLUS manual income entries.
    // This way only real payments count (including partial/DP), not full invoice totals 
    // or "total semua project" budgets. Unpaid invoices don't inflate the profit.
    const invoiceRevenue = invoices.reduce((s: number, i: any) => s + Number(i.paidAmount || 0), 0);
    const manualRevenue = incomeEntries.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const totalRevenue = invoiceRevenue + manualRevenue;
    const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    const pendingInvoices = invoices.filter((i: any) => i.status === "DRAFT" || i.status === "SENT" || (i.status !== "PAID" && Number(i.paidAmount || 0) < Number(i.total || 0)));
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const overdueInvoices = invoices.filter((i: any) => i.status !== "PAID" && i.dueDate && new Date(i.dueDate) < now).length;
    const dueSoonInvoices = invoices.filter((i: any) =>
      i.status !== "PAID" && i.dueDate &&
      new Date(i.dueDate) >= now && new Date(i.dueDate) <= sevenDaysFromNow
    ).length;

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
      invoiceRevenue,
      manualRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices,
      dueSoonInvoices,
      pendingInvoiceAmount: pendingInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0),
      leads,
    });
  } catch (err) {
    logger.error({ err }, "dashboard.stats.error");
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

router.get("/invoices/notifications", async (_req, res): Promise<void> => {
  try {
    const invoices = await db.select().from(invoicesTable) as InvoiceRow[] & { id: any; number: any; clientId: any }[];
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const unpaid = (invoices as any[]).filter(i => i.status !== "PAID" && i.dueDate);

    const overdue = unpaid
      .filter(i => new Date(i.dueDate) < now)
      .map(i => ({
        id: i.id,
        number: i.number,
        clientId: i.clientId,
        total: Number(i.total),
        paidAmount: Number(i.paidAmount || 0),
        dueDate: i.dueDate,
        daysOverdue: Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
        type: "overdue" as const,
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const dueSoon = unpaid
      .filter(i => {
        const d = new Date(i.dueDate);
        return d >= now && d <= sevenDaysFromNow;
      })
      .map(i => ({
        id: i.id,
        number: i.number,
        clientId: i.clientId,
        total: Number(i.total),
        paidAmount: Number(i.paidAmount || 0),
        dueDate: i.dueDate,
        daysUntilDue: Math.ceil((new Date(i.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        type: "due_soon" as const,
      }))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    res.json({
      overdue,
      dueSoon,
      totalOverdueAmount: overdue.reduce((s, i) => s + (i.total - i.paidAmount), 0),
      totalDueSoonAmount: dueSoon.reduce((s, i) => s + (i.total - i.paidAmount), 0),
    });
  } catch (err) {
    logger.error({ err }, "invoices.notifications.error");
    res.status(500).json({ error: "Failed to fetch invoice notifications" });
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

  const [invoices, expenses, incomeRows] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(expensesTable),
    db.execute(sql`SELECT amount, category, date FROM income_entries`).then(
      (r: any) => r.rows || r,
      () => [],
    ),
  ]) as [InvoiceRow[], ExpenseRow[], { amount: any; category: string; date: any }[]];

  const invoiceIncome = invoices.reduce((s: number, i: InvoiceRow) => s + Number(i.paidAmount || 0), 0);
  const manualIncome = (incomeRows || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalIncome = invoiceIncome + manualIncome;
  const totalExpenses = expenses.reduce((s: number, e: ExpenseRow) => s + Number(e.amount), 0);
  const invoicedAmount = invoices.reduce((s: number, i: InvoiceRow) => s + Number(i.total), 0);
  const paidAmount = invoices.reduce((s: number, i: InvoiceRow) => s + Number(i.paidAmount), 0);

  const expenseByCategory: Record<string, number> = {};
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount);
  }

  res.json({
    totalIncome,
    invoiceIncome,
    manualIncome,
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
  const [invoices, expenses, incomeRows] = await Promise.all([
    db.select().from(invoicesTable),
    db.select().from(expensesTable),
    db.execute(sql`SELECT amount, date FROM income_entries`).then(
      (r: any) => r.rows || r,
      () => [],
    ),
  ]) as [InvoiceRow[], ExpenseRow[], { amount: any; date: any }[]];

  const result: { month: string; income: number; expenses: number; net: number; profit: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthLabel = date.toLocaleString("default", { month: "short", year: "numeric" });

    const invoiceIncome = invoices
      .filter((inv: InvoiceRow) => {
        if (inv.status !== "PAID") return false;
        const ref = inv.paidAt ? new Date(inv.paidAt) : inv.updatedAt ? new Date(inv.updatedAt) : inv.createdAt ? new Date(inv.createdAt) : null;
        return !!ref && ref >= date && ref < nextDate;
      })
      .reduce((s: number, inv: InvoiceRow) => s + Number(inv.paidAmount || inv.total), 0);

    const manualIncome = (incomeRows || [])
      .filter((e: any) => e.date && new Date(e.date) >= date && new Date(e.date) < nextDate)
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    const income = invoiceIncome + manualIncome;

    const expense = expenses
      .filter((e: ExpenseRow) => e.date && new Date(e.date) >= date && new Date(e.date) < nextDate)
      .reduce((s: number, e: ExpenseRow) => s + Number(e.amount), 0);

    result.push({ month: monthLabel, income, expenses: expense, net: income - expense, profit: income - expense });
  }

  return result;
}

export default router;