// artifacts/frameless/src/pages/dashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Activity, CreditCard, Film, Users, TrendingUp,
  AlertCircle, FolderOpen, Clock, BarChart2, BookOpen,
  DollarSign, TrendingDown, ArrowRight, Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  netProfit: number;
  activeProjects: number;
  pendingInvoiceAmount: number;
  pendingInvoices: number;
  overdueInvoices: number;
  dueSoonInvoices?: number;
  totalClients?: number;
  totalTeam?: number;
  totalRevenue?: number;
  totalExpenses?: number;
  invoiceRevenue?: number;
  manualRevenue?: number;
  leads?: number;
}
interface CashFlowItem { month: string; income: number; expenses: number; }
interface ActivityItem { id: string; action: string; description: string; createdAt: string; }

// ── Fetchers ──────────────────────────────────────────────────────────────────
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
    staleTime: 60_000, retry: 2,
  });
}
function useCashFlow() {
  return useQuery<CashFlowItem[]>({
    queryKey: ["dashboard-cashflow"],
    queryFn: () => fetch("/api/dashboard/cash-flow?months=6").then(r => {
      if (!r.ok) throw new Error("cashflow failed");
      return r.json();
    }),
    staleTime: 60_000, retry: 2,
  });
}
function useActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ["dashboard-activity"],
    queryFn: () => fetch("/api/dashboard/recent-activity?limit=10").then(r => {
      if (!r.ok) throw new Error("activity failed");
      return r.json();
    }),
    staleTime: 10_000, refetchInterval: 15000, retry: 2,
  });
}

// ── Animated Number Counter ────────────────────────────────────────────────────
function AnimatedNumber({ value, format }: { value: number; format?: "currency" | "number" }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  const start = useRef<number>(0);
  const from = useRef<number>(0);

  useEffect(() => {
    const target = value;
    from.current = display;
    start.current = 0;
    const duration = 900;

    const step = (timestamp: number) => {
      if (!start.current) start.current = timestamp;
      const elapsed = timestamp - start.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from.current + (target - from.current) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  if (format === "currency") return <>{formatCurrency(display)}</>;
  return <>{display.toLocaleString("id-ID")}</>;
}

// ── Fade-in wrapper using IntersectionObserver ────────────────────────────────
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-white/5 animate-pulse ${className}`} />;
}

function LoadingPulse() {
  return (
    <div className="space-y-6 pb-8">
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="col-span-2 h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, rawValue, icon: Icon, subtitle, alert, accent, href, format,
}: {
  title: string; value?: string; rawValue?: number; icon: any;
  subtitle?: string; alert?: boolean; accent?: boolean; href?: string; format?: "currency" | "number";
}) {
  const content = (
    <div className={`
      relative overflow-hidden rounded-2xl border p-4 sm:p-5
      transition-all duration-300 active:scale-[0.97] cursor-default group
      ${alert ? "bg-destructive/5 border-destructive/25" : accent ? "bg-primary/5 border-primary/25" : "glass-panel border-white/6"}
    `}>
      {/* Shimmer on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/4 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />

      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold leading-tight">
          {title}
        </p>
        <div className={`p-2 rounded-xl flex-shrink-0 ${alert ? "bg-destructive/15 text-destructive" : accent ? "bg-primary/15 text-primary" : "bg-white/6 text-primary"}`}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </div>

      <p className={`text-xl sm:text-2xl font-extrabold tracking-tight leading-none ${alert ? "text-destructive" : "text-foreground"}`}>
        {rawValue !== undefined && format
          ? <AnimatedNumber value={rawValue} format={format} />
          : value}
      </p>

      {subtitle && (
        <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{subtitle}</p>
      )}

      {href && (
        <div className="absolute bottom-3.5 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
    </div>
  );

  if (href) return <a href={href} className="block no-underline">{content}</a>;
  return content;
}

// ── Alert Banner ──────────────────────────────────────────────────────────────
function AlertBanner({ icon: Icon, message, color = "destructive", href }: {
  icon: any; message: string; color?: "destructive" | "yellow"; href?: string;
}) {
  const cls = color === "yellow"
    ? "bg-yellow-500/8 border-yellow-500/25 text-yellow-400"
    : "bg-destructive/8 border-destructive/25 text-destructive";

  const inner = (
    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-[12px] font-semibold ${cls}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{message}</span>
      {href && <ArrowRight className="w-3 h-3 ml-auto flex-shrink-0" />}
    </div>
  );

  if (href) return <a href={href} className="block no-underline">{inner}</a>;
  return inner;
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useStats();
  const { data: cashFlow, isLoading: cashFlowLoading } = useCashFlow();
  const { data: activity, isLoading: activityLoading } = useActivity();

  const isLoading = statsLoading || cashFlowLoading || activityLoading;
  if (isLoading) return <LoadingPulse />;

  const s = stats || ({} as DashboardStats);
  const cf = cashFlow || [];
  const acts = activity || [];

  const now = new Date();
  const greeting = now.getHours() < 11 ? "Selamat pagi" : now.getHours() < 15 ? "Selamat siang" : now.getHours() < 19 ? "Selamat sore" : "Selamat malam";

  return (
    <div className="space-y-5 pb-20 sm:pb-10">

      {/* ── Header ── */}
      <FadeIn delay={0}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-0.5">{greeting} 👋</p>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-[11px] sm:text-xs uppercase tracking-widest text-muted-foreground font-semibold mt-1">
              {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex-shrink-0 mt-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── Alert banners ── */}
      {(s.overdueInvoices > 0 || (s.dueSoonInvoices ?? 0) > 0) && (
        <FadeIn delay={60}>
          <div className="flex flex-col gap-2">
            {s.overdueInvoices > 0 && (
              <AlertBanner
                icon={AlertCircle}
                message={`${s.overdueInvoices} invoice melewati jatuh tempo — segera tindak lanjuti`}
                color="destructive"
                href="/invoices"
              />
            )}
            {(s.dueSoonInvoices ?? 0) > 0 && (
              <AlertBanner
                icon={Clock}
                message={`${s.dueSoonInvoices} invoice jatuh tempo dalam 7 hari ke depan`}
                color="yellow"
                href="/invoices"
              />
            )}
          </div>
        </FadeIn>
      )}

      {/* ── KPI Cards — 2×2 on mobile, 4 columns on lg ── */}
      <FadeIn delay={100}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            title="Laba Bersih"
            rawValue={s.netProfit ?? 0}
            format="currency"
            icon={TrendingUp}
            subtitle={s.netProfit >= 0 ? "Untung periode ini" : "Perlu perhatian"}
            accent={!!s.netProfit && s.netProfit > 0}
            alert={!!s.netProfit && s.netProfit < 0}
          />
          <KpiCard
            title="Proyek Aktif"
            rawValue={s.activeProjects ?? 0}
            format="number"
            icon={Film}
            subtitle="Sedang berjalan"
            href="/projects"
          />
          <KpiCard
            title="Invoice Pending"
            rawValue={s.pendingInvoices ?? 0}
            format="number"
            icon={CreditCard}
            subtitle={s.pendingInvoiceAmount ? formatCurrency(s.pendingInvoiceAmount) : undefined}
            alert={(s.pendingInvoices ?? 0) > 0}
            href="/invoices"
          />
          <KpiCard
            title="Total Klien"
            rawValue={s.totalClients ?? 0}
            format="number"
            icon={Users}
            subtitle={s.leads ? `${s.leads} prospek aktif` : "Semua klien"}
            href="/clients"
          />
        </div>
      </FadeIn>

      {/* ── Revenue / Expense pills — horizontal scroll on mobile ── */}
      {(s.totalRevenue !== undefined || s.totalExpenses !== undefined) && (
        <FadeIn delay={150}>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
            {s.totalRevenue !== undefined && (
              <a href="/finance" className="flex-shrink-0 snap-start no-underline">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 min-w-[160px]">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Total Revenue</p>
                    <p className="text-sm font-extrabold text-emerald-400 leading-tight">
                      <AnimatedNumber value={s.totalRevenue} format="currency" />
                    </p>
                  </div>
                </div>
              </a>
            )}
            {s.totalExpenses !== undefined && (
              <a href="/expenses" className="flex-shrink-0 snap-start no-underline">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-rose-500/8 border border-rose-500/20 min-w-[160px]">
                  <div className="w-7 h-7 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/80">Total Expenses</p>
                    <p className="text-sm font-extrabold text-rose-400 leading-tight">
                      <AnimatedNumber value={s.totalExpenses} format="currency" />
                    </p>
                  </div>
                </div>
              </a>
            )}
            {s.totalTeam !== undefined && (
              <div className="flex-shrink-0 snap-start">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-violet-500/8 border border-violet-500/20 min-w-[140px]">
                  <div className="w-7 h-7 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400/80">Tim Aktif</p>
                    <p className="text-sm font-extrabold text-violet-400 leading-tight">{s.totalTeam} orang</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {/* ── Chart + Activity: stacked on mobile, side-by-side on lg ── */}
      <FadeIn delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Cash Flow Chart */}
          <Card className="col-span-1 lg:col-span-2 glass-panel border-white/6 overflow-hidden">
            <CardHeader className="pb-1 pt-4 px-4 sm:px-6">
              <CardTitle className="uppercase tracking-[0.14em] text-[10px] sm:text-[11px] text-muted-foreground font-semibold flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-primary" />
                6-Month Cash Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 pb-4">
              {cf.length === 0 ? (
                <div className="h-[220px] sm:h-[280px] flex flex-col items-center justify-center gap-3">
                  <BarChart2 className="w-10 h-10 text-white/10" />
                  <p className="text-sm text-muted-foreground">Belum ada data cash flow</p>
                </div>
              ) : (
                <div className="h-[220px] sm:h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cf} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.25)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.25)" fontSize={10} tickFormatter={v => `${v/1_000_000}M`} tickLine={false} axisLine={false} width={36} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "rgba(14,18,28,0.97)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "12px" }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(v: number) => [formatCurrency(v), ""]}
                      />
                      <Area type="monotone" dataKey="income" name="Income" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                      <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="flex items-center gap-5 mt-3 pt-3 border-t border-white/5 px-2 sm:px-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-[11px] text-muted-foreground">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                  <span className="text-[11px] text-muted-foreground">Expenses</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Activity Feed */}
          <Card className="glass-panel border-white/6">
            <CardHeader className="pb-1 pt-4 px-4 sm:px-5">
              <CardTitle className="uppercase tracking-[0.14em] text-[10px] sm:text-[11px] text-muted-foreground font-semibold flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary" />
                Live Feed
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4">
              <div className="space-y-4 overflow-y-auto max-h-[260px] sm:max-h-[290px] pr-1 overscroll-contain">
                {acts.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Clock className="w-8 h-8 text-white/10" />
                    <p className="text-sm text-muted-foreground text-center">Belum ada aktivitas</p>
                  </div>
                ) : (
                  acts.map((item) => (
                    <div key={item.id} className="relative pl-5 before:absolute before:left-[8px] before:top-5 before:bottom-[-16px] last:before:bottom-0 before:w-px before:bg-white/8">
                      <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-background border border-primary/40 flex items-center justify-center z-10">
                        <div className="w-1 h-1 rounded-full bg-primary" />
                      </div>
                      <p className="text-[12px] sm:text-[13px] font-semibold text-foreground leading-tight">{item.action}</p>
                      {item.description && (
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground/50 mt-1">
                        {(() => { try { return formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }); } catch { return "baru saja"; } })()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* ── Quick Links — 2-col grid, tap-friendly ── */}
      <FadeIn delay={260}>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2.5 px-0.5">Menu Cepat</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Projects", href: "/projects", icon: FolderOpen, desc: "Lihat semua proyek", color: "text-blue-400" },
              { label: "Invoices", href: "/invoices", icon: CreditCard, desc: "Kelola invoice", color: "text-primary" },
              { label: "Finance", href: "/finance", icon: DollarSign, desc: "Laporan keuangan", color: "text-emerald-400" },
              { label: "Expenses", href: "/expenses", icon: TrendingDown, desc: "Catat pengeluaran", color: "text-rose-400" },
              { label: "Crew", href: "/team", icon: Users, desc: "Manajemen tim", color: "text-violet-400" },
              { label: "Academy", href: "/courses-admin", icon: BookOpen, desc: "Kelola kursus", color: "text-yellow-400" },
              { label: "Clients", href: "/clients", icon: Activity, desc: "Manajemen klien", color: "text-cyan-400" },
              { label: "CMS", href: "/cms", icon: Zap, desc: "Edit konten", color: "text-orange-400" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-white/5 bg-white/2 hover:bg-white/5 active:bg-white/8 hover:border-primary/20 transition-all duration-200 no-underline active:scale-[0.97]"
              >
                <div className={`w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ${link.color}`}>
                  <link.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors leading-tight truncate">{link.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{link.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </FadeIn>

    </div>
  );
}