import { useState } from "react";
import { useGetFinanceSummary, useGetFinanceCashFlow } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon } from "lucide-react";

const COLORS = ["hsl(16,100%,60%)", "hsl(200,90%,60%)", "hsl(270,80%,65%)", "hsl(140,70%,50%)", "hsl(35,100%,55%)"];

export default function FinancePage() {
  const [months, setMonths] = useState(6);
  const { data: summary, isLoading: sumLoading } = useGetFinanceSummary();
  const { data: cashFlow, isLoading: cfLoading } = useGetFinanceCashFlow({ months });

  const isLoading = sumLoading || cfLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const netProfitPositive = (summary?.netProfit || 0) >= 0;
  const profitMargin = summary?.profitMargin ? Math.round(summary.profitMargin) : 0;

  const expenseByCategory = summary?.expenseByCategory || [];

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-4xl font-heading tracking-wider text-white">Finance</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Financial Intelligence</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinKpi
          label="Total Revenue"
          value={formatCurrency(summary?.totalIncome || 0)}
          icon={DollarSign}
          positive
        />
        <FinKpi
          label="Total Expenses"
          value={formatCurrency(summary?.totalExpenses || 0)}
          icon={TrendingDown}
          positive={false}
        />
        <FinKpi
          label="Net Profit"
          value={formatCurrency(summary?.netProfit || 0)}
          icon={netProfitPositive ? TrendingUp : TrendingDown}
          positive={netProfitPositive}
        />
        <FinKpi
          label="Profit Margin"
          value={`${profitMargin}%`}
          icon={PieIcon}
          positive={profitMargin >= 0}
        />
      </div>

      {/* Cash Flow Chart */}
      <Card className="glass-panel border-white/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">
            Cash Flow — {months} Months
          </CardTitle>
          <div className="flex gap-2">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border transition-all ${
                  months === m ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                }`}
              >
                {m}M
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="finIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(16,100%,60%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(16,100%,60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="finExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0,84%,60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0,84%,60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11}
                  tickFormatter={(v) => `${v / 1000000}M`} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(14,18,27,0.95)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(v: number) => [formatCurrency(v), ""]}
                />
                <Area type="monotone" dataKey="income" name="Revenue" stroke="hsl(16,100%,60%)" strokeWidth={2} fillOpacity={1} fill="url(#finIncome)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(0,84%,60%)" strokeWidth={2} fillOpacity={1} fill="url(#finExpenses)" />
                <Legend formatter={(val) => <span className="text-xs uppercase tracking-wider text-muted-foreground">{val}</span>} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Bar */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Monthly Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlow || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10}
                    tickFormatter={(v) => `${v / 1000000}M`} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "rgba(14,18,27,0.95)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(v: number) => [formatCurrency(v), "Net"]}
                  />
                  <Bar dataKey="net" name="Net" fill="hsl(16,100%,60%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        dataKey="total"
                        nameKey="category"
                        strokeWidth={0}
                      >
                        {expenseByCategory.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "rgba(14,18,27,0.95)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                        formatter={(v: number) => [formatCurrency(v), ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {expenseByCategory.map((cat: any, i: number) => (
                    <div key={cat.category} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">{cat.category}</span>
                      </div>
                      <span className="text-xs text-white font-medium">{formatCurrency(cat.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-sm text-muted-foreground">No expense data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Invoices */}
      {summary && (
        <Card className="glass-panel border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Outstanding (Unpaid)</p>
                <p className="text-3xl font-heading text-primary">{formatCurrency(summary.unpaidAmount || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Invoiced</p>
                <p className="text-3xl font-heading text-white">{formatCurrency(summary.invoicedAmount || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Collected</p>
                <p className="text-3xl font-heading text-green-400">{formatCurrency(summary.paidAmount || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FinKpi({ label, value, icon: Icon, positive }: { label: string; value: string; icon: any; positive: boolean }) {
  return (
    <Card className={`glass-panel border-white/5 ${positive ? "border-green-500/10" : "border-red-500/10"}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <div className={`p-1.5 rounded-md ${positive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <p className={`text-xl font-heading ${positive ? "text-white" : "text-destructive"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
