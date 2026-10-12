import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, FileText, Receipt, Loader2, Link2, Mail, MessageCircle, Check } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  createShareLink,
  normalizeWaNumber,
  fetchInvoiceDetail,
  fetchInvoiceDocHtml,
  fetchInvoiceDocPdf,
  saveBlob,
  slugifyNumber,
  type InvoiceDocKind,
  type InvoicePayment,
} from "@/lib/invoice-docs";

interface Props {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dokumen yang tampil pertama kali. Default: kwitansi bila sudah ada pembayaran, kalau tidak invoice. */
  initialDoc?: InvoiceDocKind;
  /** Kwitansi untuk pembayaran tertentu (default: pembayaran terakhir). */
  initialPaymentId?: string | null;
}

export function InvoiceDocDialog({ invoiceId, open, onOpenChange, initialDoc, initialPaymentId }: Props) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [number, setNumber] = useState("");
  const [total, setTotal] = useState(0);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [paid, setPaid] = useState(0);
  const [doc, setDoc] = useState<InvoiceDocKind>("invoice");
  const [paymentId, setPaymentId] = useState<string>("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [contact, setContact] = useState<{ name: string; phone: string; email: string; dueDate: string | null; company: string }>({ name: "", phone: "", email: "", dueDate: null, company: "Frameless Creative" });

  // Muat ringkasan invoice setiap dialog dibuka (pembayaran bisa berubah sejak terakhir dilihat).
  useEffect(() => {
    if (!open || !invoiceId) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchInvoiceDetail(invoiceId);
        if (cancelled) return;
        setNumber(d.number);
        setTotal(Number(d.total));
        setPaid(Number(d.paidAmount));
        setPayments(d.payments ?? []);
        setContact((c) => ({ ...c, name: d.clientName || "", phone: d.clientPhone || "", email: d.clientEmail || "", dueDate: d.dueDate || null }));
        setPaymentId(initialPaymentId ?? "");
        setDoc(initialDoc ?? (Number(d.paidAmount) > 0 ? "receipt" : "invoice"));
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [open, invoiceId, initialDoc, initialPaymentId]);

  useEffect(() => {
    if (!open || !invoiceId || !number) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchInvoiceDocHtml(invoiceId, doc, { paymentId: doc === "receipt" ? paymentId || null : null })
      .then((h) => { if (!cancelled) setHtml(h); })
      .catch((e) => { if (!cancelled) { setHtml(""); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, invoiceId, number, doc, paymentId]);

  // Link publik disiapkan di muka agar tombol WhatsApp / Email berupa tautan biasa (tidak diblokir pop-up)
  useEffect(() => {
    if (!open || !invoiceId || !number) return;
    let cancelled = false;
    setShareUrl("");
    setCopied(false);
    createShareLink(invoiceId, doc, doc === "receipt" ? paymentId || null : null)
      .then((u) => { if (!cancelled) setShareUrl(u); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, invoiceId, number, doc, paymentId]);

  useEffect(() => {
    if (!open) return;
    let t: string | null = null;
    try { t = localStorage.getItem("token"); } catch {}
    fetch("/api/company-profile", { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then((r) => r.json())
      .then((c) => c?.companyName && setContact((x) => ({ ...x, company: c.companyName })))
      .catch(() => {});
  }, [open]);

  const hasPayments = paid > 0;

  const sel = doc === "receipt" ? (payments.find((p) => p.id === paymentId) ?? payments[payments.length - 1]) : null;
  const rp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const dueTxt = contact.dueDate ? new Date(contact.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";
  const message =
    doc === "receipt"
      ? `Halo ${contact.name || ""}, terima kasih atas pembayarannya. Berikut kwitansi ${sel && sel.amount >= total - 0.5 ? "pelunasan" : "pembayaran"} untuk invoice ${number}${sel ? ` sebesar ${rp(sel.amount)}` : ""} dari ${contact.company}.\n${shareUrl}`
      : `Halo ${contact.name || ""}, berikut invoice ${number} dari ${contact.company} sebesar ${rp(total - paid > 0 ? total - paid : total)}${dueTxt ? `, jatuh tempo ${dueTxt}` : ""}.\nLihat / unduh: ${shareUrl}`;
  const wa = normalizeWaNumber(contact.phone);
  const waHref = shareUrl ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : undefined;
  const mailHref = shareUrl ? `mailto:${contact.email}?subject=${encodeURIComponent(`${doc === "receipt" ? "Kwitansi" : "Invoice"} ${number} — ${contact.company}`)}&body=${encodeURIComponent(message)}` : undefined;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Gagal menyalin", description: shareUrl });
    }
  };

  const handlePrint = () => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  const handleDownload = async () => {
    if (!invoiceId) return;
    setBusy(true);
    try {
      const blob = await fetchInvoiceDocPdf(invoiceId, doc, { paymentId: doc === "receipt" ? paymentId || null : null });
      saveBlob(blob, `${doc === "receipt" ? "kwitansi" : "invoice"}-${slugifyNumber(number)}.pdf`);
    } catch (e: any) {
      // PDF server tidak tersedia → buka jendela cetak browser (pilih "Simpan sebagai PDF"), hasilnya sama
      toast({
        title: "PDF server belum tersedia — memakai cetak browser",
        description: 'Di jendela cetak, pilih "Simpan sebagai PDF".',
      });
      console.warn("PDF server gagal:", e?.message);
      setTimeout(handlePrint, 400);
    } finally {
      setBusy(false);
    }
  };

  const tabCls = (active: boolean, disabled = false) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider border transition-colors ${
      disabled
        ? "opacity-40 cursor-not-allowed border-foreground/10 text-muted-foreground"
        : active
        ? "bg-primary/20 text-primary border-primary/40"
        : "bg-foreground/5 text-muted-foreground border-foreground/10 hover:bg-foreground/10"
    }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[calc(100vw-1.5rem)] max-h-[95vh] p-0 gap-0 bg-card border-foreground/10 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-5 pt-4 pb-3 border-b border-foreground/10 space-y-3">
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle className="font-heading tracking-wider text-foreground text-xl">
              {number || "Dokumen"} <span className="text-muted-foreground text-sm font-sans tracking-normal">· {formatCurrency(total)}</span>
            </DialogTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={tabCls(doc === "invoice")} onClick={() => setDoc("invoice")}>
              <FileText className="w-3.5 h-3.5" /> Invoice
            </button>
            <button
              className={tabCls(doc === "receipt", !hasPayments)}
              disabled={!hasPayments}
              title={hasPayments ? "" : "Belum ada pembayaran"}
              onClick={() => hasPayments && setDoc("receipt")}
            >
              <Receipt className="w-3.5 h-3.5" /> Kwitansi DP / Lunas
            </button>

            {doc === "receipt" && payments.length > 1 && (
              <select
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                className="bg-foreground/5 border border-foreground/10 text-foreground text-xs rounded-md px-2 py-1.5 max-w-full"
              >
                <option value="">Pembayaran terakhir</option>
                {payments.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    #{i + 1} · {formatCurrency(p.amount)} · {p.method}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Button size="sm" variant="outline" className="border-foreground/20 text-foreground hover:bg-foreground/10" onClick={copyLink} disabled={!shareUrl} title="Salin link untuk dikirim ke client">
                {copied ? <Check className="w-4 h-4 mr-1.5 text-green-400" /> : <Link2 className="w-4 h-4 mr-1.5" />} {copied ? "Tersalin" : "Salin Link"}
              </Button>
              <Button asChild size="sm" variant="outline" className={`border-green-500/40 text-green-400 hover:bg-green-500/10 ${!waHref ? "pointer-events-none opacity-50" : ""}`}>
                <a href={waHref} target="_blank" rel="noreferrer" title={wa ? `Kirim ke ${contact.phone}` : "Nomor client belum ada — pilih kontak di WhatsApp"}>
                  <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className={`border-foreground/20 text-foreground hover:bg-foreground/10 ${!mailHref ? "pointer-events-none opacity-50" : ""}`}>
                <a href={mailHref} title={contact.email ? `Kirim ke ${contact.email}` : "Email client belum ada"}>
                  <Mail className="w-4 h-4 mr-1.5" /> Email
                </a>
              </Button>
              <Button size="sm" variant="outline" className="border-foreground/20 text-foreground hover:bg-foreground/10" onClick={handlePrint} disabled={loading || !html}>
                <Printer className="w-4 h-4 mr-1.5" /> Cetak
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white" onClick={handleDownload} disabled={busy || loading || !html}>
                {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                Unduh PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="relative flex-1 min-h-[60vh] bg-[#d9dce1]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          )}
          {error ? (
            <div className="p-8 text-center text-sm text-red-500">{error}</div>
          ) : (
            <iframe ref={iframeRef} title="Dokumen invoice" srcDoc={html} className="w-full h-[70vh] border-0 bg-transparent" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
