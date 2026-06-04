import { useState } from "react";
import { useListExpenses, useCreateExpense, useListProjects, type CreateExpenseBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, TrendingDown, Edit3, Trash2, Download, Calendar, Search } from "lucide-react";

const CATEGORIES = ["EQUIPMENT", "TRANSPORT", "CATERING", "SOFTWARE", "SALARY", "MARKETING", "OFFICE", "OTHER"];

const CATEGORY_COLORS: Record<string, string> = {
  EQUIPMENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  TRANSPORT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CATERING: "bg-green-500/20 text-green-400 border-green-500/30",
  SOFTWARE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  SALARY: "bg-primary/20 text-primary border-primary/30",
  MARKETING: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  OFFICE: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  OTHER: "bg-muted/20 text-muted-foreground border-muted/30",
};

export default function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useListExpenses({
    category: categoryFilter !== "ALL" ? categoryFilter : undefined,
  });

  const { data: projects = [] } = useListProjects();

  const createMutation = useCreateExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
        closeDialog();
        toast({ title: "Expense recorded" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to save expense" }),
    },
  });

  // Filter + search + date
  const filteredExpenses = (expenses || [])
    .filter((e: any) => {
      const matchCat = categoryFilter === "ALL" || e.category === categoryFilter;
      const matchProj = projectFilter === "ALL" || e.projectId === projectFilter;
      const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase());
      const eDate = e.date ? new Date(e.date) : null;
      const matchFrom = !dateFrom || (eDate && eDate >= new Date(dateFrom));
      const matchTo = !dateTo || (eDate && eDate <= new Date(dateTo + "T23:59:59"));
      return matchCat && matchProj && matchSearch && matchFrom && matchTo;
    })
    .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const total = filteredExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;

  const byCategory = CATEGORIES.map((cat) => ({
    category: cat,
    total: filteredExpenses.filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + Number(e.amount), 0) || 0,
  })).filter((c) => c.total > 0);

  const projectMap = Object.fromEntries(projects.map((p: any) => [p.id, p.title]));

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete" });
    }
  };

  // Update (simple direct)
  const updateExpense = async (id: string, data: any) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      closeDialog();
      toast({ title: "Expense updated" });
    } catch {
      toast({ variant: "destructive", title: "Update failed" });
    }
  };

  // PDF Export - attractive report
  const handleExportPdf = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(18);
      doc.text("Expenses Report - Frameless Creative", 14, 18);

      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString("id-ID")}`, 14, 26);
      if (search || dateFrom || dateTo || categoryFilter !== "ALL" || projectFilter !== "ALL") {
        doc.text("Filters applied", 14, 32);
      }

      // Summary
      doc.setFontSize(12);
      doc.text(`Total: ${formatCurrency(total)}  |  Records: ${filteredExpenses.length}`, 14, 40);

      // Table header
      let y = 52;
      doc.setFontSize(9);
      doc.text("Date", 14, y);
      doc.text("Category", 40, y);
      doc.text("Description", 75, y);
      doc.text("Project", 140, y);
      doc.text("Amount", 175, y, { align: "right" });

      doc.line(14, y + 2, pageWidth - 14, y + 2);
      y += 8;

      filteredExpenses.forEach((e: any, idx: number) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const proj = e.projectId ? projectMap[e.projectId] || "" : "";
        doc.text(formatDate(e.date).slice(0,10), 14, y);
        doc.text(e.category, 40, y);
        doc.text((e.description || "").slice(0, 35), 75, y);
        doc.text(proj.slice(0, 18), 140, y);
        doc.text(formatCurrency(Number(e.amount)), 175, y, { align: "right" });
        y += 7;
      });

      // By category summary at bottom
      y += 10;
      doc.text("By Category:", 14, y);
      y += 6;
      byCategory.forEach((c) => {
        doc.text(`${c.category}: ${formatCurrency(c.total)}`, 14, y);
        y += 5;
      });

      doc.save(`expenses-report-${new Date().toISOString().slice(0,10)}.pdf`);
      toast({ title: "PDF exported" });
    } catch (e) {
      toast({ variant: "destructive", title: "Export failed" });
    }
  };

  // Open dialog for create or edit
  const openDialog = (expense?: any) => {
    setEditingExpense(expense || null);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingExpense(null);
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-heading tracking-wider text-white">Expenses</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Cost Tracking &amp; Reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => {
              // trigger export
              handleExportPdf();
            }} 
            variant="outline" 
            className="border-white/20 text-white hover:bg-white/10 font-heading tracking-wider"
          >
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
          <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()} className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
                <Plus className="w-4 h-4 mr-2" /> Log Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading tracking-wider text-2xl">
                  {editingExpense ? "Edit Expense" : "Log New Expense"}
                </DialogTitle>
              </DialogHeader>
              <NewExpenseForm
                expense={editingExpense}
                onSubmit={(data: any) => {
                  if (editingExpense) {
                    // update via direct fetch since hook may be create only
                    updateExpense(editingExpense.id, data);
                  } else {
                    createMutation.mutate({ data });
                  }
                }}
                isPending={createMutation.isPending}
                projects={projects}
                onClose={closeDialog}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary - more attractive */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-panel border-white/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total (Filtered)</p>
              <p className="text-2xl font-heading text-white">{formatCurrency(total)}</p>
              <p className="text-[10px] text-muted-foreground">{filteredExpenses.length} records</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 md:col-span-3">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" /> By Category
            </p>
            <div className="flex flex-wrap gap-2">
              {byCategory.map((c) => (
                <div key={c.category} className={`px-3 py-1.5 rounded-md border text-xs flex items-center gap-1.5 ${CATEGORY_COLORS[c.category] || ""}`}>
                  <span className="font-semibold">{c.category}</span>
                  <span className="opacity-70">{formatCurrency(c.total)}</span>
                </div>
              ))}
              {byCategory.length === 0 && <p className="text-xs text-muted-foreground">No data for current filters</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters - more powerful & easy */}
      <div className="glass-panel rounded-xl p-4 border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Search className="w-3.5 h-3.5" /> Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description..."
              className="pl-9 bg-white/5 border-white/10 text-white"
            />
          </div>

          {/* Date range */}
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="From" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="To" />

          {/* Category quick */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="ALL">All Categories</SelectItem>
              {CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Project */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="ALL">All Projects</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setCategoryFilter("ALL"); setProjectFilter("ALL"); }} className="text-xs">
            Clear Filters
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((expense: any) => (
            <Card key={expense.id} className="glass-panel border-white/5 hover:border-primary/30 transition-all group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white truncate">{expense.description}</p>
                        <Badge className={`text-[10px] border uppercase tracking-wider ${CATEGORY_COLORS[expense.category] || ""}`}>
                          {expense.category}
                        </Badge>
                        {expense.projectId && projectMap[expense.projectId] && (
                          <Badge variant="outline" className="text-[10px] border-white/20 text-white/70">📁 {projectMap[expense.projectId]}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(expense.date)}</span>
                        {expense.receiptUrl && (
                          <a href={expense.receiptUrl} target="_blank" rel="noopener" className="text-primary hover:underline">📎 Receipt</a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-lg font-heading text-white tabular-nums">{formatCurrency(Number(expense.amount))}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(expense)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(expense.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredExpenses.length === 0 && (
            <div className="glass-panel rounded-xl p-12 text-center">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm uppercase tracking-wider">No expenses match filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewExpenseForm({ 
  expense, 
  onSubmit, 
  isPending, 
  projects = [], 
  onClose 
}: { 
  expense?: any; 
  onSubmit: (data: any) => void; 
  isPending: boolean; 
  projects?: any[]; 
  onClose?: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<any>({
    category: expense?.category || "OTHER",
    description: expense?.description || "",
    amount: expense?.amount || 0,
    date: expense?.date ? new Date(expense.date).toISOString().split("T")[0] : today,
    projectId: expense?.projectId || "",
    receiptUrl: expense?.receiptUrl || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      date: form.date,
    };
    if (form.projectId) payload.projectId = form.projectId;
    if (form.receiptUrl) payload.receiptUrl = form.receiptUrl;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Category</label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Date</label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Description / Notes</label>
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          required className="bg-white/5 border-white/10 text-white" placeholder="e.g. Beli harddisk 4TB untuk editing" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (IDR)</label>
          <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            required className="bg-white/5 border-white/10 text-white" placeholder="0" />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Linked Project (optional)</label>
          <Select value={form.projectId || "__none__"} onValueChange={(v) => setForm({ ...form, projectId: v === "__none__" ? "" : v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="__none__">No project</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Receipt URL (optional)</label>
        <Input value={form.receiptUrl} onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
          className="bg-white/5 border-white/10 text-white" placeholder="https://drive.google.com/... or upload link" />
        <p className="text-[10px] text-muted-foreground">Paste Google Drive / Dropbox link or upload receipt separately</p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/20">Cancel</Button>
        <Button type="submit" disabled={isPending} className="flex-1 bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
          {isPending ? "Saving..." : (expense ? "Update Expense" : "Log Expense")}
        </Button>
      </div>
    </form>
  );
}
