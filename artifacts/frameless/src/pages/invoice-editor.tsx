import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetInvoice, useListClients, useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Save, FileText, Printer, Receipt, Loader2, Wallet, Info } from "lucide-react";
import { InvoiceDocDialog } from "@/components/invoice-doc-dialog";
import { InvoicePaymentDialog } from "@/components/invoice-payment-dialog";
import { CompanyProfileDialog } from "@/components/company-profile-dialog";
import {
  deletePayment,
  fetchDraftPreviewHtml,
  fetchNextInvoiceNumber,
  type InvoiceDocKind,
  type InvoicePayment,
} from "@/lib/invoice-docs";

// ─── Types & helpers ─────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceForm {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  poNumber: string;
  clientId: string;
  projectId: string;
  billTo: string;
  shipTo: string;
  items: LineItem[];
  notes: string;
  terms: string;
  taxRate: number;
  discount: number;
  shipping: number;
  status: string;
}

const DEFAULT_TERMS =
  "1. Pembayaran dilakukan dalam 14 hari kalender sejak tanggal invoice.\n2. Keterlambatan pembayaran dikenakan denda 2% per bulan.\n3. Pembayaran DP minimal 50% wajib dilunasi sebelum produksi dimulai.\n4. File/aset final hanya diserahkan setelah pelunasan penuh.\n5. Revisi di luar scope pekerjaan yang telah disepakati dapat dikenakan biaya tambahan.\n6. Invoice ini sah sebagai dokumen tagihan resmi tanpa tanda tangan basah.";

const uid = () => Math.random().toString(36).slice(2);
const newItem = (): LineItem => ({ id: uid(), description: "", quantity: 1, unitPrice: 0 });
const isoDay = (d: Date) => d.toISOString().split("T")[0];
const today = () => isoDay(new Date());
const daysOut = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); };
const toDay = (v: any) => (v ? isoDay(new Date(v)) : "");

const emptyForm = (): InvoiceForm => ({
  invoiceNumber: "",
  invoiceDate: today(),
  dueDate: daysOut(14),
  paymentTerms: "Net 14",
  poNumber: "",
  clientId: "",
  projectId: "",
  billTo: "",
  shipTo: "",
  items: [newItem()],
  notes: "",
  terms: DEFAULT_TERMS,
  taxRate: 11,
  discount: 0,
  shipping: 0,
  status: "DRAFT",
});

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

function clientBlock(c: any): string {
  return [
    c.name,
    c.company,
    c.address,
    c.email ? `Email: ${c.email}` : null,
    c.phone ? `WA/Telp: ${c.phone}` : null,
  ].filter(Boolean).join("\n");
}

const projectBelongsTo = (p: any, c: any) =>
  !!c && [norm(c.name), norm(c.company)].filter(Boolean).includes(norm(p.client));

function authHeaders(): Record<string, string> {
  let t: string | null = null;
  try { t = localStorage.getItem("token"); } catch {}
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

const lineTotal = (i: LineItem) => Math.round(Number(i.quantity) * Number(i.unitPrice) * 100) / 100;

// Bentuk payload yang dikirim ke server (dipakai juga untuk mendeteksi "belum disimpan")
function toPayload(inv: InvoiceForm) {
  return {
    clientId: inv.clientId,
    projectId: inv.projectId || null,
    status: inv.status,
    number: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    paymentTerms: inv.paymentTerms,
    poNumber: inv.poNumber,
    taxRate: inv.taxRate,
    discount: inv.discount,
    shipping: inv.shipping,
    billTo: inv.billTo,
    shipTo: inv.shipTo,
    notes: inv.notes,
    terms: inv.terms,
    items: inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
  };
}

const STAGE_CHIP: Record<string, string> = {
  UNPAID: "bg-foreground/10 text-muted-foreground border-foreground/15",
  DP: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  PAID: "bg-green-500/20 text-green-400 border-green-500/30",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoiceEditorPage() {
  const [, params] = useRoute("/invoices/:id");
  const [, navigate] = useLocation();
  const invoiceId = params?.id && params.id !== "new" ? params.id : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inv, setInv] = useState<InvoiceForm>(emptyForm);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [paid, setPaid] = useState(0);
  const [storedTotal, setStoredTotal] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [docOpen, setDocOpen] = useState(false);
  const [docKind, setDocKind] = useState<InvoiceDocKind | undefined>(undefined);
  const [docPaymentId, setDocPaymentId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);

  const hydratedFor = useRef<string | null>(null);
  const savedRef = useRef<string>("");

  const { data: existing, isLoading: loadingInvoice } = useGetInvoice(invoiceId ?? "", {
    query: { enabled: !!invoiceId, refetchOnWindowFocus: false } as any,
  });
  const { data: clients, isLoading: clientsLoading, isError: clientsError } = useListClients();
  const { data: projects, isLoading: projectsLoading, isError: projectsError } = useListProjects();

  const payload = useMemo(() => toPayload(inv), [inv]);
  const payloadJson = JSON.stringify(payload);
  const dirty = savedRef.current !== payloadJson;

  // ── Hitung otomatis ─────────────────────────────────────────────────────
  const subtotal = inv.items.reduce((s, i) => s + lineTotal(i), 0);
  const taxAmount = Math.round(subtotal * (inv.taxRate / 100));
  const total = Math.max(subtotal + taxAmount - inv.discount + inv.shipping, 0);
  const balance = Math.max(total - paid, 0);
  const stage = paid <= 0 ? "UNPAID" : balance <= 0.5 ? "PAID" : "DP";
  const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  // ── Muat data: form hanya di-hydrate SEKALI per invoice ─────────────────
  // Refetch di belakang layar tidak boleh menimpa ketikan / perubahan yang belum disimpan.
  useEffect(() => {
    if (!existing || !invoiceId) return;
    const e = existing as any;
    setPayments(e.payments ?? []);
    setPaid(Number(e.paidAmount || 0));
    setStoredTotal(Number(e.total ?? 0));

    if (hydratedFor.current !== invoiceId) {
      hydratedFor.current = invoiceId;
      const form: InvoiceForm = {
        invoiceNumber: e.number,
        invoiceDate: toDay(e.invoiceDate ?? e.createdAt) || today(),
        dueDate: toDay(e.dueDate) || daysOut(14),
        paymentTerms: e.paymentTerms ?? "",
        poNumber: e.poNumber ?? "",
        clientId: e.clientId || "",
        projectId: e.projectId || "",
        billTo: e.billTo || "",
        shipTo: e.shipTo || "",
        items:
          e.items?.length > 0
            ? e.items.map((i: any) => ({ id: i.id, description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))
            : [newItem()],
        notes: e.notes || "",
        terms: e.terms ?? "",
        taxRate: Number(e.taxRate ?? 11),
        discount: Number(e.discount || 0),
        shipping: Number(e.shipping || 0),
        status: e.status,
      };
      setInv(form);
      savedRef.current = JSON.stringify(toPayload(form));
    } else {
      // Status bisa berubah otomatis karena pembayaran (mis. jadi PAID): ikuti server tanpa menandai "belum disimpan"
      setInv((p) => (p.status === e.status ? p : { ...p, status: e.status }));
      try {
        const snap = JSON.parse(savedRef.current || "{}");
        snap.status = e.status;
        savedRef.current = JSON.stringify(snap);
      } catch {}
    }
  }, [existing, invoiceId]);

  // Hapus sisa cache draft versi lama (dulu form invoice baru dipulihkan dari localStorage)
  useEffect(() => {
    try { localStorage.removeItem("invoice_draft_new"); localStorage.removeItem("invoice_draft_logo"); } catch {}
  }, []);

  // Invoice baru: mulai bersih (tanpa cache draft lama), nomor dari server
  useEffect(() => {
    if (invoiceId) return;
    let cancelled = false;
    hydratedFor.current = null;
    setPayments([]);
    setPaid(0);
    fetchNextInvoiceNumber()
      .then((n) => {
        if (cancelled) return;
        setInv((p) => (p.invoiceNumber ? p : { ...p, invoiceNumber: n }));
        // form baru yang belum disentuh dianggap "tersimpan" (tidak muncul label belum disimpan)
        savedRef.current = JSON.stringify(toPayload({ ...emptyForm(), invoiceNumber: n }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [invoiceId]);

  // Peringatan bila menutup tab dengan perubahan yang belum disimpan
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Setelah invoice baru dibuat lewat tombol "Tambah Pembayaran", buka dialog pembayarannya
  useEffect(() => {
    if (!invoiceId || !existing) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("pay") === "1") {
      sp.delete("pay");
      window.history.replaceState({}, "", window.location.pathname + (sp.toString() ? `?${sp}` : ""));
      setPayOpen(true);
    }
  }, [invoiceId, existing]);

  // ── Aksi form ───────────────────────────────────────────────────────────

  const patch = useCallback((p: Partial<InvoiceForm>) => setInv((prev) => ({ ...prev, ...p })), []);

  const updateItem = (id: string, field: keyof LineItem, value: number | string) =>
    setInv((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, [field]: value } : i)) }));

  // Ganti client → Bill To SELALU diganti dengan data client itu; project yang bukan milik client dikosongkan
  const onClientChange = (id: string) => {
    const c = (clients as any[] | undefined)?.find((x) => x.id === id);
    setShowAllProjects(false);
    setInv((p) => {
      const stillValid = p.projectId && (projects as any[] | undefined)?.some((pr) => pr.id === p.projectId && projectBelongsTo(pr, c));
      return { ...p, clientId: id, billTo: c ? clientBlock(c) : p.billTo, projectId: stillValid ? p.projectId : "" };
    });
  };

  // Pilih project → deskripsi item yang masih kosong otomatis terisi judul project
  const onProjectChange = (id: string) => {
    const pr = (projects as any[] | undefined)?.find((x) => x.id === id);
    setInv((p) => {
      const onlyBlank = p.items.length === 1 && !p.items[0].description.trim();
      return {
        ...p,
        projectId: id,
        items: onlyBlank && pr ? [{ ...p.items[0], description: pr.title?.trim() || "" }] : p.items,
      };
    });
  };

  const selectedClient = (clients as any[] | undefined)?.find((c) => c.id === inv.clientId);
  const clientProjects = useMemo(() => {
    const all = (projects as any[] | undefined) ?? [];
    if (!selectedClient || showAllProjects) return all;
    return all.filter((p) => projectBelongsTo(p, selectedClient) || p.id === inv.projectId);
  }, [projects, selectedClient, showAllProjects, inv.projectId]);
  const hiddenProjects = ((projects as any[] | undefined)?.length ?? 0) - clientProjects.length;

  // ── Simpan ──────────────────────────────────────────────────────────────

  const refreshInvoice = () => {
    queryClient.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes("invoices") });
  };

  /** Simpan ke server. Mengembalikan id invoice, atau null bila gagal. Isi form TIDAK ditimpa ulang. */
  const handleSave = async (opts: { silent?: boolean; then?: "pay" } = {}): Promise<string | null> => {
    if (!inv.clientId) {
      toast({ variant: "destructive", title: "Pilih client terlebih dahulu" });
      return null;
    }
    if (!inv.items.some((i) => i.description.trim())) {
      toast({ variant: "destructive", title: "Isi minimal satu item pekerjaan" });
      return null;
    }
    setSaving(true);
    try {
      const res = await fetch(invoiceId ? `/api/invoices/${invoiceId}` : "/api/invoices", {
        method: invoiceId ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan invoice");

      savedRef.current = payloadJson;
      refreshInvoice();
      if (!opts.silent) toast({ title: "Invoice tersimpan" });

      if (!invoiceId) navigate(`/invoices/${data.id}${opts.then === "pay" ? "?pay=1" : ""}`);
      return invoiceId ?? data.id;
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Gagal menyimpan invoice" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openDoc = async (kind?: InvoiceDocKind, paymentId: string | null = null) => {
    if (!invoiceId || dirty) {
      const id = await handleSave({ silent: true });
      if (!id || !invoiceId) return; // invoice baru: setelah tersimpan, tekan Cetak lagi dari halaman invoice
    }
    setDocKind(kind);
    setDocPaymentId(paymentId);
    setDocOpen(true);
  };

  const openPayment = async () => {
    if (!invoiceId) {
      await handleSave({ silent: true, then: "pay" });
      return;
    }
    if (dirty) {
      const id = await handleSave({ silent: true });
      if (!id) return;
    }
    setPayOpen(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!invoiceId || !confirm("Hapus pembayaran ini? Sisa tagihan dan status invoice akan dihitung ulang.")) return;
    try {
      await deletePayment(invoiceId, paymentId);
      refreshInvoice();
      toast({ title: "Pembayaran dihapus" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal menghapus", description: e.message });
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceId) return;
    const warn = payments.length > 0 ? `Invoice ini punya ${payments.length} pembayaran tercatat. ` : "";
    if (!confirm(`${warn}Hapus invoice ${inv.invoiceNumber} secara permanen?`)) return;
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Gagal menghapus invoice");
      savedRef.current = payloadJson; // tidak ada peringatan "belum disimpan"
      refreshInvoice();
      toast({ title: "Invoice dihapus" });
      navigate("/invoices");
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    }
  };

  // ── Preview (dirender server — identik dengan cetak & PDF) ──────────────

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const html = await fetchDraftPreviewHtml({ ...payload, invoiceNumber: inv.invoiceNumber, invoiceId: invoiceId ?? undefined }, ctrl.signal);
        setPreviewHtml(html);
        setPreviewError("");
      } catch (e: any) {
        if (e?.name !== "AbortError") setPreviewError(e.message || "Preview gagal");
      } finally {
        if (!ctrl.signal.aborted) setPreviewLoading(false);
      }
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadJson, invoiceId, payments.length, paid, previewNonce]);

  if (invoiceId && loadingInvoice && hydratedFor.current !== invoiceId) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const label = "text-xs uppercase tracking-wider text-muted-foreground";
  const field = "bg-foreground/5 border-foreground/10 text-foreground";
  const totalMismatch = !!invoiceId && storedTotal !== null && Math.abs(storedTotal - total) > 1;
  const payDisabled = saving || (!!invoiceId && balance <= 0 && total > 0);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="pb-12 space-y-6">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <a href="/invoices">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </a>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-heading tracking-wider text-foreground truncate">{invoiceId ? inv.invoiceNumber : "New Invoice"}</h1>
              {invoiceId && (
                <span className={`text-[11px] font-semibold uppercase tracking-wider border rounded px-2 py-0.5 ${STAGE_CHIP[stage]}`}>
                  {stage === "PAID" ? "Lunas" : stage === "DP" ? `DP ${paidPct}%` : "Belum dibayar"}
                </span>
              )}
              {dirty && <span className="text-[11px] text-yellow-400">● belum disimpan</span>}
            </div>
            <p className="text-muted-foreground text-xs uppercase tracking-widest">Invoice Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={inv.status} onValueChange={(v) => patch({ status: v })}>
            <SelectTrigger className="w-28 bg-foreground/5 border-foreground/10 text-foreground text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-foreground/10">
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={openPayment} disabled={payDisabled} className="bg-green-600 hover:bg-green-600/90 text-white font-heading tracking-wider">
            <Wallet className="w-4 h-4 mr-2" /> Tambah Pembayaran
          </Button>
          <Button onClick={() => openDoc()} disabled={saving} variant="outline" className="border-foreground/20 text-foreground hover:bg-foreground/10 font-heading tracking-wider">
            <Printer className="w-4 h-4 mr-2" /> Cetak / PDF
          </Button>
          <Button onClick={() => handleSave()} disabled={saving} className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
          {invoiceId && (
            <Button onClick={handleDeleteInvoice} variant="ghost" size="icon" title="Hapus invoice" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {totalMismatch && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm flex items-start gap-3">
          <Info className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 font-semibold">Total tersimpan berbeda dari hasil hitung item</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total di database {formatCurrency(storedTotal!)}, sedangkan item + pajak − diskon + ongkir = {formatCurrency(total)}.
              Periksa item di bawah. Jika hasil hitung sudah benar, tekan <b>Simpan</b> agar total diperbarui.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Form ── */}
        <div className="xl:col-span-2 space-y-4">
          {/* Client / Project */}
          <div className="glass-panel rounded-xl p-5 border-foreground/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Client & Project</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={label}>Client *</label>
                <Select value={inv.clientId} onValueChange={onClientChange}>
                  <SelectTrigger className={field}>
                    <SelectValue placeholder={clientsLoading ? "Memuat..." : clientsError ? "Gagal memuat client" : "Pilih client..."} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-foreground/10">
                    {(clients as any[] | undefined)?.length ? (
                      (clients as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</SelectItem>)
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">{clientsLoading ? "Memuat..." : "Belum ada client"}</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className={label}>Project</label>
                <Select value={inv.projectId || "__none__"} onValueChange={(v) => (v === "__none__" ? patch({ projectId: "" }) : onProjectChange(v))}>
                  <SelectTrigger className={field}><SelectValue placeholder="Tanpa project" /></SelectTrigger>
                  <SelectContent className="bg-card border-foreground/10">
                    <SelectItem value="__none__">Tanpa project</SelectItem>
                    {clientProjects.length ? (
                      clientProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        {projectsError ? "Gagal memuat project" : projectsLoading ? "Memuat..." : "Client ini belum punya project"}
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {selectedClient && hiddenProjects > 0 && !showAllProjects && (
                  <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setShowAllProjects(true)}>
                    Tampilkan semua project ({hiddenProjects} lainnya)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bill To / Ship To */}
          <div className="glass-panel rounded-xl p-5 border-foreground/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={label}>Bill To (Tagihan Kepada)</label>
                  {selectedClient && (
                    <button type="button" className="text-[10px] text-primary hover:underline" onClick={() => patch({ billTo: clientBlock(selectedClient) })}>
                      Isi ulang dari data client
                    </button>
                  )}
                </div>
                <Textarea value={inv.billTo} onChange={(e) => patch({ billTo: e.target.value })} rows={4} className={`${field} resize-none`} placeholder="Terisi otomatis saat memilih client" />
              </div>
              <div className="space-y-1">
                <label className={label}>Ship To (opsional)</label>
                <Textarea value={inv.shipTo} onChange={(e) => patch({ shipTo: e.target.value })} rows={4} className={`${field} resize-none`} placeholder="Alamat pengiriman" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Kop surat (nama, alamat, logo) dan rekening mengikuti Profil Perusahaan. <button type="button" className="text-primary hover:underline" onClick={() => setSettingsOpen(true)}>Ubah pengaturan dokumen</button></span>
            </p>
          </div>

          {/* Detail */}
          <div className="glass-panel rounded-xl p-5 border-foreground/10">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="space-y-1 col-span-2 md:col-span-1">
                <label className={label}>Invoice #</label>
                <Input value={inv.invoiceNumber} onChange={(e) => patch({ invoiceNumber: e.target.value })} className={field} />
              </div>
              <div className="space-y-1">
                <label className={label}>Tanggal</label>
                <Input type="date" value={inv.invoiceDate} onChange={(e) => patch({ invoiceDate: e.target.value })} className={field} />
              </div>
              <div className="space-y-1">
                <label className={label}>Jatuh Tempo</label>
                <Input type="date" value={inv.dueDate} onChange={(e) => patch({ dueDate: e.target.value })} className={field} />
              </div>
              <div className="space-y-1">
                <label className={label}>Terms</label>
                <Input value={inv.paymentTerms} onChange={(e) => patch({ paymentTerms: e.target.value })} className={field} placeholder="Net 14" />
              </div>
              <div className="space-y-1">
                <label className={label}>No. PO</label>
                <Input value={inv.poNumber} onChange={(e) => patch({ poNumber: e.target.value })} className={field} placeholder="opsional" />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="glass-panel rounded-xl p-5 border-foreground/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Item Pekerjaan</p>
            <div className="hidden sm:grid grid-cols-12 gap-2 pb-2 border-b border-foreground/10">
              <span className={`col-span-5 ${label}`}>Deskripsi</span>
              <span className={`col-span-2 text-center ${label}`}>Qty</span>
              <span className={`col-span-2 text-right ${label}`}>Harga (IDR)</span>
              <span className={`col-span-2 text-right ${label}`}>Total</span>
              <span className="col-span-1" />
            </div>
            {inv.items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 sm:col-span-5">
                  <Input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} className={`${field} text-sm h-9`} placeholder="Deskripsi layanan / produk..." />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input type="number" min={0} value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))} className={`${field} text-sm h-9 text-center`} />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <Input type="number" min={0} value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))} className={`${field} text-sm h-9 text-right`} />
                </div>
                <div className="col-span-3 sm:col-span-2 text-right text-sm text-foreground font-medium px-1">{formatCurrency(lineTotal(item))}</div>
                <div className="col-span-1 flex justify-center">
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setInv((p) => ({ ...p, items: p.items.filter((i) => i.id !== item.id) }))} disabled={inv.items.length === 1}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setInv((p) => ({ ...p, items: [...p.items, newItem()] }))} className="text-primary hover:text-primary hover:bg-primary/10 font-semibold text-xs mt-1">
              <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Item
            </Button>
          </div>

          {/* Notes + Terms */}
          <div className="glass-panel rounded-xl p-5 border-foreground/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={label}>Catatan</label>
              <Textarea value={inv.notes} onChange={(e) => patch({ notes: e.target.value })} rows={5} className={`${field} resize-none text-sm`} placeholder="Catatan tambahan untuk client" />
            </div>
            <div className="space-y-1">
              <label className={label}>Syarat & Ketentuan</label>
              <Textarea value={inv.terms} onChange={(e) => patch({ terms: e.target.value })} rows={5} className={`${field} resize-none text-sm`} placeholder="Syarat pembayaran, denda keterlambatan, dll." />
            </div>
          </div>
        </div>

        {/* ── Ringkasan + Pembayaran ── */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-5 border-foreground/10 space-y-3 xl:sticky xl:top-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Ringkasan (otomatis)</p>

            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground font-medium">{formatCurrency(subtotal)}</span></div>

            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="space-y-1">
                <label className={label}>PPN %</label>
                <Input type="number" min={0} max={100} value={inv.taxRate} onChange={(e) => patch({ taxRate: Number(e.target.value) })} className={`${field} h-8 text-sm`} />
              </div>
              <div className="col-span-2 text-right text-sm text-muted-foreground pb-1.5">{formatCurrency(taxAmount)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={label}>Diskon (IDR)</label>
                <Input type="number" min={0} value={inv.discount} onChange={(e) => patch({ discount: Number(e.target.value) })} className={`${field} h-8 text-sm`} />
              </div>
              <div className="space-y-1">
                <label className={label}>Ongkir (IDR)</label>
                <Input type="number" min={0} value={inv.shipping} onChange={(e) => patch({ shipping: Number(e.target.value) })} className={`${field} h-8 text-sm`} />
              </div>
            </div>

            <div className="pt-3 border-t border-foreground/10 flex justify-between items-center">
              <span className="font-semibold text-foreground uppercase tracking-wider text-sm">Total</span>
              <span className="text-2xl font-heading text-primary">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sudah dibayar</span><span className="text-green-400 font-medium">{formatCurrency(paid)}</span></div>

            <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
              <div className={`h-full rounded-full ${stage === "PAID" ? "bg-green-500" : "bg-primary"}`} style={{ width: `${paidPct}%` }} />
            </div>

            <div className="pt-3 border-t border-primary/30 flex justify-between items-center bg-primary/5 -mx-5 px-5 py-3">
              <span className="font-heading text-foreground tracking-wider uppercase">{stage === "PAID" ? "Status" : "Sisa Tagihan"}</span>
              <span className={`text-2xl font-heading ${balance > 0 ? "text-primary" : "text-green-400"}`}>{stage === "PAID" ? "LUNAS" : formatCurrency(balance)}</span>
            </div>

            <Button onClick={openPayment} disabled={payDisabled} className="w-full bg-green-600 hover:bg-green-600/90 text-white font-heading tracking-wider">
              <Wallet className="w-4 h-4 mr-2" /> Tambah Pembayaran
            </Button>
          </div>

          {/* Riwayat pembayaran */}
          <div className="glass-panel rounded-xl p-5 border-foreground/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Riwayat Pembayaran</p>
            {!invoiceId ? (
              <p className="text-xs text-muted-foreground">Invoice akan disimpan otomatis saat kamu menekan “Tambah Pembayaran”.</p>
            ) : payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {paid > 0 ? `Tercatat ${formatCurrency(paid)} dari data lama (tanpa rincian).` : "Belum ada pembayaran."}
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map((pm, i) => (
                  <div key={pm.id} className="flex items-center justify-between gap-2 rounded-lg bg-foreground/5 border border-foreground/10 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground font-medium">{formatCurrency(pm.amount)}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        #{i + 1} · {pm.method}{pm.reference ? ` · ${pm.reference}` : ""} · {pm.paidAt ? new Date(pm.paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </p>
                    </div>
                    <div className="flex items-center shrink-0">
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-green-400" title="Cetak kwitansi pembayaran ini" onClick={() => openDoc("receipt", pm.id)}>
                        <Receipt className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" title="Hapus pembayaran" onClick={() => handleDeletePayment(pm.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <FileText className="w-4 h-4 text-primary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Preview Invoice</p>
          <span className="text-xs text-muted-foreground">(sama persis dengan hasil cetak / PDF)</span>
          {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
        </div>
        {previewError ? (
          <div className="glass-panel rounded-xl p-6 text-sm text-red-400">{previewError}</div>
        ) : (
          <iframe title="Preview invoice" srcDoc={previewHtml} className="w-full h-[80vh] min-h-[480px] rounded-lg border border-foreground/10 bg-[#d9dce1]" />
        )}
      </div>

      <CompanyProfileDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={() => setPreviewNonce((n) => n + 1)} />
      <InvoiceDocDialog invoiceId={invoiceId} open={docOpen} onOpenChange={setDocOpen} initialDoc={docKind} initialPaymentId={docPaymentId} />
      {invoiceId && (
        <InvoicePaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          invoiceId={invoiceId}
          invoiceNumber={inv.invoiceNumber}
          total={total}
          paid={paid}
          onSaved={refreshInvoice}
          onPrintReceipt={(pid) => { setDocKind("receipt"); setDocPaymentId(pid); setDocOpen(true); }}
        />
      )}
    </div>
  );
}
