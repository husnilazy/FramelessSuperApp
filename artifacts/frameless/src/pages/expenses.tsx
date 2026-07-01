// artifacts/frameless/src/pages/expenses.tsx
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import {
  Plus, Trash2, X, Search, TrendingDown,
  Receipt, Calendar, RefreshCw, Edit2, Check,
  AlertCircle, Upload, FileText, Loader2,
  Image as ImageIcon, Printer, Layers, Copy, ListPlus,
} from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

// Kategori dipecah lebih detail — Utilitas (listrik/air/PDAM) dipisah dari
// Software & Langganan supaya laporan pengeluaran lebih akurat per jenis biaya.
const EXPENSE_CATS = [
  "Peralatan", "Transportasi", "Akomodasi", "Makan & Minum",
  "Utilitas", "Software & Langganan", "Marketing", "Gaji & Honor",
  "Sewa Tempat", "Komunikasi", "Administrasi", "Lainnya",
];

const PIE_COLORS = ["#FF6A20", "#7c3aed", "#2563eb", "#4ade80", "#fbbf24", "#f472b6", "#06b6d4", "#a78bfa", "#34d399", "#fb923c", "#f97316", "#60a5fa"];

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

// Multipart upload — separate from `api()` since it must NOT set Content-Type:
// application/json (the browser needs to set the multipart boundary itself).
// Reuses the existing admin upload endpoint (POST /api/uploads, field "file"),
// which streams to Supabase Storage and returns { url, filename }.
async function uploadReceiptFile(file: File): Promise<{ url: string; filename: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const r = await fetch("/api/uploads", {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });

  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "Gagal mengunggah struk");
  }
  return r.json();
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  projectId?: string | null;
  receiptUrl?: string | null;
  createdAt?: string | null;
}

interface Project {
  id: string;
  title: string;
}

// A single row inside the batch-entry modal — same shape as Expense minus id/date
// (date is shared across all rows in a batch since the whole point is "same day, many items").
interface BatchRow {
  rowId: string; // local-only key for React list rendering, not sent to server
  category: string;
  description: string;
  amount: number | "";
  projectId: string | null;
  receiptUrl: string | null;
}

function newBatchRow(category: string): BatchRow {
  return {
    rowId: crypto.randomUUID(),
    category,
    description: "",
    amount: "",
    projectId: null,
    receiptUrl: null,
  };
}

// ─── Shared styles ──────────────────────────────────────────────────────────────
const ipt: React.CSSProperties = {
  background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13,
  outline: "none", fontFamily: FONT, width: "100%", boxSizing: "border-box",
};

const btnBase: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
  borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
  fontFamily: FONT, border: "none",
};

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// ─── Single Expense Modal (edit existing) ───────────────────────────────────────
function ExpenseModal({ item, projects, onClose, onSave }: {
  item: Expense;
  projects: Project[];
  onClose: () => void;
  onSave: (d: Partial<Expense>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<Expense>>(item);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const f = (k: keyof Expense, v: any) => setForm(p => ({ ...p, [k]: v }));

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setUploadError(null);

    const validExt = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExt.includes(ext)) {
      setUploadError("Format tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("Ukuran file maksimal 20MB.");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadReceiptFile(file);
      f("receiptUrl", result.url);
    } catch (err: any) {
      setUploadError(err.message || "Gagal mengunggah struk");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.description || !form.amount || !form.category) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  const isPdf = form.receiptUrl?.toLowerCase().endsWith(".pdf");

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: 32, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 22 }}>Edit Pengeluaran</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Kategori *</label>
            <select value={form.category || ""} onChange={e => f("category", e.target.value)} style={{ ...ipt, cursor: "pointer" }}>
              {EXPENSE_CATS.map(c => <option key={c} value={c} style={{ background: "#111318" }}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Keterangan *</label>
            <input value={form.description || ""} onChange={e => f("description", e.target.value)} placeholder="mis. Sewa drone DJI Air 3" style={ipt} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Jumlah (IDR) *</label>
              <input type="number" value={form.amount ?? ""} onChange={e => f("amount", Number(e.target.value))} placeholder="500000" style={ipt} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Tanggal</label>
              <input type="date" value={form.date ? String(form.date).slice(0, 10) : ""} onChange={e => f("date", e.target.value)} style={ipt} />
            </div>
          </div>
          {projects.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Proyek (opsional)</label>
              <select value={form.projectId || ""} onChange={e => f("projectId", e.target.value || null)} style={{ ...ipt, cursor: "pointer" }}>
                <option value="" style={{ background: "#111318" }}>— Tidak terkait proyek —</option>
                {projects.map(p => <option key={p.id} value={p.id} style={{ background: "#111318" }}>{p.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Struk/Bukti Pembayaran (opsional)</label>
            {form.receiptUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.2)" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(74,222,128,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isPdf ? <FileText size={16} color="#4ade80" /> : <ImageIcon size={16} color="#4ade80" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={form.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Lihat file terlampir ↗</a>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,.35)", margin: "2px 0 0" }}>File berhasil diunggah</p>
                </div>
                <button type="button" onClick={() => f("receiptUrl", null)} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(248,113,113,.1)", border: "none", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash2 size={12} /></button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "20px 14px", borderRadius: 10, border: "1.5px dashed rgba(255,255,255,.15)", background: "rgba(255,255,255,.02)", cursor: uploading ? "wait" : "pointer" }}>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" onChange={e => handleFileSelect(e.target.files?.[0])} disabled={uploading} style={{ display: "none" }} />
                {uploading ? (
                  <><Loader2 size={20} color={OR} style={{ animation: "spin .8s linear infinite" }} /><span style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>Mengunggah...</span></>
                ) : (
                  <><Upload size={20} color="rgba(255,255,255,.3)" /><span style={{ fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>Klik untuk unggah foto/PDF struk</span><span style={{ fontSize: 10, color: "rgba(255,255,255,.25)" }}>JPG, PNG, WEBP, atau PDF · maks 20MB</span></>
                )}
              </label>
            )}
            {uploadError && <p style={{ fontSize: 11, color: "#f87171", margin: "6px 0 0", display: "flex", alignItems: "center", gap: 4 }}><AlertCircle size={11} /> {uploadError}</p>}
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onClose} style={{ ...btnBase, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}>Batal</button>
          <button onClick={save} disabled={saving || !form.description || !form.amount} style={{ ...btnBase, background: OR, color: "#fff", opacity: saving || !form.description || !form.amount ? 0.5 : 1 }}>
            {saving ? "Menyimpan..." : <><Check size={14} /> Simpan Perubahan</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Batch Entry Modal (add many expenses for the same date in one go) ─────────
function BatchExpenseModal({ projects, onClose, onSaveAll }: {
  projects: Project[];
  onClose: () => void;
  onSaveAll: (date: string, rows: BatchRow[]) => Promise<void>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<BatchRow[]>([newBatchRow(EXPENSE_CATS[0])]);
  const [saving, setSaving] = useState(false);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);

  function updateRow(rowId: string, patch: Partial<BatchRow>) {
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch } : r));
  }

  function addRow() {
    setRows(prev => [...prev, newBatchRow(prev[prev.length - 1]?.category || EXPENSE_CATS[0])]);
  }

  function duplicateRow(rowId: string) {
    setRows(prev => {
      const idx = prev.findIndex(r => r.rowId === rowId);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], rowId: crypto.randomUUID(), description: "" };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function removeRow(rowId: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.rowId !== rowId) : prev);
  }

  async function handleRowFile(rowId: string, file: File | undefined) {
    if (!file) return;
    const validExt = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExt.includes(ext)) return;
    if (file.size > 20 * 1024 * 1024) return;

    setUploadingRowId(rowId);
    try {
      const result = await uploadReceiptFile(file);
      updateRow(rowId, { receiptUrl: result.url });
    } catch {
      // Silent — row stays without a receipt; user can retry.
    } finally {
      setUploadingRowId(null);
    }
  }

  const validRows = rows.filter(r => r.description.trim() && Number(r.amount) > 0);
  const totalAmount = validRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const canSave = validRows.length > 0 && !saving;

  async function handleSaveAll() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSaveAll(date, validRows);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: 28, width: "100%", maxWidth: 900, maxHeight: "92vh", display: "flex", flexDirection: "column", position: "relative" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center", color: OR }}>
              <Layers size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0 }}>Tambah Banyak Pengeluaran</h3>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", margin: "2px 0 0" }}>Untuk tanggal yang sama — isi semua transaksi sekaligus.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={14} /></button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexShrink: 0 }}>
          <Calendar size={14} color="rgba(255,255,255,.4)" />
          <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".1em" }}>Tanggal untuk semua baris:</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...ipt, width: 170 }} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 130px 130px 70px 80px", gap: 8, padding: "0 6px" }}>
            {["Kategori", "Keterangan", "Jumlah (IDR)", "Proyek", "Struk", ""].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgba(255,255,255,.3)" }}>{h}</span>
            ))}
          </div>

          {rows.map((row, idx) => {
            const isUploading = uploadingRowId === row.rowId;
            const isPdf = row.receiptUrl?.toLowerCase().endsWith(".pdf");
            return (
              <div key={row.rowId} style={{
                display: "grid", gridTemplateColumns: "150px 1fr 130px 130px 70px 80px", gap: 8,
                padding: "8px 6px", borderRadius: 10, background: "rgba(255,255,255,.025)",
                border: "1px solid rgba(255,255,255,.06)", alignItems: "center",
              }}>
                <select value={row.category} onChange={e => updateRow(row.rowId, { category: e.target.value })}
                  style={{ ...ipt, padding: "7px 8px", fontSize: 12, cursor: "pointer" }}>
                  {EXPENSE_CATS.map(c => <option key={c} value={c} style={{ background: "#111318" }}>{c}</option>)}
                </select>

                <input value={row.description} onChange={e => updateRow(row.rowId, { description: e.target.value })}
                  placeholder={`Pengeluaran ke-${idx + 1}`} style={{ ...ipt, padding: "7px 10px", fontSize: 12 }} />

                <input type="number" value={row.amount} onChange={e => updateRow(row.rowId, { amount: e.target.value === "" ? "" : Number(e.target.value) })}
                  placeholder="0" style={{ ...ipt, padding: "7px 10px", fontSize: 12 }} />

                <select value={row.projectId || ""} onChange={e => updateRow(row.rowId, { projectId: e.target.value || null })}
                  style={{ ...ipt, padding: "7px 8px", fontSize: 12, cursor: "pointer" }}>
                  <option value="" style={{ background: "#111318" }}>—</option>
                  {projects.map(p => <option key={p.id} value={p.id} style={{ background: "#111318" }}>{p.title.slice(0, 16)}</option>)}
                </select>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  {row.receiptUrl ? (
                    <a href={row.receiptUrl} target="_blank" rel="noopener noreferrer"
                      style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(74,222,128,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4ade80" }}>
                      {isPdf ? <FileText size={13} /> : <ImageIcon size={13} />}
                    </a>
                  ) : (
                    <label style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,.05)", border: "1px dashed rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: isUploading ? "wait" : "pointer", color: "rgba(255,255,255,.35)" }}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                        onChange={e => handleRowFile(row.rowId, e.target.files?.[0])} disabled={isUploading} style={{ display: "none" }} />
                      {isUploading ? <Loader2 size={12} style={{ animation: "spin .8s linear infinite" }} /> : <Upload size={12} />}
                    </label>
                  )}
                </div>

                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <button onClick={() => duplicateRow(row.rowId)} title="Duplikat baris"
                    style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Copy size={11} />
                  </button>
                  <button onClick={() => removeRow(row.rowId)} disabled={rows.length === 1} title="Hapus baris"
                    style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(248,113,113,.1)", border: "none", cursor: rows.length === 1 ? "not-allowed" : "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", opacity: rows.length === 1 ? 0.3 : 1 }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}

          <button onClick={addRow} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px", borderRadius: 10, border: "1.5px dashed rgba(255,255,255,.15)",
            background: "rgba(255,255,255,.02)", color: "rgba(255,255,255,.45)",
            cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: FONT, marginTop: 2,
          }}>
            <ListPlus size={14} /> Tambah Baris
          </button>
        </div>

        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)", flexShrink: 0, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,.35)", margin: 0, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>
              {validRows.length} dari {rows.length} baris siap disimpan
            </p>
            <p style={{ fontSize: 18, fontWeight: 900, color: "#f87171", margin: "2px 0 0" }}>{formatCurrency(totalAmount)}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ ...btnBase, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}>Batal</button>
            <button onClick={handleSaveAll} disabled={!canSave}
              style={{ ...btnBase, background: OR, color: "#fff", opacity: canSave ? 1 : 0.4 }}>
              {saving ? "Menyimpan..." : <><Check size={14} /> Simpan {validRows.length > 0 ? `${validRows.length} Pengeluaran` : ""}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Print/Export Modal — choose month or custom range, generate PDF document ──
function PrintExpenseModal({ expenses, projects, onClose }: {
  expenses: Expense[];
  projects: Project[];
  onClose: () => void;
}) {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "range">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

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

  const { from, to, label } = getRange();
  const filtered = expenses.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d >= from && d <= to;
  });
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const catBreakdown = filtered.reduce((acc, e) => {
    acc[e.category || "Lainnya"] = (acc[e.category || "Lainnya"] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);
  const catRows = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);

  function projectName(id?: string | null) {
    if (!id) return "—";
    return projects.find(p => p.id === id)?.title || "—";
  }

  function handlePrint() {
    const w = window.open("", "_blank", "width=960,height=720");
    if (!w) return;

    const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Laporan Pengeluaran — ${label}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; color: #1a1d2e; padding: 36px 40px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 3px solid #FF6A20; }
  .logo-mark { font-size: 22px; font-weight: 900; color: #FF6A20; letter-spacing: -.02em; }
  .logo-sub { font-size: 11px; color: #888; margin-top: 3px; }
  .header-right { text-align: right; }
  .report-title { font-size: 21px; font-weight: 900; color: #1a1d2e; }
  .report-meta { font-size: 11px; color: #888; margin-top: 4px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 26px; }
  .kpi { padding: 14px 16px; border-radius: 10px; background: #f9fafb; border: 1px solid #e5e7eb; }
  .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; color: #9ca3af; margin-bottom: 5px; }
  .kpi-value { font-size: 18px; font-weight: 900; }
  .kv-red { color: #dc2626; }
  .kv-orange { color: #FF6A20; }
  .kv-dark { color: #1a1d2e; }
  .section { margin-bottom: 26px; page-break-inside: avoid; }
  .section-title { font-size: 13px; font-weight: 800; color: #1a1d2e; margin-bottom: 10px; padding-bottom: 7px; border-bottom: 2px solid #f3f4f6; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; width: 4px; height: 16px; background: #FF6A20; border-radius: 2px; flex-shrink: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .neg { color: #dc2626; font-weight: 700; }
  .bold { font-weight: 800; }
  .total-row td { background: #fff7ed; font-weight: 800; border-top: 2px solid #FF6A20; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; }
  .badge-cat { background: #fff1e9; color: #FF6A20; }
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  .progress-track { height: 6px; border-radius: 100px; background: #f3f4f6; overflow: hidden; margin-top: 4px; }
  .progress-fill { height: 100%; border-radius: 100px; background: #FF6A20; }
  @media print { body { padding: 20px 24px; } }
</style></head><body>

<div class="header">
  <div>
    <div class="logo-mark">FRAMELESS™</div>
    <div class="logo-sub">Creative Production House · Wonosobo, Central Java</div>
    <div class="logo-sub" style="margin-top:2px;">framelesscreative.com</div>
  </div>
  <div class="header-right">
    <div class="report-title">Laporan Pengeluaran</div>
    <div class="report-meta">Periode: ${label}</div>
    <div class="report-meta">Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Pengeluaran</div><div class="kpi-value kv-red">${formatCurrency(total)}</div></div>
  <div class="kpi"><div class="kpi-label">Jumlah Transaksi</div><div class="kpi-value kv-dark">${filtered.length}</div></div>
  <div class="kpi"><div class="kpi-label">Rata-rata / Transaksi</div><div class="kpi-value kv-orange">${formatCurrency(filtered.length > 0 ? total / filtered.length : 0)}</div></div>
</div>

<div class="section">
  <div class="section-title">Rincian per Kategori</div>
  <table>
    <thead><tr><th>Kategori</th><th>Jumlah</th><th>% dari Total</th><th style="width:160px;">Proporsi</th></tr></thead>
    <tbody>
      ${catRows.map(([cat, amt]) => {
        const pct = total > 0 ? (amt / total) * 100 : 0;
        return `<tr>
          <td><span class="badge badge-cat">${cat}</span></td>
          <td class="neg">${formatCurrency(amt)}</td>
          <td>${pct.toFixed(1)}%</td>
          <td><div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div></td>
        </tr>`;
      }).join("") || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Tidak ada data pada periode ini</td></tr>'}
      <tr class="total-row"><td>TOTAL</td><td class="neg">${formatCurrency(total)}</td><td colspan="2">100%</td></tr>
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">Rincian Transaksi (${filtered.length} item, urut tanggal)</div>
  <table>
    <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Proyek</th><th>Jumlah</th></tr></thead>
    <tbody>
      ${sorted.map(e => `<tr>
        <td>${new Date(e.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
        <td class="bold">${e.description}</td>
        <td>${e.category}</td>
        <td>${projectName(e.projectId)}</td>
        <td class="neg">${formatCurrency(Number(e.amount))}</td>
      </tr>`).join("") || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Tidak ada transaksi pada periode ini</td></tr>'}
      ${sorted.length > 0 ? `<tr class="total-row"><td colspan="4">TOTAL ${filtered.length} TRANSAKSI</td><td class="neg">${formatCurrency(total)}</td></tr>` : ""}
    </tbody>
  </table>
</div>

<div class="footer">
  <span>Frameless Creative Production House · Wonosobo, Central Java · framelesscreative.com</span>
  <span>Dokumen dibuat otomatis oleh sistem manajemen Frameless Creative</span>
</div>

</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 600);
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 22, padding: 30, width: "100%", maxWidth: 460, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center", color: OR }}>
            <Printer size={16} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0 }}>Cetak Laporan Pengeluaran</h3>
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

        <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 8px" }}>Pratinjau · {label}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{filtered.length} transaksi</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#f87171" }}>{formatCurrency(total)}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ ...btnBase, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)" }}>Batal</button>
          <button onClick={handlePrint} disabled={filtered.length === 0}
            style={{ ...btnBase, background: OR, color: "#fff", opacity: filtered.length === 0 ? 0.4 : 1 }}>
            <Printer size={14} /> Cetak PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Chart Tooltip ─────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(12,14,22,.98)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "rgba(255,255,255,.6)", marginBottom: 4, fontWeight: 600 }}>{label}</p>
      <p style={{ color: OR, fontWeight: 700 }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
export default function ExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Expense | null>(null);
  const [batchModal, setBatchModal] = useState(false);
  const [printModal, setPrintModal] = useState(false);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, proj] = await Promise.all([
        api("/api/expenses").catch(() => []),
        api("/api/projects").catch(() => []),
      ]);
      setExpenses(Array.isArray(exp) ? exp : []);
      setProjects(Array.isArray(proj) ? proj.map((p: any) => ({ id: p.id, title: p.title || p.name || "Proyek" })) : []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function saveExpense(data: Partial<Expense>) {
    try {
      await api(`/api/expenses/${(editModal as Expense).id}`, { method: "PUT", body: JSON.stringify(data) });
      toast({ title: "Pengeluaran diperbarui ✓" });
      setEditModal(null);
      await loadData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  }

  async function saveBatch(date: string, rows: BatchRow[]) {
    try {
      const results = await Promise.allSettled(
        rows.map(row => api("/api/expenses", {
          method: "POST",
          body: JSON.stringify({
            category: row.category,
            description: row.description.trim(),
            amount: Number(row.amount),
            date,
            projectId: row.projectId,
            receiptUrl: row.receiptUrl,
          }),
        }))
      );

      const failed = results.filter(r => r.status === "rejected").length;
      const succeeded = results.length - failed;

      if (succeeded > 0) {
        toast({ title: `${succeeded} pengeluaran berhasil ditambahkan ✓` });
      }
      if (failed > 0) {
        toast({ variant: "destructive", title: "Sebagian gagal", description: `${failed} baris gagal disimpan. Coba lagi untuk baris tersebut.` });
      }

      setBatchModal(false);
      await loadData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm("Hapus pengeluaran ini?")) return;
    try {
      await api(`/api/expenses/${id}`, { method: "DELETE" });
      toast({ title: "Dihapus" });
      await loadData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  }

  const filtered = expenses
    .filter(e => {
      const matchCat = catFilter === "ALL" || e.category === catFilter;
      const matchSearch = !search ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return sortDir === "desc" ? diff : -diff;
      } else {
        const diff = Number(b.amount) - Number(a.amount);
        return sortDir === "desc" ? diff : -diff;
      }
    });

  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const catBreakdown = expenses.reduce((acc, e) => {
    acc[e.category || "Lainnya"] = (acc[e.category || "Lainnya"] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);
  const catData = Object.entries(catBreakdown)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const monthlyData = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const nd = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const lbl = d.toLocaleString("id-ID", { month: "short" });
      const total = expenses
        .filter(e => e.date && new Date(e.date) >= d && new Date(e.date) < nd)
        .reduce((s, e) => s + Number(e.amount), 0);
      return { month: lbl, total };
    });
  })();

  const usedCats = [...new Set(expenses.map(e => e.category))].filter(Boolean);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${OR}`, borderTopColor: "transparent", animation: "spin .7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT, color: "#f0f0f0", paddingBottom: 60 }}>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", margin: "0 0 4px" }}>Pengeluaran</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 600 }}>Expense Tracker · Frameless Creative</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={loadData} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><RefreshCw size={14} /></button>
          <button onClick={() => setPrintModal(true)} style={{ ...btnBase, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.1)" }}><Printer size={14} /> Cetak Laporan</button>
          <button onClick={() => setBatchModal(true)} style={{ ...btnBase, background: OR, color: "#fff" }}><Layers size={14} /> Tambah Banyak</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { l: "Total Pengeluaran", v: formatCurrency(totalAll), c: "#f87171", sub: `${expenses.length} transaksi` },
          { l: "Kategori Terbanyak", v: catData[0]?.name || "—", c: OR, sub: catData[0] ? formatCurrency(catData[0].value) : "" },
          { l: "Rata-rata / Transaksi", v: formatCurrency(expenses.length > 0 ? totalAll / expenses.length : 0), c: "#fbbf24", sub: "semua waktu" },
          { l: "Bulan Ini", v: formatCurrency(monthlyData[monthlyData.length - 1]?.total || 0), c: "#a78bfa", sub: new Date().toLocaleString("id-ID", { month: "long", year: "numeric" }) },
        ].map(s => (
          <div key={s.l} style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".14em", margin: "0 0 8px" }}>{s.l}</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: s.c, margin: "0 0 4px", letterSpacing: "-.01em" }}>{s.v}</p>
            {s.sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,.3)", margin: 0 }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: "20px 22px" }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", margin: "0 0 16px" }}>Tren 6 Bulan Terakhir</p>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" stroke="rgba(255,255,255,.3)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,.2)" fontSize={10} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="total" name="Pengeluaran" radius={[6, 6, 0, 0]}>
                  {monthlyData.map((_, i) => (
                    <Cell key={i} fill={i === monthlyData.length - 1 ? OR : "rgba(255,106,32,.4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", padding: "20px 22px" }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", margin: "0 0 16px" }}>Per Kategori</p>
          {catData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {catData.slice(0, 6).map((d, i) => (
                <div key={d.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#f87171" }}>{formatCurrency(d.value)}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 100, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${totalAll > 0 ? (d.value / totalAll) * 100 : 0}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 100 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13, textAlign: "center", paddingTop: 32 }}>Belum ada data.</p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.35)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari keterangan atau kategori..." style={{ ...ipt, paddingLeft: 36 }} />
        </div>
        <select value={`${sortBy}-${sortDir}`} onChange={e => {
          const [by, dir] = e.target.value.split("-");
          setSortBy(by as any); setSortDir(dir as any);
        }} style={{ ...ipt, width: "auto", cursor: "pointer", paddingRight: 30 }}>
          <option value="date-desc" style={{ background: "#111318" }}>Terbaru</option>
          <option value="date-asc" style={{ background: "#111318" }}>Terlama</option>
          <option value="amount-desc" style={{ background: "#111318" }}>Terbesar</option>
          <option value="amount-asc" style={{ background: "#111318" }}>Terkecil</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["ALL", ...usedCats].map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            style={{
              padding: "5px 13px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              cursor: "pointer", border: "1px solid",
              borderColor: catFilter === cat ? OR : "rgba(255,255,255,.1)",
              background: catFilter === cat ? `${OR}20` : "rgba(255,255,255,.04)",
              color: catFilter === cat ? OR : "rgba(255,255,255,.45)",
              transition: "all .15s", fontFamily: FONT,
            }}>
            {cat === "ALL" ? `Semua (${expenses.length})` : cat}
          </button>
        ))}
      </div>

      {(search || catFilter !== "ALL") && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{filtered.length} hasil ditemukan</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f87171" }}>{formatCurrency(totalFiltered)}</span>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <TrendingDown size={40} color="rgba(255,255,255,.08)" style={{ margin: "0 auto 14px" }} />
            <p style={{ color: "rgba(255,255,255,.3)", fontSize: 14, marginBottom: 16 }}>
              {search || catFilter !== "ALL" ? "Tidak ada hasil yang cocok." : "Belum ada pengeluaran tercatat."}
            </p>
            {!search && catFilter === "ALL" && (
              <button onClick={() => setBatchModal(true)} style={{ ...btnBase, background: OR, color: "#fff", margin: "0 auto" }}><Plus size={14} /> Tambah Pengeluaran</button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 120px 80px 70px", gap: 0, padding: "9px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              {["Tanggal", "Keterangan", "Kategori", "Jumlah", "Proyek", ""].map(h => (
                <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.3)" }}>{h}</span>
              ))}
            </div>

            {filtered.map((e, idx) => (
              <div key={e.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 2fr 120px 120px 80px 70px",
                  gap: 0, padding: "13px 18px",
                  borderBottom: idx < filtered.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>
                  {e.date ? new Date(e.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </span>

                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{e.description}</p>
                  {e.receiptUrl && (
                    <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: OR, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <Receipt size={10} /> Lihat Struk
                    </a>
                  )}
                </div>

                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(255,106,32,.12)", color: OR, display: "inline-block" }}>
                  {e.category}
                </span>

                <span style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>
                  {formatCurrency(Number(e.amount))}
                </span>

                <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>
                  {e.projectId ? (projects.find(p => p.id === e.projectId)?.title || "—").slice(0, 12) : "—"}
                </span>

                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <button onClick={() => setEditModal(e)}
                    style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => deleteExpense(e.id)}
                    style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(248,113,113,.1)", border: "none", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 120px 120px 80px 70px", gap: 0, padding: "12px 18px", borderTop: `2px solid ${OR}`, background: `${OR}08` }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", gridColumn: "1 / 3" }}>
                TOTAL {catFilter !== "ALL" ? catFilter : ""} ({filtered.length} transaksi)
              </span>
              <span />
              <span style={{ fontSize: 15, fontWeight: 900, color: "#f87171" }}>{formatCurrency(totalFiltered)}</span>
              <span />
              <span />
            </div>
          </>
        )}
      </div>

      {editModal && (
        <ExpenseModal item={editModal} projects={projects} onClose={() => setEditModal(null)} onSave={saveExpense} />
      )}
      {batchModal && (
        <BatchExpenseModal projects={projects} onClose={() => setBatchModal(false)} onSaveAll={saveBatch} />
      )}
      {printModal && (
        <PrintExpenseModal expenses={expenses} projects={projects} onClose={() => setPrintModal(false)} />
      )}
    </div>
  );
}