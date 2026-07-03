// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  FileText,
  Send,
  CheckCircle2,
  Download,
  Eye,
  Clock,
  Loader2,
  RefreshCw,
  Building2,
  User,
  Mail,
  MapPin,
  DollarSign,
  Percent,
  Calculator,
  Stamp,
  Lock,
} from "lucide-react";

// ── Types ──

interface LineItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

interface CustomInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceTitle: string | null;
  planName: string;
  amount: number;
  currencySymbol: string;
  currencyCode: string;
  issuedAt: string;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  approvedAt: string | null;
  paymentStatus: string | null;
  type: string;
  clientName: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  lineItems: LineItem[] | null;
  subtotal: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  notes: string | null;
  organization: { id: string; name: string; email: string | null; plan: string } | null;
}

interface OrgOption {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  plan: string;
}

// ── Helpers ──

function fmtCurrency(amount: number | null | undefined, symbol: string = "Rs."): string {
  const v = Number(amount ?? 0);
  return `${symbol} ${v.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadge(status: string, paymentStatus?: string | null) {
  if (status === "approved" || status === "paid" || paymentStatus === "verified") {
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>;
  }
  if (status === "sent") return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1"><Send className="h-3 w-3" /> Sent</Badge>;
  if (status === "pending" || paymentStatus === "pending_verification") return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
  if (status === "draft") return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30 gap-1"><FileText className="h-3 w-3" /> Draft</Badge>;
  if (status === "overdue") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1">Overdue</Badge>;
  if (status === "cancelled") return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30 gap-1 line-through">Cancelled</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ── Main Component ──

export function CustomInvoicePage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [invoices, setInvoices] = useState<CustomInvoice[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // New invoice form state
  const [orgId, setOrgId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", qty: 1, rate: 0, amount: 0 },
  ]);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [sendImmediately, setSendImmediately] = useState<boolean>(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ── Computed totals ──
  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + (Number(li.qty) * Number(li.rate) || 0), 0),
    [lineItems]
  );
  const taxableBase = Math.max(0, subtotal - (Number(discountAmount) || 0));
  const taxAmount = Math.round(taxableBase * (Number(taxRate) / 100) * 100) / 100;
  const total = Math.round((taxableBase + taxAmount) * 100) / 100;

  // ── Fetch invoices ──
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/invoices/custom");
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      } else {
        toast.error("Failed to load custom invoices");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch orgs (for client picker) ──
  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        const list = (data.clients || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          country: null,
          plan: c.plan,
        }));
        setOrgs(list);
      }
    } catch {
      // ignore — admin can still type client name manually
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- fetching initial data on mount */
  useEffect(() => {
    fetchInvoices();
    fetchOrgs();
  }, [fetchInvoices, fetchOrgs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Form helpers ──
  const updateLineItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((li, i) => {
      if (i !== idx) return li;
      const next = { ...li, [field]: value };
      if (field === "qty" || field === "rate") {
        next.amount = Math.round(Number(next.qty) * Number(next.rate) * 100) / 100;
      }
      return next;
    }));
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { description: "", qty: 1, rate: 0, amount: 0 }]);
  };

  const removeLineItem = (idx: number) => {
    setLineItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  // When org is selected, prefill client fields
  const handleOrgSelect = (orgId: string) => {
    setOrgId(orgId);
    const org = orgs.find((o) => o.id === orgId);
    if (org) {
      setClientName(org.name);
      if (org.email) setClientEmail(org.email);
    }
  };

  const resetForm = () => {
    setOrgId("");
    setClientName("");
    setClientEmail("");
    setClientAddress("");
    setInvoiceTitle("");
    setLineItems([{ description: "", qty: 1, rate: 0, amount: 0 }]);
    setTaxRate(0);
    setDiscountAmount(0);
    setNotes("");
    setDueDate("");
    setSendImmediately(false);
  };

  // ── Create custom invoice ──
  const handleCreate = async () => {
    if (!clientName.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (lineItems.length === 0 || lineItems.every((li) => !li.description.trim())) {
      toast.error("Add at least one line item with a description");
      return;
    }
    const cleanItems = lineItems.filter((li) => li.description.trim());
    if (cleanItems.length === 0) {
      toast.error("Each line item needs a description");
      return;
    }

    setCreating(true);
    const payload = {
      organizationId: orgId || undefined,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      invoiceTitle: invoiceTitle.trim() || undefined,
      lineItems: cleanItems.map((li) => ({
        description: li.description.trim(),
        qty: Number(li.qty) || 1,
        rate: Number(li.rate) || 0,
        amount: Number(li.qty) * Number(li.rate) || 0,
      })),
      taxRate: Number(taxRate) || 0,
      discountAmount: Number(discountAmount) || 0,
      notes: notes.trim() || undefined,
      dueDate: dueDate || undefined,
      sendImmediately,
    };

    const attemptCreate = async (): Promise<{ ok: boolean; error?: string }> => {
      const res = await fetchWithAuth("/api/admin/invoices/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Robust error parsing — server may return JSON or plain text
      let data: any = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: `Server returned status ${res.status}` };
      }
      if (res.ok) return { ok: true };
      return { ok: false, error: data.error || `Failed to create invoice (status ${res.status})` };
    };

    try {
      let result = await attemptCreate();

      // Auto-retry once after a short delay if the server signals a schema repair
      // was triggered (the server-side ensureInvoicePhase2Columns runs on every
      // request, but the first cold-start request may still race).
      if (!result.ok && result.error && (
        result.error.toLowerCase().includes("schema") ||
        result.error.toLowerCase().includes("does not exist") ||
        result.error.toLowerCase().includes("column")
      )) {
        toast.info("Database schema is being prepared. Retrying automatically…", { duration: 4000 });
        await new Promise((r) => setTimeout(r, 1500));
        result = await attemptCreate();
      }

      if (result.ok) {
        toast.success(sendImmediately ? "Invoice created and sent!" : "Invoice saved as draft");
        setCreateOpen(false);
        resetForm();
        await fetchInvoices();
      } else {
        toast.error(result.error || "Failed to create invoice", { duration: 8000 });
      }
    } catch {
      toast.error("Network error — please check your connection and retry");
    } finally {
      setCreating(false);
    }
  };

  // ── Send invoice (draft → sent) ──
  const handleSend = async (inv: CustomInvoice) => {
    if (!inv.clientEmail) {
      toast.error("Invoice has no client email. Edit invoice first to add one.");
      return;
    }
    setActionLoading((p) => ({ ...p, [`send-${inv.id}`]: true }));
    try {
      const res = await fetchWithAuth(`/api/admin/invoices/${inv.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inv.clientEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Invoice emailed to ${data.recipientEmail}`);
        await fetchInvoices();
      } else {
        toast.error(data.error || "Failed to send invoice");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading((p) => ({ ...p, [`send-${inv.id}`]: false }));
    }
  };

  // ── Approve payment (sent/pending → approved, unlocks PDF) ──
  const handleApprove = async (inv: CustomInvoice) => {
    setActionLoading((p) => ({ ...p, [`approve-${inv.id}`]: true }));
    try {
      const res = await fetchWithAuth(`/api/admin/invoices/${inv.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "manual_verification",
          adminNote: "Payment verified by admin from Custom Invoices tab",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Payment verified. PDF download unlocked for client.");
        await fetchInvoices();
      } else {
        toast.error(data.error || "Failed to approve payment");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading((p) => ({ ...p, [`approve-${inv.id}`]: false }));
    }
  };

  // ── Download PDF ──
  const handleDownloadPdf = async (inv: CustomInvoice) => {
    setActionLoading((p) => ({ ...p, [`pdf-${inv.id}`]: true }));
    try {
      const res = await fetchWithAuth(`/api/admin/invoices/${inv.id}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to download PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading((p) => ({ ...p, [`pdf-${inv.id}`]: false }));
    }
  };

  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const inputBg = isDark ? "border-white/[0.1] bg-white/[0.03]" : "";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className={cn("text-2xl font-bold tracking-tight flex items-center gap-2", textPrimary)}>
            <Stamp className="h-6 w-6 text-amber-500" />
            Custom Invoices
          </h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Create branded invoices with line items · Send to clients · Verify payment · Unlock PDF
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInvoices} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="h-4 w-4" /> New Custom Invoice
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-amber-400" />
              <p className={cn("text-xs", textSecondary)}>Total Custom Invoices</p>
            </div>
            <p className={cn("text-xl font-bold", textPrimary)}>{invoices.length}</p>
          </CardContent>
        </Card>
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-400" />
              <p className={cn("text-xs", textSecondary)}>Drafts / Sent</p>
            </div>
            <p className={cn("text-xl font-bold text-yellow-400")}>
              {invoices.filter((i) => i.status === "draft" || i.status === "sent").length}
            </p>
          </CardContent>
        </Card>
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <p className={cn("text-xs", textSecondary)}>Verified</p>
            </div>
            <p className="text-xl font-bold text-emerald-400">
              {invoices.filter((i) => i.status === "approved" || i.status === "paid").length}
            </p>
          </CardContent>
        </Card>
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-amber-400" />
              <p className={cn("text-xs", textSecondary)}>Total Billed</p>
            </div>
            <p className="text-xl font-bold text-amber-400">
              {fmtCurrency(invoices.reduce((s, i) => s + Number(i.amount), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices list */}
      {loading ? (
        <Card className={cardBg}>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-amber-400" />
            <p className={cn("text-sm mt-2", textSecondary)}>Loading invoices…</p>
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card className={cardBg}>
          <CardContent className="p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-amber-400/40 mb-3" />
            <p className={cn("text-sm font-medium", textPrimary)}>No custom invoices yet</p>
            <p className={cn("text-xs mt-1", textSecondary)}>
              Click <span className="text-amber-500">New Custom Invoice</span> to create your first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {invoices.map((inv) => (
              <motion.div
                key={inv.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <Card className={cardBg}>
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      {/* Left: Invoice info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={cn("text-base font-semibold", textPrimary)}>
                                {inv.invoiceTitle || inv.planName}
                              </h3>
                              {statusBadge(inv.status, inv.paymentStatus)}
                            </div>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">{inv.invoiceNumber}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                          <div className="flex items-start gap-2">
                            <User className="h-3.5 w-3.5 text-amber-400 mt-0.5" />
                            <div>
                              <p className={textSecondary}>Client</p>
                              <p className={cn("font-medium", textPrimary)}>{inv.clientName || inv.organization?.name || "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Mail className="h-3.5 w-3.5 text-amber-400 mt-0.5" />
                            <div>
                              <p className={textSecondary}>Email</p>
                              <p className={cn("font-medium", textPrimary)}>{inv.clientEmail || inv.organization?.email || "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clock className="h-3.5 w-3.5 text-amber-400 mt-0.5" />
                            <div>
                              <p className={textSecondary}>Issued / Due</p>
                              <p className={cn("font-medium", textPrimary)}>
                                {fmtDate(inv.issuedAt)} · {fmtDate(inv.dueDate)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Building2 className="h-3.5 w-3.5 text-amber-400 mt-0.5" />
                            <div>
                              <p className={textSecondary}>Org</p>
                              <p className={cn("font-medium", textPrimary)}>{inv.organization?.name || "Standalone"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Line items preview */}
                        {Array.isArray(inv.lineItems) && inv.lineItems.length > 0 && (
                          <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2">
                              Line Items ({inv.lineItems.length})
                            </p>
                            <div className="space-y-1">
                              {inv.lineItems.slice(0, 3).map((li, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span className={cn("truncate", textPrimary)}>{li.description}</span>
                                  <span className={cn("font-mono ml-2", textSecondary)}>
                                    {li.qty} × {fmtCurrency(li.rate, inv.currencySymbol)} = {fmtCurrency(li.amount, inv.currencySymbol)}
                                  </span>
                                </div>
                              ))}
                              {inv.lineItems.length > 3 && (
                                <p className="text-[10px] text-slate-500">+ {inv.lineItems.length - 3} more…</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Total + actions */}
                      <div className="lg:w-56 lg:border-l lg:border-amber-500/10 lg:pl-5 flex flex-col gap-3">
                        <div>
                          <p className={cn("text-[10px] uppercase tracking-wider", textSecondary)}>Total</p>
                          <p className="text-2xl font-extrabold text-amber-500">
                            {fmtCurrency(inv.amount, inv.currencySymbol)}
                          </p>
                          {inv.taxRate ? (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              incl. {inv.taxRate}% tax
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {/* PDF Download — locked unless approved/paid (admin always allowed) */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPdf(inv)}
                            disabled={actionLoading[`pdf-${inv.id}`]}
                            className="gap-1.5 text-xs h-8"
                          >
                            {actionLoading[`pdf-${inv.id}`] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            PDF
                          </Button>

                          {/* Send — only for drafts */}
                          {(inv.status === "draft" || inv.status === "pending") && (
                            <Button
                              size="sm"
                              onClick={() => handleSend(inv)}
                              disabled={actionLoading[`send-${inv.id}`]}
                              className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {actionLoading[`send-${inv.id}`] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              Send
                            </Button>
                          )}

                          {/* Approve — only for sent/pending */}
                          {(inv.status === "sent" || inv.status === "pending" || inv.status === "overdue") && (
                            <Button
                              size="sm"
                              onClick={() => handleApprove(inv)}
                              disabled={actionLoading[`approve-${inv.id}`]}
                              className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {actionLoading[`approve-${inv.id}`] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Verify Payment
                            </Button>
                          )}

                          {/* Approved badge */}
                          {(inv.status === "approved" || inv.status === "paid") && (
                            <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <Lock className="h-3 w-3" /> PDF Unlocked
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-500" />
              New Custom Invoice
            </DialogTitle>
            <DialogDescription>
              Create a branded invoice with line items. Save as draft or send immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Client section */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-amber-500" /> Client Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Link to Valtriox Org (optional)</Label>
                  <Select value={orgId} onValueChange={handleOrgSelect}>
                    <SelectTrigger className={inputBg}>
                      <SelectValue placeholder="Select existing org or leave blank" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name} {o.email ? `(${o.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Client Name *</Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Acme Pvt Ltd"
                    className={inputBg}
                  />
                </div>
                <div>
                  <Label className="text-xs">Client Email</Label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="billing@acme.com"
                    className={inputBg}
                  />
                </div>
                <div>
                  <Label className="text-xs">Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={inputBg}
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Client Address</Label>
                <Textarea
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Street, City, Country"
                  rows={2}
                  className={inputBg}
                />
              </div>
            </div>

            <Separator />

            {/* Invoice meta */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" /> Invoice Details
              </h4>
              <Input
                value={invoiceTitle}
                onChange={(e) => setInvoiceTitle(e.target.value)}
                placeholder="Invoice title (e.g. Q3 Consulting Services, Brand Setup Package)"
                className={inputBg}
              />
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-amber-500" /> Line Items
                </h4>
                <Button size="sm" variant="outline" onClick={addLineItem} className="gap-1.5 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>

              <div className="space-y-2">
                {/* Header row — hidden on mobile (each row has its own labels) */}
                <div className="hidden md:grid grid-cols-[1fr_70px_100px_110px_36px] gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2">
                  <div>Description</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Rate</div>
                  <div className="text-right">Amount</div>
                  <div></div>
                </div>

                {lineItems.map((li, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-2 md:grid-cols-[1fr_70px_100px_110px_36px] gap-2 items-center p-2 rounded-md bg-amber-500/5 border border-amber-500/10"
                  >
                    <Input
                      value={li.description}
                      onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                      placeholder="Item description"
                      className="h-8 text-sm col-span-2 md:col-span-1"
                    />
                    <div className="flex flex-col">
                      <Label className="text-[9px] uppercase text-slate-500 mb-0.5 md:hidden">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={li.qty}
                        onChange={(e) => updateLineItem(idx, "qty", e.target.value)}
                        className="h-8 text-sm text-right"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label className="text-[9px] uppercase text-slate-500 mb-0.5 md:hidden">Rate</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={li.rate}
                        onChange={(e) => updateLineItem(idx, "rate", e.target.value)}
                        className="h-8 text-sm text-right"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label className="text-[9px] uppercase text-slate-500 mb-0.5 md:hidden">Amount</Label>
                      <div className="h-8 flex items-center justify-end text-sm font-semibold text-amber-500 px-2">
                        {fmtCurrency(li.qty * li.rate)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeLineItem(idx)}
                      disabled={lineItems.length === 1}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-400 col-span-2 md:col-span-1 justify-self-end"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax, discount, totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <Percent className="h-3 w-3" /> Tax Rate (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className={inputBg}
                />
              </div>
              <div>
                <Label className="text-xs">Discount Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className={inputBg}
                />
              </div>
              <div>
                <Label className="text-xs">Computed Total</Label>
                <div className="h-9 px-3 rounded-md border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Total</span>
                  <span className="text-base font-extrabold text-amber-500">{fmtCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms, bank details, thank-you note…"
                rows={3}
                className={inputBg}
              />
            </div>

            {/* Summary card */}
            <div className="rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/[0.02] p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">{fmtCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-500">
                  <span>Discount</span>
                  <span>− {fmtCurrency(discountAmount)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax ({taxRate}%)</span>
                  <span className="font-medium">{fmtCurrency(taxAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase text-xs tracking-wider text-slate-500">Total Due</span>
                <span className="text-2xl font-extrabold text-amber-500">{fmtCurrency(total)}</span>
              </div>
            </div>

            {/* Send immediately toggle */}
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border border-amber-500/10 hover:bg-amber-500/5">
              <input
                type="checkbox"
                checked={sendImmediately}
                onChange={(e) => setSendImmediately(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <div>
                <p className="text-sm font-medium">Send immediately after creating</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  If checked, invoice status = <code className="text-amber-500">sent</code> and client receives it right away.
                  Otherwise, invoice is saved as <code className="text-amber-500">draft</code> for later review.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sendImmediately ? (
                <Send className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {sendImmediately ? "Create & Send" : "Save as Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
