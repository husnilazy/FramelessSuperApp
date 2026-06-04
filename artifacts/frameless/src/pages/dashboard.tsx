// artifacts/frameless/src/pages/dashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  CreditCard,
  Film,
  Users,
  TrendingUp,
  AlertCircle,
  FolderOpen,
  Clock,
  BarChart2,
  BookOpen,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  netProfit: number;
  activeProjects: number;
  pendingInvoiceAmount: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalClients?: number;
  totalTeam?: number;
  totalRevenue?: number;
  totalExpenses?: number;
  leads?: number;
}

interface CashFlowItem {
  month: string;
  income: number;
  expenses: number;
}

interface ActivityItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

// ── Fetchers (direct fetch, bypassing broken codegen hooks) ──────────────────

function useStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/dashboard/stats", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("stats failed");
      return res.json();
    },
    staleTime: 60_000,
    retry: 2,
  });
}

function useCashFlow() {
  return useQuery<CashFlowItem[]>({
    queryKey: ["dashboard-cashflow"],
    queryFn: () =>
      fetch("/api/dashboard/cash-flow?months=6").then((r) => {
        if (!r.ok) throw new Error("cashflow failed");
        return r.json();
      }),
    staleTime: 60_000,
    retry: 2,
  });
}

function useActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ["dashboard-activity"],
    queryFn: () =>
      fetch("/api/dashboard/recent-activity?limit=10").then((r) => {
        if (!r.ok) throw new Error("activity failed");
        return r.json();
      }),
    staleTime: 10_000,
    refetchInterval: 15000, // live updates every 15s
    retry: 2,
  });
}

// ── Components ───────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  subtitle,
  alert,
  accent,
}: {
  title: string;
  value: string;
  icon: any;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  alert?: boolean;
  accent?: boolean;
}) {
  return (
    <Card
      className={`relative overflow-hidden group transition-all duration-300 hover:translate-y-[-2px] ${
        alert
          ? "bg-destructive/5 border-destructive/30"
          : accent
          ? "border-primary/30 bg-primary/5"
          : "glass-panel border-white/5"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
            {title}
          </p>
          <div
            className={`p-2 rounded-lg ${
              alert
                ? "bg-destructive/15 text-destructive"
                : accent
                ? "bg-primary/15 text-primary"
                : "bg-white/5 text-primary"
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h3
            className={`text-2xl font-bold tracking-tight ${
              alert ? "text-destructive" : "text-white"
            }`}
          >
            {value}
          </h3>
          {trend && (
            <p
              className={`text-xs font-semibold flex items-center gap-1 ${
                trendUp ? "text-emerald-400" : "text-red-400"
              }`}
            >
              <span>{trendUp ? "▲" : "▼"}</span>
              {trend} vs bulan lalu
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingPulse() {
  return (
    <div className="space-y-8 pb-8 animate-pulse">
      <div>
        <div className="h-10 w-64 bg-white/5 rounded-lg mb-2" />
        <div className="h-4 w-40 bg-white/5 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-white/5 rounded-xl border border-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-2 h-80 bg-white/5 rounded-xl border border-white/5" />
        <div className="h-80 bg-white/5 rounded-xl border border-white/5" />
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-6">
      <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
      <p className="text-sm text-destructive/90">{message}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useStats();
  const {
    data: cashFlow,
    isLoading: cashFlowLoading,
    isError: cashFlowError,
  } = useCashFlow();
  const {
    data: activity,
    isLoading: activityLoading,
  } = useActivity();

  const isLoading = statsLoading || cashFlowLoading || activityLoading;

  if (isLoading) return <LoadingPulse />;

  const s = stats || ({} as DashboardStats);
  const cf = cashFlow || [];
  const recentActivity = activity || [];

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-heading tracking-wider mb-1 text-white">
            Control Room
          </h1>
          <p className="text-muted-foreground uppercase tracking-[0.16em] text-[11px] font-semibold">
            Operational Overview — Frameless Creative
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground px-4 py-2 rounded-lg bg-white/5 border border-white/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* Error notices (non-blocking) */}
      {statsError && (
        <ErrorBanner message="Gagal memuat statistik. Pastikan server API berjalan." />
      )}
      {cashFlowError && (
        <ErrorBanner message="Gagal memuat data cash flow." />
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Net Profit"
          value={formatCurrency(s.netProfit || 0)}
          icon={TrendingUp}
          trend="+12.5%"
          trendUp={true}
          accent
        />
        <KpiCard
          title="Active Projects"
          value={(s.activeProjects || 0).toString()}
          icon={Film}
          subtitle="Sedang berjalan"
        />
        <KpiCard
          title="Pending Invoice"
          value={formatCurrency(s.pendingInvoiceAmount || 0)}
          icon={CreditCard}
          subtitle={`${s.pendingInvoices || 0} invoice menunggu`}
        />
        <KpiCard
          title="Overdue"
          value={(s.overdueInvoices || 0).toString()}
          icon={AlertCircle}
          subtitle="Invoice jatuh tempo"
          alert={!!s.overdueInvoices && s.overdueInvoices > 0}
        />
      </div>

      {/* Secondary KPIs */}
      {(s.totalClients || s.totalTeam) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {s.totalClients !== undefined && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/5">
              <Users className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-white font-bold text-lg">{s.totalClients}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Clients</p>
              </div>
            </div>
          )}
          {s.totalTeam !== undefined && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/5">
              <Users className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-white font-bold text-lg">{s.totalTeam}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tim</p>
              </div>
            </div>
          )}
          {s.totalRevenue !== undefined && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/5">
              <BarChart2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-white font-bold text-lg">{formatCurrency(s.totalRevenue)}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Revenue</p>
              </div>
            </div>
          )}
          {s.totalExpenses !== undefined && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/5">
              <FolderOpen className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <div>
                <p className="text-white font-bold text-lg">{formatCurrency(s.totalExpenses)}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Expenses</p>
              </div>
            </div>
          )}
          {s.leads !== undefined && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/5">
              <Users className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <div>
                <p className="text-white font-bold text-lg">{s.leads}</p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Leads / Prospects</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cash Flow Chart */}
        <Card className="col-span-1 lg:col-span-2 glass-panel border-white/8">
          <CardHeader className="pb-2">
            <CardTitle className="uppercase tracking-[0.14em] text-[11px] text-muted-foreground font-semibold flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-primary" />
              6-Month Cash Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cf.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                <BarChart2 className="w-10 h-10 text-white/10" />
                <p className="text-sm text-muted-foreground">
                  Belum ada data cash flow
                </p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={cf}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorIncome"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorExpenses"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--destructive))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--destructive))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.07)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={11}
                      tickFormatter={(v) => `${v / 1_000_000}M`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(14,18,28,0.95)",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "10px",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "#fff" }}
                      formatter={(value: number) => [
                        formatCurrency(value),
                        "",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Income"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorIncome)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorExpenses)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-xs text-muted-foreground">Expenses</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="glass-panel border-white/8">
          <CardHeader className="pb-2">
            <CardTitle className="uppercase tracking-[0.14em] text-[11px] text-muted-foreground font-semibold flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-primary" />
              Live Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5 overflow-y-auto max-h-[320px] pr-1">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Clock className="w-8 h-8 text-white/10" />
                  <p className="text-sm text-muted-foreground text-center">
                    Belum ada aktivitas terbaru
                  </p>
                </div>
              ) : (
                recentActivity.map((item, i) => (
                  <div
                    key={item.id}
                    className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-[-20px] last:before:bottom-0 before:w-[1.5px] before:bg-white/8"
                  >
                    <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-background border border-primary/40 flex items-center justify-center z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white leading-tight">
                        {item.action}
                      </p>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mt-1">
                        {(() => {
                          try {
                            return formatDistanceToNow(
                              new Date(item.createdAt),
                              { addSuffix: true }
                            );
                          } catch {
                            return "baru saja";
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Projects", href: "/projects", icon: FolderOpen, desc: "Lihat semua proyek" },
          { label: "Invoices", href: "/invoices", icon: CreditCard, desc: "Kelola invoice" },
          { label: "Crew", href: "/team", icon: Users, desc: "Manajemen tim" },
          { label: "Academy", href: "/courses-admin", icon: BookOpen, desc: "Kelola kursus" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-primary/20 transition-all duration-200 no-underline"
          >
            <link.icon className="w-4 h-4 text-primary flex-shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-white group-hover:text-primary transition-colors">
                {link.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{link.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}