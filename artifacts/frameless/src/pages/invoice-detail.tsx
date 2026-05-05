import { useRoute } from "wouter";
import { useGetInvoice } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted/20 text-muted-foreground border-muted/30",
  SENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PAID: "bg-green-500/20 text-green-400 border-green-500/30",
  OVERDUE: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function InvoiceDetailPage() {
  const [, params] = useRoute("/invoices/:id");
  const id = params?.id || "";

  const { data: invoice, isLoading } = useGetInvoice(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-muted-foreground text-center py-20">Invoice not found</div>;
  }

  return (
    <div className="space-y-8 pb-8 max-w-3xl">
      <div className="flex items-center gap-4">
        <a href="/invoices">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </a>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-heading tracking-wider text-white">{invoice.number}</h1>
            <p className="text-muted-foreground text-sm mt-1">Due {formatDate(invoice.dueDate)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`text-sm border uppercase tracking-wider px-3 py-1 ${STATUS_COLORS[invoice.status] || ""}`}>
              {invoice.status}
            </Badge>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Document */}
      <Card className="glass-panel border-white/10">
        <CardContent className="p-8">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-3xl font-heading tracking-widest text-primary mb-1">FRAMELESS™</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Creative Production House</p>
              <p className="text-xs text-muted-foreground mt-2">Jakarta, Indonesia</p>
              <p className="text-xs text-muted-foreground">admin@frameless.com</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Invoice</p>
              <p className="text-2xl font-heading text-white">{invoice.number}</p>
              <p className="text-xs text-muted-foreground mt-2">Issued: {formatDate(new Date().toISOString())}</p>
              <p className="text-xs text-muted-foreground">Due: {formatDate(invoice.dueDate)}</p>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-8">
            <div className="grid grid-cols-12 gap-2 pb-2 border-b border-white/10 mb-3">
              <span className="col-span-6 text-xs uppercase tracking-wider text-muted-foreground">Description</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-center">Qty</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-right">Unit Price</span>
              <span className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground text-right">Total</span>
            </div>
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 py-3 border-b border-white/5">
                  <span className="col-span-6 text-sm text-white">{item.description}</span>
                  <span className="col-span-2 text-sm text-muted-foreground text-center">{item.quantity}</span>
                  <span className="col-span-2 text-sm text-muted-foreground text-right">{formatCurrency(Number(item.unitPrice))}</span>
                  <span className="col-span-2 text-sm text-white text-right">{formatCurrency(Number(item.total))}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No line items</p>
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-white">{formatCurrency(Number(invoice.subtotal))}</span>
              </div>
              {invoice.tax && Number(invoice.tax) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (PPN)</span>
                  <span className="text-white">{formatCurrency(Number(invoice.tax))}</span>
                </div>
              )}
              {invoice.discount && Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-400">-{formatCurrency(Number(invoice.discount))}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-white/20">
                <span className="font-semibold text-white">Total</span>
                <span className="text-xl font-heading text-primary">{formatCurrency(Number(invoice.total))}</span>
              </div>
              {invoice.paidAmount && Number(invoice.paidAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="text-green-400">{formatCurrency(Number(invoice.paidAmount))}</span>
                </div>
              )}
              {invoice.paidAmount && Number(invoice.paidAmount) < Number(invoice.total) && (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-white">Balance Due</span>
                  <span className="text-primary">{formatCurrency(Number(invoice.total) - Number(invoice.paidAmount))}</span>
                </div>
              )}
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
              <p className="text-sm text-white/80">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
