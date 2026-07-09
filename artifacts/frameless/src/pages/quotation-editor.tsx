import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useListClients, useListProjects } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Trash2, Download, Save, Upload, ImageIcon,
  RotateCcw, Sparkles, Wand2, RefreshCcw, ChevronDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem { id: string; description: string; quantity: number; unitPrice: number; total: number; }
interface RabItem { id: string; category: string; itemName: string; quantity: number; unit: string; unitCost: number; total: number; notes: string; }

interface QuotationData {
  clientId: string;
  projectType: string;
  title: string;
  status: string;
  validUntil: string;
  billTo: string;
  items: LineItem[];
  rabItems: RabItem[];
  notes: string;
  terms: string;
  taxRate: number;
  discount: number;
  dpPercentage: number;
  logoUrl: string;
  paperSize: string;
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
}

const RAB_CATEGORIES = ["Crew", "Equipment", "Lokasi", "Logistik", "Overhead", "Lainnya"];
const PAPER_SIZES = ["A4", "Letter", "Legal", "F4"];
const DEFAULT_LOGO = "/logo-frameless.png";

const newItem = (): LineItem => ({ id: Math.random().toString(36).slice(2), description: "", quantity: 1, unitPrice: 0, total: 0 });
const newRabItem = (category = "Crew"): RabItem => ({ id: Math.random().toString(36).slice(2), category, itemName: "", quantity: 1, unit: "", unitCost: 0, total: 0, notes: "" });

function today() { return new Date().toISOString().split("T")[0]; }
function daysOut(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; }
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const defaultQ: QuotationData = {
  clientId: "", projectType: "", title: "", status: "DRAFT",
  validUntil: daysOut(14), billTo: "",
  items: [newItem()], rabItems: [],
  notes: "", terms:
    "1. Penawaran ini berlaku hingga tanggal yang tercantum di atas.\n2. DP wajib dibayarkan sebelum produksi dimulai.\n3. Revisi di luar scope yang disepakati dapat dikenakan biaya tambahan.\n4. Jadwal produksi mengikuti ketersediaan tim & lokasi.",
  taxRate: 11, discount: 0, dpPercentage: 50,
  logoUrl: DEFAULT_LOGO, paperSize: "A4",
  marginTop: "16mm", marginBottom: "16mm", marginLeft: "14mm", marginRight: "14mm",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuotationEditorPage() {
  const [, params] = useRoute("/quotations/:id");
  const [, navigate] = useLocation();
  const quotationId = params?.id && params.id !== "new" ? params.id : null;
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [q, setQ] = useState<QuotationData>(defaultQ);
  const [loading, setLoading] = useState(!!quotationId);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [rabSuggestions, setRabSuggestions] = useState<any[] | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [number, setNumber] = useState<string>("");
  const [convertedInfo, setConvertedInfo] = useState<{ projectId?: string; invoiceId?: string } | null>(null);

  const { data: clients, isLoading: clientsLoading } = useListClients();
  const { data: projects } = useListProjects();

  // ─── Load existing quotation ───────────────────────────────────────────────
  useEffect(() => {
    if (!quotationId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/quotations/${quotationId}`, { headers: authHeaders() });
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        setNumber(data.number);
        setConvertedInfo(data.convertedProjectId ? { projectId: data.convertedProjectId, invoiceId: data.convertedInvoiceId } : null);
        setQ({
          clientId: data.clientId || "",
          projectType: data.projectType || "",
          title: data.title || "",
          status: data.status || "DRAFT",
          validUntil: data.validUntil ? new Date(data.validUntil).toISOString().split("T")[0] : daysOut(14),
          billTo: data.billTo || "",
          items: data.items?.length ? data.items.map((i: any) => ({ id: i.id, description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), total: Number(i.total) })) : [newItem()],
          rabItems: data.rabItems?.length ? data.rabItems.map((r: any) => ({ id: r.id, category: r.category, itemName: r.itemName, quantity: Number(r.quantity), unit: r.unit || "", unitCost: Number(r.unitCost), total: Number(r.total), notes: r.notes || "" })) : [],
          notes: data.notes || "",
          terms: data.terms || defaultQ.terms,
          taxRate: data.subtotal > 0 ? Math.round((data.tax / data.subtotal) * 100) : 11,
          discount: data.discount || 0,
          dpPercentage: data.dpPercentage || 50,
          logoUrl: data.logoUrl || DEFAULT_LOGO,
          paperSize: data.paperSize || "A4",
          marginTop: data.marginTop || "16mm",
          marginBottom: data.marginBottom || "16mm",
          marginLeft: data.marginLeft || "14mm",
          marginRight: data.marginRight || "14mm",
        });
      } catch {
        toast({ variant: "destructive", title: "Gagal memuat penawaran" });
      } finally {
        setLoading(false);
      }
    })();
  }, [quotationId]);

  // ─── Calculations ───────────────────────────────────────────────────────────
  const subtotal = q.items.reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(subtotal * (q.taxRate / 100));
  const total = subtotal + taxAmount - q.discount;
  const estimatedCost = q.rabItems.reduce((s, r) => s + r.total, 0);
  const margin = total - estimatedCost;
  const marginPercent = total > 0 ? Math.round((margin / total) * 100) : 0;
  const dpAmount = Math.round((total * q.dpPercentage) / 100);

  // ─── Line item handlers ─────────────────────────────────────────────────────
  const updateItem = useCallback((id: string, field: keyof LineItem, value: number | string) => {
    setQ((p) => ({
      ...p,
      items: p.items.map((it) => {
        if (it.id !== id) return it;
        const u = { ...it, [field]: value };
        if (field === "quantity" || field === "unitPrice") u.total = Number(u.quantity) * Number(u.unitPrice);
        return u;
      }),
    }));
  }, []);
  const addItem = () => setQ((p) => ({ ...p, items: [...p.items, newItem()] }));
  const removeItem = (id: string) => setQ((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));

  // ─── RAB handlers ───────────────────────────────────────────────────────────
  const updateRab = useCallback((id: string, field: keyof RabItem, value: number | string) => {
    setQ((p) => ({
      ...p,
      rabItems: p.rabItems.map((r) => {
        if (r.id !== id) return r;
        const u = { ...r, [field]: value };
        if (field === "quantity" || field === "unitCost") u.total = Number(u.quantity) * Number(u.unitCost);
        return u;
      }),
    }));
  }, []);
  const addRabItem = (category?: string) => setQ((p) => ({ ...p, rabItems: [...p.rabItems, newRabItem(category)] }));
  const removeRabItem = (id: string) => setQ((p) => ({ ...p, rabItems: p.rabItems.filter((r) => r.id !== id) }));

  const fetchRabSuggestions = async () => {
    setLoadingSuggest(true);
    try {
      const qs = q.projectType ? `?projectType=${encodeURIComponent(q.projectType)}` : "";
      const res = await fetch(`/api/quotations/rab-suggest${qs}`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRabSuggestions(data.suggestions || []);
      if (data.fallbackUsed) {
        toast({ title: "Belum ada histori project tipe ini — pakai rata-rata semua project" });
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal ambil saran RAB" });
    } finally {
      setLoadingSuggest(false);
    }
  };

  const applySuggestion = (s: any) => {
    setQ((p) => ({
      ...p,
      rabItems: [...p.rabItems, {
        id: Math.random().toString(36).slice(2),
        category: s.category, itemName: `${s.category} (estimasi histori)`,
        quantity: 1, unit: "paket", unitCost: s.averageCost, total: s.averageCost,
        notes: `Rata-rata dari ${s.sampleSize} data histori (Rp${s.minCost.toLocaleString("id-ID")} - Rp${s.maxCost.toLocaleString("id-ID")})`,
      }],
    }));
  };

  // ─── Logo upload ────────────────────────────────────────────────────────────
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ variant: "destructive", title: "File harus gambar (PNG/JPG/SVG)" }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setQ((p) => ({ ...p, logoUrl: ev.target!.result as string })); };
    reader.readAsDataURL(file);
  };

  // ─── Client auto-fill ───────────────────────────────────────────────────────
  const applyClientData = (clientId: string) => {
    const selected = clients?.find((c: any) => c.id === clientId);
    if (!selected) return;
    const parts = [selected.name, selected.company, selected.address,
      selected.email ? `Email: ${selected.email}` : null,
      selected.phone ? `WA/Telp: ${selected.phone}` : null].filter(Boolean);
    setQ((p) => ({ ...p, clientId, billTo: parts.join("\n") }));
  };

  // ─── AI Assist ──────────────────────────────────────────────────────────────
  const handleAiAssist = async () => {
    if (!q.title) { toast({ variant: "destructive", title: "Isi judul project dulu biar AI paham konteksnya" }); return; }
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          role: "admin",
          messages: [{
            role: "user",
            content: `Buatkan draf poin-poin deskripsi jasa (bukan harga) untuk dokumen penawaran project "${q.title}"${q.projectType ? ` (tipe: ${q.projectType})` : ""}. Format: satu poin per baris, singkat, profesional, dalam Bahasa Indonesia. Maksimal 6 poin.`,
          }],
        }),
      });
      const data = await res.json();
      const lines: string[] = (data.reply || "").split("\n").map((l: string) => l.replace(/^[-•\d.\s]+/, "").trim()).filter(Boolean);
      if (lines.length === 0) { toast({ variant: "destructive", title: "AI tidak memberikan hasil, coba lagi" }); return; }
      setQ((p) => ({
        ...p,
        items: [
          ...p.items.filter((i) => i.description.trim() !== ""),
          ...lines.map((desc) => ({ ...newItem(), description: desc })),
        ],
      }));
      toast({ title: `${lines.length} item ditambahkan dari AI` });
    } catch {
      toast({ variant: "destructive", title: "AI sedang tidak bisa dihubungi" });
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Save ───────────────────────────────────────────────────────────────────
  const buildPayload = () => ({
    clientId: q.clientId, projectType: q.projectType, title: q.title, status: q.status,
    validUntil: q.validUntil, billTo: q.billTo,
    subtotal: String(subtotal), tax: String(taxAmount), discount: String(q.discount), total: String(total),
    estimatedCost: String(estimatedCost), dpPercentage: String(q.dpPercentage),
    notes: q.notes, terms: q.terms, logoUrl: q.logoUrl, paperSize: q.paperSize,
    marginTop: q.marginTop, marginBottom: q.marginBottom, marginLeft: q.marginLeft, marginRight: q.marginRight,
    items: q.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
    rabItems: q.rabItems.map((r) => ({ category: r.category, itemName: r.itemName, quantity: r.quantity, unit: r.unit, unitCost: r.unitCost, total: r.total, notes: r.notes })),
  });

  const handleSave = async () => {
    if (!q.clientId) { toast({ variant: "destructive", title: "Pilih client terlebih dahulu" }); return; }
    if (!q.title.trim()) { toast({ variant: "destructive", title: "Judul penawaran wajib diisi" }); return; }
    setSaving(true);
    try {
      if (quotationId) {
        const res = await fetch(`/api/quotations/${quotationId}`, {
          method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) throw new Error();
        toast({ title: "Penawaran tersimpan" });
      } else {
        const res = await fetch("/api/quotations", {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        toast({ title: "Penawaran dibuat" });
        navigate(`/quotations/${data.id}`);
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal menyimpan penawaran" });
    } finally {
      setSaving(false);
    }
  };

  // ─── PDF Export (server-rendered, Puppeteer) ───────────────────────────────
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      if (quotationId) {
        const res = await fetch(`/api/quotations/${quotationId}/export-pdf`, { headers: authHeaders() });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${number || "penawaran"}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } else {
        const res = await fetch("/api/quotations/preview-pdf", {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ ...buildPayload(), number: "draft-penawaran" }),
        });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "draft-penawaran.pdf";
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }
      toast({ title: "PDF berhasil diunduh" });
    } catch {
      toast({ variant: "destructive", title: "Export gagal, simpan dulu lalu coba lagi" });
    } finally {
      setExporting(false);
    }
  };

  // ─── Convert to Project + Invoice ──────────────────────────────────────────
  const handleConvert = async () => {
    if (!quotationId) { toast({ variant: "destructive", title: "Simpan penawaran dulu sebelum convert" }); return; }
    setConverting(true);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/convert`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "failed"); }
      const data = await res.json();
      setConvertedInfo({ projectId: data.project.id, invoiceId: data.invoice.id });
      setQ((p) => ({ ...p, status: "CONVERTED" }));
      toast({ title: `Project & Invoice ${data.invoice.number} berhasil dibuat!` });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message === "Penawaran ini sudah pernah dikonversi" ? e.message : "Gagal convert penawaran" });
    } finally {
      setConverting(false);
    }
  };

  // ─── Live server-rendered preview (debounced) ──────────────────────────────
  const previewPayload = useMemo(() => JSON.stringify({
    ...buildPayload(),
    number: number || "PREVIEW",
    clientName: clients?.find((c: any) => c.id === q.clientId)?.name || "",
  }), [q, number, clients]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/quotations/preview-html", {
          method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: previewPayload,
        });
        if (!res.ok) return;
        const html = await res.text();
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
        }
      } catch { /* silent, preview best-effort */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [previewPayload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-12 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <a href="/quotations">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </a>
          <div>
            <h1 className="text-3xl font-heading tracking-wider text-white">{number || "Penawaran Baru"}</h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest">
              {q.title || "Quotation Editor"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={q.status} onValueChange={(v) => setQ((p) => ({ ...p, status: v }))}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Terkirim</SelectItem>
              <SelectItem value="ACCEPTED">Diterima</SelectItem>
              <SelectItem value="REJECTED">Ditolak</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExportPdf} disabled={exporting} variant="outline" className="border-white/20 text-white hover:bg-white/10 font-heading tracking-wider">
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exporting..." : "Download PDF"}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Convert banner */}
      {q.status === "ACCEPTED" && !convertedInfo && (
        <div className="glass-panel rounded-xl p-4 border-green-500/30 bg-green-500/5 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-green-400">
            Penawaran ini sudah <b>Diterima</b> client. Convert sekarang jadi Project + Invoice DP?
          </p>
          <Button onClick={handleConvert} disabled={converting} className="bg-green-600 hover:bg-green-700 text-white shrink-0">
            <RefreshCcw className="w-4 h-4 mr-2" />
            {converting ? "Memproses..." : `Convert (DP ${q.dpPercentage}%)`}
          </Button>
        </div>
      )}
      {convertedInfo && (
        <div className="glass-panel rounded-xl p-4 border-primary/30 bg-primary/5 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-primary">Sudah dikonversi.</p>
          <a href={`/projects/${convertedInfo.projectId}`} className="text-xs text-white underline">Lihat Project</a>
          <a href={`/invoices/${convertedInfo.invoiceId}`} className="text-xs text-white underline">Lihat Invoice</a>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Editor Form ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Logo */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Logo Perusahaan</p>
            <div className="flex items-center gap-4">
              <div className="w-32 h-16 rounded-lg bg-white flex items-center justify-center border border-white/20 overflow-hidden shrink-0">
                {q.logoUrl ? <img src={q.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" /> : <ImageIcon className="w-8 h-8 text-gray-300" />}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="border-white/20 text-white hover:bg-white/10 text-xs">
                  <Upload className="w-3.5 h-3.5 mr-2" /> Upload Logo Kustom
                </Button>
                {q.logoUrl !== DEFAULT_LOGO && (
                  <Button variant="ghost" size="sm" onClick={() => setQ((p) => ({ ...p, logoUrl: DEFAULT_LOGO }))} className="text-muted-foreground hover:text-white text-xs">
                    <RotateCcw className="w-3 h-3 mr-1.5" /> Reset ke Logo Frameless
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Detail Penawaran</p>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Judul Project / Jasa *</label>
              <Input value={q.title} onChange={(e) => setQ((p) => ({ ...p, title: e.target.value }))} placeholder="Cth: Video Company Profile PT Maju Jaya" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Client *</label>
                <Select value={q.clientId} onValueChange={applyClientData}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder={clientsLoading ? "Memuat..." : "Pilih client..."} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    {clients?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Tipe Project</label>
                <Input value={q.projectType} onChange={(e) => setQ((p) => ({ ...p, projectType: e.target.value }))} placeholder="Cth: Company Profile, Wedding, Music Video" className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Berlaku Sampai</label>
                <Input type="date" value={q.validUntil} onChange={(e) => setQ((p) => ({ ...p, validUntil: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">DP saat Deal (%)</label>
                <Input type="number" value={q.dpPercentage} onChange={(e) => setQ((p) => ({ ...p, dpPercentage: Number(e.target.value) }))} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Kepada Yth (Bill To)</label>
              <Textarea value={q.billTo} onChange={(e) => setQ((p) => ({ ...p, billTo: e.target.value }))} rows={3} className="bg-white/5 border-white/10 text-white" />
            </div>
          </div>

          {/* Print Settings */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <button onClick={() => setShowPrintSettings((v) => !v)} className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              Pengaturan Cetak (Ukuran & Margin)
              <ChevronDown className={`w-4 h-4 transition-transform ${showPrintSettings ? "rotate-180" : ""}`} />
            </button>
            {showPrintSettings && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Ukuran Kertas</label>
                  <Select value={q.paperSize} onValueChange={(v) => setQ((p) => ({ ...p, paperSize: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-white/10">
                      {PAPER_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(["marginTop", "marginBottom", "marginLeft", "marginRight"] as const).map((field) => (
                    <div key={field} className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{field.replace("margin", "")}</label>
                      <Input value={q[field]} onChange={(e) => setQ((p) => ({ ...p, [field]: e.target.value }))} className="bg-white/5 border-white/10 text-white text-xs" />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Format margin: mis. "16mm" atau "0.5in". Preview di kanan otomatis sesuai render final PDF.</p>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi Jasa / Deliverable</p>
              <Button onClick={handleAiAssist} disabled={aiLoading} size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {aiLoading ? "AI menyusun..." : "Bantu AI Susun"}
              </Button>
            </div>
            
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 items-center px-1 py-2 border-b border-white/20 mb-1">
              <div className="col-span-6"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Deskripsi Jasa</p></div>
              <div className="col-span-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center">QTY</p></div>
              <div className="col-span-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right">RATE</p></div>
              <div className="col-span-1"></div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {q.items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <Input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="Deskripsi item" className="col-span-6 bg-white/5 border-white/10 text-white text-sm" />
                  <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))} placeholder="0" className="col-span-2 bg-white/5 border-white/10 text-white text-sm text-center" />
                  <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))} placeholder="0" className="col-span-3 bg-white/5 border-white/10 text-white text-sm text-right" />
                  <div className="col-span-1 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{formatCurrency(item.total)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={addItem} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 text-xs w-full">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Tambah Item
            </Button>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Pajak (%)</label>
                <Input type="number" value={q.taxRate} onChange={(e) => setQ((p) => ({ ...p, taxRate: Number(e.target.value) }))} className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Diskon (Rp)</label>
                <Input type="number" value={q.discount} onChange={(e) => setQ((p) => ({ ...p, discount: Number(e.target.value) }))} className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
            </div>
          </div>

          {/* ── RAB & HPP Panel ── */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">RAB & HPP (Internal — tidak muncul di PDF client)</p>
              <Button onClick={fetchRabSuggestions} disabled={loadingSuggest} size="sm" variant="outline" className="border-blue-400/30 text-blue-400 hover:bg-blue-400/10 text-xs">
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                {loadingSuggest ? "Menghitung..." : "Auto-Suggest dari Histori"}
              </Button>
            </div>

            {rabSuggestions && rabSuggestions.length > 0 && (
              <div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-blue-400">Saran biaya berdasarkan histori project</p>
                {rabSuggestions.map((s) => (
                  <div key={s.category} className="flex items-center justify-between text-xs">
                    <span className="text-white">{s.category} <span className="text-muted-foreground">({s.sampleSize} data)</span></span>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400">{formatCurrency(s.averageCost)}</span>
                      <Button size="sm" variant="ghost" onClick={() => applySuggestion(s)} className="h-6 px-2 text-[10px] text-white hover:bg-white/10">+ Pakai</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {RAB_CATEGORIES.map((cat) => {
                const catItems = q.rabItems.filter((r) => r.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat} className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{cat}</p>
                    
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 items-center px-1 py-2 border-b border-white/10">
                      <div className="col-span-4"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Item</p></div>
                      <div className="col-span-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold text-center">Qty</p></div>
                      <div className="col-span-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold text-center">Satuan</p></div>
                      <div className="col-span-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold text-right">Rate</p></div>
                      <div className="col-span-1"><p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold text-right">Total</p></div>
                      <div className="col-span-1"></div>
                    </div>

                    {/* Items */}
                    {catItems.map((r) => (
                      <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
                        <Input value={r.itemName} onChange={(e) => updateRab(r.id, "itemName", e.target.value)} placeholder="Nama item biaya" className="col-span-4 bg-white/5 border-white/10 text-white text-sm" />
                        <Input type="number" value={r.quantity} onChange={(e) => updateRab(r.id, "quantity", Number(e.target.value))} placeholder="0" className="col-span-2 bg-white/5 border-white/10 text-white text-sm text-center" />
                        <Input value={r.unit} onChange={(e) => updateRab(r.id, "unit", e.target.value)} placeholder="Satuan" className="col-span-2 bg-white/5 border-white/10 text-white text-sm text-center" />
                        <Input type="number" value={r.unitCost} onChange={(e) => updateRab(r.id, "unitCost", Number(e.target.value))} placeholder="0" className="col-span-2 bg-white/5 border-white/10 text-white text-sm text-right" />
                        <div className="col-span-1 text-right"><p className="text-sm text-white font-semibold">{formatCurrency(r.total)}</p></div>
                        <Button variant="ghost" size="icon" onClick={() => removeRabItem(r.id)} className="col-span-1 text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 flex-wrap pt-1">
              {RAB_CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => addRabItem(cat)} className="px-3 py-1 rounded-md text-[10px] uppercase tracking-wider font-semibold border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white transition-all">
                  + {cat}
                </button>
              ))}
            </div>

            {/* HPP Summary */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. HPP</p>
                <p className="text-sm font-heading text-white">{formatCurrency(estimatedCost)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margin</p>
                <p className={`text-sm font-heading ${margin >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(margin)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margin %</p>
                <p className={`text-sm font-heading ${marginPercent >= 20 ? "text-green-400" : marginPercent >= 0 ? "text-yellow-400" : "text-red-400"}`}>{marginPercent}%</p>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Catatan</label>
              <Textarea value={q.notes} onChange={(e) => setQ((p) => ({ ...p, notes: e.target.value }))} rows={3} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Syarat & Ketentuan</label>
              <Textarea value={q.terms} onChange={(e) => setQ((p) => ({ ...p, terms: e.target.value }))} rows={5} className="bg-white/5 border-white/10 text-white" />
            </div>
          </div>
        </div>

        {/* ── Live Preview (server-rendered, sama persis dengan PDF) ── */}
        <div className="xl:col-span-1">
          <div className="sticky top-6 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Preview (identik dengan PDF final)</p>
            <div className="glass-panel rounded-xl border-white/10 overflow-hidden" style={{ aspectRatio: q.paperSize === "A4" || q.paperSize === "F4" ? "210/297" : "216/279" }}>
              <iframe ref={iframeRef} title="Quotation Preview" className="w-full h-full bg-white" style={{ border: "none" }} />
            </div>
            <div className="glass-panel rounded-xl p-4 border-white/10 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-white">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span className="text-white">{formatCurrency(taxAmount)}</span></div>
              {q.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span className="text-green-400">−{formatCurrency(q.discount)}</span></div>}
              <div className="flex justify-between pt-1.5 border-t border-white/10"><span className="font-semibold text-white">Total</span><span className="text-lg font-heading text-primary">{formatCurrency(total)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">DP ({q.dpPercentage}%)</span><span className="text-white">{formatCurrency(dpAmount)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}