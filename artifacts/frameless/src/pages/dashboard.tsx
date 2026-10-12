// Dashboard admin — ringkasan bisnis: angka utama, arus kas, tindakan yang perlu diambil, project, aktivitas.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Clock, CreditCard, FilePlus2, FileText, Film, Inbox,
  PiggyBank, Receipt, TrendingDown, TrendingUp, Users, UsersRound, Wallet,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, KpiCard, Panel, Pill, Skeleton } from "@/components/shell/ui";

// ── Data ─────────────────────────────────────────────────────────────────────
async function authedJson<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

interface Stats {
  netProfit: number; activeProjects: number; pendingInvoiceAmount: number; pendingInvoices: number; overdueInvoices: number;
  dueSoonInvoices?: number; totalClients?: number; totalTeam?: number; totalRevenue?: number; totalExpenses?: number; leads?: number;
}
interface CashFlowItem { month: string; income: number; expenses: number }
interface ActivityItem { id: string; action: string; description: string; createdAt: string }
interface InvoiceRow {
  id: string; number: string; clientName?: string | null; total: number; paidAmount: number; dueDate?: string | null;
  status: string; displayStatus?: string; paymentStage?: string; createdAt: string;
}
interface ProjectRow { id: string; title: string; client?: string | null; status: string; progress?: number | null; deadline?: string | null }

const rp = (n: number) => formatCurrency(Math.round(n));
const rpShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)} M`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)} jt`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  return String(Math.round(n));
};

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
}

function daysBetween(dateStr?: string | null) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

// ── Tooltip grafik ───────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.dataKey === "income" ? "Pemasukan" : "Pengeluaran"}
          </span>
          <span className="font-semibold text-foreground tabular-nums">{rp(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Halaman ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const stats = useQuery<Stats>({ queryKey: ["dash", "stats"], queryFn: () => authedJson("/api/dashboard/stats"), staleTime: 60_000 });
  const cash = useQuery<CashFlowItem[]>({ queryKey: ["dash", "cash"], queryFn: () => authedJson("/api/dashboard/cash-flow?months=6"), staleTime: 60_000 });
  const activity = useQuery<ActivityItem[]>({ queryKey: ["dash", "activity"], queryFn: () => authedJson("/api/dashboard/recent-activity?limit=8"), refetchInterval: 30_000 });
  const invoices = useQuery<InvoiceRow[]>({ queryKey: ["dash", "invoices"], queryFn: () => authedJson("/api/invoices"), staleTime: 60_000 });
  const projects = useQuery<ProjectRow[]>({ queryKey: ["dash", "projects"], queryFn: () => authedJson("/api/projects"), staleTime: 60_000 });

  const s = stats.data;
  const cf = cash.data ?? [];

  // tren pemasukan: bulan ini vs bulan lalu
  const trend = useMemo(() => {
    if (cf.length < 2) return null;
    const cur = cf[cf.length - 1].income, prev = cf[cf.length - 2].income;
    if (!prev) return null; // bulan lalu 0 → persentase tidak bermakna
    return ((cur - prev) / prev) * 100;
  }, [cf]);

  // invoice yang perlu tindakan: terlambat dulu, lalu yang jatuh tempo ≤ 7 hari
  const actions = useMemo(() => {
    const list = (invoices.data ?? [])
      .filter((i) => (i.displayStatus ?? i.status) !== "PAID" && i.status !== "DRAFT" && i.status !== "CANCELLED" && i.total - i.paidAmount > 0.5)
      .map((i) => ({ ...i, late: daysBetween(i.dueDate) }))
      .filter((i) => i.late !== null && i.late > -8);
    return list.sort((a, b) => (b.late ?? 0) - (a.late ?? 0)).slice(0, 5);
  }, [invoices.data]);

  const recentInvoices = useMemo(
    () => [...(invoices.data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5),
    [invoices.data],
  );
  const runningProjects = useMemo(
    () => (projects.data ?? []).filter((p) => !["completed", "done", "delivered", "cancelled"].includes((p.status || "").toLowerCase())).slice(0, 5),
    [projects.data],
  );

  const hasCash = cf.some((c) => c.income > 0 || c.expenses > 0);
  const overdue = s?.overdueInvoices ?? 0;
  const firstName = (user?.name || "Admin").split(/[\s(]/)[0];

  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        title={`${greeting()}, ${firstName}`}
        description="Ringkasan bisnis Frameless Creative hari ini."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/quotations/new")}><FileText className="h-4 w-4 mr-2" />Penawaran</Button>
            <Button onClick={() => navigate("/invoices/new")}><FilePlus2 className="h-4 w-4 mr-2" />Invoice baru</Button>
          </>
        }
      />

      {overdue > 0 && (
        <Link href="/invoices" className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm hover:bg-destructive/12 transition-colors">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <span className="flex-1 text-foreground"><b>{overdue} invoice</b> melewati jatuh tempo — segera tindak lanjuti.</span>
          <ArrowRight className="h-4 w-4 text-destructive" />
        </Link>
      )}

      {/* Angka utama */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)
        ) : (
          <>
            <KpiCard label="Laba bersih" tone={(s?.netProfit ?? 0) >= 0 ? "success" : "danger"} icon={PiggyBank}
              value={rp(s?.netProfit ?? 0)} sub="Pemasukan − pengeluaran" />
            <KpiCard label="Pemasukan" tone="primary" icon={TrendingUp} value={rp(s?.totalRevenue ?? 0)} trend={trend} sub="vs bulan lalu" onClick={() => navigate("/finance")} />
            <KpiCard label="Pengeluaran" tone="danger" icon={TrendingDown} value={rp(s?.totalExpenses ?? 0)} sub="Total tercatat" onClick={() => navigate("/expenses")} />
            <KpiCard label="Piutang" tone={overdue > 0 ? "warning" : "info"} icon={Wallet} value={rp(s?.pendingInvoiceAmount ?? 0)}
              sub={`${s?.pendingInvoices ?? 0} invoice belum lunas${overdue ? ` · ${overdue} terlambat` : ""}`} onClick={() => navigate("/invoices")} />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {[
          { label: "Project aktif", value: s?.activeProjects ?? 0, icon: Film, href: "/projects" },
          { label: "Klien", value: s?.totalClients ?? 0, icon: UsersRound, href: "/clients" },
          { label: "Crew aktif", value: s?.totalTeam ?? 0, icon: Users, href: "/team" },
          { label: "Prospek baru", value: s?.leads ?? 0, icon: Inbox, href: "/clients" },
        ].map((m) => (
          <Link key={m.label} href={m.href} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:border-foreground/20 transition-colors">
            <span className="h-9 w-9 rounded-xl grid place-items-center bg-muted text-muted-foreground"><m.icon className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-lg font-extrabold leading-none text-foreground tabular-nums">{m.value}</span>
              <span className="block text-[11px] text-muted-foreground mt-1 truncate">{m.label}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        {/* Arus kas */}
        <Panel
          className="xl:col-span-2"
          title="Arus kas 6 bulan"
          description="Pemasukan vs pengeluaran per bulan (berdasarkan tanggal uang masuk)"
          action={
            <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Pemasukan</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--c-red)" }} />Pengeluaran</span>
            </div>
          }
        >
          {cash.isLoading ? (
            <Skeleton className="h-64" />
          ) : !hasCash ? (
            <EmptyState icon={BarChart3} title="Belum ada data arus kas" hint="Catat pembayaran invoice atau pengeluaran, grafik akan muncul di sini." />
          ) : (
            <div className="h-64 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cf} barGap={4} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={rpShort} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--foreground) / .04)" }} />
                  <Bar dataKey="income" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(var(--destructive) / .75)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        {/* Perlu tindakan */}
        <Panel title="Perlu tindakan" description="Invoice terlambat & segera jatuh tempo" action={<Link href="/invoices" className="text-xs font-semibold text-primary hover:underline">Semua</Link>}>
          {invoices.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : actions.length === 0 ? (
            <EmptyState icon={Receipt} title="Semua beres" hint="Tidak ada invoice terlambat atau jatuh tempo dalam 7 hari." />
          ) : (
            <ul className="space-y-2">
              {actions.map((i) => {
                const late = (i.late ?? 0) > 0;
                return (
                  <li key={i.id}>
                    <Link href={`/invoices/${i.id}`} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-muted/60 transition-colors">
                      <span className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${late ? "bg-destructive/12 text-destructive" : "bg-warning/14 text-warning"}`}>
                        {late ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground truncate">{i.number} · {i.clientName || "—"}</span>
                        <span className={`block text-[11px] ${late ? "text-destructive" : "text-muted-foreground"}`}>
                          {late ? `Terlambat ${i.late} hari` : i.late === 0 ? "Jatuh tempo hari ini" : `Jatuh tempo ${Math.abs(i.late ?? 0)} hari lagi`}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{rpShort(i.total - i.paidAmount)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        {/* Project */}
        <Panel title="Project berjalan" action={<Link href="/projects" className="text-xs font-semibold text-primary hover:underline">Semua</Link>}>
          {projects.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : runningProjects.length === 0 ? (
            <EmptyState icon={Film} title="Belum ada project berjalan" />
          ) : (
            <ul className="space-y-4">
              {runningProjects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="block group">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{p.title}</span>
                      <span className="text-xs font-bold text-muted-foreground tabular-nums">{p.progress ?? 0}%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{p.client || "Tanpa klien"}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, p.progress ?? 0))}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Invoice terbaru */}
        <Panel title="Invoice terbaru" action={<Link href="/invoices" className="text-xs font-semibold text-primary hover:underline">Semua</Link>}>
          {invoices.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : recentInvoices.length === 0 ? (
            <EmptyState icon={Receipt} title="Belum ada invoice" action={<Button size="sm" onClick={() => navigate("/invoices/new")}>Buat invoice</Button>} />
          ) : (
            <ul className="divide-y divide-border">
              {recentInvoices.map((i) => {
                const st = i.displayStatus ?? i.status;
                const tone = st === "PAID" ? "success" : st === "OVERDUE" ? "danger" : st === "SENT" ? "info" : "neutral";
                return (
                  <li key={i.id}>
                    <Link href={`/invoices/${i.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground truncate">{i.number}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">{i.clientName || "—"}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold text-foreground tabular-nums">{rpShort(i.total)}</span>
                        <Pill tone={tone as any} className="mt-0.5">{i.paymentStage === "DP" && st !== "PAID" ? "DP" : st}</Pill>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Aktivitas */}
        <Panel title="Aktivitas terbaru" action={<Activity className="h-4 w-4 text-muted-foreground" />}>
          {activity.isLoading ? (
            <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState icon={Activity} title="Belum ada aktivitas" />
          ) : (
            <ul className="space-y-3.5">
              {(activity.data ?? []).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0">
                    <span className="block text-[13px] text-foreground leading-snug line-clamp-2">{a.description}</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: localeId })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
