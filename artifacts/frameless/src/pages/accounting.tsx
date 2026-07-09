// artifacts/frameless/src/pages/accounting.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import {
  BookOpen, Plus, X, Check, RefreshCw, ChevronDown,
  ChevronRight, TrendingUp, TrendingDown, DollarSign,
  BarChart2, AlertCircle, Printer, FileText, Layers,
  ArrowUpRight, ArrowDownRight, Scale, ListOrdered,
  Search, Eye, Trash2, CheckCircle2, Settings,
} from "lucide-react";

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

// ── Responsive hook ────────────────────────────────────────────────────────────
function useIsMobile(bp = 640) {
  const [v, setV] = useState(() => typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const h = (e: MediaQueryListEvent) => setV(e.matches);
    setV(mq.matches); mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [bp]);
  return v;
}

// ── API ────────────────────────────────────────────────────────────────────────
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
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Request gagal"); }
  return r.json();
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Account {
  id: string; code: string; name: string; type: string;
  subType: string | null; normalBalance: string;
  description: string | null; isActive: boolean; isSystem: boolean;
}

interface JournalLine {
  id?: string; accountCode: string; accountName?: string;
  description?: string; debit: number; credit: number;
}

interface JournalEntry {
  id: string; date: string; refNumber: string; type: string;
  description: string; status: string; totalDebit: number;
  totalCredit: number; sourceType?: string; lines?: JournalLine[];
}

interface LedgerRow {
  accountCode: string; accountName: string; accountType: string;
  normalBalance: string; totalDebit: number; totalCredit: number; balance: number;
}

interface TrialBalance {
  items: { code: string; name: string; type: string; subType: string; normalBalance: string; totalDebit: number; totalCredit: number; balance: number }[];
  grandDebit: number; grandCredit: number; isBalanced: boolean;
}

interface FinancialStatements {
  incomeStatement: {
    revenues: { code: string; name: string; balance: number }[];
    expenses: { code: string; name: string; balance: number }[];
    totalRevenue: number; totalExpenses: number; netIncome: number; grossMargin: number;
  };
  balanceSheet: {
    assets: { code: string; name: string; subType: string; balance: number }[];
    liabilities: { code: string; name: string; subType: string; balance: number }[];
    equity: { code: string; name: string; subType: string; balance: number }[];
    totalAssets: number; totalLiabilities: number; totalEquity: number; isBalanced: boolean;
  };
}

// ── Shared style helpers ───────────────────────────────────────────────────────
const ipt: React.CSSProperties = {
  background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10, padding: "8px 12px", color: "#fff", fontSize: 13,
  outline: "none", fontFamily: FONT, width: "100%", boxSizing: "border-box",
};
const btnBase: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
  borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
  fontFamily: FONT, border: "none",
};

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ASSET:       { bg: "rgba(37,99,235,.15)", color: "#60a5fa", label: "Aset" },
  LIABILITY:   { bg: "rgba(239,68,68,.15)",  color: "#f87171", label: "Kewajiban" },
  EQUITY:      { bg: "rgba(168,85,247,.15)", color: "#c084fc", label: "Modal" },
  REVENUE:     { bg: "rgba(74,222,128,.15)", color: "#4ade80", label: "Pendapatan" },
  EXPENSE:     { bg: "rgba(251,146,60,.15)", color: "#fb923c", label: "Beban" },
};

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

// ── Loading skeleton ───────────────────────────────────────────────────────────
function Skel({ h = 40, w = "100%" }: { h?: number; w?: string }) {
  return <div style={{ height: h, width: w, borderRadius: 8, background: "rgba(255,255,255,.05)", animation: "pulse 1.5s ease-in-out infinite" }} />;
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,.025)", borderRadius: 18,
      border: "1px solid rgba(255,255,255,.07)", overflow: "hidden", ...style,
    }}>
      {children}
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────
function Tab({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
      borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
      fontFamily: FONT, border: "none", whiteSpace: "nowrap",
      background: active ? OR : "rgba(255,255,255,.05)",
      color: active ? "#fff" : "rgba(255,255,255,.45)",
      transition: "all .2s",
    }}>
      {icon} {label}
    </button>
  );
}

// ── Journal Entry Modal ────────────────────────────────────────────────────────
function JournalModal({ accounts, onClose, onSave }: {
  accounts: Account[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [type, setType] = useState("GENERAL");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([
    { accountCode: "", description: "", debit: 0, credit: 0 },
    { accountCode: "", description: "", debit: 0, credit: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  function updateLine(i: number, patch: Partial<JournalLine>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLine() {
    setLines(prev => [...prev, { accountCode: "", description: "", debit: 0, credit: 0 }]);
  }
  function removeLine(i: number) {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!description || !isBalanced) return;
    setSaving(true);
    try {
      await onSave({ date, type, description, notes, lines: lines.filter(l => l.accountCode && (l.debit > 0 || l.credit > 0)) });
    } finally { setSaving(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: 28, width: "100%", maxWidth: 780, maxHeight: "94vh", display: "flex", flexDirection: "column", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center", color: OR }}><ListOrdered size={16} /></div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0 }}>Jurnal Umum Baru</h3>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", margin: "2px 0 0" }}>Catat transaksi debit dan kredit secara berpasangan</p>
          </div>
        </div>

        {/* Header fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 5 }}>Tanggal *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={ipt} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 5 }}>Tipe</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...ipt, cursor: "pointer" }}>
              {["GENERAL","ADJUSTMENT","DEPRECIATION"].map(t => <option key={t} value={t} style={{ background: "#111318" }}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 5 }}>Keterangan *</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="mis. Pembayaran honorarium editor" style={ipt} />
          </div>
        </div>

        {/* Lines table */}
        <div style={{ flex: 1, overflowY: "auto", marginBottom: 14 }}>
          {/* Column header */}
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 130px 130px 32px", gap: 8, padding: "0 6px", marginBottom: 6 }}>
            {["Kode Akun", "Keterangan Baris", "Debit (Rp)", "Kredit (Rp)", ""].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)" }}>{h}</span>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lines.map((line, idx) => {
              const acct = accounts.find(a => a.code === line.accountCode);
              return (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "180px 1fr 130px 130px 32px", gap: 8, padding: "8px 6px", borderRadius: 10, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)", alignItems: "center" }}>
                  <div>
                    <select value={line.accountCode} onChange={e => updateLine(idx, { accountCode: e.target.value })}
                      style={{ ...ipt, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}>
                      <option value="" style={{ background: "#111318" }}>— Pilih Akun —</option>
                      {["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"].map(t => (
                        <optgroup key={t} label={TYPE_BADGE[t]?.label || t}>
                          {accounts.filter(a => a.type === t).map(a => (
                            <option key={a.code} value={a.code} style={{ background: "#111318" }}>{a.code} — {a.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {acct && <p style={{ fontSize: 9, color: "rgba(255,255,255,.35)", margin: "3px 0 0 4px" }}>{acct.name}</p>}
                  </div>
                  <input value={line.description || ""} onChange={e => updateLine(idx, { description: e.target.value })}
                    placeholder="Keterangan (opsional)" style={{ ...ipt, padding: "6px 10px", fontSize: 12 }} />
                  <input type="number" value={line.debit || ""} onChange={e => updateLine(idx, { debit: Number(e.target.value), credit: 0 })}
                    placeholder="0" style={{ ...ipt, padding: "6px 10px", fontSize: 12, color: "#4ade80" }} />
                  <input type="number" value={line.credit || ""} onChange={e => updateLine(idx, { credit: Number(e.target.value), debit: 0 })}
                    placeholder="0" style={{ ...ipt, padding: "6px 10px", fontSize: 12, color: "#f87171" }} />
                  <button onClick={() => removeLine(idx)} disabled={lines.length <= 2}
                    style={{ width: 28, height: 28, borderRadius: 7, background: lines.length <= 2 ? "transparent" : "rgba(248,113,113,.1)", border: "none", cursor: lines.length <= 2 ? "not-allowed" : "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", opacity: lines.length <= 2 ? 0.2 : 1 }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}

            <button onClick={addLine} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 9, borderRadius: 10, border: "1.5px dashed rgba(255,255,255,.15)", background: "rgba(255,255,255,.02)", color: "rgba(255,255,255,.45)", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
              <Plus size={13} /> Tambah Baris
            </button>
          </div>
        </div>

        <style>{`@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}`}</style>

        {/* Footer: balance check + actions */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 14, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 2px" }}>Total Debit</p>
                <p style={{ fontSize: 16, fontWeight: 900, color: "#4ade80", margin: 0 }}>{formatCurrency(totalDebit)}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 2px" }}>Total Kredit</p>
                <p style={{ fontSize: 16, fontWeight: 900, color: "#f87171", margin: 0 }}>{formatCurrency(totalCredit)}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: isBalanced ? "rgba(74,222,128,.1)" : "rgba(248,113,113,.1)" }}>
                {isBalanced ? <CheckCircle2 size={14} color="#4ade80" /> : <AlertCircle size={14} color="#f87171" />}
                <span style={{ fontSize: 12, fontWeight: 700, color: isBalanced ? "#4ade80" : "#f87171" }}>
                  {isBalanced ? "Seimbang ✓" : `Selisih ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ ...btnBase, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}>Batal</button>
              <button onClick={save} disabled={saving || !isBalanced || !description}
                style={{ ...btnBase, background: OR, color: "#fff", opacity: saving || !isBalanced || !description ? 0.4 : 1 }}>
                {saving ? "Menyimpan..." : <><Check size={14} /> Posting Jurnal</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal for Journal Entry ────────────────────────────────────────────
function JournalDetailModal({ entry, onClose, onVoid }: {
  entry: JournalEntry; onClose: () => void; onVoid: (id: string) => Promise<void>;
}) {
  const [voiding, setVoiding] = useState(false);
  async function handleVoid() {
    if (!confirm("Void jurnal ini? Transaksi tidak akan terhapus tapi tidak akan dihitung dalam laporan.")) return;
    setVoiding(true);
    try { await onVoid(entry.id); onClose(); } finally { setVoiding(false); }
  }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: 28, width: "100%", maxWidth: 620, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{entry.refNumber}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: entry.status === "POSTED" ? "rgba(74,222,128,.15)" : entry.status === "VOID" ? "rgba(248,113,113,.15)" : "rgba(255,255,255,.08)", color: entry.status === "POSTED" ? "#4ade80" : entry.status === "VOID" ? "#f87171" : "#fff" }}>{entry.status}</span>
          </div>
          <p style={{ fontSize: 14, color: "#fff", margin: "0 0 4px", fontWeight: 600 }}>{entry.description}</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", margin: 0 }}>{new Date(entry.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 20 }}>
          <thead>
            <tr>
              {["Akun", "Keterangan", "Debit", "Kredit"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: h === "Debit" || h === "Kredit" ? "right" : "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)", borderBottom: "1px solid rgba(255,255,255,.07)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(entry.lines || []).map((line, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                <td style={{ padding: "9px 10px" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>{line.accountCode}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,.4)", margin: "1px 0 0" }}>{line.accountName}</p>
                </td>
                <td style={{ padding: "9px 10px", fontSize: 12, color: "rgba(255,255,255,.6)" }}>{line.description || "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: line.debit > 0 ? "#4ade80" : "rgba(255,255,255,.2)", fontSize: 13 }}>{line.debit > 0 ? formatCurrency(line.debit) : "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: line.credit > 0 ? "#f87171" : "rgba(255,255,255,.2)", fontSize: 13 }}>{line.credit > 0 ? formatCurrency(line.credit) : "—"}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${OR}`, background: `${OR}08` }}>
              <td colSpan={2} style={{ padding: "9px 10px", fontWeight: 800, color: "#fff", fontSize: 12 }}>TOTAL</td>
              <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 900, color: "#4ade80", fontSize: 13 }}>{formatCurrency(entry.totalDebit)}</td>
              <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 900, color: "#f87171", fontSize: 13 }}>{formatCurrency(entry.totalCredit)}</td>
            </tr>
          </tbody>
        </table>

        {entry.status !== "VOID" && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ ...btnBase, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}>Tutup</button>
            <button onClick={handleVoid} disabled={voiding || !!entry.sourceType}
              title={entry.sourceType ? "Jurnal otomatis tidak dapat divoid manual" : ""}
              style={{ ...btnBase, background: "rgba(248,113,113,.12)", color: "#f87171", border: "1px solid rgba(248,113,113,.2)", opacity: voiding || !!entry.sourceType ? 0.4 : 1 }}>
              <Trash2 size={13} /> {voiding ? "Memvoid..." : "Void Jurnal"}
            </button>
          </div>
        )}
        {entry.status === "VOID" && (
          <div style={{ textAlign: "right" }}>
            <button onClick={onClose} style={{ ...btnBase, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}>Tutup</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
// ── MappingSelect — inline account picker for the mapping table ───────────────
function MappingSelect({ value, accounts, onChange, color }: {
  value: string; accounts: Account[];
  onChange: (code: string) => Promise<void>; color: string;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        disabled={saving}
        onChange={async e => {
          setSaving(true);
          try { await onChange(e.target.value); } finally { setSaving(false); }
        }}
        style={{
          width: "100%", background: "rgba(255,255,255,.04)",
          border: `1px solid ${color}30`, borderRadius: 8,
          padding: "4px 8px", color, fontSize: 12, fontWeight: 700,
          outline: "none", cursor: "pointer", fontFamily: FONT,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {accounts.map(a => (
          <option key={a.code} value={a.code} style={{ background: "#111318", color: "#fff" }}>
            {a.code} — {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AccountingPage() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const printRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"accounts"|"journal"|"ledger"|"trial"|"statements"|"settings">("journal");
  const [loading, setLoading] = useState(true);
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [periodTo, setPeriodTo] = useState(() => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    return d.toISOString().split("T")[0];
  });

  const [accounts, setAccounts]       = useState<Account[]>([]);
  const [journal, setJournal]         = useState<JournalEntry[]>([]);
  const [ledger, setLedger]           = useState<LedgerRow[]>([]);
  const [trialBal, setTrialBal]       = useState<TrialBalance | null>(null);
  const [statements, setStatements]   = useState<FinancialStatements | null>(null);
  const [mappings, setMappings]       = useState<any[]>([]);
  const [postStatus, setPostStatus]   = useState<any>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [deprPosting, setDeprPosting] = useState(false);

  const [journalModal, setJournalModal]   = useState(false);
  const [detailEntry, setDetailEntry]     = useState<JournalEntry | null>(null);
  const [acctSearch, setAcctSearch]       = useState("");
  const [journalSearch, setJournalSearch] = useState("");
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string>("");

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [accts, jnl, ldgr, tb, fs, maps, status] = await Promise.all([
        api("/api/accounts").catch(() => []),
        api(`/api/journal?from=${periodFrom}&to=${periodTo}&limit=100`).catch(() => []),
        api(`/api/ledger?from=${periodFrom}&to=${periodTo}`).catch(() => []),
        api(`/api/trial-balance?from=${periodFrom}&to=${periodTo}`).catch(() => null),
        api(`/api/financial-statements?from=${periodFrom}&to=${periodTo}`).catch(() => null),
        api("/api/account-mappings").catch(() => []),
        api("/api/auto-post/status").catch(() => null),
      ]);
      setAccounts(Array.isArray(accts) ? accts : []);
      setJournal(Array.isArray(jnl) ? jnl : []);
      setLedger(Array.isArray(ldgr) ? ldgr : []);
      setTrialBal(tb);
      setStatements(fs);
      setMappings(Array.isArray(maps) ? maps : []);
      setPostStatus(status);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally { setLoading(false); }
  }, [periodFrom, periodTo, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Load journal entry detail ───────────────────────────────────────────────
  async function openDetail(entry: JournalEntry) {
    try {
      const full = await api(`/api/journal/${entry.id}`);
      setDetailEntry(full);
    } catch { setDetailEntry(entry); }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function saveJournal(data: any) {
    try {
      await api("/api/journal", { method: "POST", body: JSON.stringify(data) });
      toast({ title: "Jurnal berhasil diposting ✓" });
      setJournalModal(false);
      await loadAll();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  async function voidJournal(id: string) {
    try {
      await api(`/api/journal/${id}`, { method: "DELETE" });
      toast({ title: "Jurnal divoid" });
      await loadAll();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  // ── Print Financial Statements ──────────────────────────────────────────────
  function printStatements() {
    if (!statements) return;
    const w = window.open("", "_blank", "width=960,height=720");
    if (!w) return;
    const { incomeStatement: is, balanceSheet: bs } = statements;
    const fromLabel = new Date(periodFrom).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const toLabel   = new Date(periodTo).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>Laporan Keuangan Formal — Frameless Creative</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#1a1d2e;padding:36px 40px;font-size:12px;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:18px;border-bottom:3px solid #FF6A20;}
  .logo{font-size:22px;font-weight:900;color:#FF6A20;}
  .logo-sub{font-size:11px;color:#888;margin-top:3px;}
  .right{text-align:right;}
  .report-title{font-size:20px;font-weight:900;}
  .report-meta{font-size:11px;color:#888;margin-top:3px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:28px;}
  .section{page-break-inside:avoid;}
  .section-title{font-size:13px;font-weight:800;margin:0 0 10px;padding-bottom:7px;border-bottom:2px solid #f3f4f6;display:flex;align-items:center;gap:8px;}
  .section-title::before{content:'';width:4px;height:16px;background:#FF6A20;border-radius:2px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#f3f4f6;padding:7px 10px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;border-bottom:2px solid #e5e7eb;}
  td{padding:7px 10px;border-bottom:1px solid #f3f4f6;color:#374151;}
  .tr{text-align:right;font-weight:700;}
  .pos{color:#16a34a;font-weight:700;}
  .neg{color:#dc2626;font-weight:700;}
  .subtotal{background:#f9fafb;font-weight:700;}
  .total{background:#fff7ed;font-weight:800;border-top:2px solid #FF6A20;}
  .footer{margin-top:36px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between;}
  .badge{display:inline-block;padding:1px 7px;border-radius:4px;font-size:9px;font-weight:700;}
  .badge-g{background:#dcfce7;color:#16a34a;}
  .badge-r{background:#fee2e2;color:#dc2626;}
  @media print{body{padding:20px 24px;}}
</style></head><body>
<div class="header">
  <div>
    <div class="logo">FRAMELESS™</div>
    <div class="logo-sub">Creative Production House · Wonosobo, Central Java</div>
    <div class="logo-sub">framelesscreative.com</div>
  </div>
  <div class="right">
    <div class="report-title">Laporan Keuangan Formal</div>
    <div class="report-meta">Periode: ${fromLabel} – ${toLabel}</div>
    <div class="report-meta">Dicetak: ${new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</div>
  </div>
</div>

<div class="two-col">
<!-- LABA RUGI -->
<div class="section">
  <div class="section-title">Laporan Laba Rugi</div>
  <table>
    <thead><tr><th>Akun</th><th class="tr">Saldo</th></tr></thead>
    <tbody>
      <tr><td colspan="2" style="font-weight:800;color:#16a34a;padding:8px 10px 4px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;">PENDAPATAN</td></tr>
      ${is.revenues.map(r=>`<tr><td style="padding-left:18px;">${r.name}</td><td class="tr pos">${formatCurrency(r.balance)}</td></tr>`).join("")}
      <tr class="subtotal"><td>Total Pendapatan</td><td class="tr pos">${formatCurrency(is.totalRevenue)}</td></tr>
      <tr><td colspan="2" style="font-weight:800;color:#dc2626;padding:10px 10px 4px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;">BEBAN</td></tr>
      ${is.expenses.map(e=>`<tr><td style="padding-left:18px;">${e.name}</td><td class="tr neg">${formatCurrency(e.balance)}</td></tr>`).join("")}
      <tr class="subtotal"><td>Total Beban</td><td class="tr neg">${formatCurrency(is.totalExpenses)}</td></tr>
      <tr class="total"><td>${is.netIncome >= 0 ? "LABA BERSIH" : "RUGI BERSIH"}</td><td class="tr" style="color:${is.netIncome>=0?"#16a34a":"#dc2626"};font-size:15px;">${formatCurrency(Math.abs(is.netIncome))}</td></tr>
    </tbody>
  </table>
  <p style="font-size:11px;color:#888;margin-top:8px;">Profit Margin: <b style="color:${is.netIncome>=0?"#16a34a":"#dc2626"}">${is.grossMargin.toFixed(1)}%</b></p>
</div>

<!-- NERACA -->
<div class="section">
  <div class="section-title">Neraca (Balance Sheet)</div>
  <table>
    <thead><tr><th>Akun</th><th class="tr">Saldo</th></tr></thead>
    <tbody>
      <tr><td colspan="2" style="font-weight:800;color:#2563eb;padding:8px 10px 4px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;">ASET</td></tr>
      ${bs.assets.map(a=>`<tr><td style="padding-left:18px;">${a.name}</td><td class="tr" style="color:#1a1d2e;font-weight:600;">${formatCurrency(a.balance)}</td></tr>`).join("")}
      <tr class="subtotal"><td>Total Aset</td><td class="tr" style="color:#2563eb;">${formatCurrency(bs.totalAssets)}</td></tr>
      <tr><td colspan="2" style="font-weight:800;color:#dc2626;padding:10px 10px 4px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;">KEWAJIBAN</td></tr>
      ${bs.liabilities.map(l=>`<tr><td style="padding-left:18px;">${l.name}</td><td class="tr neg">${formatCurrency(l.balance)}</td></tr>`).join("")}
      <tr class="subtotal"><td>Total Kewajiban</td><td class="tr neg">${formatCurrency(bs.totalLiabilities)}</td></tr>
      <tr><td colspan="2" style="font-weight:800;color:#7c3aed;padding:10px 10px 4px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;">MODAL</td></tr>
      ${bs.equity.map(e=>`<tr><td style="padding-left:18px;">${e.name}</td><td class="tr" style="color:#7c3aed;font-weight:600;">${formatCurrency(e.balance)}</td></tr>`).join("")}
      <tr class="total"><td>TOTAL KEWAJIBAN + MODAL</td><td class="tr" style="color:#FF6A20;font-size:14px;">${formatCurrency(bs.totalLiabilities+bs.totalEquity)}</td></tr>
    </tbody>
  </table>
  <p style="font-size:11px;margin-top:8px;">${bs.isBalanced ? '<span class="badge badge-g">✓ Neraca Seimbang</span>' : '<span class="badge badge-r">⚠ Neraca Tidak Seimbang</span>'}</p>
</div>
</div>

<div class="footer">
  <span>Frameless Creative Production House · Wonosobo, Central Java</span>
  <span>Dibuat dari sistem akuntansi Creative-Hub-Core</span>
</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  // ── Derived / filtered ──────────────────────────────────────────────────────
  const filteredAccounts = accounts.filter(a =>
    !acctSearch || a.name.toLowerCase().includes(acctSearch.toLowerCase()) || a.code.includes(acctSearch)
  );
  const filteredJournal = journal.filter(j =>
    !journalSearch || j.description.toLowerCase().includes(journalSearch.toLowerCase()) || j.refNumber.toLowerCase().includes(journalSearch.toLowerCase())
  );

  const TABS = [
    { id: "journal",    label: "Jurnal",         icon: <ListOrdered size={13} /> },
    { id: "ledger",     label: "Buku Besar",      icon: <BookOpen size={13} /> },
    { id: "trial",      label: "Neraca Saldo",    icon: <Scale size={13} /> },
    { id: "statements", label: "Lap. Keuangan",   icon: <FileText size={13} /> },
    { id: "accounts",   label: "Daftar Akun",     icon: <Layers size={13} /> },
    { id: "settings",   label: "Pengaturan",       icon: <Settings size={13} /> },
  ] as const;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONT, color: "#f0f0f0", paddingBottom: 60 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}`}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "flex-end", justifyContent: "space-between", marginBottom: isMobile ? 18 : 28, flexDirection: isMobile ? "column" : "row", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", margin: "0 0 4px" }}>Akuntansi</h1>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 600 }}>Double-Entry Bookkeeping · Frameless Creative</p>
        </div>
        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto", flexWrap: "wrap" }}>
          {/* Period picker */}
          <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} style={{ ...ipt, width: isMobile ? "calc(50% - 4px)" : 150 }} />
          <input type="date" value={periodTo}   onChange={e => setPeriodTo(e.target.value)}   style={{ ...ipt, width: isMobile ? "calc(50% - 4px)" : 150 }} />
          <button onClick={loadAll} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><RefreshCw size={14} /></button>
          {activeTab === "statements" && statements && (
            <button onClick={printStatements} style={{ ...btnBase, background: OR, color: "#fff", flexShrink: 0 }}><Printer size={14} /> Cetak</button>
          )}
          {activeTab === "journal" && (
            <button onClick={() => setJournalModal(true)} style={{ ...btnBase, background: OR, color: "#fff", flex: isMobile ? 1 : "none", justifyContent: "center" }}><Plus size={14} /> Jurnal Baru</button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", paddingBottom: 4 }}>
        {TABS.map(t => <Tab key={t.id} label={t.label} icon={t.icon} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...Array(5)].map((_, i) => <Skel key={i} h={52} />)}
        </div>
      ) : (

        <>
          {/* ═══════════════ TAB: JURNAL UMUM ═════════════════════ */}
          {activeTab === "journal" && (
            <>
              {/* Search */}
              <div style={{ position: "relative", marginBottom: 16 }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.35)" }} />
                <input value={journalSearch} onChange={e => setJournalSearch(e.target.value)}
                  placeholder="Cari ref number atau keterangan..." style={{ ...ipt, paddingLeft: 36 }} />
              </div>

              <Card>
                {/* Table header */}
                {!isMobile && (
                  <div style={{ display: "grid", gridTemplateColumns: "110px 90px 1fr 120px 120px 80px 60px", gap: 0, padding: "9px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                    {["Ref", "Tanggal", "Keterangan", "Debit", "Kredit", "Status", ""].map(h => (
                      <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.3)" }}>{h}</span>
                    ))}
                  </div>
                )}

                {filteredJournal.length === 0 ? (
                  <div style={{ padding: "56px 24px", textAlign: "center" }}>
                    <ListOrdered size={40} color="rgba(255,255,255,.08)" style={{ margin: "0 auto 14px" }} />
                    <p style={{ color: "rgba(255,255,255,.3)", fontSize: 14, marginBottom: 16 }}>Belum ada jurnal pada periode ini.</p>
                    <button onClick={() => setJournalModal(true)} style={{ ...btnBase, background: OR, color: "#fff", margin: "0 auto" }}><Plus size={14} /> Buat Jurnal Pertama</button>
                  </div>
                ) : filteredJournal.map((entry, idx) => (
                  isMobile ? (
                    <div key={entry.id} onClick={() => openDetail(entry)}
                      style={{ padding: "13px 16px", borderBottom: idx < filteredJournal.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: OR }}>{entry.refNumber}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: entry.status === "POSTED" ? "rgba(74,222,128,.15)" : "rgba(248,113,113,.15)", color: entry.status === "POSTED" ? "#4ade80" : "#f87171" }}>{entry.status}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#fff", margin: "0 0 2px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.description}</p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,.4)", margin: 0 }}>{new Date(entry.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", margin: 0 }}>{formatCurrency(entry.totalDebit)}</p>
                        <ChevronRight size={14} color="rgba(255,255,255,.25)" style={{ marginTop: 4 }} />
                      </div>
                    </div>
                  ) : (
                    <div key={entry.id}
                      style={{ display: "grid", gridTemplateColumns: "110px 90px 1fr 120px 120px 80px 60px", gap: 0, padding: "12px 18px", borderBottom: idx < filteredJournal.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none", alignItems: "center", cursor: "pointer" }}
                      onClick={() => openDetail(entry)}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: OR }}>{entry.refNumber}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{new Date(entry.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{entry.description}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>{formatCurrency(entry.totalDebit)}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{formatCurrency(entry.totalCredit)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: entry.status === "POSTED" ? "rgba(74,222,128,.12)" : entry.status === "VOID" ? "rgba(248,113,113,.12)" : "rgba(255,255,255,.06)", color: entry.status === "POSTED" ? "#4ade80" : entry.status === "VOID" ? "#f87171" : "#fff", display: "inline-block" }}>{entry.status}</span>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={e => { e.stopPropagation(); openDetail(entry); }} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><Eye size={12} /></button>
                      </div>
                    </div>
                  )
                ))}
              </Card>
            </>
          )}

          {/* ═══════════════ TAB: BUKU BESAR ══════════════════════ */}
          {activeTab === "ledger" && (
            <>
              {/* Account selector */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <select value={selectedLedgerAccount} onChange={e => setSelectedLedgerAccount(e.target.value)}
                  style={{ ...ipt, maxWidth: 340, cursor: "pointer" }}>
                  <option value="" style={{ background: "#111318" }}>— Semua Akun —</option>
                  {accounts.map(a => <option key={a.code} value={a.code} style={{ background: "#111318" }}>{a.code} — {a.name}</option>)}
                </select>
              </div>

              <Card>
                {!isMobile && (
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 100px 130px 130px 130px", gap: 0, padding: "9px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                    {["Kode", "Nama Akun", "Tipe", "Total Debit", "Total Kredit", "Saldo"].map(h => (
                      <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.3)" }}>{h}</span>
                    ))}
                  </div>
                )}
                {(selectedLedgerAccount ? ledger.filter(l => l.accountCode === selectedLedgerAccount) : ledger).map((row, idx, arr) => {
                  const badge = TYPE_BADGE[row.accountType] || { bg: "rgba(255,255,255,.08)", color: "#fff", label: row.accountType };
                  return isMobile ? (
                    <div key={row.accountCode} style={{ padding: "12px 16px", borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: OR }}>{row.accountCode}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 3px" }}>{row.accountName}</p>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span style={{ fontSize: 10, color: "#4ade80" }}>D: {formatCurrency(row.totalDebit)}</span>
                          <span style={{ fontSize: 10, color: "#f87171" }}>K: {formatCurrency(row.totalCredit)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 900, color: row.balance >= 0 ? OR : "#f87171", flexShrink: 0 }}>{formatCurrency(Math.abs(row.balance))}</span>
                    </div>
                  ) : (
                    <div key={row.accountCode}
                      style={{ display: "grid", gridTemplateColumns: "100px 1fr 100px 130px 130px 130px", gap: 0, padding: "11px 18px", borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: OR }}>{row.accountCode}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{row.accountName}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: badge.bg, color: badge.color, display: "inline-block" }}>{badge.label}</span>
                      <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 600 }}>{row.totalDebit > 0 ? formatCurrency(row.totalDebit) : "—"}</span>
                      <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>{row.totalCredit > 0 ? formatCurrency(row.totalCredit) : "—"}</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: row.balance >= 0 ? OR : "#f87171" }}>{formatCurrency(Math.abs(row.balance))}</span>
                    </div>
                  );
                })}
                {ledger.length === 0 && (
                  <div style={{ padding: "56px 24px", textAlign: "center" }}>
                    <BookOpen size={40} color="rgba(255,255,255,.08)" style={{ margin: "0 auto 12px" }} />
                    <p style={{ color: "rgba(255,255,255,.3)", fontSize: 14 }}>Belum ada transaksi. Buat jurnal untuk mengisi buku besar.</p>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* ═══════════════ TAB: NERACA SALDO ════════════════════ */}
          {activeTab === "trial" && trialBal && (
            <>
              {/* Balance check banner */}
              <div style={{ padding: "12px 16px", borderRadius: 12, marginBottom: 20, display: "flex", alignItems: "center", gap: 10, background: trialBal.isBalanced ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", border: `1px solid ${trialBal.isBalanced ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)"}` }}>
                {trialBal.isBalanced ? <CheckCircle2 size={18} color="#4ade80" /> : <AlertCircle size={18} color="#f87171" />}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: trialBal.isBalanced ? "#4ade80" : "#f87171", margin: 0 }}>
                    {trialBal.isBalanced ? "✓ Neraca Saldo Seimbang" : "⚠ Neraca Saldo Tidak Seimbang"}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", margin: "2px 0 0" }}>
                    Total Debit: {formatCurrency(trialBal.grandDebit)} · Total Kredit: {formatCurrency(trialBal.grandCredit)}
                  </p>
                </div>
              </div>

              <Card>
                {!isMobile && (
                  <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 100px 130px 130px 130px", gap: 0, padding: "9px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                    {["Kode", "Nama Akun", "Tipe", "Debit", "Kredit", "Saldo"].map(h => (
                      <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.3)" }}>{h}</span>
                    ))}
                  </div>
                )}
                {trialBal.items.map((item, idx) => {
                  const badge = TYPE_BADGE[item.type] || { bg: "rgba(255,255,255,.08)", color: "#fff", label: item.type };
                  return isMobile ? (
                    <div key={item.code} style={{ padding: "11px 16px", borderBottom: idx < trialBal.items.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: OR }}>{item.code}</span>
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 5, background: badge.bg, color: badge.color, fontWeight: 700 }}>{badge.label}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#fff", fontWeight: 600, margin: 0 }}>{item.name}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: item.normalBalance === "DEBIT" ? "#4ade80" : "#f87171", margin: 0 }}>{formatCurrency(item.balance)}</p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,.35)", margin: "2px 0 0" }}>{item.normalBalance}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={item.code} style={{ display: "grid", gridTemplateColumns: "90px 1fr 100px 130px 130px 130px", gap: 0, padding: "10px 18px", borderBottom: idx < trialBal.items.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: OR }}>{item.code}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{item.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: badge.bg, color: badge.color, display: "inline-block" }}>{badge.label}</span>
                      <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 600 }}>{item.totalDebit > 0 ? formatCurrency(item.totalDebit) : "—"}</span>
                      <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>{item.totalCredit > 0 ? formatCurrency(item.totalCredit) : "—"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.normalBalance === "DEBIT" ? "#4ade80" : "#f87171" }}>{formatCurrency(item.balance)}</span>
                    </div>
                  );
                })}
                {/* Grand total row */}
                <div style={{ display: isMobile ? "flex" : "grid", gridTemplateColumns: isMobile ? undefined : "90px 1fr 100px 130px 130px 130px", justifyContent: isMobile ? "space-between" : undefined, gap: 0, padding: "12px 18px", borderTop: `2px solid ${OR}`, background: `${OR}08`, alignItems: "center" }}>
                  {isMobile ? (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>GRAND TOTAL</span>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", margin: 0 }}>{formatCurrency(trialBal.grandDebit)}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#f87171", margin: "2px 0 0" }}>{formatCurrency(trialBal.grandCredit)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span />
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>GRAND TOTAL</span>
                      <span />
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#4ade80" }}>{formatCurrency(trialBal.grandDebit)}</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#f87171" }}>{formatCurrency(trialBal.grandCredit)}</span>
                      <span style={{ fontSize: 13, color: trialBal.isBalanced ? "#4ade80" : "#f87171", fontWeight: 700 }}>{trialBal.isBalanced ? "✓ Seimbang" : "✗ Tidak Seimbang"}</span>
                    </>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* ═══════════════ TAB: LAPORAN KEUANGAN ════════════════ */}
          {activeTab === "statements" && statements && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24 }}>
              {/* Laba Rugi */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(74,222,128,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><TrendingUp size={14} color="#4ade80" /></div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>Laporan Laba Rugi</h3>
                </div>
                <Card>
                  {/* Revenue section */}
                  <div style={{ padding: "10px 16px 6px", background: "rgba(74,222,128,.04)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 8px" }}>Pendapatan</p>
                    {statements.incomeStatement.revenues.map(r => (
                      <div key={r.code} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{r.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{formatCurrency(r.balance)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Total Pendapatan</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#4ade80" }}>{formatCurrency(statements.incomeStatement.totalRevenue)}</span>
                    </div>
                  </div>
                  {/* Expense section */}
                  <div style={{ padding: "10px 16px 6px", background: "rgba(248,113,113,.04)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 8px" }}>Beban</p>
                    {statements.incomeStatement.expenses.map(e => (
                      <div key={e.code} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{e.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>{formatCurrency(e.balance)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Total Beban</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#f87171" }}>{formatCurrency(statements.incomeStatement.totalExpenses)}</span>
                    </div>
                  </div>
                  {/* Net income */}
                  <div style={{ padding: "14px 16px", background: statements.incomeStatement.netIncome >= 0 ? "rgba(74,222,128,.06)" : "rgba(248,113,113,.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{statements.incomeStatement.netIncome >= 0 ? "Laba Bersih" : "Rugi Bersih"}</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: statements.incomeStatement.netIncome >= 0 ? "#4ade80" : "#f87171" }}>
                        {formatCurrency(Math.abs(statements.incomeStatement.netIncome))}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", margin: "4px 0 0" }}>Profit Margin: {statements.incomeStatement.grossMargin.toFixed(1)}%</p>
                  </div>
                </Card>
              </div>

              {/* Neraca */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(37,99,235,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Scale size={14} color="#60a5fa" /></div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>Neraca (Balance Sheet)</h3>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: statements.balanceSheet.isBalanced ? "rgba(74,222,128,.12)" : "rgba(248,113,113,.12)", color: statements.balanceSheet.isBalanced ? "#4ade80" : "#f87171" }}>
                    {statements.balanceSheet.isBalanced ? "Seimbang ✓" : "Tidak Seimbang ⚠"}
                  </span>
                </div>
                <Card>
                  {/* Assets */}
                  <div style={{ padding: "10px 16px 6px", background: "rgba(37,99,235,.04)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 8px" }}>Aset</p>
                    {statements.balanceSheet.assets.map(a => (
                      <div key={a.code} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{a.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>{formatCurrency(a.balance)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Total Aset</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#60a5fa" }}>{formatCurrency(statements.balanceSheet.totalAssets)}</span>
                    </div>
                  </div>
                  {/* Liabilities */}
                  <div style={{ padding: "10px 16px 6px", background: "rgba(248,113,113,.04)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 8px" }}>Kewajiban</p>
                    {statements.balanceSheet.liabilities.map(l => (
                      <div key={l.code} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{l.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>{formatCurrency(l.balance)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Total Kewajiban</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#f87171" }}>{formatCurrency(statements.balanceSheet.totalLiabilities)}</span>
                    </div>
                  </div>
                  {/* Equity */}
                  <div style={{ padding: "10px 16px 6px" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#c084fc", textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 8px" }}>Modal</p>
                    {statements.balanceSheet.equity.map(e => (
                      <div key={e.code} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{e.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#c084fc" }}>{formatCurrency(e.balance)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Total Modal</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#c084fc" }}>{formatCurrency(statements.balanceSheet.totalEquity)}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ═══════════════ TAB: DAFTAR AKUN ═════════════════════ */}
          {activeTab === "accounts" && (
            <>
              <div style={{ position: "relative", marginBottom: 16 }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.35)" }} />
                <input value={acctSearch} onChange={e => setAcctSearch(e.target.value)}
                  placeholder="Cari kode atau nama akun..." style={{ ...ipt, paddingLeft: 36 }} />
              </div>

              {["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"].map(type => {
                const group = filteredAccounts.filter(a => a.type === type);
                if (group.length === 0) return null;
                const badge = TYPE_BADGE[type];
                return (
                  <div key={type} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 7, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>{group.length} akun</span>
                    </div>
                    <Card>
                      {group.map((acct, idx) => (
                        <div key={acct.id} style={{ padding: "11px 16px", borderBottom: idx < group.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: OR, flexShrink: 0 }}>{acct.code}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acct.name}</span>
                            </div>
                            {acct.description && (
                              <p style={{ fontSize: 10, color: "rgba(255,255,255,.35)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acct.description}</p>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: acct.normalBalance === "DEBIT" ? "rgba(74,222,128,.1)" : "rgba(248,113,113,.1)", color: acct.normalBalance === "DEBIT" ? "#4ade80" : "#f87171" }}>
                              {acct.normalBalance}
                            </span>
                            {acct.isSystem && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.3)" }}>SISTEM</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </Card>
                  </div>
                );
              })}
            </>
          )}

          {/* ═══════════════ TAB: PENGATURAN ══════════════════════ */}
          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* ── Sync Status ── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(74,222,128,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle2 size={14} color="#4ade80" />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>Status Sinkronisasi Jurnal</h3>
                </div>

                {postStatus ? (
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                    {(["invoice","expense","income"] as const).map(type => {
                      const s = postStatus[type] || { total: 0, posted: 0, pending: 0 };
                      const allSynced = s.pending === 0;
                      return (
                        <div key={type} style={{ padding: "16px", borderRadius: 14, background: allSynced ? "rgba(74,222,128,.06)" : "rgba(251,191,36,.06)", border: `1px solid ${allSynced ? "rgba(74,222,128,.2)" : "rgba(251,191,36,.2)"}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".1em", margin: 0 }}>
                              {type === "invoice" ? "Invoice" : type === "expense" ? "Pengeluaran" : "Pemasukan"}
                            </p>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: allSynced ? "rgba(74,222,128,.15)" : "rgba(251,191,36,.15)", color: allSynced ? "#4ade80" : "#fbbf24" }}>
                              {allSynced ? "✓ Sinkron" : `${s.pending} belum`}
                            </span>
                          </div>
                          <p style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "0 0 4px" }}>{s.posted}<span style={{ fontSize: 13, color: "rgba(255,255,255,.4)", fontWeight: 600 }}>/{s.total}</span></p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", margin: 0 }}>jurnal diposting</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "16px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", marginBottom: 16 }}>
                    <p style={{ color: "rgba(255,255,255,.4)", fontSize: 13, margin: 0 }}>Memuat status...</p>
                  </div>
                )}

                {/* Backfill actions */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={async () => {
                      if (!confirm("Ini akan memposting jurnal untuk SEMUA transaksi lama yang belum ada jurnalnya. Lanjutkan?")) return;
                      setBackfilling(true);
                      try {
                        const result = await api("/api/auto-post/bulk-backfill", { method: "POST", body: JSON.stringify({ types: ["invoice","expense","income"] }) });
                        toast({ title: `Selesai: ${result.summary}` });
                        await loadAll();
                      } catch (e: any) {
                        toast({ variant: "destructive", title: "Error", description: e.message });
                      } finally { setBackfilling(false); }
                    }}
                    disabled={backfilling}
                    style={{ ...btnBase, background: OR, color: "#fff", opacity: backfilling ? 0.6 : 1 }}
                  >
                    <CheckCircle2 size={14} />
                    {backfilling ? "Memposting..." : "Backfill Semua Transaksi Lama"}
                  </button>

                  <button
                    onClick={async () => {
                      if (!confirm("Posting jurnal penyusutan untuk semua aset bulan ini?")) return;
                      setDeprPosting(true);
                      try {
                        const result = await api("/api/auto-post/depreciation", { method: "POST", body: JSON.stringify({ periodDate: new Date().toISOString().split("T")[0] }) });
                        toast({ title: `Depresiasi: ${result.posted} jurnal diposting, total Rp ${Number(result.totalDepreciation).toLocaleString("id-ID")}` });
                        await loadAll();
                      } catch (e: any) {
                        toast({ variant: "destructive", title: "Error", description: e.message });
                      } finally { setDeprPosting(false); }
                    }}
                    disabled={deprPosting}
                    style={{ ...btnBase, background: "rgba(251,191,36,.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,.2)", opacity: deprPosting ? 0.6 : 1 }}
                  >
                    <BarChart2 size={14} />
                    {deprPosting ? "Memposting..." : "Posting Depresiasi Bulan Ini"}
                  </button>
                </div>
              </div>

              {/* ── Account Mapping Table ── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Settings size={14} color={OR} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>Pemetaan Akun Otomatis</h3>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", margin: "2px 0 0" }}>
                      Atur akun debit/kredit yang dipakai saat auto-posting jurnal
                    </p>
                  </div>
                </div>

                {(["expense_category","income_source","default"] as const).map(mtype => {
                  const group = mappings.filter((m: any) => m.mappingType === mtype);
                  if (group.length === 0) return null;
                  const groupLabel = mtype === "expense_category" ? "Kategori Pengeluaran" : mtype === "income_source" ? "Sumber Pemasukan" : "Default / Sistem";
                  return (
                    <div key={mtype} style={{ marginBottom: 20 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 10px" }}>{groupLabel}</p>
                      <Card>
                        {/* Header */}
                        {!isMobile && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 200px", gap: 0, padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                            {["Kunci / Kategori", "Akun Debit", "Akun Kredit", "Keterangan"].map(h => (
                              <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)" }}>{h}</span>
                            ))}
                          </div>
                        )}
                        {group.map((m: any, idx: number) => (
                          <div key={m.id} style={{
                            display: isMobile ? "block" : "grid",
                            gridTemplateColumns: isMobile ? undefined : "1fr 160px 160px 200px",
                            gap: 0, padding: isMobile ? "12px 16px" : "10px 16px",
                            borderBottom: idx < group.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none",
                            alignItems: "center",
                          }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: isMobile ? "0 0 6px" : 0 }}>{m.key}</p>

                            {isMobile && (
                              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(74,222,128,.1)", color: "#4ade80", fontWeight: 700 }}>D: {m.debitCode}</span>
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(248,113,113,.1)", color: "#f87171", fontWeight: 700 }}>K: {m.creditCode}</span>
                              </div>
                            )}

                            {!isMobile && (
                              <>
                                <div>
                                  <MappingSelect
                                    value={m.debitCode}
                                    accounts={accounts}
                                    onChange={async (code) => {
                                      try {
                                        await api(`/api/account-mappings/${m.id}`, { method: "PUT", body: JSON.stringify({ debitCode: code }) });
                                        await loadAll();
                                        toast({ title: "Pemetaan diperbarui ✓" });
                                      } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
                                    }}
                                    color="#4ade80"
                                  />
                                </div>
                                <div>
                                  <MappingSelect
                                    value={m.creditCode}
                                    accounts={accounts}
                                    onChange={async (code) => {
                                      try {
                                        await api(`/api/account-mappings/${m.id}`, { method: "PUT", body: JSON.stringify({ creditCode: code }) });
                                        await loadAll();
                                        toast({ title: "Pemetaan diperbarui ✓" });
                                      } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
                                    }}
                                    color="#f87171"
                                  />
                                </div>
                              </>
                            )}
                            <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", margin: 0 }}>{m.description || "—"}</p>
                          </div>
                        ))}
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {journalModal && (
        <JournalModal accounts={accounts} onClose={() => setJournalModal(false)} onSave={saveJournal} />
      )}
      {detailEntry && (
        <JournalDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} onVoid={voidJournal} />
      )}
    </div>
  );
}