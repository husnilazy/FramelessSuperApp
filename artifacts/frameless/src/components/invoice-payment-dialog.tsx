import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Printer, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { recordPayment } from "@/lib/invoice-docs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  paid: number;
  /** Dipanggil setelah pembayaran tersimpan — induk memuat ulang data invoice. */
  onSaved: () => void;
  /** Cetak kwitansi untuk pembayaran yang baru dicatat. */
  onPrintReceipt: (paymentId: string) => void;
}

const METHODS = ["Transfer", "Tunai", "QRIS", "E-Wallet", "Lainnya"];
const todayStr = () => new Date().toISOString().split("T")[0];

export function InvoicePaymentDialog({ open, onOpenChange, invoiceId, invoiceNumber, total, paid, onSaved, onPrintReceipt }: Props) {
  const { toast } = useToast();
  const balance = Math.max(total - paid, 0);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Transfer");
  const [paidAt, setPaidAt] = useState(todayStr());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; stage: string; amount: number; remaining: number } | null>(null);

  // Reset setiap dialog dibuka; jumlah default = sisa tagihan
  useEffect(() => {
    if (open) {
      setAmount(balance > 0 ? String(Math.round(balance)) : "");
      setMethod("Transfer");
      setPaidAt(todayStr());
      setReference("");
      setNotes("");
      setDone(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amt = Number(amount) || 0;
  const remainingAfter = Math.max(balance - amt, 0);
  const overpay = amt > balance + 0.5;
  const quick: { label: string; value: number }[] = [];
  if (paid <= 0) {
    for (const pct of [30, 50]) quick.push({ label: `DP ${pct}%`, value: Math.round((total * pct) / 100) });
  }
  if (balance > 0) quick.push({ label: `Lunasi sisa`, value: Math.round(balance) });

  const submit = async () => {
    if (!(amt > 0)) { toast({ variant: "destructive", title: "Isi jumlah pembayaran" }); return; }
    if (overpay) { toast({ variant: "destructive", title: "Jumlah melebihi sisa tagihan" }); return; }
    setBusy(true);
    try {
      const r = await recordPayment(invoiceId, { amount: amt, method, paidAt, reference: reference || undefined, notes: notes || undefined });
      // sisa dihitung dari saldo SEBELUM refresh (prop `paid` ikut berubah setelah onSaved)
      setDone({ id: r.id, stage: r.stage, amount: amt, remaining: Math.max(balance - amt, 0) });
      onSaved();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal mencatat pembayaran", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[92vh] overflow-y-auto bg-card border-foreground/10">
        {done ? (
          <div className="py-4 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto" />
            <div>
              <p className="font-heading text-2xl text-foreground tracking-wider">
                {done.stage === "PAID" ? "Invoice Lunas" : "Pembayaran Tercatat"}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {formatCurrency(done.amount)} untuk {invoiceNumber}
                {done.stage === "PAID" ? " — status invoice otomatis menjadi PAID." : ` — sisa ${formatCurrency(done.remaining)}.`}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => { onOpenChange(false); onPrintReceipt(done.id); }}>
                <Printer className="w-4 h-4 mr-2" /> Cetak Kwitansi {done.stage === "PAID" ? "Lunas" : "DP"}
              </Button>
              <Button variant="outline" className="border-foreground/20 text-foreground hover:bg-foreground/10" onClick={() => onOpenChange(false)}>
                Selesai
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading tracking-wider text-foreground text-xl flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" /> Tambah Pembayaran
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {invoiceNumber} — status dan sisa tagihan diperbarui otomatis.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Total", formatCurrency(total), "text-foreground"],
                ["Sudah dibayar", formatCurrency(paid), "text-green-400"],
                ["Sisa tagihan", formatCurrency(balance), "text-primary"],
              ].map(([k, v, c]) => (
                <div key={k} className="rounded-lg bg-foreground/5 border border-foreground/10 py-2 px-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                  <p className={`text-sm font-semibold ${c}`}>{v}</p>
                </div>
              ))}
            </div>

            {balance <= 0 ? (
              <p className="text-sm text-green-400 text-center py-4">Invoice ini sudah lunas.</p>
            ) : (
              <div className="space-y-3">
                {quick.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {quick.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => setAmount(String(q.value))}
                        className={`text-xs px-3 py-1.5 rounded-md border font-semibold transition-colors ${
                          Number(amount) === q.value ? "bg-primary/20 border-primary/50 text-primary" : "border-foreground/15 text-muted-foreground hover:bg-foreground/10"
                        }`}
                      >
                        {q.label} · {formatCurrency(q.value)}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Jumlah dibayar (IDR) *</label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-foreground/5 border-foreground/10 text-foreground text-lg h-11"
                    autoFocus
                  />
                  {overpay ? (
                    <p className="text-xs text-red-400">Melebihi sisa tagihan ({formatCurrency(balance)}).</p>
                  ) : amt > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Setelah ini: <b className={remainingAfter <= 0.5 ? "text-green-400" : "text-primary"}>
                        {remainingAfter <= 0.5 ? "LUNAS" : `sisa ${formatCurrency(remainingAfter)}`}
                      </b>
                      {remainingAfter > 0.5 ? ` · tercatat sebagai ${paid > 0 ? "pembayaran termin" : "DP"}` : ""}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Metode</label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger className="bg-foreground/5 border-foreground/10 text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-foreground/10">
                        {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Tanggal bayar</label>
                    <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="bg-foreground/5 border-foreground/10 text-foreground" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">No. referensi (opsional)</label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. transfer / bukti" className="bg-foreground/5 border-foreground/10 text-foreground" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Catatan (opsional)</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-foreground/5 border-foreground/10 text-foreground resize-none" />
                </div>

                <Button onClick={submit} disabled={busy || !(amt > 0) || overpay} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider h-11">
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
                  Catat Pembayaran
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
