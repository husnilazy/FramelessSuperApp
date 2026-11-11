// artifacts/frameless/src/components/ImportCsvModal.tsx
// Impor pengeluaran & pemasukan dari CSV/Excel-export. Pakai endpoint yang sudah ada (POST /api/expenses, /api/income)
// sehingga jurnal akuntansi otomatis tetap terisi. Ada pratinjau, dan baris yang sudah ada (tanggal+nominal+keterangan sama) dilewati.
import { useEffect, useMemo, useState } from "react";
import { X, Upload, Check, AlertCircle, Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";

const OR = "hsl(var(--primary))";
const FONT = "'Plus Jakarta Sans',sans-serif";
const EXPENSE_CATS = ["Peralatan", "Transportasi", "Akomodasi", "Makan & Minum", "Utilitas", "Software & Langganan", "Marketing", "Gaji & Honor", "Sewa Tempat", "Komunikasi", "Administrasi", "Lainnya"];
const INCOME_CATS = ["Jasa Produksi", "Jasa Editing", "Konsultasi", "Sewa Alat", "Royalti", "Bonus", "Pinjaman", "Lainnya"];

async function api(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Request gagal"); }
  return r.json();
}

type Row = { n: number; date: string; type: "expense" | "income"; desc: string; category: string; amount: number; dup: boolean; error?: string; use: boolean };

/** CSV sederhana: pemisah koma/titik koma (otomatis), tanda kutip ganda, BOM. */
function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const first = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const out: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}
const num = (s: string) => parseInt((s ?? "").replace(/[^\d-]/g, "") || "0", 10) || 0;
function toIsoDate(s: string): string | null {
  const v = (s ?? "").trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
const key = (date: string, amount: number, desc: string) => `${date}|${Math.round(amount)}|${desc.trim().toLowerCase().replace(/\s+/g, " ")}`;
const localDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const ipt: React.CSSProperties = { background: "rgb(var(--ink) / .05)", border: "1px solid rgb(var(--ink) / .1)", borderRadius: 10, padding: "8px 10px", color: "hsl(var(--foreground))", fontSize: 12, fontFamily: FONT };
const btn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT, border: "none" };

export default function ImportCsvModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [existing, setExisting] = useState<Set<string> | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseErr, setParseErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; fail: { n: number; msg: string }[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [exp, inc] = await Promise.all([api("/api/expenses").catch(() => []), api("/api/income").catch(() => [])]);
      const s = new Set<string>();
      (Array.isArray(exp) ? exp : []).forEach((e: any) => s.add("e|" + key(localDate(e.date), Number(e.amount), e.description || "")));
      (Array.isArray(inc) ? inc : []).forEach((e: any) => s.add("i|" + key(localDate(e.date), Number(e.amount), e.description || "")));
      setExisting(s);
    })();
  }, []);

  function load(text: string, name: string) {
    setParseErr(""); setResult(null); setFileName(name);
    const grid = parseCsv(text);
    if (grid.length < 2) { setParseErr("File kosong atau tidak terbaca."); setRows([]); return; }
    const head = grid[0].map((h) => h.trim().toLowerCase());
    const ix = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const cDate = ix("tanggal", "date"), cType = ix("jenis", "tipe", "type"), cDesc = ix("keterangan", "deskripsi", "description"), cCat = ix("kategori", "category"), cIn = ix("masuk", "pemasukan"), cOut = ix("keluar", "pengeluaran");
    if (cDate < 0 || cDesc < 0 || (cIn < 0 && cOut < 0)) { setParseErr("Kolom wajib: Tanggal, Keterangan, dan Masuk/Keluar (kolom Jenis & Kategori opsional)."); setRows([]); return; }
    const parsed: Row[] = [];
    grid.slice(1).forEach((r, i) => {
      const date = toIsoDate(r[cDate] ?? ""), desc = (r[cDesc] ?? "").trim();
      const inn = cIn >= 0 ? num(r[cIn]) : 0, out = cOut >= 0 ? num(r[cOut]) : 0;
      const label = (cType >= 0 ? r[cType] : "").trim().toLowerCase();
      if (label === "total" || (!inn && !out && !desc)) return;
      const type: "expense" | "income" = out > 0 ? "expense" : "income";
      const amount = out > 0 ? out : inn;
      const cat = (cCat >= 0 ? r[cCat] : "").trim();
      const valid = type === "expense" ? EXPENSE_CATS : INCOME_CATS;
      const category = valid.find((c) => c.toLowerCase() === cat.toLowerCase()) ?? "Lainnya";
      const error = !date ? "tanggal tidak valid" : !desc ? "keterangan kosong" : amount <= 0 ? "nominal 0" : undefined;
      parsed.push({ n: i + 2, date: date ?? "", type, desc, category, amount, dup: false, error, use: !error });
    });
    setRows(parsed);
  }

  // Tandai baris yang sudah ada begitu daftar existing siap (dan setiap file baru dibaca).
  const marked = useMemo(() => rows.map((r) => {
    const dup = !!existing && !r.error && existing.has((r.type === "expense" ? "e|" : "i|") + key(r.date, r.amount, r.desc));
    return { ...r, dup };
  }), [rows, existing]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const todo = marked.filter((r) => !r.error && !r.dup && !off.has(r.n));
  const sumOut = todo.filter((r) => r.type === "expense").reduce((a, r) => a + r.amount, 0);
  const sumIn = todo.filter((r) => r.type === "income").reduce((a, r) => a + r.amount, 0);

  async function run() {
    setBusy(true); setProgress(0);
    let ok = 0; const fail: { n: number; msg: string }[] = [];
    for (const [i, r] of todo.entries()) {
      try {
        if (r.type === "expense") await api("/api/expenses", { method: "POST", body: JSON.stringify({ category: r.category, description: r.desc, amount: r.amount, date: r.date }) });
        else await api("/api/income", { method: "POST", body: JSON.stringify({ category: r.category, description: r.desc, amount: r.amount, date: r.date, source: "Impor CSV" }) });
        ok++;
      } catch (e: any) { fail.push({ n: r.n, msg: e?.message || "gagal" }); }
      setProgress(i + 1);
    }
    setBusy(false); setResult({ ok, fail }); if (ok > 0) onDone();
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "hsl(var(--card))", border: "1px solid rgb(var(--ink) / .1)", borderRadius: 22, padding: 26, width: "100%", maxWidth: 880, maxHeight: "92vh", display: "flex", flexDirection: "column", position: "relative", fontFamily: FONT, color: "hsl(var(--foreground))" }}>
        <button onClick={onClose} disabled={busy} aria-label="Tutup" style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgb(var(--ink) / .06)", border: "none", cursor: "pointer", color: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Impor CSV</h3>
        <p style={{ fontSize: 11, opacity: .55, margin: "4px 0 14px" }}>Kolom: Tanggal, Jenis, Keterangan, Kategori, Masuk, Keluar. Baris yang sudah ada (tanggal, nominal, dan keterangan sama) dilewati otomatis. Pemasukan dari invoice tidak diimpor di sini; catat lewat Invoice.</p>

        <label style={{ ...btn, background: "rgb(var(--ink) / .06)", border: "1px dashed rgb(var(--ink) / .25)", color: "inherit", justifyContent: "center", marginBottom: 14, cursor: "pointer" }}>
          <Upload size={14} /> {fileName || "Pilih file CSV"}
          <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setOff(new Set()); load(await f.text(), f.name); } }} />
        </label>
        {parseErr && <p style={{ fontSize: 12, color: "var(--c-red)", display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={13} /> {parseErr}</p>}
        {existing === null && <p style={{ fontSize: 11, opacity: .55 }}><Loader2 size={12} style={{ display: "inline", animation: "spin .8s linear infinite" }} /> Memeriksa data yang sudah ada…</p>}

        {marked.length > 0 && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, marginBottom: 10 }}>
              <span><b>{todo.length}</b> baris akan diimpor</span>
              <span style={{ color: "var(--c-red)" }}>Pengeluaran {formatCurrency(sumOut)}</span>
              <span style={{ color: "var(--c-green)" }}>Pemasukan {formatCurrency(sumIn)}</span>
              <span style={{ opacity: .6 }}>{marked.filter((r) => r.dup).length} sudah ada · {marked.filter((r) => r.error).length} bermasalah</span>
            </div>
            <div style={{ overflow: "auto", flex: 1, border: "1px solid rgb(var(--ink) / .08)", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>{["", "Tanggal", "Jenis", "Keterangan", "Kategori", "Jumlah", "Status"].map((h) => <th key={h} style={{ textAlign: h === "Jumlah" ? "right" : "left", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", opacity: .5, padding: "7px 8px", position: "sticky", top: 0, background: "hsl(var(--card))" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {marked.map((r) => (
                    <tr key={r.n} style={{ opacity: r.dup || r.error ? 0.5 : 1 }}>
                      <td style={{ padding: "6px 8px" }}><input type="checkbox" disabled={!!r.error || r.dup} checked={!r.error && !r.dup && !off.has(r.n)} onChange={(e) => setOff((s) => { const n = new Set(s); if (e.target.checked) n.delete(r.n); else n.add(r.n); return n; })} aria-label={`Impor baris ${r.n}`} /></td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.date || "—"}</td>
                      <td style={{ padding: "6px 8px" }}>{r.type === "expense" ? "Keluar" : "Masuk"}</td>
                      <td style={{ padding: "6px 8px" }}>{r.desc}</td>
                      <td style={{ padding: "6px 8px" }}>{r.category}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: r.type === "expense" ? "var(--c-red)" : "var(--c-green)" }}>{formatCurrency(r.amount)}</td>
                      <td style={{ padding: "6px 8px", fontSize: 11 }}>{r.error ? <span style={{ color: "var(--c-red)" }}>{r.error}</span> : r.dup ? "sudah ada" : off.has(r.n) ? "dilewati" : "baru"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {result && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <p style={{ margin: 0, color: "var(--c-green)", display: "flex", gap: 6, alignItems: "center" }}><Check size={14} /> {result.ok} baris berhasil diimpor.</p>
            {result.fail.length > 0 && <p style={{ margin: "6px 0 0", color: "var(--c-red)" }}>{result.fail.length} gagal: {result.fail.map((f) => `baris ${f.n} (${f.msg})`).join(", ")}</p>}
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16, alignItems: "center" }}>
          {busy && <span style={{ fontSize: 12, opacity: .7 }}>Mengimpor {progress}/{todo.length}…</span>}
          <button onClick={onClose} disabled={busy} style={{ ...btn, background: "rgb(var(--ink) / .06)", color: "inherit", border: "1px solid rgb(var(--ink) / .1)" }}>{result ? "Selesai" : "Batal"}</button>
          {!result && <button onClick={run} disabled={busy || todo.length === 0 || existing === null} style={{ ...btn, background: OR, color: "#fff", opacity: busy || todo.length === 0 ? 0.5 : 1 }}>{busy ? "Mengimpor…" : `Impor ${todo.length} baris`}</button>}
        </div>
      </div>
    </div>
  );
}

// diekspor untuk pengujian
export { parseCsv, toIsoDate };
