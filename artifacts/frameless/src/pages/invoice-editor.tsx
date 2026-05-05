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
import { ArrowLeft, Plus, Trash2, Download, Save, FileText } from "lucide-react";

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

export default function InvoiceEditorPage() {
  const [, params] = useRoute("/invoices/:id");
  const [, navigate] = useLocation();
  const invoiceId = params?.id && params.id !== "new" ? params.id : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const previewRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: existingInvoice } = useGetInvoice(invoiceId ?? "", {
    query: { enabled: !!invoiceId } as any,
  });
  const { data: clients } = useListClients();
  const { data: projects } = useListProjects();

  const createMutation = useCreateInvoice({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        toast({ title: "Invoice saved" });
        navigate(`/invoices/${data.id}`);
      },
      onError: () => toast({ variant: "destructive", title: "Failed to save invoice" }),
    },
  });

  const [inv, setInv] = useState<InvoiceData>({
    fromName: "FRAMELESS CREATIVE",
    fromAddress: "Jakarta, Indonesia\nadmin@frameless.com",
    billTo: "",
    shipTo: "",
    invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
    invoiceDate: today(),
    dueDate: daysOut(30),
    paymentTerms: "Net 30",
    poNumber: "",
    items: [newItem()],
    notes: "",
    terms: "Payment due within 30 days. Late payments subject to 2% monthly interest.",
    taxRate: 11,
    discount: 0,
    shipping: 0,
    paidAmount: 0,
    status: "DRAFT",
    clientId: "",
    projectId: "",
  });

  useEffect(() => {
    if (existingInvoice) {
      setInv((prev) => ({
        ...prev,
        fromName: "FRAMELESS CREATIVE",
        fromAddress: "Jakarta, Indonesia\nadmin@frameless.com",
        billTo: existingInvoice.billTo || "",
        shipTo: (existingInvoice as any).shipTo || "",
        invoiceNumber: existingInvoice.number,
        invoiceDate: today(),
        dueDate: existingInvoice.dueDate
          ? new Date(existingInvoice.dueDate).toISOString().split("T")[0]
          : daysOut(30),
        paymentTerms: "Net 30",
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
        taxRate: existingInvoice.subtotal > 0
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

  // ─── Calculations ───────────────────────────────────────────────────────────

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

  // ─── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!inv.clientId) {
      toast({ variant: "destructive", title: "Select a client first" });
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
        toast({ title: "Invoice updated" });
      } else {
        createMutation.mutate({ data: payload as any });
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── PDF Export ────────────────────────────────────────────────────────────

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
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // If taller than A4, split into pages
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
      toast({ title: "PDF downloaded" });
    } catch (e) {
      toast({ variant: "destructive", title: "Export failed" });
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

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
          {/* Client / Project */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice Meta</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Client *</label>
                <Select value={inv.clientId} onValueChange={(v) => setInv((p) => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Select client..." />
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
              <label className="text-xs uppercase tracking-wider text-muted-foreground">From</label>
              <Textarea
                value={inv.fromAddress}
                onChange={(e) => setInv((p) => ({ ...p, fromAddress: e.target.value }))}
                rows={2}
                className="bg-white/5 border-white/10 text-white resize-none"
                placeholder="Your business address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Bill To</label>
                <Textarea
                  value={inv.billTo}
                  onChange={(e) => setInv((p) => ({ ...p, billTo: e.target.value }))}
                  rows={3}
                  className="bg-white/5 border-white/10 text-white resize-none"
                  placeholder="Client name & address"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Ship To (optional)</label>
                <Textarea
                  value={inv.shipTo}
                  onChange={(e) => setInv((p) => ({ ...p, shipTo: e.target.value }))}
                  rows={3}
                  className="bg-white/5 border-white/10 text-white resize-none"
                  placeholder="Shipping address"
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Invoice Date</label>
                <Input type="date" value={inv.invoiceDate} onChange={(e) => setInv((p) => ({ ...p, invoiceDate: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Due Date</label>
                <Input type="date" value={inv.dueDate} onChange={(e) => setInv((p) => ({ ...p, dueDate: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Payment Terms</label>
                <Input value={inv.paymentTerms} onChange={(e) => setInv((p) => ({ ...p, paymentTerms: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white" placeholder="Net 30" />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Line Items</p>
            <div className="grid grid-cols-12 gap-2 pb-2 border-b border-white/10">
              <span className="col-span-5 text-xs uppercase tracking-wider text-muted-foreground">Item / Description</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-center">Qty</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-right">Rate (IDR)</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-right">Amount</span>
              <span className="col-span-1" />
            </div>
            {inv.items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-sm h-9"
                    placeholder="Description of item/service..."
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
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Line Item
            </Button>
          </div>

          {/* Notes + Terms */}
          <div className="glass-panel rounded-xl p-5 border-white/10 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</label>
              <Textarea
                value={inv.notes}
                onChange={(e) => setInv((p) => ({ ...p, notes: e.target.value }))}
                rows={4}
                className="bg-white/5 border-white/10 text-white resize-none text-sm"
                placeholder="Notes — any relevant information not already covered"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Terms</label>
              <Textarea
                value={inv.terms}
                onChange={(e) => setInv((p) => ({ ...p, terms: e.target.value }))}
                rows={4}
                className="bg-white/5 border-white/10 text-white resize-none text-sm"
                placeholder="Terms and conditions — late fees, payment methods, delivery schedule"
              />
            </div>
          </div>
        </div>

        {/* ── Totals Panel ── */}
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-5 border-white/10 space-y-4 sticky top-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Summary</p>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-white font-medium">{formatCurrency(subtotal)}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Tax Rate (%)</label>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Discount (IDR)</label>
                <Input
                  type="number"
                  value={inv.discount}
                  onChange={(e) => setInv((p) => ({ ...p, discount: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 text-white h-8 text-sm"
                  min={0}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Shipping (IDR)</label>
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
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount Paid (IDR)</label>
                <Input
                  type="number"
                  value={inv.paidAmount}
                  onChange={(e) => setInv((p) => ({ ...p, paidAmount: Number(e.target.value) }))}
                  className="bg-white/5 border-white/10 text-white h-8 text-sm"
                  min={0}
                />
              </div>

              <div className="pt-3 border-t border-primary/30 flex justify-between items-center bg-primary/5 -mx-5 px-5 py-3 rounded-b-xl">
                <span className="font-heading text-white tracking-wider uppercase">Balance Due</span>
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

      {/* ── Print/PDF Preview (hidden, used for pdf generation) ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice Preview</p>
          <span className="text-xs text-muted-foreground">(this is what the PDF will look like)</span>
        </div>
        <div className="overflow-x-auto">
          <InvoicePreview
            ref={previewRef}
            inv={inv}
            subtotal={subtotal}
            taxAmount={taxAmount}
            total={total}
            balanceDue={balanceDue}
            clientName={clients?.find((c) => c.id === inv.clientId)?.name}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Preview (the printable document) ─────────────────────────────────

const InvoicePreview = forwardRef<
  HTMLDivElement,
  {
    inv: InvoiceData;
    subtotal: number;
    taxAmount: number;
    total: number;
    balanceDue: number;
    clientName?: string;
  }
>(({ inv, subtotal, taxAmount, total, balanceDue, clientName }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        background: "#fff",
        color: "#111",
        width: "794px",
        minHeight: "1123px",
        padding: "48px 56px",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "13px",
        lineHeight: "1.5",
        boxShadow: "0 4px 40px rgba(0,0,0,0.3)",
        borderRadius: "4px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
        <div>
          <div style={{ fontSize: "22px", fontWeight: "800", letterSpacing: "4px", color: "#111", marginBottom: "4px" }}>
            FRAMELESS™
          </div>
          <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#666", textTransform: "uppercase" }}>
            STUDIODO · ZENSVISUAL
          </div>
          <div style={{ marginTop: "12px", color: "#444", fontSize: "12px", whiteSpace: "pre-line" }}>
            {inv.fromAddress}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "36px", fontWeight: "900", letterSpacing: "4px", color: "#111", marginBottom: "8px" }}>
            INVOICE
          </div>
          <table style={{ marginLeft: "auto", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ color: "#666", paddingRight: "16px", paddingBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Invoice #</td>
                <td style={{ fontWeight: "700", paddingBottom: "4px" }}>{inv.invoiceNumber}</td>
              </tr>
              <tr>
                <td style={{ color: "#666", paddingRight: "16px", paddingBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Date</td>
                <td style={{ paddingBottom: "4px" }}>{inv.invoiceDate}</td>
              </tr>
              <tr>
                <td style={{ color: "#666", paddingRight: "16px", paddingBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Due Date</td>
                <td style={{ paddingBottom: "4px", fontWeight: "600" }}>{inv.dueDate}</td>
              </tr>
              {inv.paymentTerms && (
                <tr>
                  <td style={{ color: "#666", paddingRight: "16px", paddingBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>Terms</td>
                  <td style={{ paddingBottom: "4px" }}>{inv.paymentTerms}</td>
                </tr>
              )}
              {inv.poNumber && (
                <tr>
                  <td style={{ color: "#666", paddingRight: "16px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>PO #</td>
                  <td>{inv.poNumber}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "3px", background: "linear-gradient(90deg, #ff6b35, #ff9a35)", marginBottom: "28px", borderRadius: "2px" }} />

      {/* Bill To / Ship To */}
      <div style={{ display: "grid", gridTemplateColumns: inv.shipTo ? "1fr 1fr" : "1fr", gap: "32px", marginBottom: "36px" }}>
        <div>
          <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "8px" }}>Bill To</div>
          <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "4px" }}>
            {clientName || inv.billTo?.split("\n")[0] || "—"}
          </div>
          {inv.billTo && (
            <div style={{ color: "#444", whiteSpace: "pre-line", fontSize: "12px" }}>
              {inv.billTo.split("\n").slice(clientName ? 0 : 1).join("\n")}
            </div>
          )}
        </div>
        {inv.shipTo && (
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "8px" }}>Ship To</div>
            <div style={{ color: "#444", whiteSpace: "pre-line", fontSize: "12px" }}>{inv.shipTo}</div>
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
        <thead>
          <tr style={{ background: "#111" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", color: "#fff", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600" }}>Item</th>
            <th style={{ textAlign: "center", padding: "10px 14px", color: "#fff", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600", width: "80px" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "10px 14px", color: "#fff", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600", width: "140px" }}>Rate</th>
            <th style={{ textAlign: "right", padding: "10px 14px", color: "#fff", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "600", width: "140px" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? "#fafafa" : "#fff", borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 14px", color: "#222" }}>{item.description || "—"}</td>
              <td style={{ padding: "10px 14px", textAlign: "center", color: "#555" }}>{item.quantity}</td>
              <td style={{ padding: "10px 14px", textAlign: "right", color: "#555" }}>{formatCurrency(item.unitPrice)}</td>
              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: "600", color: "#111" }}>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals + Notes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: "24px" }}>
        {/* Notes */}
        <div>
          {inv.notes && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "6px" }}>Notes</div>
              <div style={{ color: "#444", fontSize: "12px", lineHeight: "1.6" }}>{inv.notes}</div>
            </div>
          )}
          {inv.terms && (
            <div>
              <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#999", marginBottom: "6px" }}>Terms</div>
              <div style={{ color: "#444", fontSize: "12px", lineHeight: "1.6" }}>{inv.terms}</div>
            </div>
          )}
        </div>

        {/* Totals */}
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "6px 0", color: "#666", fontSize: "12px" }}>Subtotal</td>
                <td style={{ padding: "6px 0", textAlign: "right", fontWeight: "500" }}>{formatCurrency(subtotal)}</td>
              </tr>
              {taxAmount > 0 && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#666", fontSize: "12px" }}>PPN ({inv.taxRate}%)</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontWeight: "500" }}>{formatCurrency(taxAmount)}</td>
                </tr>
              )}
              {inv.discount > 0 && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#666", fontSize: "12px" }}>Discount</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontWeight: "500", color: "#22c55e" }}>−{formatCurrency(inv.discount)}</td>
                </tr>
              )}
              {inv.shipping > 0 && (
                <tr>
                  <td style={{ padding: "6px 0", color: "#666", fontSize: "12px" }}>Shipping</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontWeight: "500" }}>{formatCurrency(inv.shipping)}</td>
                </tr>
              )}
              <tr style={{ borderTop: "2px solid #111" }}>
                <td style={{ padding: "10px 0 6px", fontWeight: "700", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase" }}>Total</td>
                <td style={{ padding: "10px 0 6px", textAlign: "right", fontWeight: "800", fontSize: "18px", color: "#ff6b35" }}>{formatCurrency(total)}</td>
              </tr>
              {inv.paidAmount > 0 && (
                <tr>
                  <td style={{ padding: "4px 0", color: "#666", fontSize: "12px" }}>Amount Paid</td>
                  <td style={{ padding: "4px 0", textAlign: "right", color: "#22c55e", fontWeight: "600" }}>{formatCurrency(inv.paidAmount)}</td>
                </tr>
              )}
              <tr style={{ background: "#111", borderRadius: "4px" }}>
                <td style={{ padding: "10px 12px", fontWeight: "700", fontSize: "14px", letterSpacing: "2px", textTransform: "uppercase", color: "#fff" }}>Balance Due</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "800", fontSize: "20px", color: "#ff6b35" }}>{formatCurrency(balanceDue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #eee", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "11px", color: "#999" }}>Thank you for your business!</div>
        <div style={{ fontSize: "11px", color: "#999", letterSpacing: "2px" }}>FRAMELESS™ CREATIVE</div>
      </div>
    </div>
  );
});

InvoicePreview.displayName = "InvoicePreview";
