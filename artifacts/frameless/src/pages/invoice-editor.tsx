import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetInvoice, useCreateInvoice, useListClients, useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Download, Save, FileText, Upload, ImageIcon, RotateCcw } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  fromName: string;
  fromAddress: string;
  billTo: string;
  shipTo: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  poNumber: string;
  items: LineItem[];
  notes: string;
  terms: string;
  taxRate: number;
  discount: number;
  shipping: number;
  paidAmount: number;
  status: string;
  clientId: string;
  projectId: string;
}

const DEFAULT_LOGO = "/logo-frameless.png";
const BCA_IMAGE = "/bca-payment.png";

const newItem = (): LineItem => ({
  id: Math.random().toString(36).slice(2),
  description: "",
  quantity: 1,
  unitPrice: 0,
  total: 0,
});

function today() {
  return new Date().toISOString().split("T")[0];
}

function daysOut(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DRAFT_KEY = "invoice_draft_new";
const DRAFT_LOGO_KEY = "invoice_draft_logo";

function loadDraft(): Partial<InvoiceData> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function InvoiceEditorPage() {
  const [, params] = useRoute("/invoices/:id");
  const [, navigate] = useLocation();
  const invoiceId = params?.id && params.id !== "new" ? params.id : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previewRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const savedLogo = !invoiceId ? (localStorage.getItem(DRAFT_LOGO_KEY) || DEFAULT_LOGO) : DEFAULT_LOGO;
  const [logoUrl, setLogoUrl] = useState<string>(savedLogo);

  const { data: existingInvoice } = useGetInvoice(invoiceId ?? "", {
    query: { enabled: !!invoiceId } as any,
  });
  const { data: clients } = useListClients();
  const { data: projects } = useListProjects();

  const createMutation = useCreateInvoice({
    mutation: {
      onSuccess: (data) => {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(DRAFT_LOGO_KEY);
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        toast({ title: "Invoice tersimpan" });
        navigate(`/invoices/${data.id}`);
      },
      onError: () => toast({ variant: "destructive", title: "Gagal menyimpan invoice" }),
    },
  });

  const defaultInv: InvoiceData = {
    fromName: "FRAMELESS CREATIVE PROJECT PT",
    fromAddress: "Jakarta, Indonesia\ninfo@frameless.id · +62 xxx xxxx xxxx\nwww.frameless.id",
    billTo: "",
    shipTo: "",
    invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
    invoiceDate: today(),
    dueDate: daysOut(14),
    paymentTerms: "Net 14",
    poNumber: "",
    items: [newItem()],
    notes: "",
    terms: "Pembayaran dilakukan dalam 14 hari kalender sejak tanggal invoice. Keterlambatan pembayaran dikenakan denda 2% per bulan.",
    taxRate: 11,
    discount: 0,
    shipping: 0,
    paidAmount: 0,
    status: "DRAFT",
    clientId: "",
    projectId: "",
  };

  const draft = !invoiceId ? loadDraft() : null;
  const [inv, setInv] = useState<InvoiceData>(draft ? { ...defaultInv, ...draft } : defaultInv);

  useEffect(() => {
    if (existingInvoice) {
      setInv((prev) => ({
        ...prev,
        fromName: "FRAMELESS CREATIVE PROJECT PT",
        fromAddress: "Jakarta, Indonesia\ninfo@frameless.id · +62 xxx xxxx xxxx\nwww.frameless.id",
        billTo: existingInvoice.billTo || "",
        shipTo: existingInvoice.shipTo || "",
        invoiceNumber: existingInvoice.number,
        invoiceDate: today(),
        dueDate: existingInvoice.dueDate
          ? new Date(existingInvoice.dueDate).toISOString().split("T")[0]
          : daysOut(14),
        paymentTerms: "Net 14",
        poNumber: "",
        items:
          existingInvoice.items && existingInvoice.items.length > 0
            ? existingInvoice.items.map((i: any) => ({
                id: i.id,
                description: i.description,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
                total: Number(i.total),
              }))
            : [newItem()],
        notes: existingInvoice.notes || "",
        terms: existingInvoice.terms || prev.terms,
        taxRate:
          existingInvoice.subtotal > 0
            ? Math.round((existingInvoice.tax / existingInvoice.subtotal) * 100)
            : 11,
        discount: existingInvoice.discount || 0,
        shipping: 0,
        paidAmount: existingInvoice.paidAmount || 0,
        status: existingInvoice.status,
        clientId: existingInvoice.clientId || "",
        projectId: existingInvoice.projectId || "",
      }));
    }
  }, [existingInvoice]);

  // ─── Auto-save draft to localStorage (new invoices only) ─────────────────────

  useEffect(() => {
    if (!invoiceId) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(inv));
      } catch {}
    }
  }, [inv, invoiceId]);

  useEffect(() => {
    if (!invoiceId && logoUrl !== DEFAULT_LOGO) {
      try {
        localStorage.setItem(DRAFT_LOGO_KEY, logoUrl);
      } catch {}
    } else if (!invoiceId && logoUrl === DEFAULT_LOGO) {
      localStorage.removeItem(DRAFT_LOGO_KEY);
    }
  }, [logoUrl, invoiceId]);

  // ─── Logo Upload ─────────────────────────────────────────────────────────────

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "File harus berupa gambar (PNG/JPG)" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setLogoUrl(ev.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ─── Calculations ─────────────────────────────────────────────────────────────

  const subtotal = inv.items.reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(subtotal * (inv.taxRate / 100));
  const total = subtotal + taxAmount - inv.discount + inv.shipping;
  const balanceDue = total - inv.paidAmount;

  const updateItem = useCallback((id: string, field: keyof LineItem, value: number | string) => {
    setInv((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.total = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      }),
    }));
  }, []);

  const addItem = () => setInv((p) => ({ ...p, items: [...p.items, newItem()] }));
  const removeItem = (id: string) => setInv((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!inv.clientId) {
      toast({ variant: "destructive", title: "Pilih client terlebih dahulu" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientId: inv.clientId,
        projectId: inv.projectId || undefined,
        status: inv.status,
        subtotal: String(subtotal),
        tax: String(taxAmount),
        discount: String(inv.discount),
        total: String(total),
        paidAmount: inv.paidAmount,
        dueDate: inv.dueDate,
        billTo: inv.billTo,
        shipTo: inv.shipTo,
        notes: inv.notes,
        terms: inv.terms,
        items: inv.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
      };

      if (invoiceId) {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/invoices/${invoiceId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoiceId}`] });
        toast({ title: "Invoice berhasil disimpan" });
      } else {
        createMutation.mutate({ data: payload as any });
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── PDF Export ───────────────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      const el = previewRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      } else {
        let y = 0;
        while (y < pdfHeight) {
          if (y > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, -y, pdfWidth, pdfHeight);
          y += pageHeight;
        }
      }

      pdf.save(`${inv.invoiceNumber}.pdf`);
      toast({ title: "PDF berhasil diunduh" });
    } catch (e) {
      toast({ variant: "destructive", title: "Export gagal, coba lagi" });
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="pb-12 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <a href="/invoices">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </a>
          <div>
            <h1 className="text-3xl font-heading tracking-wider text-white">
              {invoiceId ? inv.invoiceNumber : "New Invoice"}
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest">Invoice Editor</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={inv.status} onValueChange={(v) => setInv((p) => ({ ...p, status: v }))}>
            <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleExportPdf}
            disabled={exporting}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 font-heading tracking-wider"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Exporting..." : "Download PDF"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || createMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving || createMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Editor Form ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Logo Upload */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Logo Perusahaan</p>
            <div className="flex items-center gap-4">
              <div className="w-32 h-16 rounded-lg bg-white flex items-center justify-center border border-white/20 overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  className="border-white/20 text-white hover:bg-white/10 text-xs"
                >
                  <Upload className="w-3.5 h-3.5 mr-2" />
                  Upload Logo Kustom
                </Button>
                {logoUrl !== DEFAULT_LOGO && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl(DEFAULT_LOGO)}
                    className="text-muted-foreground hover:text-white text-xs"
                  >
                    <RotateCcw className="w-3 h-3 mr-1.5" />
                    Reset ke Logo Frameless
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG, JPG, SVG · maks 5MB</p>
              </div>
            </div>
          </div>

          {/* Client / Project */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice Meta</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Client *</label>
                <Select value={inv.clientId} onValueChange={(v) => setInv((p) => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Pilih client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Project</label>
                <Select value={inv.projectId || "__none__"} onValueChange={(v) => setInv((p) => ({ ...p, projectId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    <SelectItem value="__none__">None</SelectItem>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* From / Bill To / Ship To */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">From (Info Pengirim)</label>
              <Textarea
                value={inv.fromAddress}
                onChange={(e) => setInv((p) => ({ ...p, fromAddress: e.target.value }))}
                rows={3}
                className="bg-white/5 border-white/10 text-white resize-none"
                placeholder="Alamat perusahaan, email, telepon"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Bill To (Tagihan Kepada)</label>
                <Textarea
                  value={inv.billTo}
                  onChange={(e) => setInv((p) => ({ ...p, billTo: e.target.value }))}
                  rows={3}
                  className="bg-white/5 border-white/10 text-white resize-none"
                  placeholder="Nama & alamat client"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Ship To (opsional)</label>
                <Textarea
                  value={inv.shipTo}
                  onChange={(e) => setInv((p) => ({ ...p, shipTo: e.target.value }))}
                  rows={3}
                  className="bg-white/5 border-white/10 text-white resize-none"
                  placeholder="Alamat pengiriman"
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="glass-panel rounded-xl p-5 border-white/10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Invoice #</label>
                <Input value={inv.invoiceNumber} onChange={(e) => setInv((p) => ({ ...p, invoiceNumber: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Tanggal</label>
                <Input type="date" value={inv.invoiceDate} onChange={(e) => setInv((p) => ({ ...p, invoiceDate: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Jatuh Tempo</label>
                <Input type="date" value={inv.dueDate} onChange={(e) => setInv((p) => ({ ...p, dueDate: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Terms</label>
                <Input value={inv.paymentTerms} onChange={(e) => setInv((p) => ({ ...p, paymentTerms: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white" placeholder="Net 14" />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Item Pekerjaan</p>
            <div className="grid grid-cols-12 gap-2 pb-2 border-b border-white/10">
              <span className="col-span-5 text-xs uppercase tracking-wider text-muted-foreground">Deskripsi</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-center">Qty</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-right">Harga (IDR)</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-right">Total</span>
              <span className="col-span-1" />
            </div>
            {inv.items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-sm h-9"
                    placeholder="Deskripsi layanan / produk..."
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                    className="bg-white/5 border-white/10 text-white text-sm h-9 text-center"
                    min={0}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                    className="bg-white/5 border-white/10 text-white text-sm h-9 text-right"
                    min={0}
                  />
                </div>
                <div className="col-span-2 text-right text-sm text-white font-medium px-2">
                  {formatCurrency(item.total)}
                </div>
                <div className="col-span-1 flex justify-center">
                  <Button
                    variant="ghost" size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeItem(item.id)}
                    disabled={inv.items.length === 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addItem}
              className="text-primary hover:text-primary hover:bg-primary/10 font-semibold text-xs mt-1">
              <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Item
            </Button>
          </div>

          {/* Notes + Terms */}
          <div className="glass-panel rounded-xl p-5 border-white/10 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Catatan</label>
              <Textarea
                value={inv.notes}
                onChange={(e) => setInv((p) => ({ ...p, notes: e.target.value }))}
                rows={4}
                className="bg-white/5 border-white/10 text-white resize-none text-sm"
                placeholder="Catatan tambahan untuk client"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Syarat & Ketentuan</label>
              <Textarea
                value={inv.terms}
                onChange={(e) => setInv((p) => ({ ...p, terms: e.target.value }))}
                rows={4}
                className="bg-white/5 border-white/10 text-white resize-none text-sm"
                placeholder="Syarat pembayaran, denda keterlambatan, dll."
              />
            </div>
          </div>
        </div>

        {/* ── Totals Panel ── */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-4 sticky top-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Ringkasan</p>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-white font-medium">{formatCurrency(subtotal)}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">PPN (%)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={inv.taxRate}
                    onChange={(e) => setInv((p) => ({ ...p, taxRate: Number(e.target.value) }))}
                    className="bg-white/5 border-white/10 text-white h-8 text-sm"
                    min={0} max={100}
                  />
                  <span className="text-muted-foreground text-sm shrink-0">{formatCurrency(taxAmount)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Diskon (IDR)</label>
                <Input
                  type="number"
                  value={inv.discount}
                  onChange={(e) => setInv((p) => ({ ...p, discount: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 text-white h-8 text-sm"
                  min={0}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Ongkos Kirim (IDR)</label>
                <Input
                  type="number"
                  value={inv.shipping}
                  onChange={(e) => setInv((p) => ({ ...p, shipping: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 text-white h-8 text-sm"
                  min={0}
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                <span className="font-semibold text-white uppercase tracking-wider text-sm">Total</span>
                <span className="text-2xl font-heading text-primary">{formatCurrency(total)}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Jumlah Dibayar (IDR)</label>
                <Input
                  type="number"
                  value={inv.paidAmount}
                  onChange={(e) => setInv((p) => ({ ...p, paidAmount: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 text-white h-8 text-sm"
                  min={0}
                />
              </div>

              <div className="pt-3 border-t border-primary/30 flex justify-between items-center bg-primary/5 -mx-5 px-5 py-3 rounded-b-xl">
                <span className="font-heading text-white tracking-wider uppercase">Sisa Tagihan</span>
                <span className={`text-2xl font-heading ${balanceDue > 0 ? "text-primary" : "text-green-400"}`}>
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>

            <Button onClick={handleExportPdf} disabled={exporting}
              className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-heading tracking-wider mt-2">
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "Generating PDF..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Invoice Preview ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Preview Invoice</p>
          <span className="text-xs text-muted-foreground">(tampilan PDF yang akan diunduh)</span>
        </div>
        <div className="overflow-x-auto">
          <InvoicePreview
            ref={previewRef}
            inv={inv}
            subtotal={subtotal}
            taxAmount={taxAmount}
            total={total}
            balanceDue={balanceDue}
            logoUrl={logoUrl}
            clientName={clients?.find((c) => c.id === inv.clientId)?.name}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Preview Document ─────────────────────────────────────────────────

const InvoicePreview = forwardRef<
  HTMLDivElement,
  {
    inv: InvoiceData;
    subtotal: number;
    taxAmount: number;
    total: number;
    balanceDue: number;
    logoUrl: string;
    clientName?: string;
  }
>(({ inv, subtotal, taxAmount, total, balanceDue, logoUrl, clientName }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        background: "#fff",
        color: "#111",
        width: "794px",
        minHeight: "1123px",
        padding: "48px 56px 40px",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize: "13px",
        lineHeight: "1.55",
        boxShadow: "0 4px 40px rgba(0,0,0,0.25)",
        borderRadius: "4px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        {/* Left: Logo + Company Info */}
        <div style={{ maxWidth: "320px" }}>
          {/* Logo */}
          <div style={{ marginBottom: "14px", height: "72px", display: "flex", alignItems: "center" }}>
            <img
              src={logoUrl}
              alt="Logo"
              style={{ maxHeight: "72px", maxWidth: "240px", objectFit: "contain", objectPosition: "left center" }}
              crossOrigin="anonymous"
            />
          </div>
          {/* Company Info */}
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#111", marginBottom: "2px", letterSpacing: "0.3px" }}>
            Frameless Creative Project PT
          </div>
          <div style={{ fontSize: "11px", color: "#555", lineHeight: "1.6", whiteSpace: "pre-line" }}>
            {inv.fromAddress}
          </div>
        </div>

        {/* Right: Invoice Title + Meta */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "38px", fontWeight: "900", letterSpacing: "5px", color: "#111", marginBottom: "12px", lineHeight: "1" }}>
            INVOICE
          </div>
          <table style={{ marginLeft: "auto", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ color: "#888", paddingRight: "16px", paddingBottom: "5px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>Invoice #</td>
                <td style={{ fontWeight: "700", paddingBottom: "5px", fontSize: "13px" }}>{inv.invoiceNumber}</td>
              </tr>
              <tr>
                <td style={{ color: "#888", paddingRight: "16px", paddingBottom: "5px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>Tanggal</td>
                <td style={{ paddingBottom: "5px" }}>{inv.invoiceDate}</td>
              </tr>
              <tr>
                <td style={{ color: "#888", paddingRight: "16px", paddingBottom: "5px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>Jatuh Tempo</td>
                <td style={{ paddingBottom: "5px", fontWeight: "700", color: "#c0392b" }}>{inv.dueDate}</td>
              </tr>
              {inv.paymentTerms && (
                <tr>
                  <td style={{ color: "#888", paddingRight: "16px", paddingBottom: "5px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>Terms</td>
                  <td style={{ paddingBottom: "5px" }}>{inv.paymentTerms}</td>
                </tr>
              )}
              {inv.poNumber && (
                <tr>
                  <td style={{ color: "#888", paddingRight: "16px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>PO #</td>
                  <td>{inv.poNumber}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Orange Accent Divider ── */}
      <div style={{ height: "3px", background: "linear-gradient(90deg, #ff6b35 0%, #ff9a35 60%, #ffd23520 100%)", marginBottom: "24px", borderRadius: "2px" }} />

      {/* ── Bill To / Ship To ── */}
      <div style={{ display: "grid", gridTemplateColumns: inv.shipTo ? "1fr 1fr" : "1fr 2fr", gap: "24px", marginBottom: "28px" }}>
        <div style={{ background: "#f9f9f9", borderRadius: "6px", padding: "14px 16px", borderLeft: "3px solid #ff6b35" }}>
          <div style={{ fontSize: "9px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "6px", fontWeight: "600" }}>Tagihan Kepada</div>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "3px" }}>
            {clientName || inv.billTo?.split("\n")[0] || "—"}
          </div>
          {inv.billTo && (
            <div style={{ color: "#555", whiteSpace: "pre-line", fontSize: "12px", lineHeight: "1.55" }}>
              {inv.billTo.split("\n").slice(clientName ? 0 : 1).join("\n")}
            </div>
          )}
        </div>
        {inv.shipTo ? (
          <div style={{ background: "#f9f9f9", borderRadius: "6px", padding: "14px 16px" }}>
            <div style={{ fontSize: "9px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "6px", fontWeight: "600" }}>Dikirim Ke</div>
            <div style={{ color: "#444", whiteSpace: "pre-line", fontSize: "12px" }}>{inv.shipTo}</div>
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* ── Line Items Table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
        <thead>
          <tr style={{ background: "#1a1a1a" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", color: "#fff", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600" }}>Deskripsi Item / Layanan</th>
            <th style={{ textAlign: "center", padding: "10px 14px", color: "#fff", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600", width: "70px" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "10px 14px", color: "#fff", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600", width: "150px" }}>Harga Satuan</th>
            <th style={{ textAlign: "right", padding: "10px 14px", color: "#fff", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600", width: "150px" }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? "#fafafa" : "#ffffff", borderBottom: "1px solid #ececec" }}>
              <td style={{ padding: "10px 14px", color: "#222", fontSize: "13px" }}>{item.description || "—"}</td>
              <td style={{ padding: "10px 14px", textAlign: "center", color: "#666" }}>{item.quantity}</td>
              <td style={{ padding: "10px 14px", textAlign: "right", color: "#555" }}>{formatCurrency(item.unitPrice)}</td>
              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: "600", color: "#111" }}>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals (right-aligned) ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <div style={{ width: "340px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "5px 0", color: "#666", fontSize: "12px" }}>Subtotal</td>
                <td style={{ padding: "5px 0", textAlign: "right", fontWeight: "500" }}>{formatCurrency(subtotal)}</td>
              </tr>
              {taxAmount > 0 && (
                <tr>
                  <td style={{ padding: "5px 0", color: "#666", fontSize: "12px" }}>PPN ({inv.taxRate}%)</td>
                  <td style={{ padding: "5px 0", textAlign: "right", fontWeight: "500" }}>{formatCurrency(taxAmount)}</td>
                </tr>
              )}
              {inv.discount > 0 && (
                <tr>
                  <td style={{ padding: "5px 0", color: "#666", fontSize: "12px" }}>Diskon</td>
                  <td style={{ padding: "5px 0", textAlign: "right", fontWeight: "500", color: "#22c55e" }}>−{formatCurrency(inv.discount)}</td>
                </tr>
              )}
              {inv.shipping > 0 && (
                <tr>
                  <td style={{ padding: "5px 0", color: "#666", fontSize: "12px" }}>Ongkos Kirim</td>
                  <td style={{ padding: "5px 0", textAlign: "right", fontWeight: "500" }}>{formatCurrency(inv.shipping)}</td>
                </tr>
              )}
              <tr style={{ borderTop: "2px solid #1a1a1a" }}>
                <td style={{ padding: "10px 0 5px", fontWeight: "700", fontSize: "13px", letterSpacing: "1px", textTransform: "uppercase" }}>Total</td>
                <td style={{ padding: "10px 0 5px", textAlign: "right", fontWeight: "800", fontSize: "17px", color: "#ff6b35" }}>{formatCurrency(total)}</td>
              </tr>
              {inv.paidAmount > 0 && (
                <tr>
                  <td style={{ padding: "4px 0", color: "#666", fontSize: "12px" }}>Sudah Dibayar</td>
                  <td style={{ padding: "4px 0", textAlign: "right", color: "#22c55e", fontWeight: "600" }}>−{formatCurrency(inv.paidAmount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={2} style={{ padding: "0" }}>
                  <div style={{ background: "#1a1a1a", borderRadius: "5px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                    <span style={{ fontWeight: "700", fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", color: "#fff" }}>Sisa Tagihan</span>
                    <span style={{ fontWeight: "900", fontSize: "20px", color: "#ff6b35" }}>{formatCurrency(balanceDue)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* BCA Payment — di bawah total, kanan */}
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "8px", fontWeight: "600" }}>Informasi Pembayaran</div>
            <div style={{ border: "1.5px solid #1a4f9b", borderRadius: "8px", padding: "12px 16px", background: "#f0f5ff", display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={BCA_IMAGE} alt="BCA" style={{ height: "32px", objectFit: "contain", flexShrink: 0 }} crossOrigin="anonymous" />
              <div>
                <div style={{ fontSize: "9px", color: "#1a4f9b", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600", marginBottom: "1px" }}>Bank Central Asia</div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#1a4f9b", letterSpacing: "2px", fontFamily: "monospace" }}>239-0777895</div>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#1a4f9b", letterSpacing: "0.5px", textTransform: "uppercase" }}>FRAMELESS CREATIVE PROJECT PT</div>
              </div>
            </div>
            <div style={{ fontSize: "10px", color: "#888", marginTop: "6px", lineHeight: "1.55" }}>
              Sertakan nomor invoice pada berita transfer.
            </div>
          </div>
        </div>
      </div>

      {/* ── Catatan + Syarat & Ketentuan (bawah, full-width 2-col) ── */}
      {(inv.notes || inv.terms) && (
        <div style={{ display: "grid", gridTemplateColumns: inv.notes && inv.terms ? "1fr 1fr" : "1fr", gap: "28px", borderTop: "1px solid #ececec", paddingTop: "18px", marginBottom: "20px" }}>
          {inv.notes && (
            <div>
              <div style={{ fontSize: "9px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "5px", fontWeight: "600" }}>Catatan</div>
              <div style={{ color: "#444", fontSize: "12px", lineHeight: "1.65" }}>{inv.notes}</div>
            </div>
          )}
          {inv.terms && (
            <div>
              <div style={{ fontSize: "9px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "5px", fontWeight: "600" }}>Syarat & Ketentuan</div>
              <div style={{ color: "#555", fontSize: "11px", lineHeight: "1.7" }}>{inv.terms}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Official Footer ── */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "16px", marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: "800", fontSize: "12px", letterSpacing: "2px", color: "#111", textTransform: "uppercase", marginBottom: "3px" }}>
              Frameless Creative Project PT
            </div>
            <div style={{ fontSize: "10px", color: "#888", lineHeight: "1.6" }}>
              Dokumen ini merupakan invoice resmi yang diterbitkan oleh Frameless Creative Project PT.<br />
              Invoice ini sah tanpa tanda tangan dan cap basah. Berlaku sesuai syarat & ketentuan yang tertera.
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "10px", color: "#999", marginBottom: "3px" }}>Dicetak pada</div>
            <div style={{ fontSize: "11px", fontWeight: "600", color: "#555" }}>
              {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff6b35" }} />
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff9a35" }} />
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ffd235" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

InvoicePreview.displayName = "InvoicePreview";
