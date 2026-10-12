import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, FileText, ArrowRight, TrendingUp, Clock,
  CheckCircle2, XCircle, RefreshCcw,
} from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { KpiCard } from "@/components/shell/ui";
import { SectionTabs } from "@/components/shell/section-tabs";
const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  DRAFT: { color: "bg-muted/20 text-muted-foreground border-muted/30", icon: Clock, label: "Draft" },
  SENT: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: TrendingUp, label: "Terkirim" },
  ACCEPTED: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2, label: "Diterima" },
  REJECTED: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Ditolak" },
  EXPIRED: { color: "bg-muted/20 text-muted-foreground border-muted/30", icon: Clock, label: "Kadaluarsa" },
  CONVERTED: { color: "bg-primary/20 text-primary border-primary/30", icon: RefreshCcw, label: "Dikonversi" },
};

interface QuotationRow {
  id: string;
  number: string;
  title: string;
  clientName: string | null;
  status: string;
  total: number;
  validUntil: string | null;
  createdAt: string;
}

export default function QuotationsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [quotations, setQuotations] = useState<QuotationRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/quotations", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load");
      setQuotations(await res.json());
    } catch {
      toast({ variant: "destructive", title: "Gagal memuat daftar penawaran" });
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = quotations?.filter((q) => statusFilter === "ALL" || q.status === statusFilter) ?? [];

  const totalValue = quotations?.reduce((s, q) => s + Number(q.total || 0), 0) || 0;
  const acceptedValue = quotations?.reduce((s, q) => (q.status === "ACCEPTED" || q.status === "CONVERTED" ? s + Number(q.total || 0) : s), 0) || 0;
  const pendingCount = quotations?.filter((q) => q.status === "DRAFT" || q.status === "SENT").length || 0;

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        eyebrow="Keuangan"
        title="Penawaran"
        description="Surat penawaran project dan jasa."
        actions={<Button onClick={() => navigate("/quotations/new")}><Plus className="w-4 h-4 mr-2" /> Buat Penawaran</Button>}
      />

      <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard label="Total nilai penawaran" value={formatCurrency(totalValue)} icon={FileText} tone="primary" />
        <KpiCard label="Deal / dikonversi" value={formatCurrency(acceptedValue)} icon={CheckCircle2} tone="success" />
        <KpiCard label="Menunggu respon" value={pendingCount} icon={Clock} tone="info" />
      </div>

      <SectionTabs
        value={statusFilter}
        onChange={setStatusFilter}
        tabs={["ALL", "DRAFT", "SENT", "ACCEPTED", "REJECTED", "CONVERTED"].map((k) => ({ value: k, label: k === "ALL" ? "Semua" : STATUS_CONFIG[k]?.label || k }))}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const config = STATUS_CONFIG[q.status] || STATUS_CONFIG.DRAFT;
            const StatusIcon = config.icon;
            return (
              <Card
                key={q.id}
                className="glass-panel border-foreground/5 group hover:border-primary/20 transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/quotations/${q.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading text-foreground tracking-wider">{q.number}</span>
                          <Badge className={`text-xs border ${config.color} uppercase tracking-wider`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {q.title}{q.clientName ? ` · ${q.clientName}` : ""}
                        </p>
                        {q.validUntil && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            Berlaku s/d {formatDate(q.validUntil)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-heading text-foreground">{formatCurrency(Number(q.total))}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="text-muted-foreground group-hover:text-primary shrink-0"
                      onClick={(e) => { e.stopPropagation(); navigate(`/quotations/${q.id}`); }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="glass-panel rounded-xl p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm uppercase tracking-wider mb-4">Belum ada penawaran</p>
              <Button
                onClick={() => navigate("/quotations/new")}
                className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider"
              >
                <Plus className="w-4 h-4 mr-2" /> Buat Penawaran Pertama
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}