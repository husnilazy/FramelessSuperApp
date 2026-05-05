import { useState } from "react";
import { useListInvoices, useCreateInvoice, type CreateInvoiceBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, ArrowRight, TrendingUp, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  DRAFT: { color: "bg-muted/20 text-muted-foreground border-muted/30", icon: Clock, label: "Draft" },
  SENT: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: TrendingUp, label: "Sent" },
  PAID: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2, label: "Paid" },
  OVERDUE: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle, label: "Overdue" },
  CANCELLED: { color: "bg-muted/20 text-muted-foreground border-muted/30", icon: Clock, label: "Cancelled" },
};

export default function InvoicesPage() {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useListInvoices({
    status: statusFilter !== "ALL" ? statusFilter : undefined,
  });

  const createMutation = useCreateInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        setOpen(false);
        toast({ title: "Invoice created" });
      },
    },
  });

  const totalPaid = invoices?.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total), 0) || 0;
  const totalPending = invoices?.filter((i) => i.status === "SENT").reduce((s, i) => s + Number(i.total), 0) || 0;
  const totalOverdue = invoices?.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + Number(i.total), 0) || 0;

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading tracking-wider text-white">Invoices</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Billing & Collections</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading tracking-wider text-2xl">Create Invoice</DialogTitle>
            </DialogHeader>
            <NewInvoiceForm
              onSubmit={(data) => createMutation.mutate({ data })}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-panel border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-green-400 mb-1">Collected</p>
            <p className="text-xl font-heading text-green-400">{formatCurrency(totalPaid)}</p>
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
                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
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
            const config = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.DRAFT;
            const StatusIcon = config.icon;
            return (
              <Card key={invoice.id} className="glass-panel border-white/5 group hover:border-primary/20 transition-all duration-300">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading text-white tracking-wider">{invoice.number}</span>
                          <Badge className={`text-xs border ${config.color} uppercase tracking-wider`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          Due {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-heading text-white">{formatCurrency(Number(invoice.total))}</p>
                      {invoice.paidAmount && Number(invoice.paidAmount) > 0 && Number(invoice.paidAmount) < Number(invoice.total) && (
                        <p className="text-xs text-green-400">Paid {formatCurrency(Number(invoice.paidAmount))}</p>
                      )}
                    </div>
                    <a href={`/invoices/${invoice.id}`}>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary shrink-0">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {invoices?.length === 0 && (
            <div className="glass-panel rounded-xl p-12 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm uppercase tracking-wider">No invoices found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewInvoiceForm({ onSubmit, isPending }: { onSubmit: (data: CreateInvoiceBody) => void; isPending: boolean }) {
  const [form, setForm] = useState<CreateInvoiceBody>({
    number: `INV-${String(Date.now()).slice(-4)}`,
    status: "DRAFT",
    type: "FULL",
    subtotal: "0",
    tax: "0",
    discount: "0",
    total: "0",
    dueDate: "",
    notes: "",
  });

  const calcTotal = (subtotal: string, tax: string, discount: string) => {
    const sub = Number(subtotal) || 0;
    const t = Number(tax) || 0;
    const d = Number(discount) || 0;
    return String(sub + t - d);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Invoice #</label>
          <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
            required className="bg-white/5 border-white/10 text-white" />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Status</label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Subtotal (IDR)</label>
        <Input type="number" value={form.subtotal as string}
          onChange={(e) => {
            const sub = e.target.value;
            setForm({ ...form, subtotal: sub, total: calcTotal(sub, form.tax as string, form.discount as string) });
          }}
          className="bg-white/5 border-white/10 text-white" placeholder="0" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Tax (IDR)</label>
          <Input type="number" value={form.tax as string}
            onChange={(e) => {
              const t = e.target.value;
              setForm({ ...form, tax: t, total: calcTotal(form.subtotal as string, t, form.discount as string) });
            }}
            className="bg-white/5 border-white/10 text-white" placeholder="0" />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Discount (IDR)</label>
          <Input type="number" value={form.discount as string}
            onChange={(e) => {
              const d = e.target.value;
              setForm({ ...form, discount: d, total: calcTotal(form.subtotal as string, form.tax as string, d) });
            }}
            className="bg-white/5 border-white/10 text-white" placeholder="0" />
        </div>
      </div>
      <div className="glass-panel rounded-md p-3 flex justify-between items-center">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
        <span className="text-xl font-heading text-primary">{formatCurrency(Number(form.total) || 0)}</span>
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Due Date</label>
        <Input type="date" value={form.dueDate as string || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className="bg-white/5 border-white/10 text-white" />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</label>
        <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="bg-white/5 border-white/10 text-white" placeholder="Payment terms, etc." />
      </div>
      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
        {isPending ? "Creating..." : "Create Invoice"}
      </Button>
    </form>
  );
}
