// artifacts/frameless/src/pages/finance.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Printer, RefreshCw,
  Plus, Trash2, X, Package, AlertCircle, Filter, BarChart2,
  Receipt, Wallet, ChevronDown, Check, Edit2, FileText,
  ArrowUpRight, ArrowDownRight, Calendar, Tag, Layers,
} from "lucide-react";

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";
const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// ─── API helper ────────────────────────────────────────────────────────────────
async function api(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const r = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...("headers" in opts ? (opts.headers as any) : {}),
    },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Request gagal");
  }
  return r.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  paidAmount: number;
  dueDate: string | null;
  paidAt: string | null;
  updatedAt: string | null;
  clientName?: string;
  clientId: string;
  createdAt: string;
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  projectId?: string | null;
  receiptUrl?: string | null;
}

interface IncomeEntry {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  source: string;
  notes?: string | null;
}

interface Equipment {
  id: string;
  name: string;
  purchaseDate: string;
  purchasePrice: number;
  depreciationYears: number;
  category: string;
  notes?: string;
  condition?: string;
  serialNumber?: string;
}

interface FinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  invoicedAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  expenseByCategory: { category: string; amount: number }[];
}

// ─── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon, sub, color = OR, delta, deltaUp,
}: {
  label: string; value: string; icon: React.ReactNode;
  sub?: string; color?: string; delta?: string; deltaUp?: boolean;
}) {
  return (
    <div style={{
      padding: "20px 22px", borderRadius: 16,
      background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", margin: 0 }}>{label}</p>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</div>
      </div>
      <p style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-.02em", lineHeight: 1 }}>{value}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,.3)", margin: 0 }}>{sub}</p>}
        {delta && (
          <span style={{ fontSize: 11, fontWeight: 700, color: deltaUp ? "#4ade80" : "#f87171", display: "flex", alignItems: "center", gap: 2 }}>
            {deltaUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {delta}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────
function Section({ title, icon, children, action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center", color: OR }}>{icon}</div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
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

// ─── Modal: Income Entry ────────────────────────────────────────────────────────
function IncomeModal({ item, onClose, onSave }: {
  item: IncomeEntry | null; onClose: () => void;
  onSave: (d: Partial<IncomeEntry>) => Promise<void>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<Partial<IncomeEntry>>(item || { date: today, category: "Jasa Produksi", source: "Manual" });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof IncomeEntry, v: any) => setForm(p => ({ ...p, [k]: v }));

  const cats = ["Jasa Produksi", "Jasa Editing", "Konsultasi", "Sewa Alat", "Royalti", "Bonus", "Lainnya"];

  async function save() {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: 32, width: "100%", maxWidth: 460, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 22 }}>{item ? "Edit" : "Tambah"} Pemasukan</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { k: "description", l: "Keterangan *", ph: "mis. Pembayaran proyek video klip" },
            { k: "amount", l: "Jumlah (IDR) *", type: "number", ph: "5000000" },
            { k: "date", l: "Tanggal", type: "date" },
            { k: "source", l: "Sumber", ph: "mis. Transfer BCA, Tunai" },
            { k: "notes", l: "Catatan", ph: "Opsional" },
          ].map((field: any) => (
            <div key={field.k}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>{field.l}</label>
              <input type={field.type || "text"} value={(form as any)[field.k] || ""}
                onChange={e => f(field.k as any, field.type === "number" ? Number(e.target.value) : e.target.value)}
                placeholder={field.ph || ""}
                style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: FONT }} />
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Kategori</label>
            <select value={form.category || ""} onChange={e => f("category", e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, cursor: "pointer" }}>
              {cats.map(c => <option key={c} value={c} style={{ background: "#111318" }}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Batal</button>
          <button onClick={save} disabled={saving || !form.description || !form.amount}
            style={{ padding: "9px 20px", borderRadius: 9, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, opacity: saving || !form.description || !form.amount ? 0.5 : 1 }}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Equipment ──────────────────────────────────────────────────────────
function EquipmentModal({ item, onClose, onSave }: {
  item: Equipment | null; onClose: () => void;
  onSave: (d: Partial<Equipment>) => Promise<void>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<Partial<Equipment>>(item || { depreciationYears: 5, purchaseDate: today, condition: "Baik" });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof Equipment, v: any) => setForm(p => ({ ...p, [k]: v }));
  const cats = ["Kamera", "Lensa", "Drone", "Audio", "Lighting", "Gimbal", "Komputer", "Monitor", "Aksesoris", "Kendaraan", "Lainnya"];
  const conditions = ["Baru", "Baik", "Perlu Service", "Rusak"];

  async function save() {
    if (!form.name || !form.purchasePrice) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: 32, width: "100%", maxWidth: 500, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 22 }}>{item ? "Edit" : "Tambah"} Aset/Alat</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { k: "name", l: "Nama Alat *", ph: "Sony FX3" },
            { k: "serialNumber", l: "Serial Number", ph: "SN-XXXXXXXX" },
            { k: "purchaseDate", l: "Tanggal Beli", type: "date" },
            { k: "purchasePrice", l: "Harga Beli (IDR) *", type: "number", ph: "25000000" },
            { k: "depreciationYears", l: "Umur Ekonomis (tahun)", type: "number", ph: "5" },
            { k: "notes", l: "Catatan", ph: "Kondisi, lokasi penyimpanan, dll" },
          ].map((field: any) => (
            <div key={field.k}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>{field.l}</label>
              <input type={field.type || "text"} value={(form as any)[field.k] || ""}
                onChange={e => f(field.k as any, field.type === "number" ? Number(e.target.value) : e.target.value)}
                placeholder={field.ph || ""}
                style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: FONT }} />
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Kategori</label>
              <select value={form.category || ""} onChange={e => f("category", e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, cursor: "pointer" }}>
                <option value="" style={{ background: "#111318" }}>— Pilih —</option>
                {cats.map(c => <option key={c} value={c} style={{ background: "#111318" }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Kondisi</label>
              <select value={form.condition || "Baik"} onChange={e => f("condition", e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, cursor: "pointer" }}>
                {conditions.map(c => <option key={c} value={c} style={{ background: "#111318" }}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Batal</button>
          <button onClick={save} disabled={saving || !form.name || !form.purchasePrice}
            style={{ padding: "9px 20px", borderRadius: 9, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit3 icon ────────────────────────────────────────────────────────────────
function Edit3Icon({ size = 13 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ─── Tab Button ────────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px", borderRadius: 10, fontSize: 12, fontWeight: 700,
      cursor: "pointer", border: "none", fontFamily: FONT,
      background: active ? OR : "rgba(255,255,255,.05)",
      color: active ? "#fff" : "rgba(255,255,255,.45)",
      transition: "all .2s",
    }}>{label}</button>
  );
}

// ─── Print Period Picker — choose month or custom range before generating PDF ──
function PrintPeriodModal({ onClose, onConfirm }: {
  onClose: () => void;
  onConfirm: (range: { from: Date; to: Date; label: string }) => void;
}) {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "range">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const ipt: React.CSSProperties = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, width: "100%", boxSizing: "border-box" };
  const btnBase: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT, border: "none" };

  function getRange(): { from: Date; to: Date; label: string } {
    if (mode === "month") {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0, 23, 59, 59);
      return { from, to, label: `${MONTHS_ID[month]} ${year}` };
    }
    const from = new Date(startDate);
    const to = new Date(endDate);
    to.setHours(23, 59, 59);
    const label = `${from.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – ${to.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
    return { from, to, label };
  }

  const { label } = getRange();

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: 30, width: "100%", maxWidth: 440, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center", color: OR }}>
            <Printer size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0 }}>Cetak Laporan Keuangan</h3>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", margin: "2px 0 0" }}>Pilih periode arus kas yang ingin dicetak</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {(["month", "range"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: "8px 12px", borderRadius: 9, fontSize: 12, fontWeight: 700,
              cursor: "pointer", border: "none", fontFamily: FONT,
              background: mode === m ? OR : "rgba(255,255,255,.05)",
              color: mode === m ? "#fff" : "rgba(255,255,255,.45)",
            }}>
              {m === "month" ? "Per Bulan" : "Rentang Custom"}
            </button>
          ))}
        </div>

        {mode === "month" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10, marginBottom: 18 }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ ...ipt, cursor: "pointer" }}>
              {MONTHS_ID.map((m, i) => <option key={m} value={i} style={{ background: "#111318" }}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...ipt, cursor: "pointer" }}>
              {years.map(y => <option key={y} value={y} style={{ background: "#111318" }}>{y}</option>)}
            </select>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Dari</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={ipt} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Sampai</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={ipt} />
            </div>
          </div>
        )}

        <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 4px" }}>Periode terpilih</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: OR, margin: 0 }}>{label}</p>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...btnBase, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}>Batal</button>
          <button onClick={() => onConfirm(getRange())} style={{ ...btnBase, background: OR, color: "#fff" }}>
            <Printer size={14} /> Cetak PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function FinancePage() {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "income" | "expenses" | "assets">("overview");
  const [period, setPeriod] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);

  // Data state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);

  // Modal state
  const [incomeModal, setIncomeModal] = useState<IncomeEntry | null | "new">(null);
  const [eqModal, setEqModal] = useState<Equipment | null | "new">(null);
  const [printModal, setPrintModal] = useState(false);

  // ── Load Data ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, exp, inc, eq, sum] = await Promise.all([
        api("/api/invoices").catch(() => []),
        api("/api/expenses").catch(() => []),
        api("/api/income").catch(() => []),
        api("/api/equipment").catch(() => {
          // fallback to localStorage if endpoint doesn't exist yet
          const stored = localStorage.getItem("frameless_equipment");
          return stored ? JSON.parse(stored) : [];
        }),
        api("/api/finance/summary").catch(() => null),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []);
      setExpenses(Array.isArray(exp) ? exp : []);
      setIncomeEntries(Array.isArray(inc) ? inc : []);
      setEquipment(Array.isArray(eq) ? eq : []);
      setSummary(sum);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Calculations ────────────────────────────────────────────────────────────
  const yr = Number(period);

  // Revenue = paidAmount dari semua invoice (otomatis sync)
  const paidInvoices = invoices.filter(i =>
    i.status === "PAID" || Number(i.paidAmount) > 0
  );
  const invoiceRevenue = invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
  const manualIncome = incomeEntries.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalRevenue = invoiceRevenue + manualIncome;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";
  const unpaidAmount = invoices.reduce((s, i) => {
    if (i.status === "PAID") return s;
    return s + Math.max(0, Number(i.total || 0) - Number(i.paidAmount || 0));
  }, 0);

  // Monthly cashflow (filtered by period year)
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const cashFlow = MONTHS.map((m, mi) => {
    const invIncome = invoices
      .filter(i => {
        if (Number(i.paidAmount || 0) === 0) return false;
        const ref = i.paidAt ? new Date(i.paidAt) : i.updatedAt ? new Date(i.updatedAt) : i.createdAt ? new Date(i.createdAt) : null;
        return !!ref && ref.getMonth() === mi && ref.getFullYear() === yr;
      })
      .reduce((s, i) => s + Number(i.paidAmount || 0), 0);

    const manIncome = incomeEntries
      .filter(i => { const d = new Date(i.date); return d.getMonth() === mi && d.getFullYear() === yr; })
      .reduce((s, i) => s + Number(i.amount || 0), 0);

    const exp = expenses
      .filter(e => { const d = new Date(e.date); return d.getMonth() === mi && d.getFullYear() === yr; })
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    return { month: m, income: invIncome + manIncome, invoiceIncome: invIncome, manualIncome: manIncome, expenses: exp, net: (invIncome + manIncome) - exp };
  });

  // Expense by category
  const expCats = expenses.reduce((acc, e) => {
    acc[e.category || "Lainnya"] = (acc[e.category || "Lainnya"] || 0) + Number(e.amount || 0);
    return acc;
  }, {} as Record<string, number>);
  const expPieData = Object.entries(expCats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const PIE_COLORS = ["#FF6A20", "#7c3aed", "#2563eb", "#4ade80", "#fbbf24", "#f472b6", "#06b6d4", "#a78bfa"];

  // Income by category
  const incCats = [
    ...incomeEntries.map(i => ({ cat: i.category || "Manual", amt: Number(i.amount) })),
    ...invoices.filter(i => Number(i.paidAmount) > 0).map(i => ({ cat: "Invoice", amt: Number(i.paidAmount) })),
  ].reduce((acc, { cat, amt }) => { acc[cat] = (acc[cat] || 0) + amt; return acc; }, {} as Record<string, number>);
  const incPieData = Object.entries(incCats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Equipment
  function calcDep(eq: Equipment) {
    const age = eq.purchaseDate
      ? (Date.now() - new Date(eq.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
      : 0;
    const annualDep = eq.purchasePrice / (eq.depreciationYears || 5);
    const accumulated = Math.min(eq.purchasePrice, annualDep * age);
    const bookValue = Math.max(0, eq.purchasePrice - accumulated);
    const deprPct = Math.min(100, (accumulated / eq.purchasePrice) * 100);
    return { annualDep, accumulated, bookValue, deprPct };
  }
  const totalEquipValue = equipment.reduce((s, e) => s + e.purchasePrice, 0);
  const totalBookValue = equipment.reduce((s, e) => s + calcDep(e).bookValue, 0);
  const totalAnnualDepr = equipment.reduce((s, e) => s + calcDep(e).annualDep, 0);

  // ── CRUD: Income ────────────────────────────────────────────────────────────
  async function saveIncome(data: Partial<IncomeEntry>) {
    try {
      if (incomeModal && incomeModal !== "new") {
        await api(`/api/income/${(incomeModal as IncomeEntry).id}`, { method: "PUT", body: JSON.stringify(data) });
      } else {
        await api("/api/income", { method: "POST", body: JSON.stringify(data) });
      }
      setIncomeModal(null);
      toast({ title: "Pemasukan disimpan ✓" });
      await loadData();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  async function deleteIncome(id: string) {
    if (!confirm("Hapus pemasukan ini?")) return;
    try {
      await api(`/api/income/${id}`, { method: "DELETE" });
      toast({ title: "Dihapus" });
      await loadData();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  // ── CRUD: Equipment ─────────────────────────────────────────────────────────
  async function saveEquipment(data: Partial<Equipment>) {
    try {
      if (eqModal && eqModal !== "new") {
        await api(`/api/equipment/${(eqModal as Equipment).id}`, { method: "PUT", body: JSON.stringify(data) }).catch(() => {
          // fallback localStorage
          const updated = equipment.map(e => e.id === (eqModal as Equipment).id ? { ...e, ...data } : e);
          setEquipment(updated);
          localStorage.setItem("frameless_equipment", JSON.stringify(updated));
        });
      } else {
        await api("/api/equipment", { method: "POST", body: JSON.stringify(data) }).catch(() => {
          const newEq = { ...data, id: Date.now().toString(), purchaseDate: data.purchaseDate || new Date().toISOString().split("T")[0] } as Equipment;
          const updated = [...equipment, newEq];
          setEquipment(updated);
          localStorage.setItem("frameless_equipment", JSON.stringify(updated));
        });
      }
      setEqModal(null);
      toast({ title: "Aset disimpan ✓" });
      await loadData();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  async function deleteEquipment(id: string) {
    if (!confirm("Hapus aset ini?")) return;
    try {
      await api(`/api/equipment/${id}`, { method: "DELETE" }).catch(() => {
        const updated = equipment.filter(e => e.id !== id);
        setEquipment(updated);
        localStorage.setItem("frameless_equipment", JSON.stringify(updated));
      });
      toast({ title: "Dihapus" });
      await loadData();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  // ── PDF Print ────────────────────────────────────────────────────────────────
  function handlePrint(range: { from: Date; to: Date; label: string }) {
    const w = window.open("", "_blank", "width=960,height=720");
    if (!w) return;

    const { from, to, label } = range;

    // Filter every data source to the chosen range, independent of the `period` (year) selector —
    // this is what lets the report cover a single month or an arbitrary custom range instead of
    // always being locked to a full calendar year.
    //
    // Reference date fallback chain: paidAt (set when a payment is recorded) → updatedAt (set on
    // any edit, including a manual status change to PAID) → createdAt (last resort, for legacy
    // invoices that were marked PAID before paidAt/updatedAt were reliably populated). Without this
    // last fallback, invoices with missing payment timestamps disappear from period reports entirely
    // instead of at least showing up under the invoice's creation date.
    const rangeInvoicePayments = invoices.filter(i => {
      if (Number(i.paidAmount || 0) === 0) return false;
      const ref = i.paidAt ? new Date(i.paidAt) : i.updatedAt ? new Date(i.updatedAt) : i.createdAt ? new Date(i.createdAt) : null;
      return !!ref && ref >= from && ref <= to;
    });
    const rangeIncomeEntries = incomeEntries.filter(i => {
      const d = new Date(i.date);
      return d >= from && d <= to;
    });
    const rangeExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= from && d <= to;
    });

    const rangeInvoiceRevenue = rangeInvoicePayments.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
    const rangeManualIncome = rangeIncomeEntries.reduce((s, i) => s + Number(i.amount || 0), 0);
    const rangeTotalIncome = rangeInvoiceRevenue + rangeManualIncome;
    const rangeTotalExpenses = rangeExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const rangeNetProfit = rangeTotalIncome - rangeTotalExpenses;
    const rangeProfitMargin = rangeTotalIncome > 0 ? ((rangeNetProfit / rangeTotalIncome) * 100).toFixed(1) : "0.0";

    // Build a month-by-month breakdown spanning only the months touched by the range
    // (a single month picks one row; a multi-month custom range gets one row per month it crosses).
    const monthRows: { label: string; invIncome: number; manIncome: number; income: number; expenses: number; net: number }[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const rangeEndMonth = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= rangeEndMonth) {
      const mStart = new Date(Math.max(cursor.getTime(), from.getTime()));
      const mEnd = new Date(Math.min(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59).getTime(), to.getTime()));

      const invInc = invoices
        .filter(i => {
          if (Number(i.paidAmount || 0) === 0) return false;
          const ref = i.paidAt ? new Date(i.paidAt) : i.updatedAt ? new Date(i.updatedAt) : i.createdAt ? new Date(i.createdAt) : null;
          return !!ref && ref >= mStart && ref <= mEnd;
        })
        .reduce((s, i) => s + Number(i.paidAmount || 0), 0);

      const manInc = incomeEntries
        .filter(i => { const d = new Date(i.date); return d >= mStart && d <= mEnd; })
        .reduce((s, i) => s + Number(i.amount || 0), 0);

      const exp = expenses
        .filter(e => { const d = new Date(e.date); return d >= mStart && d <= mEnd; })
        .reduce((s, e) => s + Number(e.amount || 0), 0);

      monthRows.push({
        label: cursor.toLocaleDateString("id-ID", { month: "short", year: "numeric" }),
        invIncome: invInc, manIncome: manInc, income: invInc + manInc, expenses: exp, net: (invInc + manInc) - exp,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Expense-by-category and unpaid-invoice figures stay scoped to the range too,
    // so the printed breakdown matches the period in the title rather than all-time totals.
    const rangeExpCats = rangeExpenses.reduce((acc, e) => {
      acc[e.category || "Lainnya"] = (acc[e.category || "Lainnya"] || 0) + Number(e.amount || 0);
      return acc;
    }, {} as Record<string, number>);
    const rangeExpPieData = Object.entries(rangeExpCats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const rangeInvoicedAmount = invoices
      .filter(i => i.createdAt && new Date(i.createdAt) >= from && new Date(i.createdAt) <= to)
      .reduce((s, i) => s + Number(i.total || 0), 0);

    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Laporan Keuangan Frameless Creative — ${label}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; color: #1a1d2e; padding: 36px 40px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #FF6A20; }
  .logo-mark { font-size: 22px; font-weight: 900; color: #FF6A20; letter-spacing: -.02em; }
  .logo-sub { font-size: 11px; color: #888; margin-top: 3px; }
  .header-right { text-align: right; }
  .report-title { font-size: 22px; font-weight: 900; color: #1a1d2e; }
  .report-meta { font-size: 11px; color: #888; margin-top: 4px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { padding: 14px 16px; border-radius: 10px; background: #f9fafb; border: 1px solid #e5e7eb; }
  .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: #9ca3af; margin-bottom: 5px; }
  .kpi-value { font-size: 18px; font-weight: 900; }
  .kv-green { color: #16a34a; }
  .kv-red { color: #dc2626; }
  .kv-orange { color: #FF6A20; }
  .kv-blue { color: #2563eb; }
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  .section-title { font-size: 13px; font-weight: 800; color: #1a1d2e; margin-bottom: 10px; padding-bottom: 7px; border-bottom: 2px solid #f3f4f6; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; width: 4px; height: 16px; background: #FF6A20; border-radius: 2px; flex-shrink: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .pos { color: #16a34a; font-weight: 700; }
  .neg { color: #dc2626; font-weight: 700; }
  .or { color: #FF6A20; font-weight: 700; }
  .bold { font-weight: 800; }
  .total-row td { background: #fff7ed; font-weight: 800; border-top: 2px solid #FF6A20; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
  .badge-green { background: #dcfce7; color: #16a34a; }
  .badge-red { background: #fee2e2; color: #dc2626; }
  .badge-yellow { background: #fef9c3; color: #92400e; }
  .badge-gray { background: #f3f4f6; color: #6b7280; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  .progress-bar { height: 5px; border-radius: 100px; background: #f3f4f6; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 100px; }
  @media print { body { padding: 20px 24px; } .no-print { display: none !important; } }
</style></head><body>

<div class="header">
  <div>
    <div class="logo-mark">FRAMELESS™</div>
    <div class="logo-sub">Creative Production House · Wonosobo, Central Java</div>
    <div class="logo-sub" style="margin-top:2px;">framelesscreative.com</div>
  </div>
  <div class="header-right">
    <div class="report-title">Laporan Keuangan</div>
    <div class="report-meta">Periode: ${label}</div>
    <div class="report-meta">Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
    <div class="report-meta">Waktu: ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Pemasukan</div><div class="kpi-value kv-green">${formatCurrency(rangeTotalIncome)}</div></div>
  <div class="kpi"><div class="kpi-label">Total Pengeluaran</div><div class="kpi-value kv-red">${formatCurrency(rangeTotalExpenses)}</div></div>
  <div class="kpi"><div class="kpi-label">Laba Bersih</div><div class="kpi-value ${rangeNetProfit >= 0 ? "kv-green" : "kv-red"}">${formatCurrency(rangeNetProfit)}</div></div>
  <div class="kpi"><div class="kpi-label">Profit Margin</div><div class="kpi-value kv-orange">${rangeProfitMargin}%</div></div>
</div>

<div class="two-col" style="margin-bottom:28px;">
  <div class="kpi"><div class="kpi-label">Invoice Diterbitkan (periode ini)</div><div class="kpi-value kv-blue">${formatCurrency(rangeInvoicedAmount)}</div></div>
  <div class="kpi"><div class="kpi-label">Piutang Belum Lunas (saat ini)</div><div class="kpi-value kv-red">${formatCurrency(unpaidAmount)}</div></div>
</div>

<div class="section">
  <div class="section-title">Arus Kas · ${label}</div>
  <table>
    <thead><tr><th>Bulan</th><th>Pemasukan Invoice</th><th>Pemasukan Lain</th><th>Total Pemasukan</th><th>Pengeluaran</th><th>Arus Bersih</th></tr></thead>
    <tbody>
      ${monthRows.map(r => `<tr>
        <td class="bold">${r.label}</td>
        <td class="pos">${r.invIncome > 0 ? formatCurrency(r.invIncome) : "—"}</td>
        <td>${r.manIncome > 0 ? formatCurrency(r.manIncome) : "—"}</td>
        <td class="pos">${r.income > 0 ? formatCurrency(r.income) : "—"}</td>
        <td class="neg">${r.expenses > 0 ? formatCurrency(r.expenses) : "—"}</td>
        <td class="${r.net >= 0 ? "pos" : "neg"}">${(r.income > 0 || r.expenses > 0) ? formatCurrency(r.net) : "—"}</td>
      </tr>`).join("")}
      <tr class="total-row">
        <td>TOTAL ${label}</td>
        <td class="pos">${formatCurrency(rangeInvoiceRevenue)}</td>
        <td>${formatCurrency(rangeManualIncome)}</td>
        <td class="pos">${formatCurrency(rangeTotalIncome)}</td>
        <td class="neg">${formatCurrency(rangeTotalExpenses)}</td>
        <td class="${rangeNetProfit >= 0 ? "pos" : "neg"}">${formatCurrency(rangeNetProfit)}</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="two-col">
  <div class="section">
    <div class="section-title">Pemasukan dari Invoice · ${label}</div>
    <table>
      <thead><tr><th>No. Invoice</th><th>Klien</th><th>Dibayar</th><th>Status</th></tr></thead>
      <tbody>
        ${rangeInvoicePayments.slice(0, 20).map(i => `<tr>
          <td class="bold">${i.number}</td>
          <td>${(i as any).clientName || "—"}</td>
          <td class="pos">${formatCurrency(Number(i.paidAmount))}</td>
          <td><span class="badge ${i.status === "PAID" ? "badge-green" : "badge-yellow"}">${i.status}</span></td>
        </tr>`).join("") || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Tidak ada pembayaran pada periode ini</td></tr>'}
      </tbody>
    </table>
  </div>
  <div class="section">
    <div class="section-title">Pengeluaran per Kategori · ${label}</div>
    <table>
      <thead><tr><th>Kategori</th><th>Jumlah</th><th>%</th></tr></thead>
      <tbody>
        ${rangeExpPieData.map(r => `<tr>
          <td>${r.name}</td>
          <td class="neg">${formatCurrency(r.value)}</td>
          <td>${rangeTotalExpenses > 0 ? ((r.value / rangeTotalExpenses) * 100).toFixed(1) : "0"}%</td>
        </tr>`).join("") || '<tr><td colspan="3" style="text-align:center;color:#9ca3af;">Tidak ada pengeluaran pada periode ini</td></tr>'}
      </tbody>
    </table>
  </div>
</div>

${rangeIncomeEntries.length > 0 ? `<div class="section">
  <div class="section-title">Pemasukan Manual · ${label}</div>
  <table>
    <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Sumber</th><th>Jumlah</th></tr></thead>
    <tbody>
      ${rangeIncomeEntries.map(i => `<tr>
        <td>${new Date(i.date).toLocaleDateString("id-ID")}</td>
        <td>${i.description}</td>
        <td>${i.category || "—"}</td>
        <td>${i.source || "—"}</td>
        <td class="pos">${formatCurrency(Number(i.amount))}</td>
      </tr>`).join("")}
      <tr class="total-row"><td colspan="4">Total Pemasukan Manual</td><td class="pos">${formatCurrency(rangeManualIncome)}</td></tr>
    </tbody>
  </table>
</div>` : ""}

${rangeExpenses.length > 0 ? `<div class="section">
  <div class="section-title">Rincian Transaksi Pengeluaran · ${label} (${rangeExpenses.length} item)</div>
  <table>
    <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Jumlah</th></tr></thead>
    <tbody>
      ${[...rangeExpenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(e => `<tr>
        <td>${new Date(e.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
        <td class="bold">${e.description}</td>
        <td>${e.category}</td>
        <td class="neg">${formatCurrency(Number(e.amount))}</td>
      </tr>`).join("")}
      <tr class="total-row"><td colspan="3">TOTAL ${rangeExpenses.length} TRANSAKSI</td><td class="neg">${formatCurrency(rangeTotalExpenses)}</td></tr>
    </tbody>
  </table>
</div>` : ""}

${equipment.length > 0 ? `<div class="section">
  <div class="section-title">Inventaris & Depresiasi Aset (kondisi saat ini)</div>
  <table>
    <thead><tr><th>Nama Alat</th><th>Kategori</th><th>S/N</th><th>Kondisi</th><th>Harga Beli</th><th>Dep/Tahun</th><th>Akumulasi Dep.</th><th>Nilai Buku</th></tr></thead>
    <tbody>
      ${equipment.map(eq => { const d = calcDep(eq); return `<tr>
        <td class="bold">${eq.name}</td>
        <td>${eq.category || "—"}</td>
        <td style="color:#9ca3af;font-size:10px;">${eq.serialNumber || "—"}</td>
        <td><span class="badge ${eq.condition === "Baru" || eq.condition === "Baik" ? "badge-green" : eq.condition === "Perlu Service" ? "badge-yellow" : "badge-red"}">${eq.condition || "—"}</span></td>
        <td>${formatCurrency(eq.purchasePrice)}</td>
        <td class="neg">${formatCurrency(d.annualDep)}</td>
        <td class="neg">${formatCurrency(d.accumulated)}</td>
        <td class="${d.bookValue > 0 ? "or" : "neg"}">${formatCurrency(d.bookValue)}</td>
      </tr>`; }).join("")}
      <tr class="total-row">
        <td colspan="4">TOTAL ASET (${equipment.length} item)</td>
        <td>${formatCurrency(totalEquipValue)}</td>
        <td class="neg">${formatCurrency(totalAnnualDepr)}</td>
        <td></td>
        <td class="or">${formatCurrency(totalBookValue)}</td>
      </tr>
    </tbody>
  </table>
</div>` : ""}

<div class="footer">
  <span>Frameless Creative Production House · Wonosobo, Central Java · framelesscreative.com</span>
  <span>Dokumen dibuat otomatis oleh sistem manajemen Frameless Creative</span>
</div>

</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 600);
  }

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  const ipt: React.CSSProperties = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT };
  const btnBase: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT, border: "none" };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${OR}`, borderTopColor: "transparent", animation: "spin .7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  return (
    <div ref={printRef} style={{ fontFamily: FONT, color: "#f0f0f0", paddingBottom: 60 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", margin: "0 0 4px" }}>Keuangan</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 600 }}>Finance & Accounting · Frameless Creative</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ ...ipt, cursor: "pointer" }}>
            {years.map(y => <option key={y} value={y} style={{ background: "#111318" }}>{y}</option>)}
          </select>
          <button onClick={loadData} title="Refresh" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><RefreshCw size={14} /></button>
          <button onClick={() => setPrintModal(true)} style={{ ...btnBase, background: OR, color: "#fff" }}><Printer size={14} /> Cetak PDF</button>
        </div>
      </div>

      {/* ── KPI Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total Pemasukan" value={formatCurrency(totalRevenue)} icon={<TrendingUp size={16} />} color="#4ade80" sub={`Invoice: ${formatCurrency(invoiceRevenue)}`} />
        <StatCard label="Total Pengeluaran" value={formatCurrency(totalExpenses)} icon={<TrendingDown size={16} />} color="#f87171" sub={`${expenses.length} transaksi`} />
        <StatCard label="Laba Bersih" value={formatCurrency(netProfit)} icon={<DollarSign size={16} />} color={netProfit >= 0 ? "#4ade80" : "#f87171"} sub={netProfit >= 0 ? "Untung 🎉" : "Rugi ⚠️"} />
        <StatCard label="Profit Margin" value={`${profitMargin}%`} icon={<BarChart2 size={16} />} color={Number(profitMargin) >= 30 ? "#4ade80" : Number(profitMargin) >= 10 ? "#fbbf24" : "#f87171"} sub="Margin bersih" />
        <StatCard label="Piutang Belum Lunas" value={formatCurrency(unpaidAmount)} icon={<Receipt size={16} />} color="#fbbf24" sub={`${invoices.filter(i => i.status !== "PAID" && Number(i.paidAmount) < Number(i.total)).length} invoice pending`} />
        <StatCard label="Nilai Buku Aset" value={formatCurrency(totalBookValue)} icon={<Package size={16} />} color={OR} sub={`${equipment.length} item · dep ${formatCurrency(totalAnnualDepr)}/thn`} />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap" }}>
        {(["overview", "income", "expenses", "assets"] as const).map(tab => (
          <TabBtn key={tab} label={{ overview: "📊 Overview", income: "💰 Pemasukan", expenses: "💸 Pengeluaran", assets: "📦 Inventaris Aset" }[tab]} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: OVERVIEW
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <>
          {/* Cash Flow Chart */}
          <Section title={`Arus Kas ${period}`} icon={<BarChart2 size={14} />}>
            <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: "22px" }}>
              <div style={{ height: 270 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashFlow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} /><stop offset="95%" stopColor="#4ade80" stopOpacity={0} /></linearGradient>
                      <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.25} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,.3)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,.3)" fontSize={11} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,.5)" }} />
                    <Area type="monotone" dataKey="income" name="Pemasukan" stroke="#4ade80" strokeWidth={2} fill="url(#gi)" />
                    <Area type="monotone" dataKey="expenses" name="Pengeluaran" stroke="#f87171" strokeWidth={2} fill="url(#ge)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Monthly table */}
              <div style={{ marginTop: 20, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Bulan", "Pemasukan", "Pengeluaran", "Arus Bersih"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.3)", borderBottom: "1px solid rgba(255,255,255,.07)" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {cashFlow.map(r => (
                      <tr key={r.month} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                        <td style={{ padding: "8px 10px", color: "rgba(255,255,255,.6)", fontWeight: 600 }}>{r.month}</td>
                        <td style={{ padding: "8px 10px", color: "#4ade80", fontWeight: 700 }}>{r.income > 0 ? formatCurrency(r.income) : "—"}</td>
                        <td style={{ padding: "8px 10px", color: "#f87171", fontWeight: 700 }}>{r.expenses > 0 ? formatCurrency(r.expenses) : "—"}</td>
                        <td style={{ padding: "8px 10px", color: r.net >= 0 ? "#4ade80" : "#f87171", fontWeight: 800 }}>{(r.income > 0 || r.expenses > 0) ? formatCurrency(r.net) : "—"}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${OR}`, background: `${OR}08` }}>
                      <td style={{ padding: "10px 10px", color: "#fff", fontWeight: 800 }}>TOTAL {period}</td>
                      <td style={{ padding: "10px 10px", color: "#4ade80", fontWeight: 900 }}>{formatCurrency(totalRevenue)}</td>
                      <td style={{ padding: "10px 10px", color: "#f87171", fontWeight: 900 }}>{formatCurrency(totalExpenses)}</td>
                      <td style={{ padding: "10px 10px", color: netProfit >= 0 ? "#4ade80" : "#f87171", fontWeight: 900 }}>{formatCurrency(netProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Laba Rugi + Distribusi */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
            {/* Expense Pie */}
            <Section title="Distribusi Pengeluaran" icon={<Filter size={14} />}>
              <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: 20 }}>
                {expPieData.length > 0 ? (
                  <>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                            {expPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {expPieData.map((d, i) => (
                        <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 9, height: 9, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{d.name}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>{formatCurrency(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13, textAlign: "center", padding: 32 }}>Belum ada data pengeluaran.</p>}
              </div>
            </Section>

            {/* P&L Summary */}
            <Section title="Ringkasan Laba Rugi" icon={<DollarSign size={14} />}>
              <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.15)" }}>
                    <p style={{ fontSize: 10, color: "rgba(74,222,128,.7)", fontWeight: 700, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".1em" }}>Total Pemasukan</p>
                    <p style={{ fontSize: 22, fontWeight: 900, color: "#4ade80", margin: 0 }}>{formatCurrency(totalRevenue)}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,.3)", margin: "3px 0 0" }}>Invoice: {formatCurrency(invoiceRevenue)} · Manual: {formatCurrency(manualIncome)}</p>
                  </div>
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.15)" }}>
                    <p style={{ fontSize: 10, color: "rgba(248,113,113,.7)", fontWeight: 700, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".1em" }}>Total Pengeluaran</p>
                    <p style={{ fontSize: 22, fontWeight: 900, color: "#f87171", margin: 0 }}>{formatCurrency(totalExpenses)}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,.3)", margin: "3px 0 0" }}>{expenses.length} transaksi · {expPieData.length} kategori</p>
                  </div>
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: `${netProfit >= 0 ? "rgba(74,222,128,.06)" : "rgba(248,113,113,.06)"}`, border: `1px solid ${netProfit >= 0 ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)"}` }}>
                    <p style={{ fontSize: 10, color: `${netProfit >= 0 ? "rgba(74,222,128,.7)" : "rgba(248,113,113,.7)"}`, fontWeight: 700, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".1em" }}>{netProfit >= 0 ? "Net Profit" : "Net Loss"}</p>
                    <p style={{ fontSize: 26, fontWeight: 900, color: netProfit >= 0 ? "#4ade80" : "#f87171", margin: 0 }}>{formatCurrency(Math.abs(netProfit))}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", margin: "4px 0 0" }}>Margin: {profitMargin}%</p>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: PEMASUKAN
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "income" && (
        <>
          {/* Invoice Revenue (otomatis) */}
          <Section title="Pemasukan dari Invoice (Otomatis)" icon={<Receipt size={14} />}>
            <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(74,222,128,.1)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", margin: 0 }}>Semua pembayaran invoice otomatis tercatat sebagai pemasukan</p>
                <span style={{ fontSize: 13, fontWeight: 900, color: "#4ade80" }}>{formatCurrency(invoiceRevenue)}</span>
              </div>
              {invoices.filter(i => Number(i.paidAmount) > 0).length === 0 ? (
                <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13, textAlign: "center", padding: "32px 16px" }}>Belum ada invoice yang dibayar.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>{["No. Invoice", "Klien", "Total Invoice", "Sudah Dibayar", "Sisa", "Status"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)", borderBottom: "1px solid rgba(255,255,255,.07)" }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {invoices.filter(i => Number(i.paidAmount) > 0).map(inv => {
                        const remaining = Math.max(0, Number(inv.total) - Number(inv.paidAmount));
                        return (
                          <tr key={inv.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 700, color: "#fff" }}>{inv.number}</td>
                            <td style={{ padding: "10px 14px", color: "rgba(255,255,255,.6)" }}>{(inv as any).clientName || "—"}</td>
                            <td style={{ padding: "10px 14px", color: "rgba(255,255,255,.7)" }}>{formatCurrency(Number(inv.total))}</td>
                            <td style={{ padding: "10px 14px", color: "#4ade80", fontWeight: 700 }}>{formatCurrency(Number(inv.paidAmount))}</td>
                            <td style={{ padding: "10px 14px", color: remaining > 0 ? "#fbbf24" : "#4ade80", fontWeight: 600 }}>{remaining > 0 ? formatCurrency(remaining) : "✓ Lunas"}</td>
                            <td style={{ padding: "10px 14px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: inv.status === "PAID" ? "rgba(74,222,128,.15)" : "rgba(251,191,36,.15)", color: inv.status === "PAID" ? "#4ade80" : "#fbbf24" }}>{inv.status}</span>
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

          {/* Manual Income */}
          <Section title="Pemasukan Manual" icon={<Wallet size={14} />}
            action={<button onClick={() => setIncomeModal("new")} style={{ ...btnBase, background: OR, color: "#fff" }}><Plus size={13} /> Tambah</button>}>
            <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" }}>
              {incomeEntries.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center" }}>
                  <Wallet size={36} color="rgba(255,255,255,.1)" style={{ margin: "0 auto 12px" }} />
                  <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13 }}>Belum ada pemasukan manual. Gunakan ini untuk mencatat pendapatan di luar invoice.</p>
                  <button onClick={() => setIncomeModal("new")} style={{ ...btnBase, background: OR, color: "#fff", margin: "16px auto 0" }}><Plus size={13} /> Tambah Pemasukan</button>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>{["Tanggal", "Keterangan", "Kategori", "Sumber", "Jumlah", ""].map(h => (
                        <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)", borderBottom: "1px solid rgba(255,255,255,.07)" }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {incomeEntries.map(inc => (
                        <tr key={inc.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                          <td style={{ padding: "10px 14px", color: "rgba(255,255,255,.5)" }}>{new Date(inc.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td style={{ padding: "10px 14px", color: "#fff", fontWeight: 600 }}>{inc.description}</td>
                          <td style={{ padding: "10px 14px", color: "rgba(255,255,255,.5)" }}>{inc.category || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "rgba(255,255,255,.5)" }}>{inc.source || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#4ade80", fontWeight: 700 }}>{formatCurrency(Number(inc.amount))}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => setIncomeModal(inc)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit3Icon /></button>
                              <button onClick={() => deleteIncome(inc.id)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(248,113,113,.1)", border: "none", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={11} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: `2px solid ${OR}`, background: `${OR}08` }}>
                        <td colSpan={4} style={{ padding: "10px 14px", color: "#fff", fontWeight: 800 }}>Total Pemasukan Manual</td>
                        <td style={{ padding: "10px 14px", color: "#4ade80", fontWeight: 900 }}>{formatCurrency(manualIncome)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Section>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: PENGELUARAN
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "expenses" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(248,113,113,.7)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 5px" }}>Total Pengeluaran</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#f87171", margin: 0 }}>{formatCurrency(totalExpenses)}</p>
            </div>
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 5px" }}>Jumlah Transaksi</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: 0 }}>{expenses.length}</p>
            </div>
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 5px" }}>Rata-rata per Transaksi</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: 0 }}>{formatCurrency(expenses.length > 0 ? totalExpenses / expenses.length : 0)}</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Chart */}
            <Section title="Per Kategori" icon={<Filter size={14} />}>
              <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: 20 }}>
                {expPieData.length > 0 ? (
                  <>
                    <div style={{ height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expPieData} layout="vertical" margin={{ left: 0, right: 10 }}>
                          <XAxis type="number" stroke="rgba(255,255,255,.2)" fontSize={10} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,.3)" fontSize={10} tickLine={false} axisLine={false} width={80} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="value" name="Jumlah" radius={[0, 6, 6, 0]}>
                            {expPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                      {expPieData.map((d, i) => (
                        <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 9, height: 9, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{d.name}</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>{totalExpenses > 0 ? ((d.value / totalExpenses) * 100).toFixed(1) : 0}%</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>{formatCurrency(d.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13, textAlign: "center", padding: 32 }}>Belum ada data.</p>}
              </div>
            </Section>

            {/* Expense list */}
            <Section title="Semua Pengeluaran" icon={<TrendingDown size={14} />}
              action={<a href="/expenses" style={{ ...btnBase, background: OR, color: "#fff", textDecoration: "none" }}><Plus size={13} /> Kelola</a>}>
              <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" }}>
                {expenses.slice(0, 8).map(e => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{e.description}</p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,.4)", margin: "2px 0 0" }}>{e.category} · {e.date ? new Date(e.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "—"}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{formatCurrency(Number(e.amount))}</span>
                  </div>
                ))}
                {expenses.length > 8 && (
                  <div style={{ padding: "10px 16px", textAlign: "center" }}>
                    <a href="/expenses" style={{ fontSize: 12, color: OR, fontWeight: 700, textDecoration: "none" }}>Lihat semua {expenses.length} transaksi →</a>
                  </div>
                )}
                {expenses.length === 0 && (
                  <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13, textAlign: "center", padding: "32px 16px" }}>Belum ada pengeluaran.</p>
                )}
              </div>
            </Section>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: INVENTARIS ASET
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "assets" && (
        <Section title="Inventaris & Depresiasi Aset" icon={<Package size={14} />}
          action={<button onClick={() => setEqModal("new")} style={{ ...btnBase, background: OR, color: "#fff" }}><Plus size={13} /> Tambah Aset</button>}>
          <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" }}>
            {/* Summary bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              {[
                { l: "Total Nilai Beli", v: formatCurrency(totalEquipValue), c: "rgba(255,255,255,.8)" },
                { l: "Total Nilai Buku", v: formatCurrency(totalBookValue), c: OR },
                { l: "Dep. Tahunan", v: formatCurrency(totalAnnualDepr), c: "#fbbf24" },
                { l: "Jumlah Aset", v: `${equipment.length} item`, c: "rgba(255,255,255,.7)" },
              ].map((s, i) => (
                <div key={s.l} style={{ padding: "16px 20px", borderRight: i < 3 ? "1px solid rgba(255,255,255,.07)" : "none" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 5px" }}>{s.l}</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: s.c, margin: 0 }}>{s.v}</p>
                </div>
              ))}
            </div>
            {equipment.length === 0 ? (
              <div style={{ padding: 56, textAlign: "center" }}>
                <Package size={40} color="rgba(255,255,255,.08)" style={{ margin: "0 auto 14px" }} />
                <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13, marginBottom: 16 }}>Belum ada aset terdaftar. Daftarkan peralatan produksi untuk menghitung depresiasi.</p>
                <button onClick={() => setEqModal("new")} style={{ ...btnBase, background: OR, color: "#fff", margin: "0 auto" }}><Plus size={13} /> Tambah Aset Pertama</button>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Nama Alat", "Kategori", "S/N", "Kondisi", "Harga Beli", "Dep/Thn", "Akumulasi", "Nilai Buku", "Dep%", ""].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)", borderBottom: "1px solid rgba(255,255,255,.07)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {equipment.map(eq => {
                      const d = calcDep(eq);
                      const condColor = eq.condition === "Baru" || eq.condition === "Baik" ? "#4ade80" : eq.condition === "Perlu Service" ? "#fbbf24" : "#f87171";
                      return (
                        <tr key={eq.id} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                          <td style={{ padding: "11px 12px" }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{eq.name}</p>
                            {eq.notes && <p style={{ fontSize: 9, color: "rgba(255,255,255,.35)", margin: "2px 0 0" }}>{eq.notes}</p>}
                          </td>
                          <td style={{ padding: "11px 12px", color: "rgba(255,255,255,.5)", fontSize: 11 }}>{eq.category || "—"}</td>
                          <td style={{ padding: "11px 12px", color: "rgba(255,255,255,.35)", fontSize: 10 }}>{eq.serialNumber || "—"}</td>
                          <td style={{ padding: "11px 12px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: `${condColor}18`, color: condColor }}>{eq.condition || "—"}</span>
                          </td>
                          <td style={{ padding: "11px 12px", color: "rgba(255,255,255,.7)", fontWeight: 600 }}>{formatCurrency(eq.purchasePrice)}</td>
                          <td style={{ padding: "11px 12px", color: "#fbbf24", fontWeight: 600 }}>{formatCurrency(d.annualDep)}</td>
                          <td style={{ padding: "11px 12px", color: "#f87171", fontWeight: 600 }}>{formatCurrency(d.accumulated)}</td>
                          <td style={{ padding: "11px 12px", color: d.bookValue > 0 ? OR : "rgba(255,255,255,.3)", fontWeight: 700 }}>{formatCurrency(d.bookValue)}</td>
                          <td style={{ padding: "11px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 44, height: 4, borderRadius: 100, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${d.deprPct}%`, background: d.deprPct > 80 ? "#f87171" : d.deprPct > 50 ? "#fbbf24" : OR, borderRadius: 100 }} />
                              </div>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)", fontWeight: 600 }}>{d.deprPct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "11px 12px" }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => setEqModal(eq)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit3Icon /></button>
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
      )}

      {/* ── Modals ── */}
      {incomeModal && (
        <IncomeModal
          item={incomeModal === "new" ? null : incomeModal as IncomeEntry}
          onClose={() => setIncomeModal(null)}
          onSave={saveIncome}
        />
      )}
      {eqModal && (
        <EquipmentModal
          item={eqModal === "new" ? null : eqModal as Equipment}
          onClose={() => setEqModal(null)}
          onSave={saveEquipment}
        />
      )}
      {printModal && (
        <PrintPeriodModal
          onClose={() => setPrintModal(false)}
          onConfirm={(range) => {
            setPrintModal(false);
            handlePrint(range);
          }}
        />
      )}
    </div>
  );
}