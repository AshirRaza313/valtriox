"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { ExpenseModal } from "./ExpenseModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Trash2, Edit3, DollarSign, TrendingDown,
  CalendarDays, Filter, Receipt,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  description: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations" },
  { value: "salaries", label: "Salaries" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "shipping", label: "Shipping" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  operations: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  salaries: "bg-green-500/10 text-green-400 border-green-500/20",
  rent: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  utilities: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  shipping: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  other: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

// ── Component ──────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const { organization, appTheme } = useValtrioxStore();
  const isGold = appTheme === "premium-dark";
  const isDark = appTheme === "dark" || isGold;
  const orgId = organization?.id;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Fetch expenses ──
  const fetchExpenses = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ orgId });
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const res = await fetchWithAuth(`/api/expenses?${params}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [orgId, categoryFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // ── Delete expense ──
  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetchWithAuth(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Expense deleted");
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch { toast.error("Failed to delete expense"); }
    finally { setDeleting(null); }
  };

  // ── Edit expense ──
  const handleEdit = (expense: Expense) => {
    setEditExpense(expense);
    setModalOpen(true);
  };

  // ── Filtered expenses ──
  const filtered = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const thisMonth = expenses
      .filter((e) => {
        const d = new Date(e.date);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + e.amount, 0);
    const byCategory: Record<string, number> = {};
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return { total, thisMonth, topCategory, count: expenses.length };
  }, [expenses]);

  // ── Theme helpers ──
  const cardBg = isGold ? "bg-[#12121a] border-white/[0.06]" : isDark ? "bg-slate-900 border-white/[0.06]" : "bg-white border-slate-200";
  const inputCls = cn(
    "h-9 text-sm",
    isDark && "border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500 focus-visible:border-amber-500/50"
  );
  const btnPrimary = isGold
    ? "bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-black hover:shadow-[0_4px_20px_rgba(212,167,58,0.3)] hover:-translate-y-0.5"
    : "bg-amber-600 hover:bg-amber-700 text-white";

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900")}>Expenses</h2>
          <p className="text-sm text-slate-400 mt-0.5">Track and manage your business expenses</p>
        </div>
        <Button className={cn("gap-2", btnPrimary)} onClick={() => { setEditExpense(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className={cn("border", cardBg)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", isGold ? "bg-amber-500/10" : "bg-amber-100")}>
                <DollarSign className={cn("h-5 w-5", isGold ? "text-amber-400" : "text-amber-600")} />
              </div>
              <div>
                <p className={cn("text-[11px] font-medium uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>Total Expenses</p>
                <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>{formatCurrency(stats.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border", cardBg)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", isGold ? "bg-blue-500/10" : "bg-blue-100")}>
                <TrendingDown className={cn("h-5 w-5", isGold ? "text-blue-400" : "text-blue-600")} />
              </div>
              <div>
                <p className={cn("text-[11px] font-medium uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>This Month</p>
                <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>{formatCurrency(stats.thisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border", cardBg)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", isGold ? "bg-purple-500/10" : "bg-purple-100")}>
                <Receipt className={cn("h-5 w-5", isGold ? "text-purple-400" : "text-purple-600")} />
              </div>
              <div>
                <p className={cn("text-[11px] font-medium uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>Top Category</p>
                <p className={cn("text-lg font-bold capitalize", isDark ? "text-white" : "text-slate-900")}>
                  {stats.topCategory ? stats.topCategory[0] : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-9", inputCls)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className={cn("w-full sm:w-[180px]", inputCls)}>
            <Filter className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expense List */}
      <Card className={cn("border", cardBg)}>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className={cn("h-14 w-full rounded-lg", isDark ? "bg-white/[0.04]" : "bg-slate-100")} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center mb-4", isGold ? "bg-amber-500/10" : "bg-slate-100")}>
                <Receipt className={cn("h-7 w-7", isGold ? "text-amber-400" : "text-slate-400")} />
              </div>
              <p className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>No expenses found</p>
              <p className="text-sm text-slate-400 mt-1">Click "Add Expense" to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map((expense) => (
                <div key={expense.id} className={cn("flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors group")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("font-medium truncate", isDark ? "text-white" : "text-slate-900")}>{expense.title}</p>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize", CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.other)}>
                        {expense.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(expense.date).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" })}
                      {expense.description && <span className="truncate max-w-[200px]"> - {expense.description}</span>}
                    </p>
                  </div>
                  <p className={cn("text-sm font-bold whitespace-nowrap", isGold ? "text-amber-400" : "text-amber-500")}>
                    {formatCurrency(expense.amount)}
                  </p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(expense)} className={cn("h-8 w-8 rounded-lg flex items-center justify-center", isDark ? "hover:bg-white/[0.06] text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900")}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(expense.id)} disabled={deleting === expense.id} className={cn("h-8 w-8 rounded-lg flex items-center justify-center", isDark ? "hover:bg-red-500/10 text-slate-400 hover:text-red-400" : "hover:bg-red-50 text-slate-500 hover:text-red-500")}>
                      {deleting === expense.id ? <span className="h-3 w-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Modal */}
      {orgId && (
        <ExpenseModal
          open={modalOpen}
          onOpenChange={(open) => { setModalOpen(open); if (!open) setEditExpense(null); }}
          organizationId={orgId}
          editExpense={editExpense}
          onSaved={fetchExpenses}
        />
      )}
    </div>
  );
}
