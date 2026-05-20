// artifacts/frameless/src/pages/finance.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Printer,
  Download, Calendar, BarChart2, RefreshCw, Plus, Trash2, X,
  Package, AlertCircle, CheckCircle2, Filter,
} from "lucide-react";

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

// ── API ───────────────────────────────────────────────────────────────────────
async function api(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ..."headers" in opts ? opts.headers as any : {} } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return r.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface CashFlowRow { month: string; income: number; expenses: number; net: number; }
interface PLRow { category: string; amount: number; type: "income" | "expense"; }
interface Equipment { id: string; name: string; purchaseDate: string; purchasePrice: number; depreciationYears: number; category: string; notes?: string; }
interface Invoice { id: string; totalAmount: string; status: string; issueDate: string; client?: string; }
interface Expense { id: string; amount: string; category: string; date: string; description: string; }

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, trend, trendUp, color = OR, sub }: { label: string; value: string; icon: React.ReactNode; trend?: string; trendUp?: boolean; color?: string; sub?: string }) {
  return (
    <div style={{ padding: "20px", borderRadius: 18, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", margin: 0 }}>{label}</p>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</div>
      </div>
      <p style={{ fontSize: 26, fontWeight: 900, color: "#fff", margin: "0 0 6px", letterSpacing: "-.02em" }}>{value}</p>
      {trend && <p style={{ fontSize: 11, fontWeight: 700, color: trendUp ? "#4ade80" : "#f87171", margin: 0 }}>{trendUp ? "▲" : "▼"} {trend}</p>}
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,.3)", margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center", color: OR }}>{icon}</div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-.01em" }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── EQUIPMENT MODAL ───────────────────────────────────────────────────────────
function EquipmentModal({ item, onClose, onSave }: { item: Equipment | null; onClose: () => void; onSave: (d: Partial<Equipment>) => void }) {
  const [form, setForm] = useState<Partial<Equipment>>(item || { depreciationYears: 5 });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof Equipment, v: any) => setForm(p => ({ ...p, [k]: v }));
  const cats = ["Kamera", "Lensa", "Drone", "Audio", "Lighting", "Komputer", "Aksesoris", "Kendaraan", "Lainnya"];

  async function save() { if (!form.name || !form.purchasePrice) return; setSaving(true); try { await onSave(form); } finally { setSaving(false); } }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: "32px", width: "100%", maxWidth: 480, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 22 }}>{item ? "Edit" : "Tambah"} Aset/Alat</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { k: "name", l: "Nama Alat *", ph: "Sony A7IV" },
            { k: "purchaseDate", l: "Tanggal Beli", type: "date" },
            { k: "purchasePrice", l: "Harga Beli (IDR) *", type: "number", ph: "15000000" },
            { k: "depreciationYears", l: "Umur Ekonomis (tahun)", type: "number", ph: "5" },
            { k: "notes", l: "Catatan", ph: "Kondisi, serial number, dll" },
          ].map((field: any) => (
            <div key={field.k}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>{field.l}</label>
              <input type={field.type || "text"} value={(form as any)[field.k] || ""} onChange={e => f(field.k as any, field.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={field.ph || ""}
                style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" as any, fontFamily: FONT }} />
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Kategori</label>
            <select value={form.category || ""} onChange={e => f("category", e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, cursor: "pointer" }}>
              <option value="" style={{ background: "#111318" }}>— Pilih —</option>
              {cats.map(c => <option key={c} value={c} style={{ background: "#111318" }}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Batal</button>
          <button onClick={save} disabled={saving || !form.name || !form.purchasePrice} style={{ padding: "9px 20px", borderRadius: 9, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(12,14,22,.98)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "rgba(255,255,255,.6)", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, margin: "2px 0", fontWeight: 700 }}>{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
};

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [eqModal, setEqModal] = useState<Equipment | null | "new">(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, exp] = await Promise.all([
        api("/api/invoices").catch(() => []),
        api("/api/expenses").catch(() => []),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setExpenses(Array.isArray(exp) ? exp : []);
      // Load equipment from localStorage (since no dedicated endpoint yet)
      const stored = localStorage.getItem("frameless_equipment");
      if (stored) setEquipment(JSON.parse(stored));
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Calculations ──────────────────────────────────────────────────────────
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0";

  // Monthly cash flow
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const cashFlow: CashFlowRow[] = months.map((m, mi) => {
    const income = paidInvoices.filter(i => new Date(i.issueDate).getMonth() === mi && new Date(i.issueDate).getFullYear() === Number(period)).reduce((s, i) => s + Number(i.totalAmount || 0), 0);
    const exp = expenses.filter(e => new Date(e.date).getMonth() === mi && new Date(e.date).getFullYear() === Number(period)).reduce((s, e) => s + Number(e.amount || 0), 0);
    return { month: m, income, expenses: exp, net: income - exp };
  });

  // Expense breakdown
  const expCats = expenses.reduce((acc, e) => {
    const cat = e.category || "Other";
    acc[cat] = (acc[cat] || 0) + Number(e.amount || 0);
    return acc;
  }, {} as Record<string, number>);
  const expPieData = Object.entries(expCats).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["#FF6A20", "#7c3aed", "#2563eb", "#4ade80", "#fbbf24", "#f472b6", "#06b6d4"];

  // P&L categories
  const plData: PLRow[] = [
    ...Object.entries(expenses.reduce((acc, e) => { acc[e.category || "Other"] = (acc[e.category || "Other"] || 0) + Number(e.amount || 0); return acc; }, {} as Record<string, number>)).map(([cat, amt]) => ({ category: cat, amount: amt as number, type: "expense" as const })),
  ].sort((a, b) => b.amount - a.amount);

  // Equipment depreciation
  function calcDepreciation(eq: Equipment) {
    const age = (Date.now() - new Date(eq.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
    const annualDep = eq.purchasePrice / eq.depreciationYears;
    const accumulated = Math.min(eq.purchasePrice, annualDep * age);
    const bookValue = Math.max(0, eq.purchasePrice - accumulated);
    const deprPct = Math.min(100, (accumulated / eq.purchasePrice) * 100);
    return { annualDep, accumulated, bookValue, deprPct, age };
  }

  const totalEquipmentValue = equipment.reduce((s, e) => s + e.purchasePrice, 0);
  const totalBookValue = equipment.reduce((s, e) => s + calcDepreciation(e).bookValue, 0);
  const totalAnnualDepr = equipment.reduce((s, e) => s + calcDepreciation(e).annualDep, 0);

  // Equipment CRUD (localStorage)
  async function saveEquipment(data: Partial<Equipment>) {
    try {
      const updated = eqModal && eqModal !== "new"
        ? equipment.map(e => e.id === (eqModal as Equipment).id ? { ...e, ...data } : e)
        : [...equipment, { ...data, id: Date.now().toString(), purchaseDate: data.purchaseDate || new Date().toISOString().split("T")[0] } as Equipment];
      setEquipment(updated);
      localStorage.setItem("frameless_equipment", JSON.stringify(updated));
      setEqModal(null);
      toast({ title: "Aset disimpan" });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  function deleteEquipment(id: string) {
    if (!confirm("Hapus aset ini?")) return;
    const updated = equipment.filter(e => e.id !== id);
    setEquipment(updated);
    localStorage.setItem("frameless_equipment", JSON.stringify(updated));
    toast({ title: "Aset dihapus" });
  }

  // ── PDF Print ─────────────────────────────────────────────────────────────
  function handlePrint() {
    const printContent = printRef.current;
    if (!printContent) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Laporan Keuangan Frameless Creative — ${period}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1a1d2e;padding:40px;}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px;padding-bottom:20px;border-bottom:3px solid #FF6A20;}
        .logo{font-size:24px;font-weight:900;color:#FF6A20;}
        .logo span{color:#1a1d2e;}
        .period{font-size:14px;color:#666;font-weight:600;}
        .section{margin-bottom:32px;page-break-inside:avoid;}
        .section-title{font-size:16px;font-weight:800;color:#1a1d2e;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:8px;}
        .section-title::before{content:'';width:4px;height:18px;background:#FF6A20;border-radius:2px;display:inline-block;}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px;}
        .stat-card{padding:16px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;}
        .stat-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;margin-bottom:6px;}
        .stat-value{font-size:20px;font-weight:900;color:#1a1d2e;}
        .stat-value.positive{color:#16a34a;}
        .stat-value.negative{color:#dc2626;}
        .stat-value.orange{color:#FF6A20;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th{background:#f3f4f6;padding:9px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;border-bottom:2px solid #e5e7eb;}
        td{padding:9px 12px;border-bottom:1px solid #f3f4f6;color:#374151;}
        tr:last-child td{border-bottom:none;}
        .positive{color:#16a34a;font-weight:700;}
        .negative{color:#dc2626;font-weight:700;}
        .orange{color:#FF6A20;font-weight:700;}
        .total-row td{background:#fff7ed;font-weight:800;border-top:2px solid #FF6A20;}
        .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between;}
        @media print{body{padding:20px;}.no-print{display:none!important;}}
      </style></head><body>
      <div class="header">
        <div><div class="logo">FRAMELESS <span>CREATIVE</span></div><div style="font-size:12px;color:#666;margin-top:4px;">Media Agency · Wonosobo, Central Java</div></div>
        <div class="period"><div style="font-size:18px;font-weight:900;color:#1a1d2e;">Laporan Keuangan</div><div>Periode: ${period}</div><div>Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div></div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Total Revenue</div><div class="stat-value positive">${formatCurrency(totalRevenue)}</div></div>
        <div class="stat-card"><div class="stat-label">Total Expenses</div><div class="stat-value negative">${formatCurrency(totalExpenses)}</div></div>
        <div class="stat-card"><div class="stat-label">Net Profit</div><div class="stat-value ${netProfit >= 0 ? "positive" : "negative"}">${formatCurrency(netProfit)}</div></div>
        <div class="stat-card"><div class="stat-label">Profit Margin</div><div class="stat-value orange">${profitMargin}%</div></div>
      </div>

      <div class="section">
        <div class="section-title">Arus Kas Bulanan ${period}</div>
        <table>
          <thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Arus Bersih</th></tr></thead>
          <tbody>
            ${cashFlow.map(r => `<tr><td>${r.month}</td><td class="positive">${formatCurrency(r.income)}</td><td class="negative">${formatCurrency(r.expenses)}</td><td class="${r.net >= 0 ? "positive" : "negative"}">${formatCurrency(r.net)}</td></tr>`).join("")}
            <tr class="total-row"><td>TOTAL</td><td class="positive">${formatCurrency(cashFlow.reduce((s, r) => s + r.income, 0))}</td><td class="negative">${formatCurrency(cashFlow.reduce((s, r) => s + r.expenses, 0))}</td><td class="${netProfit >= 0 ? "positive" : "negative"}">${formatCurrency(netProfit)}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Rincian Pengeluaran per Kategori</div>
        <table>
          <thead><tr><th>Kategori</th><th>Jumlah</th><th>% dari Total</th></tr></thead>
          <tbody>
            ${plData.map(r => `<tr><td>${r.category}</td><td class="negative">${formatCurrency(r.amount)}</td><td>${totalExpenses > 0 ? ((r.amount / totalExpenses) * 100).toFixed(1) : "0"}%</td></tr>`).join("")}
          </tbody>
        </table>
      </div>

      ${equipment.length > 0 ? `<div class="section">
        <div class="section-title">Inventaris & Depresiasi Aset</div>
        <table>
          <thead><tr><th>Nama Alat</th><th>Kategori</th><th>Harga Beli</th><th>Dep/Tahun</th><th>Akumulasi Dep.</th><th>Nilai Buku</th></tr></thead>
          <tbody>
            ${equipment.map(eq => { const d = calcDepreciation(eq); return `<tr><td>${eq.name}</td><td>${eq.category || "—"}</td><td>${formatCurrency(eq.purchasePrice)}</td><td class="negative">${formatCurrency(d.annualDep)}</td><td class="negative">${formatCurrency(d.accumulated)}</td><td class="${d.bookValue > 0 ? "orange" : "negative"}">${formatCurrency(d.bookValue)}</td></tr>`; }).join("")}
            <tr class="total-row"><td colspan="2">TOTAL</td><td>${formatCurrency(totalEquipmentValue)}</td><td class="negative">${formatCurrency(totalAnnualDepr)}</td><td></td><td class="orange">${formatCurrency(totalBookValue)}</td></tr>
          </tbody>
        </table>
      </div>`: ""}

      <div class="footer">
        <span>Frameless Creative Media Agency · Wonosobo, Central Java</span>
        <span>Dokumen ini dibuat secara otomatis oleh sistem manajemen Frameless Creative</span>
      </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 600);
  }

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  const ipt = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${OR}`, borderTopColor: "transparent", animation: "spin .7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  return (
    <div ref={printRef} style={{ fontFamily: FONT, color: "#f0f0f0", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", margin: "0 0 4px" }}>Laporan Keuangan</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 600 }}>Financial Reports · Frameless Creative</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...ipt, cursor: "pointer" }}>
            {years.map(y => <option key={y} value={y} style={{ background: "#111318" }}>{y}</option>)}
          </select>
          <button onClick={loadData} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><RefreshCw size={14} /></button>
          <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            <Printer size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 32 }}>
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp size={16} />} color="#4ade80" sub={`${paidInvoices.length} invoice lunas`} />
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={<TrendingDown size={16} />} color="#f87171" sub={`${expenses.length} transaksi`} />
        <StatCard label="Net Profit" value={formatCurrency(netProfit)} icon={<DollarSign size={16} />} color={netProfit >= 0 ? "#4ade80" : "#f87171"} sub={netProfit >= 0 ? "Untung" : "Rugi"} />
        <StatCard label="Profit Margin" value={`${profitMargin}%`} icon={<BarChart2 size={16} />} color={Number(profitMargin) >= 30 ? "#4ade80" : Number(profitMargin) >= 10 ? "#fbbf24" : "#f87171"} sub="Margin bersih" />
        <StatCard label="Nilai Buku Aset" value={formatCurrency(totalBookValue)} icon={<Package size={16} />} sub={`${equipment.length} item terdaftar`} />
        <StatCard label="Dep. Tahunan" value={formatCurrency(totalAnnualDepr)} icon={<AlertCircle size={16} />} color="#fbbf24" sub="Total penyusutan/tahun" />
      </div>

      {/* Cash Flow Chart */}
      <Section title={`Arus Kas ${period}`} icon={<BarChart2 size={15} />}>
        <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: "24px" }}>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} /><stop offset="95%" stopColor="#4ade80" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.3} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="month" stroke="rgba(255,255,255,.3)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,.3)" fontSize={11} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,.5)" }} />
                <Area type="monotone" dataKey="income" name="Pemasukan" stroke="#4ade80" strokeWidth={2} fill="url(#gi)" />
                <Area type="monotone" dataKey="expenses" name="Pengeluaran" stroke="#f87171" strokeWidth={2} fill="url(#ge)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Monthly table */}
          <div style={{ marginTop: 24, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{["Bulan", "Pemasukan", "Pengeluaran", "Arus Bersih"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.3)", borderBottom: "1px solid rgba(255,255,255,.07)" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {cashFlow.map(r => (
                  <tr key={r.month} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <td style={{ padding: "8px 12px", color: "rgba(255,255,255,.6)", fontWeight: 600 }}>{r.month}</td>
                    <td style={{ padding: "8px 12px", color: "#4ade80", fontWeight: 700 }}>{r.income > 0 ? formatCurrency(r.income) : "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#f87171", fontWeight: 700 }}>{r.expenses > 0 ? formatCurrency(r.expenses) : "—"}</td>
                    <td style={{ padding: "8px 12px", color: r.net >= 0 ? "#4ade80" : "#f87171", fontWeight: 800 }}>{(r.income > 0 || r.expenses > 0) ? formatCurrency(r.net) : "—"}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${OR}`, background: `${OR}08` }}>
                  <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 800 }}>TOTAL {period}</td>
                  <td style={{ padding: "10px 12px", color: "#4ade80", fontWeight: 900 }}>{formatCurrency(totalRevenue)}</td>
                  <td style={{ padding: "10px 12px", color: "#f87171", fontWeight: 900 }}>{formatCurrency(totalExpenses)}</td>
                  <td style={{ padding: "10px 12px", color: netProfit >= 0 ? "#4ade80" : "#f87171", fontWeight: 900 }}>{formatCurrency(netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Expense breakdown + P&L */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Pie chart */}
        <div>
          <Section title="Distribusi Pengeluaran" icon={<Filter size={15} />}>
            <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: "20px" }}>
              {expPieData.length > 0 ? (
                <>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {expPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {expPieData.map((d, i) => (
                      <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block" }} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{d.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: "40px", textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13 }}>Belum ada data pengeluaran.</p>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* P&L summary */}
        <div>
          <Section title="Laba Rugi" icon={<DollarSign size={15} />}>
            <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.15)" }}>
                  <p style={{ fontSize: 11, color: "rgba(74,222,128,.7)", fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".1em" }}>Total Pendapatan</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: "#4ade80", margin: 0 }}>{formatCurrency(totalRevenue)}</p>
                </div>
                {plData.slice(0, 5).map(r => (
                  <div key={r.category} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)" }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>{r.category}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>({formatCurrency(r.amount)})</span>
                  </div>
                ))}
                <div style={{ padding: "12px 16px", borderRadius: 12, background: `${netProfit >= 0 ? "rgba(74,222,128,.06)" : "rgba(248,113,113,.06)"}`, border: `1px solid ${netProfit >= 0 ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)"}`, marginTop: 4 }}>
                  <p style={{ fontSize: 11, color: `${netProfit >= 0 ? "rgba(74,222,128,.7)" : "rgba(248,113,113,.7)"}`, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".1em" }}>
                    {netProfit >= 0 ? "Net Profit" : "Net Loss"}
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: netProfit >= 0 ? "#4ade80" : "#f87171", margin: 0 }}>{formatCurrency(Math.abs(netProfit))}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", margin: "4px 0 0" }}>Margin: {profitMargin}%</p>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Equipment Inventory */}
      <Section title="Inventaris & Depresiasi Aset" icon={<Package size={15} />}
        action={<button onClick={() => setEqModal("new")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: OR, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}><Plus size={13} /> Tambah Aset</button>}>
        <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" }}>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
            {[{ l: "Total Nilai Beli", v: formatCurrency(totalEquipmentValue), c: "rgba(255,255,255,.8)" }, { l: "Total Nilai Buku", v: formatCurrency(totalBookValue), c: OR }, { l: "Dep. Tahun Ini", v: formatCurrency(totalAnnualDepr), c: "#fbbf24" }].map((s, i) => (
              <div key={s.l} style={{ padding: "16px 20px", borderRight: i < 2 ? "1px solid rgba(255,255,255,.07)" : "none" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 5px" }}>{s.l}</p>
                <p style={{ fontSize: 18, fontWeight: 900, color: s.c, margin: 0 }}>{s.v}</p>
              </div>
            ))}
          </div>
          {/* Table */}
          {equipment.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <Package size={36} color="rgba(255,255,255,.1)" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13 }}>Belum ada aset terdaftar. Klik "Tambah Aset" untuk mulai.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>{["Nama Alat", "Kategori", "Harga Beli", "Dep/Tahun", "Akumulasi", "Nilai Buku", "%", ""].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)", borderBottom: "1px solid rgba(255,255,255,.07)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {equipment.map(eq => {
                    const d = calcDepreciation(eq);
                    return (
                      <tr key={eq.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                        <td style={{ padding: "11px 14px" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{eq.name}</p>
                          {eq.notes && <p style={{ fontSize: 10, color: "rgba(255,255,255,.35)", margin: "2px 0 0" }}>{eq.notes}</p>}
                        </td>
                        <td style={{ padding: "11px 14px", color: "rgba(255,255,255,.5)" }}>{eq.category || "—"}</td>
                        <td style={{ padding: "11px 14px", color: "rgba(255,255,255,.7)", fontWeight: 600 }}>{formatCurrency(eq.purchasePrice)}</td>
                        <td style={{ padding: "11px 14px", color: "#fbbf24", fontWeight: 600 }}>{formatCurrency(d.annualDep)}</td>
                        <td style={{ padding: "11px 14px", color: "#f87171", fontWeight: 600 }}>{formatCurrency(d.accumulated)}</td>
                        <td style={{ padding: "11px 14px", color: d.bookValue > 0 ? OR : "rgba(255,255,255,.3)", fontWeight: 700 }}>{formatCurrency(d.bookValue)}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 48, height: 4, borderRadius: 100, background: "rgba(255,255,255,.1)", overflow: "hidden" }}><div style={{ height: "100%", width: `${d.deprPct}%`, background: d.deprPct > 80 ? "#f87171" : d.deprPct > 50 ? "#fbbf24" : OR, borderRadius: 100 }} /></div>
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)", fontWeight: 600 }}>{d.deprPct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setEqModal(eq)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit3 size={11} /></button>
                            <button onClick={() => deleteEquipment(eq.id)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(248,113,113,.1)", border: "none", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {eqModal && <EquipmentModal item={eqModal === "new" ? null : eqModal as Equipment} onClose={() => setEqModal(null)} onSave={saveEquipment} />}
    </div>
  );
}

// Add Edit3 import
function Edit3(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }