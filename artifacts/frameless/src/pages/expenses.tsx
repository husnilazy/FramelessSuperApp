import { useState } from "react";
import { useListExpenses, useCreateExpense, type CreateExpenseBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, TrendingDown } from "lucide-react";

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
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useListExpenses({
    category: categoryFilter !== "ALL" ? categoryFilter : undefined,
  });

  const createMutation = useCreateExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
        setOpen(false);
        toast({ title: "Expense recorded" });
      },
    },
  });

  const total = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const byCategory = CATEGORIES.map((cat) => ({
    category: cat,
    total: expenses?.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0) || 0,
  })).filter((c) => c.total > 0);

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading tracking-wider text-white">Expenses</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Cost Tracking</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> Log Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading tracking-wider text-2xl">Log Expense</DialogTitle>
            </DialogHeader>
            <NewExpenseForm
              onSubmit={(data) => createMutation.mutate({ data })}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-panel border-white/10 md:col-span-1">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-heading text-white">{formatCurrency(total)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 md:col-span-2">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">By Category</p>
            <div className="flex flex-wrap gap-2">
              {byCategory.map((c) => (
                <div key={c.category} className={`px-3 py-1.5 rounded-md border text-xs ${CATEGORY_COLORS[c.category] || ""}`}>
                  <span className="font-semibold">{c.category}</span>
                  <span className="ml-2 opacity-70">{formatCurrency(c.total)}</span>
                </div>
              ))}
              {byCategory.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter("ALL")}
          className={`px-4 py-1.5 rounded-md text-xs uppercase tracking-widest font-semibold border transition-all ${
            categoryFilter === "ALL" ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-4 py-1.5 rounded-md text-xs uppercase tracking-widest font-semibold border transition-all ${
              categoryFilter === cat ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {expenses?.map((expense) => (
            <Card key={expense.id} className="glass-panel border-white/5 hover:border-white/10 transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{expense.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(expense.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge className={`text-xs border uppercase tracking-wider ${CATEGORY_COLORS[expense.category] || ""}`}>
                      {expense.category}
                    </Badge>
                    <span className="text-base font-heading text-white">{formatCurrency(Number(expense.amount))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {expenses?.length === 0 && (
            <div className="glass-panel rounded-xl p-12 text-center">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm uppercase tracking-wider">No expenses recorded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewExpenseForm({ onSubmit, isPending }: { onSubmit: (data: CreateExpenseBody) => void; isPending: boolean }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<CreateExpenseBody>({
    category: "OTHER", description: "", amount: "0", date: today,
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
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
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Description</label>
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          required className="bg-white/5 border-white/10 text-white" placeholder="What was this for?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount (IDR)</label>
          <Input type="number" value={form.amount as string} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required className="bg-white/5 border-white/10 text-white" placeholder="0" />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Date</label>
          <Input type="date" value={form.date as string || ""} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
        {isPending ? "Saving..." : "Log Expense"}
      </Button>
    </form>
  );
}
