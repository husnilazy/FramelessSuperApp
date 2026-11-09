import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Trash2, Wallet } from "lucide-react";

type Alloc = { id: string; role: string; memberId: string | null; person: string; sharePct: number; amountOverride: number | null; paid: boolean; paidAt?: string | null; note: string };
type Split = { name: string; pct: number };
type Data = {
  config: { baseAmount: number | null; marginPct: number; toolsPct: number; directPct: number; split: Split[]; note: string };
  budget: number; received: number; outstanding: number; invoiced: number; directActual: number; directPlanned: number; toolsAmt: number;
  allocations: (Alloc & { amount: number; computed: number; overridden: boolean })[];
  defaultRoles: { role: string; pct: number }[];
  payments: { id: string; amount: number; date: string; number: string; method: string }[];
  expenses: { id: string; category: string; description: string; amount: number; date: string }[];
};

const api = async (id: string, init?: RequestInit) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api/projects/${id}/finance`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Permintaan gagal");
  return body;
};
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const field = "bg-foreground/5 border border-foreground/10 text-foreground text-sm rounded px-2 py-1.5 w-full";
const label = "text-xs uppercase tracking-wider text-muted-foreground";

/** Keuangan proyek: pengaturan potongan, alokasi crew per peran, bagi hasil margin, dan ringkasan per orang. */
export default function ProjectFinance({ projectId, members }: { projectId: string; members?: { id: string; name: string; role: string }[] }) {
  const { toast } = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [cfg, setCfg] = useState<Data["config"] | null>(null);
  const [alloc, setAlloc] = useState<Alloc[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const x: Data = await api(projectId);
      setD(x); setCfg(x.config);
      setAlloc(x.allocations.map((a) => ({ id: a.id, role: a.role, memberId: a.memberId, person: a.person, sharePct: a.sharePct, amountOverride: a.overridden ? a.amount : null, paid: a.paid, paidAt: a.paidAt, note: a.note })));
      setDirty(false);
    } catch (e: any) { toast({ title: "Gagal memuat keuangan proyek", description: e.message, variant: "destructive" }); }
  }, [projectId, toast]);
  useEffect(() => { load(); }, [load]);

  const calc = useMemo(() => {
    if (!d || !cfg) return null;
    const budget = n(cfg.baseAmount) || d.budget;
    const cut = cfg.marginPct + cfg.toolsPct + cfg.directPct;
    const crewPool = Math.round(budget * (1 - cut / 100));
    const rows = alloc.map((a) => { const computed = Math.round((crewPool * n(a.sharePct)) / 100); return { ...a, computed, amount: a.amountOverride != null ? n(a.amountOverride) : computed }; });
    const crewTotal = rows.reduce((s, r) => s + r.amount, 0);
    const pctSum = alloc.reduce((s, r) => s + n(r.sharePct), 0);
    const toolsAmt = Math.round((budget * cfg.toolsPct) / 100);
    const margin = d.received - d.directActual - crewTotal - toolsAmt;
    const plannedMargin = Math.round((budget * cfg.marginPct) / 100);
    const people = new Map<string, { amount: number; paid: number }>();
    rows.forEach((r) => { const k = r.person || "(belum ditentukan)"; const e = people.get(k) ?? { amount: 0, paid: 0 }; e.amount += r.amount; if (r.paid) e.paid += r.amount; people.set(k, e); });
    const split = cfg.split.length ? cfg.split : [{ name: "Kas perusahaan", pct: 100 }];
    return { budget, cut, crewPool, rows, crewTotal, pctSum, toolsAmt, margin, plannedMargin, people: [...people.entries()], split, splitSum: split.reduce((s, x) => s + n(x.pct), 0) };
  }, [d, cfg, alloc]);

  if (!d || !cfg || !calc) return <div className="glass-panel rounded-xl p-6 text-sm text-muted-foreground">Memuat keuangan proyek…</div>;

  const setC = (patch: Partial<Data["config"]>) => { setCfg({ ...cfg, ...patch }); setDirty(true); };
  const setA = (i: number, patch: Partial<Alloc>) => { setAlloc((l) => l.map((a, k) => (k === i ? { ...a, ...patch } : a))); setDirty(true); };
  const fillDefaults = () => { setAlloc(d.defaultRoles.map((r, i) => ({ id: `new-${i}`, role: r.role, memberId: null, person: "", sharePct: r.pct, amountOverride: null, paid: false, note: "" }))); setDirty(true); };
  const addRow = () => { setAlloc((l) => [...l, { id: `new-${Date.now()}`, role: "Crew", memberId: null, person: "", sharePct: 0, amountOverride: null, paid: false, note: "" }]); setDirty(true); };
  const save = async () => {
    setSaving(true);
    try {
      await api(projectId, { method: "PUT", body: JSON.stringify({ config: cfg, allocations: alloc }) });
      toast({ title: "Keuangan proyek tersimpan" });
      await load();
    } catch (e: any) { toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const stat = (t: string, v: string, sub?: string, tone = "") => (
    <Card className="glass-panel border-foreground/5"><CardContent className="p-4">
      <div className={label}>{t}</div><div className={`text-lg font-semibold mt-1 ${tone}`}>{v}</div>{sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-heading tracking-wider text-foreground flex items-center gap-2"><Wallet className="w-5 h-5" /> Keuangan Proyek</h2>
        <Button onClick={save} disabled={saving || !dirty} className="bg-primary text-white font-heading tracking-wider">{saving ? "Menyimpan…" : dirty ? "Simpan perubahan" : "Tersimpan"}</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stat("Nilai proyek", formatCurrency(calc.budget), cfg.baseAmount ? "diisi manual" : d.budget ? "dari budget proyek" : "dari total invoice")}
        {stat("Sudah diterima", formatCurrency(d.received), `${d.payments.length} pembayaran`, "text-green-400")}
        {stat("Sisa tagihan", formatCurrency(Math.max(0, calc.budget - d.received)))}
        {stat("Biaya langsung", formatCurrency(d.directActual), `rencana ${formatCurrency(Math.round((calc.budget * cfg.directPct) / 100))}`, d.directActual > (calc.budget * cfg.directPct) / 100 ? "text-red-400" : "")}
        {stat("Margin nyata", formatCurrency(calc.margin), `rencana ${formatCurrency(calc.plannedMargin)}`, calc.margin < 0 ? "text-red-400" : "text-green-400")}
      </div>

      <Card className="glass-panel border-foreground/10">
        <CardHeader className="pb-2"><CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Potongan dari nilai proyek</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className={label}>Nilai dasar (opsional)</div><Input type="number" min={0} value={cfg.baseAmount ?? ""} placeholder="otomatis" onChange={(e) => setC({ baseAmount: e.target.value === "" ? null : n(e.target.value) })} className="bg-foreground/5 border-foreground/10 text-foreground" /></div>
            <div><div className={label}>Margin Frameless %</div><input type="number" min={0} max={90} className={field} value={cfg.marginPct} onChange={(e) => setC({ marginPct: n(e.target.value) })} /></div>
            <div><div className={label}>Tools / penyusutan %</div><input type="number" min={0} max={90} className={field} value={cfg.toolsPct} onChange={(e) => setC({ toolsPct: n(e.target.value) })} /></div>
            <div><div className={label}>Biaya langsung %</div><input type="number" min={0} max={90} className={field} value={cfg.directPct} onChange={(e) => setC({ directPct: n(e.target.value) })} /></div>
          </div>
          <p className="text-sm text-muted-foreground">
            Potongan {calc.cut}% → <b className="text-foreground">porsi crew {formatCurrency(calc.crewPool)}</b> ({100 - calc.cut}% dari {formatCurrency(calc.budget)}). Alat {formatCurrency(calc.toolsAmt)}.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-panel border-foreground/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Alokasi crew per peran</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fillDefaults}>Isi peran standar</Button>
              <Button size="sm" variant="outline" onClick={addRow}><Plus className="w-4 h-4 mr-1" />Peran</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {calc.rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada alokasi. Klik "Isi peran standar" lalu pilih orangnya. Satu orang boleh merangkap beberapa peran.</p>}
          {calc.rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center bg-foreground/5 rounded-lg p-2">
              <input className={`${field} col-span-12 md:col-span-3`} value={r.role} onChange={(e) => setA(i, { role: e.target.value })} aria-label="Peran" />
              <select className={`${field} col-span-12 md:col-span-3`} value={r.memberId || (r.person ? "__free" : "")}
                onChange={(e) => { const v = e.target.value; if (v === "" || v === "__free") setA(i, { memberId: null, person: v === "" ? "" : r.person }); else setA(i, { memberId: v, person: members?.find((m) => m.id === v)?.name || "" }); }}>
                <option value="">— Pilih orang —</option>
                {members?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="__free">Freelance / nama lain…</option>
              </select>
              {!r.memberId && <input className={`${field} col-span-12 md:col-span-2`} placeholder="Nama freelance" value={r.person} onChange={(e) => setA(i, { person: e.target.value })} />}
              <div className="col-span-4 md:col-span-1 flex items-center gap-1"><input type="number" min={0} max={100} className={field} value={r.sharePct} onChange={(e) => setA(i, { sharePct: n(e.target.value), amountOverride: null })} aria-label="Persen porsi crew" /><span className="text-xs text-muted-foreground">%</span></div>
              <input type="number" min={0} className={`${field} col-span-5 md:col-span-2`} value={r.amountOverride ?? r.computed} onChange={(e) => setA(i, { amountOverride: e.target.value === "" ? null : n(e.target.value) })} aria-label="Nominal" title="Bisa diubah manual; kosongkan untuk otomatis dari persen" />
              <label className="col-span-2 md:col-span-1 flex items-center gap-1 text-xs"><input type="checkbox" checked={r.paid} onChange={(e) => setA(i, { paid: e.target.checked })} />Lunas</label>
              <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground hover:text-destructive" onClick={() => { setAlloc((l) => l.filter((_, k) => k !== i)); setDirty(true); }}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          {calc.rows.length > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 text-sm pt-1">
              <span className={calc.pctSum > 100.01 ? "text-red-400" : "text-muted-foreground"}>Persen terisi {Math.round(calc.pctSum * 10) / 10}% dari porsi crew{calc.pctSum < 99.99 ? ` (sisa ${Math.round((100 - calc.pctSum) * 10) / 10}% menambah margin)` : ""}</span>
              <b>Total fee crew {formatCurrency(calc.crewTotal)}</b>
            </div>
          )}
        </CardContent>
      </Card>

      {calc.people.length > 0 && (
        <Card className="glass-panel border-foreground/10">
          <CardHeader className="pb-2"><CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Total per orang di proyek ini</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-foreground/10 text-sm">
              {calc.people.map(([name, v]) => (
                <div key={name} className="flex items-center justify-between py-2"><span>{name}</span><span><b>{formatCurrency(v.amount)}</b> <span className="text-xs text-muted-foreground">· dibayar {formatCurrency(v.paid)}</span></span></div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel border-foreground/10">
        <CardHeader className="pb-2"><CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Bagi hasil margin</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Margin nyata = uang diterima − biaya langsung − fee crew − alat. Atur pembagiannya, mis. Kas perusahaan 60% dan Husni (owner) 40%.</p>
          {(cfg.split.length ? cfg.split : [{ name: "Kas perusahaan", pct: 100 }]).map((s, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className={`${field} col-span-6`} value={s.name} onChange={(e) => { const l = cfg.split.length ? [...cfg.split] : [{ name: "Kas perusahaan", pct: 100 }]; l[i] = { ...l[i], name: e.target.value }; setC({ split: l }); }} />
              <div className="col-span-3 flex items-center gap-1"><input type="number" min={0} max={100} className={field} value={s.pct} onChange={(e) => { const l = cfg.split.length ? [...cfg.split] : [{ name: "Kas perusahaan", pct: 100 }]; l[i] = { ...l[i], pct: n(e.target.value) }; setC({ split: l }); }} /><span className="text-xs">%</span></div>
              <div className="col-span-3 text-right text-sm font-semibold">{formatCurrency(Math.round((Math.max(0, calc.margin) * n(s.pct)) / 100))}</div>
            </div>
          ))}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setC({ split: [...(cfg.split.length ? cfg.split : [{ name: "Kas perusahaan", pct: 100 }]), { name: "", pct: 0 }] })}><Plus className="w-4 h-4 mr-1" />Penerima</Button>
            <span className={`text-xs ${Math.abs(calc.splitSum - 100) > 0.5 ? "text-red-400" : "text-muted-foreground"}`}>Jumlah {calc.splitSum}% {Math.abs(calc.splitSum - 100) > 0.5 ? "(harus 100%)" : ""}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="glass-panel border-foreground/10">
          <CardHeader className="pb-2"><CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Pembayaran masuk</CardTitle></CardHeader>
          <CardContent className="text-sm divide-y divide-foreground/10">
            {d.payments.length === 0 && <p className="text-muted-foreground py-2">Belum ada pembayaran untuk invoice proyek ini.</p>}
            {d.payments.map((p) => <div key={p.id} className="flex justify-between py-2"><span>{p.date} · {p.number}</span><b className="text-green-400">{formatCurrency(p.amount)}</b></div>)}
          </CardContent>
        </Card>
        <Card className="glass-panel border-foreground/10">
          <CardHeader className="pb-2"><CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Biaya langsung proyek</CardTitle></CardHeader>
          <CardContent className="text-sm divide-y divide-foreground/10">
            {d.expenses.length === 0 && <p className="text-muted-foreground py-2">Belum ada pengeluaran. Pilih proyek ini saat mencatat Pengeluaran agar masuk di sini.</p>}
            {d.expenses.map((e) => <div key={e.id} className="flex justify-between gap-2 py-2"><span className="truncate">{e.date} · {e.description || e.category}</span><b>{formatCurrency(e.amount)}</b></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
