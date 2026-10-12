import { useEffect, useState } from "react";
import { useListInvoices } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Receipt, ArrowRight, TrendingUp, Clock, AlertCircle, CheckCircle2, Printer, Wrench, Settings2 } from "lucide-react";
import { InvoiceDocDialog } from "@/components/invoice-doc-dialog";
import { CompanyProfileDialog } from "@/components/company-profile-dialog";
import type { InvoiceDocKind } from "@/lib/invoice-docs";

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  DRAFT: { color: "bg-muted/20 text-muted-foreground border-muted/30", icon: Clock, label: "Draft" },
  SENT: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: TrendingUp, label: "Sent" },
  PAID: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2, label: "Paid" },
  OVERDUE: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle, label: "Overdue" },
  CANCELLED: { color: "bg-muted/20 text-muted-foreground border-muted/30", icon: Clock, label: "Cancelled" },
};

interface ReconcileItem { number: string; id: string; issue: string; action: string; amount: number; auto: boolean; manual?: string }

function reconcileFetch(apply: boolean): Promise<{ applied: number; plan: ReconcileItem[] }> {
  let token: string | null = null;
  try { token = localStorage.getItem("token"); } catch {}
  return fetch("/api/invoices/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ apply }),
  }).then((r) => (r.ok ? r.json() : { applied: 0, plan: [] }));
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recon, setRecon] = useState<ReconcileItem[]>([]);
  const [reconBusy, setReconBusy] = useState(false);
  useEffect(() => { reconcileFetch(false).then((r) => setRecon(r.plan)).catch(() => {}); }, []);
  const autoFix = recon.filter((r) => r.auto);
  const manualFix = recon.filter((r) => !r.auto);
  const applyRecon = async () => {
    setReconBusy(true);
    try {
      const r = await reconcileFetch(true);
      toast({ title: `${r.applied} perbaikan diterapkan` });
      setRecon((await reconcileFetch(false)).plan);
      queryClient.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes("invoices") });
    } finally {
      setReconBusy(false);
    }
  };
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [, navigate] = useLocation();
  const [doc, setDoc] = useState<{ id: string; kind: InvoiceDocKind } | null>(null);

  const { data: invoices, isLoading } = useListInvoices({
    status: statusFilter !== "ALL" ? statusFilter : undefined,
  });

  // Use actual paidAmount for collected (supports DP / partial payments correctly)
  // instead of only full total of fully PAID invoices (which was wrongly using project total price)
  const totalCollected = invoices?.reduce((s, i) => s + Number(i.paidAmount || 0), 0) || 0;
  const shown = (i: any): string => i.displayStatus || i.status;
  // Pending = tagihan berjalan (sudah dikirim, belum jatuh tempo); Overdue dihitung otomatis dari jatuh tempo
  const totalPending = invoices?.reduce((s, i) => {
    const remaining = Math.max(0, Number(i.total || 0) - Number(i.paidAmount || 0));
    return s + (shown(i) === "SENT" ? remaining : 0);
  }, 0) || 0;
  const totalOverdue = invoices?.reduce((s, i) => {
    const remaining = Math.max(0, Number(i.total || 0) - Number(i.paidAmount || 0));
    return s + (shown(i) === "OVERDUE" ? remaining : 0);
  }, 0) || 0;

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading tracking-wider text-foreground">Invoices</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Billing & Collections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)} className="border-foreground/20 text-foreground hover:bg-foreground/10" title="Kop surat & rekening">
            <Settings2 className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Pengaturan Dokumen</span>
          </Button>
          <Button
            onClick={() => navigate("/invoices/new")}
            className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider"
          >
            <Plus className="w-4 h-4 mr-2" /> New Invoice
          </Button>
        </div>
      </div>

      {recon.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Wrench className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-yellow-300">Data invoice lama perlu diluruskan ({recon.length})</p>
              <p className="text-xs text-muted-foreground mt-0.5">Beberapa invoice berstatus Paid tanpa catatan pembayaran, sehingga kwitansi dan laporan keuangan tidak akurat.</p>
            </div>
            {autoFix.length > 0 && (
              <Button size="sm" onClick={applyRecon} disabled={reconBusy} className="bg-yellow-500 hover:bg-yellow-500/90 text-black shrink-0">
                {reconBusy ? "Menerapkan..." : `Terapkan ${autoFix.length} perbaikan otomatis`}
              </Button>
            )}
          </div>
          <ul className="space-y-1.5 text-xs">
            {recon.map((r, i) => (
              <li key={i} className="rounded-lg border border-yellow-500/15 bg-background/40 p-2.5">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 rounded text-[10px] font-semibold ${r.auto ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{r.auto ? "OTOMATIS" : "MANUAL"}</span>
                  <span className="text-foreground font-semibold">{r.number}</span>
                  {!r.auto && (
                    <button className="ml-auto text-primary font-semibold hover:underline shrink-0" onClick={() => navigate(`/invoices/${r.id}`)}>Buka →</button>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 leading-relaxed">
                  {r.issue} → {r.action}.{r.manual && <> {r.manual}</>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-panel border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-green-400 mb-1">Collected</p>
            <p className="text-xl font-heading text-green-400">{formatCurrency(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-blue-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-blue-400 mb-1">Pending</p>
            <p className="text-xl font-heading text-blue-400">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-red-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-red-400 mb-1">Overdue</p>
            <p className="text-xl font-heading text-red-400">{formatCurrency(totalOverdue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["ALL", "DRAFT", "SENT", "PAID", "OVERDUE"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-md text-xs uppercase tracking-widest font-semibold border transition-all duration-200 ${
              statusFilter === s
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-foreground/5 text-muted-foreground border-foreground/10 hover:bg-foreground/10"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {invoices?.map((invoice) => {
            const shownStatus: string = (invoice as any).displayStatus || invoice.status;
            const config = STATUS_CONFIG[shownStatus] || STATUS_CONFIG.DRAFT;
            const StatusIcon = config.icon;
            return (
              <Card
                key={invoice.id}
                className="glass-panel border-foreground/5 group hover:border-primary/20 transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading text-foreground tracking-wider">{invoice.number}</span>
                          <Badge className={`text-xs border ${config.color} uppercase tracking-wider`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          {(invoice as any).paymentStage === "DP" && (
                            <Badge className="text-xs border bg-orange-500/20 text-orange-400 border-orange-500/30 uppercase tracking-wider">
                              DP {Math.round((Number(invoice.paidAmount) / Math.max(Number(invoice.total), 1)) * 100)}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {(invoice as any).clientName
                            ? `${(invoice as any).clientName} · `
                            : ""}
                          Due {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-heading text-foreground">{formatCurrency(Number(invoice.total))}</p>
                      {Number(invoice.paidAmount) > 0 && Number(invoice.paidAmount) < Number(invoice.total) && (
                        <p className="text-xs text-green-400">Paid {formatCurrency(Number(invoice.paidAmount))}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="text-muted-foreground hover:text-primary shrink-0"
                      title={Number(invoice.paidAmount) > 0 ? "Cetak kwitansi / invoice" : "Cetak invoice"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDoc({ id: invoice.id, kind: Number(invoice.paidAmount) > 0 ? "receipt" : "invoice" });
                      }}
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="text-muted-foreground group-hover:text-primary shrink-0 hidden sm:inline-flex"
                      onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${invoice.id}`); }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {invoices?.length === 0 && (
            <div className="glass-panel rounded-xl p-12 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm uppercase tracking-wider mb-4">No invoices found</p>
              <Button
                onClick={() => navigate("/invoices/new")}
                className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider"
              >
                <Plus className="w-4 h-4 mr-2" /> Create First Invoice
              </Button>
            </div>
          )}
        </div>
      )}
      <CompanyProfileDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <InvoiceDocDialog
        invoiceId={doc?.id ?? null}
        open={!!doc}
        onOpenChange={(o) => { if (!o) setDoc(null); }}
        initialDoc={doc?.kind}
      />
    </div>
  );
}
