// artifacts/frameless/src/components/MonthlyReport.tsx
// Laporan keuangan per bulan: ringkasan, perbandingan bulan lalu, rincian pemasukan & pengeluaran, rekap 12 bulan.
// Murni hitungan dari data yang sudah dimuat halaman Keuangan (tidak ada endpoint baru, tidak mengubah data).
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Download, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const OR = "hsl(var(--primary))";
const FONT = "'Plus Jakarta Sans',sans-serif";
const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type CashEvent = { id: string; invoiceNumber: string; clientName: string | null; amount: number; date: string; method: string };
type Income = { id: string; amount: number; category: string; description: string; date: string; source: string };
type Expense = { id: string; amount: number; category: string; description: string; date: string; projectId?: string | null };

const inMonth = (iso: string, y: number, m: number) => { const d = new Date(iso); return d.getFullYear() === y && d.getMonth() === m; };
const day = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

const card: React.CSSProperties = { background: "rgb(var(--ink) / .025)", borderRadius: 16, border: "1px solid rgb(var(--ink) / .07)", padding: 18 };
const th: React.CSSProperties = { textAlign: "left", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "rgb(var(--ink) / calc(.35 + var(--ink-boost)))", padding: "6px 8px", borderBottom: "1px solid rgb(var(--ink) / .08)" };
const td: React.CSSProperties = { padding: "8px", fontSize: 12, borderBottom: "1px solid rgb(var(--ink) / .05)", color: "hsl(var(--foreground))", verticalAlign: "top" };
const navBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, background: "rgb(var(--ink) / .06)", border: "1px solid rgb(var(--ink) / .1)", cursor: "pointer", color: "hsl(var(--foreground))", display: "flex", alignItems: "center", justifyContent: "center" };
const sel: React.CSSProperties = { background: "rgb(var(--ink) / .05)", border: "1px solid rgb(var(--ink) / .1)", borderRadius: 10, padding: "8px 12px", color: "hsl(var(--foreground))", fontSize: 13, fontFamily: FONT, cursor: "pointer" };

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", margin: 0, color: "rgb(var(--ink) / calc(.35 + var(--ink-boost)))" }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 900, margin: "6px 0 2px", color: color ?? "hsl(var(--foreground))", letterSpacing: "-.02em" }}>{value}</p>
      {sub && <p style={{ fontSize: 10, margin: 0, color: "rgb(var(--ink) / calc(.4 + var(--ink-boost)))" }}>{sub}</p>}
    </div>
  );
}

function delta(cur: number, prev: number): string | undefined {
  if (!prev && !cur) return undefined;
  if (!prev) return "bulan lalu Rp 0";
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  return `${p >= 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}% dari bulan lalu`;
}

export default function MonthlyReport({ cashEvents, incomeEntries, expenses, year, onPrint }: {
  cashEvents: CashEvent[]; incomeEntries: Income[]; expenses: Expense[]; year: number;
  onPrint: (range: { from: Date; to: Date; label: string }) => void;
}) {
  const now = new Date();
  const [y, setY] = useState(year);
  const [m, setM] = useState(y === now.getFullYear() ? now.getMonth() : 11);

  const go = (d: number) => { const t = new Date(y, m + d, 1); setY(t.getFullYear()); setM(t.getMonth()); };
  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    [...cashEvents.map((e) => e.date), ...incomeEntries.map((e) => e.date), ...expenses.map((e) => e.date)].forEach((d) => { const v = new Date(d).getFullYear(); if (Number.isFinite(v)) ys.add(v); });
    return [...ys].sort((a, b) => b - a);
  }, [cashEvents, incomeEntries, expenses]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    const monthTotals = (yy: number, mm: number) => {
      const inv = cashEvents.filter((e) => inMonth(e.date, yy, mm));
      const man = incomeEntries.filter((e) => inMonth(e.date, yy, mm));
      const exp = expenses.filter((e) => inMonth(e.date, yy, mm));
      const income = inv.reduce((a, e) => a + e.amount, 0) + man.reduce((a, e) => a + Number(e.amount || 0), 0);
      const expense = exp.reduce((a, e) => a + Number(e.amount || 0), 0);
      return { inv, man, exp, income, expense, net: income - expense };
    };
    const cur = monthTotals(y, m);
    const pm = new Date(y, m - 1, 1);
    const prev = monthTotals(pm.getFullYear(), pm.getMonth());
    // Saldo kumulatif: semua pemasukan - pengeluaran yang dicatat sampai akhir bulan terpilih.
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    const upTo = (iso: string) => new Date(iso) <= end;
    const cumulative = cashEvents.filter((e) => upTo(e.date)).reduce((a, e) => a + e.amount, 0)
      + incomeEntries.filter((e) => upTo(e.date)).reduce((a, e) => a + Number(e.amount || 0), 0)
      - expenses.filter((e) => upTo(e.date)).reduce((a, e) => a + Number(e.amount || 0), 0);
    const byClient = new Map<string, number>();
    cur.inv.forEach((e) => byClient.set(e.clientName?.trim() || "(tanpa klien)", (byClient.get(e.clientName?.trim() || "(tanpa klien)") ?? 0) + e.amount));
    const byCat = new Map<string, number>();
    cur.exp.forEach((e) => byCat.set(e.category || "Lainnya", (byCat.get(e.category || "Lainnya") ?? 0) + Number(e.amount || 0)));
    const incomeRows = [
      ...cur.inv.map((e) => ({ date: e.date, who: `${e.invoiceNumber} · ${e.clientName?.trim() || "—"}`, kind: `Invoice (${e.method})`, amount: e.amount })),
      ...cur.man.map((e) => ({ date: e.date, who: e.description, kind: e.category || "Manual", amount: Number(e.amount || 0) })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const expenseRows = [...cur.exp].sort((a, b) => a.date.localeCompare(b.date));
    const year12 = Array.from({ length: 12 }, (_, i) => ({ i, ...monthTotals(y, i) }));
    return { cur, prev, cumulative, byClient: [...byClient.entries()].sort((a, b) => b[1] - a[1]), byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]), incomeRows, expenseRows, year12 };
  }, [cashEvents, incomeEntries, expenses, y, m]);

  const label = `${MONTHS_ID[m]} ${y}`;
  const { cur, prev } = data;
  const missingExpense = cur.income > 0 && cur.expense === 0;
  const maxCat = Math.max(1, ...data.byCat.map(([, v]) => v));

  function exportCsv() {
    const lines = [["Tanggal", "Jenis", "Keterangan", "Kategori", "Masuk", "Keluar"].map(csvCell).join(",")];
    data.incomeRows.forEach((r) => lines.push([r.date.slice(0, 10), "Pemasukan", r.who, r.kind, r.amount, ""].map(csvCell).join(",")));
    data.expenseRows.forEach((r) => lines.push([r.date.slice(0, 10), "Pengeluaran", r.description || "", r.category || "Lainnya", "", Number(r.amount || 0)].map(csvCell).join(",")));
    lines.push(["", "TOTAL", "", "", cur.income, cur.expense].map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `laporan-keuangan-${y}-${String(m + 1).padStart(2, "0")}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={navBtn} onClick={() => go(-1)} aria-label="Bulan sebelumnya"><ChevronLeft size={16} /></button>
          <select value={m} onChange={(e) => setM(Number(e.target.value))} style={sel} aria-label="Bulan">{MONTHS_ID.map((n, i) => <option key={n} value={i} style={{ background: "hsl(var(--card))" }}>{n}</option>)}</select>
          <select value={y} onChange={(e) => setY(Number(e.target.value))} style={sel} aria-label="Tahun">{years.map((v) => <option key={v} value={v} style={{ background: "hsl(var(--card))" }}>{v}</option>)}</select>
          <button style={navBtn} onClick={() => go(1)} aria-label="Bulan berikutnya"><ChevronRight size={16} /></button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportCsv} style={{ ...sel, display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12 }}><Download size={14} /> CSV</button>
          <button onClick={() => onPrint({ from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59), label })} style={{ ...sel, display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12, background: OR, color: "#fff", border: "none" }}><Printer size={14} /> Cetak {MON_SHORT[m]} {y}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 }}>
        <Kpi label="Pemasukan" value={formatCurrency(cur.income)} sub={delta(cur.income, prev.income)} color="var(--c-green)" />
        <Kpi label="Pengeluaran" value={formatCurrency(cur.expense)} sub={delta(cur.expense, prev.expense)} color="var(--c-red)" />
        <Kpi label="Arus bersih" value={formatCurrency(cur.net)} sub={cur.net >= 0 ? "Surplus" : "Defisit"} color={cur.net >= 0 ? "var(--c-green)" : "var(--c-red)"} />
        <Kpi label={`Saldo s.d. akhir ${MON_SHORT[m]}`} value={formatCurrency(data.cumulative)} sub="Pemasukan − pengeluaran tercatat" />
      </div>

      {missingExpense && (
        <div style={{ ...card, display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, borderColor: "color-mix(in srgb, var(--c-amber) 40%, transparent)" }}>
          <AlertCircle size={16} style={{ color: "var(--c-amber)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: "hsl(var(--foreground))" }}>Ada pemasukan {label} tetapi <b>belum ada pengeluaran tercatat</b>. Laba bulan ini kemungkinan terlihat lebih besar dari kenyataan. Input pengeluarannya di menu Pengeluaran supaya laporan lengkap.</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginBottom: 16 }}>
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 10px" }}>Pemasukan {label}</h3>
          {data.incomeRows.length === 0 ? <p style={{ fontSize: 12, opacity: .6 }}>Belum ada pemasukan di bulan ini.</p> : (
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Tgl</th><th style={th}>Dari</th><th style={{ ...th, textAlign: "right" }}>Jumlah</th></tr></thead>
              <tbody>
                {data.incomeRows.map((r, i) => (
                  <tr key={i}><td style={{ ...td, whiteSpace: "nowrap" }}>{day(r.date)}</td><td style={td}>{r.who}<span style={{ display: "block", fontSize: 10, opacity: .55 }}>{r.kind}</span></td><td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--c-green)" }}>{formatCurrency(r.amount)}</td></tr>
                ))}
                <tr><td style={td} /><td style={{ ...td, fontWeight: 800 }}>Total</td><td style={{ ...td, textAlign: "right", fontWeight: 900 }}>{formatCurrency(cur.income)}</td></tr>
              </tbody>
            </table></div>
          )}
          {data.byClient.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", opacity: .5, margin: "0 0 6px" }}>Per klien</p>
              {data.byClient.map(([n, v]) => <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}><span>{n}</span><b>{formatCurrency(v)}</b></div>)}
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 10px" }}>Pengeluaran {label}</h3>
          {data.byCat.length === 0 ? <p style={{ fontSize: 12, opacity: .6 }}>Belum ada pengeluaran di bulan ini.</p> : (
            <>
              <div style={{ marginBottom: 12 }}>
                {data.byCat.map(([n, v]) => (
                  <div key={n} style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span>{n}</span><b>{formatCurrency(v)} <span style={{ fontWeight: 500, opacity: .5 }}>({cur.expense > 0 ? ((v / cur.expense) * 100).toFixed(0) : 0}%)</span></b></div>
                    <div style={{ height: 5, borderRadius: 9, background: "rgb(var(--ink) / .07)", marginTop: 3 }}><div style={{ height: "100%", width: `${(v / maxCat) * 100}%`, borderRadius: 9, background: "var(--c-red)" }} /></div>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Tgl</th><th style={th}>Keterangan</th><th style={{ ...th, textAlign: "right" }}>Jumlah</th></tr></thead>
                <tbody>
                  {data.expenseRows.map((r) => (
                    <tr key={r.id}><td style={{ ...td, whiteSpace: "nowrap" }}>{day(r.date)}</td><td style={td}>{r.description || "—"}<span style={{ display: "block", fontSize: 10, opacity: .55 }}>{r.category || "Lainnya"}</span></td><td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--c-red)" }}>{formatCurrency(Number(r.amount || 0))}</td></tr>
                  ))}
                  <tr><td style={td} /><td style={{ ...td, fontWeight: 800 }}>Total</td><td style={{ ...td, textAlign: "right", fontWeight: 900 }}>{formatCurrency(cur.expense)}</td></tr>
                </tbody>
              </table></div>
            </>
          )}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 10px" }}>Rekap per bulan {y}</h3>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead><tr><th style={th}>Bulan</th><th style={{ ...th, textAlign: "right" }}>Pemasukan</th><th style={{ ...th, textAlign: "right" }}>Pengeluaran</th><th style={{ ...th, textAlign: "right" }}>Arus bersih</th></tr></thead>
          <tbody>
            {data.year12.map((r) => (
              <tr key={r.i} onClick={() => setM(r.i)} style={{ cursor: "pointer", background: r.i === m ? "rgb(var(--ink) / .07)" : undefined }}>
                <td style={{ ...td, fontWeight: r.i === m ? 800 : 500 }}>{MONTHS_ID[r.i]}</td>
                <td style={{ ...td, textAlign: "right", color: r.income ? "var(--c-green)" : undefined }}>{r.income ? formatCurrency(r.income) : "—"}</td>
                <td style={{ ...td, textAlign: "right", color: r.expense ? "var(--c-red)" : undefined }}>{r.expense ? formatCurrency(r.expense) : "—"}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: r.net < 0 ? "var(--c-red)" : r.net > 0 ? "var(--c-green)" : undefined }}>{r.income || r.expense ? formatCurrency(r.net) : "—"}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 900 }}>Total {y}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 900 }}>{formatCurrency(data.year12.reduce((a, r) => a + r.income, 0))}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 900 }}>{formatCurrency(data.year12.reduce((a, r) => a + r.expense, 0))}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 900 }}>{formatCurrency(data.year12.reduce((a, r) => a + r.net, 0))}</td>
            </tr>
          </tbody>
        </table></div>
        <p style={{ fontSize: 10, opacity: .5, margin: "8px 0 0" }}>Klik satu baris untuk membuka rinciannya. Uang masuk invoice dihitung pada tanggal pembayarannya.</p>
      </div>
    </div>
  );
}
