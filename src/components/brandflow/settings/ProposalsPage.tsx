"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileText,
  Search,
  RefreshCw,
  Plus,
  Send,
  Eye,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle,
  Clock,
  Mail,
  Phone,
  Building2,
  Calendar,
  Edit,
  X,
  CheckCircle2,
  Copy,
  PlusCircle,
  MessageSquare,
  Share2,
  CreditCard,
  GitBranch,
  ChevronDown,
  Handshake,
  ThumbsDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isPlatformRole } from "@/lib/roles";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// ─── Version types ──────────────────────────────────────────────

interface ProposalVersion {
  versionNumber: number;
  content: Record<string, unknown>;
  title: string;
  totalCost: number | null;
  currency: string;
  createdAt: string;
  createdBy: string;
}

// ─── Types ──────────────────────────────────────────────────────────────

interface Proposal {
  id: string;
  leadId?: string | null;
  clientName: string;
  clientEmail: string;
  clientCompany?: string | null;
  clientPhone?: string | null;
  type: string;
  title: string;
  status: string;
  totalCost?: number | null;
  currency: string;
  currencySymbol: string;
  validUntil?: string | null;
  content: string;
  notes?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  respondedAt?: string | null;
  // ── Payment fields ──
  payproOrderId?: string | null;
  paymentStatus?: string;
  paidAt?: string | null;
  paymentAmount?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const PROPOSAL_TYPES = [
  { value: "brand_management", label: "Brand Management", icon: "palette" },
  { value: "digital_marketing", label: "Digital Marketing", icon: "megaphone" },
  { value: "tech_integration", label: "Technology Integration", icon: "code" },
  { value: "e_commerce", label: "E-Commerce Setup", icon: "shopping-cart" },
  { value: "enterprise", label: "Enterprise Solution", icon: "building" },
  { value: "monthly_retainer", label: "Monthly Retainer", icon: "calendar" },
  { value: "social_media_management", label: "Social Media Management", icon: "share-2" },
  { value: "content_creation", label: "Content Creation", icon: "pen-tool" },
  { value: "seo_optimization", label: "SEO Optimization", icon: "search" },
  { value: "paid_advertising", label: "Paid Advertising", icon: "target" },
  { value: "brand_identity", label: "Brand Identity & Design", icon: "paintbrush" },
  { value: "consultation", label: "Consultation & Strategy", icon: "lightbulb" },
  { value: "custom_development", label: "Custom Development", icon: "wrench" },
];

const PROPOSAL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "revised", label: "Revised" },
];

const CURRENCY_OPTIONS = [
  { value: "PKR", symbol: "Rs.", label: "PKR / Rs." },
  { value: "USD", symbol: "$", label: "USD / $" },
  { value: "EUR", symbol: "€", label: "EUR / €" },
  { value: "GBP", symbol: "£", label: "GBP / £" },
  { value: "AED", symbol: "د.إ", label: "AED / د.إ" },
  { value: "SAR", symbol: "﷼", label: "SAR / ﷼" },
];

// ─── Access Denied ──────────────────────────────────────────────────────

function AccessDenied() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className={cn("max-w-md w-full", isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200")}>
        <CardContent className="flex flex-col items-center text-center p-8">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-red-500" />
          </div>
          <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>
            Access Denied
          </h2>
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
            This page is restricted to platform administrators only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export function ProposalsPage() {
  const { user, appTheme, organization } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  // ── State ──
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ── Dialog states ──
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  // ── Create form ──
  const [createForm, setCreateForm] = useState({
    clientName: "",
    clientEmail: "",
    clientCompany: "",
    clientPhone: "",
    type: "brand_management",
    title: "",
    totalCost: "",
    currency: "PKR",
    currencySymbol: "Rs.",
    validUntil: "",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  // ── Edit dialog ──
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    clientName: "",
    clientEmail: "",
    clientCompany: "",
    clientPhone: "",
    type: "brand_management",
    title: "",
    totalCost: "",
    currency: "PKR",
    currencySymbol: "Rs.",
    validUntil: "",
    notes: "",
    executiveSummary: "",
    scopeItems: [{ title: "", description: "" }],
    timelineItems: [{ phase: "", title: "", duration: "" }],
    pricingItems: [{ item: "", description: "", amount: "" }],
    customTerms: "",
  });

  // ── Share dialog ──
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareMethod, setShareMethod] = useState<"whatsapp" | "email">("whatsapp");
  const [shareMessage, setShareMessage] = useState("");
  const [shareSubject, setShareSubject] = useState("");

  // ── Action loading ──
  const [actionLoading, setActionLoading] = useState(false);

  // ── Payment loading ──
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);

  // ── Version history ──
  const [versionHistory, setVersionHistory] = useState<ProposalVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null); // null = current

  // ── Save-as-new-version toggle ──
  const [saveAsNewVersion, setSaveAsNewVersion] = useState(false);

  // ── Acceptance workflow ──
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // ── Formatters ──
  const formatCurrency = (amount: number, symbol?: string) =>
    `${symbol || "Rs."} ${amount.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;

  const formatDate = (dateStr: string) => {
    try {
      const tz = organization?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: tz });
    } catch {
      return dateStr;
    }
  };

  const getTypeLabel = (type: string) =>
    PROPOSAL_TYPES.find((t) => t.value === type)?.label || type.replace(/_/g, " ");

  // ── Access check ──
  const hasAccess = Boolean(user?.role && isPlatformRole(user.role));

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  // ── Badge helpers ──
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: isGold ? "bg-slate-500/15 text-slate-400 border-slate-500/25" : "bg-slate-100 text-slate-600 border-slate-200",
      sent: isGold ? "bg-blue-500/15 text-blue-400 border-blue-500/25" : "bg-blue-100 text-blue-700 border-blue-200",
      viewed: isGold ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" : "bg-yellow-100 text-yellow-700 border-yellow-200",
      accepted: isGold ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-emerald-100 text-emerald-700 border-emerald-200",
      rejected: isGold ? "bg-red-500/15 text-red-400 border-red-500/25" : "bg-red-100 text-red-700 border-red-200",
      expired: isGold ? "bg-orange-500/15 text-orange-400 border-orange-500/25" : "bg-orange-100 text-orange-700 border-orange-200",
      revised: isGold ? "bg-purple-500/15 text-purple-400 border-purple-500/25" : "bg-purple-100 text-purple-700 border-purple-200",
    };
    return styles[status] || (isGold ? "bg-slate-500/15 text-slate-400 border-slate-500/25" : "bg-slate-100 text-slate-600 border-slate-200");
  };

  // ── Payment status badge helper ──
  const getPaymentBadge = (paymentStatus?: string) => {
    if (!paymentStatus || paymentStatus === "unpaid") return null;
    const styles: Record<string, string> = {
      pending: isGold ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" : "bg-yellow-100 text-yellow-700 border-yellow-200",
      paid: isGold ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-emerald-100 text-emerald-700 border-emerald-200",
      failed: isGold ? "bg-red-500/15 text-red-400 border-red-500/25" : "bg-red-100 text-red-700 border-red-200",
      refunded: isGold ? "bg-orange-500/15 text-orange-400 border-orange-500/25" : "bg-orange-100 text-orange-700 border-orange-200",
    };
    const labels: Record<string, string> = {
      pending: "Payment Pending",
      paid: "Paid",
      failed: "Payment Failed",
      refunded: "Refunded",
    };
    return styles[paymentStatus] || null;
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      brand_management: isGold ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-amber-100 text-amber-700 border-amber-200",
      digital_marketing: isGold ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/25" : "bg-cyan-100 text-cyan-700 border-cyan-200",
      tech_integration: isGold ? "bg-violet-500/15 text-violet-400 border-violet-500/25" : "bg-violet-100 text-violet-700 border-violet-200",
      e_commerce: isGold ? "bg-pink-500/15 text-pink-400 border-pink-500/25" : "bg-pink-100 text-pink-700 border-pink-200",
      enterprise: isGold ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/25" : "bg-indigo-100 text-indigo-700 border-indigo-200",
      monthly_retainer: isGold ? "bg-teal-500/15 text-teal-400 border-teal-500/25" : "bg-teal-100 text-teal-700 border-teal-200",
      social_media_management: isGold ? "bg-sky-500/15 text-sky-400 border-sky-500/25" : "bg-sky-100 text-sky-700 border-sky-200",
      content_creation: isGold ? "bg-orange-500/15 text-orange-400 border-orange-500/25" : "bg-orange-100 text-orange-700 border-orange-200",
      seo_optimization: isGold ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-emerald-100 text-emerald-700 border-emerald-200",
      paid_advertising: isGold ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : "bg-rose-100 text-rose-700 border-rose-200",
      brand_identity: isGold ? "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25" : "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
      consultation: isGold ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" : "bg-yellow-100 text-yellow-700 border-yellow-200",
      custom_development: isGold ? "bg-lime-500/15 text-lime-400 border-lime-500/25" : "bg-lime-100 text-lime-700 border-lime-200",
    };
    return styles[type] || (isGold ? "bg-slate-500/15 text-slate-400 border-slate-500/25" : "bg-slate-100 text-slate-600 border-slate-200");
  };

  // ─── Fetch proposals ──────────────────────────────────────────────────
  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (search) params.set("search", search);

      const res = await fetchWithAuth(`/api/admin/proposals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch proposals");
      const data = await res.json();
      setProposals(data.proposals || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // ─── Create proposal ──────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.clientName || !createForm.clientEmail || !createForm.title) {
      toast.error("Client name, email, and title are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/admin/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          totalCost: createForm.totalCost ? Number(createForm.totalCost) : null,
          validUntil: createForm.validUntil || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create proposal");

      toast.success("Proposal created successfully");
      setCreateDialogOpen(false);
      setCreateForm({
        clientName: "",
        clientEmail: "",
        clientCompany: "",
        clientPhone: "",
        type: "brand_management",
        title: "",
        totalCost: "",
        currency: "PKR",
        currencySymbol: "Rs.",
        validUntil: "",
        notes: "",
      });
      fetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create proposal");
    } finally {
      setCreating(false);
    }
  };

  // ─── Send proposal ───────────────────────────────────────────────────
  const handleSend = async (proposal: Proposal) => {
    setActionLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/proposals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, status: "sent" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send proposal");

      toast.success("Proposal marked as sent");
      fetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send proposal");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Update status ───────────────────────────────────────────────────
  const handleUpdateStatus = async (id: string, status: string) => {
    setActionLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/proposals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast.success(`Status updated to ${status}`);
      fetchProposals();
      if (selectedProposal?.id === id) {
        setSelectedProposal({ ...selectedProposal, status });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Delete proposal ──────────────────────────────────────────────────
  const handleDelete = async (proposal: Proposal) => {
    if (!confirm(`Delete proposal "${proposal.title}" for ${proposal.clientName}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/proposals?id=${proposal.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete proposal");

      toast.success("Proposal deleted");
      fetchProposals();
      if (viewDialogOpen) {
        setViewDialogOpen(false);
        setSelectedProposal(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete proposal");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Generate PDF ───────────────────────────────────────────────────
  const handleGeneratePDF = async (proposal: Proposal) => {
    try {
      const res = await fetchWithAuth("/api/admin/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate PDF");
      }

      // Download the PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposal-${proposal.type || ""}-${(proposal.clientName || "").replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    }
  };

  // ─── Parse content JSON (kept for backward compat) ──────────────
  const parseContent = (contentStr: string) => {
    return parseContentFull(contentStr);
  };

  // ─── Open Edit Dialog ────────────────────────────────────────────────
  const openEditDialog = (proposal: Proposal) => {
    const content = parseContentFull(proposal.content);
    setSaveAsNewVersion(false);
    setEditForm({
      clientName: proposal.clientName,
      clientEmail: proposal.clientEmail,
      clientCompany: proposal.clientCompany || "",
      clientPhone: proposal.clientPhone || "",
      type: proposal.type,
      title: proposal.title,
      totalCost: proposal.totalCost != null ? String(proposal.totalCost) : "",
      currency: proposal.currency,
      currencySymbol: proposal.currencySymbol,
      validUntil: proposal.validUntil ? proposal.validUntil.split("T")[0] : "",
      notes: proposal.notes || "",
      executiveSummary: content.executiveSummary,
      scopeItems: content.scopeItems,
      timelineItems: content.timelineItems,
      pricingItems: content.pricingItems,
      customTerms: content.customTerms,
    });
    setSelectedProposal(proposal);
    setEditDialogOpen(true);
  };

  // ─── Save Edit ────────────────────────────────────────────────────────
  const handleEditSave = async () => {
    if (!editForm.clientName || !editForm.clientEmail || !editForm.title || !selectedProposal) {
      toast.error("Client name, email, and title are required");
      return;
    }
    setSaving(true);
    try {
      const contentData = {
        executiveSummary: editForm.executiveSummary,
        scopeItems: editForm.scopeItems.filter((s) => s.title || s.description),
        timelineItems: editForm.timelineItems.filter((t) => t.phase || t.title),
        pricingItems: editForm.pricingItems.filter((p) => p.item || p.description),
        customTerms: editForm.customTerms,
      };

      if (saveAsNewVersion) {
        // Save as new version via versions API
        const res = await fetchWithAuth("/api/admin/proposals/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalId: selectedProposal.id,
            content: contentData,
            title: editForm.title,
            totalCost: editForm.totalCost ? Number(editForm.totalCost) : null,
            currency: editForm.currency,
            saveAsNewVersion: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save new version");

        toast.success(`Version ${data.version?.versionNumber || "N/A"} created successfully`);
        setEditDialogOpen(false);
        fetchProposals();
      } else {
        // Overwrite current version (existing behavior)
        const res = await fetchWithAuth("/api/admin/proposals", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedProposal.id,
            clientName: editForm.clientName,
            clientEmail: editForm.clientEmail,
            clientCompany: editForm.clientCompany || null,
            clientPhone: editForm.clientPhone || null,
            type: editForm.type,
            title: editForm.title,
            totalCost: editForm.totalCost ? Number(editForm.totalCost) : null,
            currency: editForm.currency,
            currencySymbol: editForm.currencySymbol,
            validUntil: editForm.validUntil || null,
            notes: editForm.notes || null,
            content: JSON.stringify(contentData),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update proposal");

        toast.success("Proposal updated successfully");
        setEditDialogOpen(false);
        fetchProposals();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save proposal");
    } finally {
      setSaving(false);
    }
  };

  // ─── Request Payment (PayPro) ─────────────────────────────────────
  const handleRequestPayment = async (proposal: Proposal) => {
    setPaymentLoading(proposal.id);
    try {
      const res = await fetchWithAuth('/api/admin/proposals/paypro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment link');
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
        toast.success('Payment link generated! Opening PayPro...');
      } else {
        toast.error('No payment URL returned');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate payment link');
    } finally {
      setPaymentLoading(null);
    }
  };

  // ─── Clone Proposal ──────────────────────────────────────────────────
  const handleClone = async (proposal: Proposal) => {
    try {
      const res = await fetchWithAuth("/api/admin/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: proposal.clientName,
          clientEmail: proposal.clientEmail,
          clientCompany: proposal.clientCompany || "",
          clientPhone: proposal.clientPhone || "",
          type: proposal.type,
          title: `${proposal.title} (Copy)`,
          totalCost: proposal.totalCost,
          currency: proposal.currency,
          currencySymbol: proposal.currencySymbol,
          validUntil: proposal.validUntil ? proposal.validUntil.split("T")[0] : "",
          notes: proposal.notes || "",
          content: proposal.content || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clone proposal");

      toast.success("Proposal duplicated successfully");
      fetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clone proposal");
    }
  };

  // ─── Build WhatsApp share message ──────────────────────────────────
  const buildWhatsAppMessage = (proposal: Proposal): string => {
    const typeLabel = getTypeLabel(proposal.type);
    const cost = proposal.totalCost != null
      ? formatCurrency(proposal.totalCost, proposal.currencySymbol)
      : "To be discussed";
    const validUntil = proposal.validUntil
      ? formatDate(proposal.validUntil)
      : "Open-ended";

    return (
      `Hello ${proposal.clientName}! 🌟\n\n` +
      `I'd like to share a proposal from Valtriox:\n\n` +
      `📋 *${proposal.title}*\n` +
      `Type: ${typeLabel}\n` +
      `💰 Total Investment: ${cost}\n` +
      `📅 Valid Until: ${validUntil}\n\n` +
      `I'd love to discuss this further with you. Looking forward to your feedback!\n\n` +
      `Best regards,\nValtriox Team`
    );
  };

  // ─── Build Email share message ────────────────────────────────────
  const buildEmailBody = (proposal: Proposal): { subject: string; body: string } => {
    const typeLabel = getTypeLabel(proposal.type);
    const cost = proposal.totalCost != null
      ? formatCurrency(proposal.totalCost, proposal.currencySymbol)
      : "To be discussed";
    const validUntil = proposal.validUntil
      ? formatDate(proposal.validUntil)
      : "Open-ended";

    const subject = `Valtriox - ${proposal.title} | Proposal for ${proposal.clientName}`;

    const body =
      `Dear ${proposal.clientName},\n\n` +
      `I hope this message finds you well. I'd like to share a proposal from Valtriox that I believe would be a great fit for your needs.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 ${proposal.title}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Type: ${typeLabel}\n` +
      `Total Investment: ${cost}\n` +
      `Valid Until: ${validUntil}\n\n` +
      `I would welcome the opportunity to discuss this proposal with you in more detail. Please feel free to reach out at your convenience.\n\n` +
      `Looking forward to hearing from you.\n\n` +
      `Best regards,\nValtriox Team\nhttps://valtriox.com`;

    return { subject, body };
  };

  // ─── Open Share Dialog (preview before sending) ────────────────────
  const openShareDialog = (proposal: Proposal, method: "whatsapp" | "email") => {
    setSelectedProposal(proposal);
    setShareMethod(method);
    if (method === "whatsapp") {
      setShareMessage(buildWhatsAppMessage(proposal));
      setShareSubject("");
    } else {
      const { subject, body } = buildEmailBody(proposal);
      setShareSubject(subject);
      setShareMessage(body);
    }
    setShareDialogOpen(true);
  };

  // ─── Send via WhatsApp ────────────────────────────────────────────
  const handleShareWhatsApp = (proposal?: Proposal) => {
    const p = proposal || selectedProposal;
    if (!p) return;

    const phone = p.clientPhone?.replace(/[^0-9+]/g, "") || "";
    const message = buildWhatsAppMessage(p);

    const url = phone
      ? `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
    setShareDialogOpen(false);
    toast.success("Opening WhatsApp to share proposal");
  };

  // ─── Send via Email ────────────────────────────────────────────────
  const handleShareEmail = (proposal?: Proposal) => {
    const p = proposal || selectedProposal;
    if (!p) return;

    const { subject, body } = buildEmailBody(p);
    const email = p.clientEmail || "";

    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
    setShareDialogOpen(false);
    toast.success("Opening email client to share proposal");
  };

  // ─── Copy share message to clipboard ────────────────────────────
  const handleCopyShareMessage = () => {
    navigator.clipboard.writeText(shareMessage).then(() => {
      toast.success("Message copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy message");
    });
  };

  // ─── Fetch Version History ──────────────────────────────────────
  const fetchVersionHistory = useCallback(async (proposalId: string) => {
    setVersionsLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/proposals/versions?proposalId=${proposalId}`);
      if (!res.ok) throw new Error("Failed to fetch versions");
      const data = await res.json();
      setVersionHistory(data.versions || []);
    } catch {
      setVersionHistory([]);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  // ─── Handle Accept Proposal ───────────────────────────────────
  const handleAcceptProposal = async (proposal: Proposal) => {
    if (!termsAccepted) {
      toast.error("Please accept the terms before accepting the proposal");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/proposals/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, acceptProposal: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept proposal");
      toast.success("Proposal accepted successfully");
      setTermsAccepted(false);
      setSelectedProposal({ ...proposal, status: "accepted" });
      fetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept proposal");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Handle Reject Proposal ───────────────────────────────────
  const handleRejectProposal = async () => {
    if (!selectedProposal) return;
    setActionLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/proposals/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: selectedProposal.id, rejectProposal: true, rejectionReason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject proposal");
      toast.success("Proposal rejected successfully");
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedProposal({ ...selectedProposal, status: "rejected" });
      fetchProposals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject proposal");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── View a Specific Version ───────────────────────────────────
  const handleViewVersion = (version: ProposalVersion) => {
    setViewingVersion(version.versionNumber);
  };

  // ─── Back to current version ──────────────────────────────────
  const handleBackToCurrent = () => {
    setViewingVersion(null);
  };

  // ─── Get version count for a proposal (from content JSON) ─────
  const getVersionCount = (contentStr: string): number => {
    try {
      const parsed = JSON.parse(contentStr);
      if (Array.isArray(parsed.versions) && parsed.versions.length > 0) {
        return parsed.versions.length;
      }
    } catch { /* ignore */ }
    return 0;
  };

  // ─── Open View Dialog with version history ─────────────────────
  const openViewDialog = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setViewingVersion(null);
    setTermsAccepted(false);
    setVersionHistory([]);
    setViewDialogOpen(true);
    fetchVersionHistory(proposal.id);
  };

  // ─── Parse content JSON ─────────────────────────────────────────
  const parseContentFull = (contentStr: string, versionNum?: number | null) => {
    try {
      const parsed = typeof contentStr === "string" ? JSON.parse(contentStr) : contentStr;

      // If viewing a specific version, extract that version's content
      if (versionNum && versionNum > 0 && Array.isArray(parsed.versions)) {
        const targetVersion = parsed.versions.find((v: Record<string, unknown>) => v.versionNumber === versionNum);
        if (targetVersion && targetVersion.content) {
 const vContent = targetVersion.content as Record<string, unknown>;
          return {
            executiveSummary: (vContent.executiveSummary as string) || "",
            scopeItems: Array.isArray(vContent.scopeItems) && vContent.scopeItems.length > 0
              ? vContent.scopeItems : [{ title: "", description: "" }],
            timelineItems: Array.isArray(vContent.timelineItems) && vContent.timelineItems.length > 0
              ? vContent.timelineItems : [{ phase: "", title: "", duration: "" }],
            pricingItems: Array.isArray(vContent.pricingItems) && vContent.pricingItems.length > 0
              ? vContent.pricingItems : [{ item: "", description: "", amount: "" }],
            customTerms: (vContent.customTerms as string) || "",
          };
        }
      }

      // Default: parse root content (strip versions array)
      return {
        executiveSummary: (parsed.executiveSummary as string) || "",
        scopeItems: Array.isArray(parsed.scopeItems) && parsed.scopeItems.length > 0
          ? parsed.scopeItems : [{ title: "", description: "" }],
        timelineItems: Array.isArray(parsed.timelineItems) && parsed.timelineItems.length > 0
          ? parsed.timelineItems : [{ phase: "", title: "", duration: "" }],
        pricingItems: Array.isArray(parsed.pricingItems) && parsed.pricingItems.length > 0
          ? parsed.pricingItems : [{ item: "", description: "", amount: "" }],
        customTerms: (parsed.customTerms as string) || "",
      };
    } catch {
      return {
        executiveSummary: "",
        scopeItems: [{ title: "", description: "" }],
        timelineItems: [{ phase: "", title: "", duration: "" }],
        pricingItems: [{ item: "", description: "", amount: "" }],
        customTerms: "",
      };
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold flex items-center gap-2", textPrimary)}>
            <FileText className="h-6 w-6 text-amber-500" />
            Proposals
          </h1>
          <p className={cn("text-sm mt-0.5", textSecondary)}>
            Manage client proposals, track status, and generate PDFs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchProposals} disabled={loading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="h-4 w-4" />
                Create Proposal
              </Button>
            </DialogTrigger>
            <DialogContent className={cn("max-w-lg max-h-[90vh] overflow-y-auto", isDark && "bg-slate-900 border-slate-700")}>
              <DialogHeader>
                <DialogTitle className={textPrimary}>Create New Proposal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className={textSecondary}>Client Name *</Label>
                    <Input
                      placeholder="John Doe"
                      value={createForm.clientName}
                      onChange={(e) => setCreateForm({ ...createForm, clientName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={textSecondary}>Client Email *</Label>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      value={createForm.clientEmail}
                      onChange={(e) => setCreateForm({ ...createForm, clientEmail: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className={textSecondary}>Company</Label>
                    <Input
                      placeholder="Acme Corp"
                      value={createForm.clientCompany}
                      onChange={(e) => setCreateForm({ ...createForm, clientCompany: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={textSecondary}>Phone</Label>
                    <Input
                      placeholder="+92 300 1234567"
                      value={createForm.clientPhone}
                      onChange={(e) => setCreateForm({ ...createForm, clientPhone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className={textSecondary}>Proposal Type *</Label>
                    <Select
                      value={createForm.type}
                      onValueChange={(v) => setCreateForm({ ...createForm, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPOSAL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className={textSecondary}>Total Cost</Label>
                    <Input
                      type="number"
                      placeholder="150000"
                      value={createForm.totalCost}
                      onChange={(e) => setCreateForm({ ...createForm, totalCost: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className={textSecondary}>Proposal Title *</Label>
                  <Input
                    placeholder="Brand Strategy Proposal"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={textSecondary}>Valid Until</Label>
                  <Input
                    type="date"
                    value={createForm.validUntil}
                    onChange={(e) => setCreateForm({ ...createForm, validUntil: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={textSecondary}>Notes (Internal)</Label>
                  <Textarea
                    placeholder="Internal notes about this proposal..."
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    onClick={handleCreate}
                    disabled={creating}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {creating ? "Creating..." : "Create Proposal"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card className={cn(cardBg)}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className={cn("text-base font-semibold", textPrimary)}>All Proposals</CardTitle>
              <CardDescription className={textSecondary}>
                Manage and track all client proposals
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search proposals..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 h-9 w-full sm:w-[200px] text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[130px] text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {PROPOSAL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[160px] text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PROPOSAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.06] hover:bg-transparent" : ""}>
                  <TableHead className="text-xs">Client</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Cost</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j} className="py-3">
                          <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : proposals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-slate-300" />
                        <p className={textSecondary}>No proposals found. Create your first proposal to get started.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  proposals.map((proposal, i) => (
                    <tr
                      key={proposal.id}
                      className={cn(
                        "border-b transition-colors",
                        isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      <TableCell className="font-medium py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white",
                            "bg-gradient-to-br from-amber-500 to-amber-700"
                          )}>
                            {proposal.clientName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-sm font-medium truncate max-w-[150px]", textPrimary)}>{proposal.clientName}</p>
                            <p className="text-xs text-slate-400 truncate max-w-[150px]">{proposal.clientEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={cn("text-[10px] font-semibold border", getTypeBadge(proposal.type))}>
                          {getTypeLabel(proposal.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className={cn("text-[10px] font-semibold border", getStatusBadge(proposal.status))}>
                            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                          </Badge>
                          {getPaymentBadge(proposal.paymentStatus) && (
                            <Badge variant="outline" className={cn("text-[10px] font-semibold border", getPaymentBadge(proposal.paymentStatus)!)}>
                              {proposal.paymentStatus === "paid" ? "Paid" : proposal.paymentStatus === "pending" ? "Payment Pending" : proposal.paymentStatus === "failed" ? "Payment Failed" : proposal.paymentStatus === "refunded" ? "Refunded" : proposal.paymentStatus}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <p className={cn("text-sm font-semibold", isGold ? "text-amber-400" : "text-amber-600")}>
                          {proposal.totalCost != null
                            ? formatCurrency(proposal.totalCost, proposal.currencySymbol)
                            : "-"}
                        </p>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-400">{formatDate(proposal.createdAt)}</p>
                          {getVersionCount(proposal.content) > 0 && (
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-bold border",
                              isGold ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-amber-100 text-amber-700 border-amber-200"
                            )}>
                              v{getVersionCount(proposal.content)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                                            onClick={() => openViewDialog(proposal)}
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                            onClick={() => openEditDialog(proposal)}
                            title="Edit Proposal"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-medium">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-violet-500 hover:text-violet-400"
                            onClick={() => handleClone(proposal)}
                            disabled={actionLoading}
                            title="Clone Proposal"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {proposal.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-blue-500 hover:text-blue-400"
                              onClick={() => handleSend(proposal)}
                              disabled={actionLoading}
                              title="Send Proposal"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-green-500 hover:text-green-400"
                            onClick={() => openShareDialog(proposal, "whatsapp")}
                            title="Share via WhatsApp"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-sky-500 hover:text-sky-400"
                            onClick={() => openShareDialog(proposal, "email")}
                            title="Share via Email"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-400"
                            onClick={() => handleGeneratePDF(proposal)}
                            title="Download PDF"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {proposal.totalCost != null && proposal.totalCost > 0 && proposal.paymentStatus !== "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-cyan-500 hover:text-cyan-400"
                              onClick={() => handleRequestPayment(proposal)}
                              disabled={paymentLoading === proposal.id}
                              title="Request Payment"
                            >
                              <CreditCard className={cn("h-3.5 w-3.5", paymentLoading === proposal.id && "animate-pulse")} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-400"
                            onClick={() => handleDelete(proposal)}
                            disabled={actionLoading}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2 p-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn("rounded-lg p-3 animate-pulse", isDark ? "bg-white/[0.02]" : "bg-slate-50")}>
                  <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                </div>
              ))
            ) : proposals.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <FileText className="h-8 w-8 text-slate-300" />
                <p className={textSecondary}>No proposals found.</p>
              </div>
            ) : (
              proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    isDark ? "border-white/[0.06] hover:bg-white/[0.02]" : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-xs font-bold text-white">
                        {proposal.clientName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={cn("text-sm font-semibold", textPrimary)}>{proposal.clientName}</p>
                        <p className="text-[11px] text-slate-400">{proposal.clientCompany || proposal.clientEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={cn("text-[10px] border", getStatusBadge(proposal.status))}>
                        {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                      </Badge>
                      {getPaymentBadge(proposal.paymentStatus) && (
                        <Badge variant="outline" className={cn("text-[10px] border", getPaymentBadge(proposal.paymentStatus)!)}>
                          {proposal.paymentStatus === "paid" ? "Paid" : proposal.paymentStatus === "pending" ? "Pending" : proposal.paymentStatus === "failed" ? "Failed" : proposal.paymentStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <Badge variant="outline" className={cn("text-[10px] border", getTypeBadge(proposal.type))}>
                        {getTypeLabel(proposal.type)}
                      </Badge>
                      {proposal.totalCost != null && (
                        <span className={cn("font-semibold", isGold ? "text-amber-400" : "text-amber-600")}>
                          {formatCurrency(proposal.totalCost, proposal.currencySymbol)}
                        </span>
                      )}
                      <span>{formatDate(proposal.createdAt)}</span>
                      {getVersionCount(proposal.content) > 0 && (
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-bold border",
                          isGold ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-amber-100 text-amber-700 border-amber-200"
                        )}>
                          v{getVersionCount(proposal.content)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => openViewDialog(proposal)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10" onClick={() => openEditDialog(proposal)} title="Edit Proposal">
                      <Edit className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-medium">Edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-violet-500" onClick={() => handleClone(proposal)} disabled={actionLoading}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {proposal.status === "draft" && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500" onClick={() => handleSend(proposal)} disabled={actionLoading}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-500" onClick={() => openShareDialog(proposal, "whatsapp")}>
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-sky-500" onClick={() => openShareDialog(proposal, "email")}>
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-500" onClick={() => handleGeneratePDF(proposal)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {proposal.totalCost != null && proposal.totalCost > 0 && proposal.paymentStatus !== "paid" && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-cyan-500" onClick={() => handleRequestPayment(proposal)} disabled={paymentLoading === proposal.id}>
                        <CreditCard className={cn("h-3.5 w-3.5", paymentLoading === proposal.id && "animate-pulse")} />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(proposal)} disabled={actionLoading}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className={cn("text-sm", textSecondary)}>
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={(open) => { setViewDialogOpen(open); if (!open) { setSelectedProposal(null); setViewingVersion(null); setVersionHistory([]); } }}>
        <DialogContent className={cn("max-w-2xl max-h-[90vh] overflow-y-auto", isDark && "bg-slate-900 border-slate-700")}>
          {selectedProposal && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className={textPrimary}>Proposal Details</DialogTitle>
                    <p className={cn("text-sm mt-1", textSecondary)}>{selectedProposal.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {viewingVersion && viewingVersion > 0 && (
                      <Badge variant="outline" className={cn("text-xs font-semibold border", isGold ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-amber-100 text-amber-700 border-amber-200")}>
                        Viewing v{viewingVersion}
                      </Badge>
                    )}
                    <Badge variant="outline" className={cn("text-xs font-semibold border", getStatusBadge(selectedProposal.status))}>
                      {selectedProposal.status.charAt(0).toUpperCase() + selectedProposal.status.slice(1)}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs font-semibold border", getTypeBadge(selectedProposal.type))}>
                      {getTypeLabel(selectedProposal.type)}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              {/* Version viewing banner */}
              {viewingVersion && viewingVersion > 0 && (
                <div className={cn("rounded-lg p-3 flex items-center justify-between", isGold ? "bg-amber-500/10 border border-amber-500/20" : "bg-amber-50 border border-amber-200")}>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-amber-500" />
                    <span className={cn("text-sm font-medium", textPrimary)}>You are viewing version {viewingVersion}</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleBackToCurrent}>
                    Back to Current
                  </Button>
                </div>
              )}

              <Tabs defaultValue="details" className="mt-4">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4 space-y-4">
                  {/* Proposal Content (Executive Summary, Scope, etc.) */}
                  {(() => {
                    const content = parseContentFull(selectedProposal.content, viewingVersion);
                    const hasContent = content.executiveSummary || content.scopeItems.some(s => s.title) || content.pricingItems.some(p => p.item);
                    if (!hasContent) return null;
                    return (
                      <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                        <CardContent className="p-4">
                          <h3 className={cn("text-sm font-semibold mb-3", textPrimary)}>Proposal Content</h3>
                          <div className="space-y-4">
                            {content.executiveSummary && (
                              <div>
                                <p className={cn("text-xs font-medium mb-1", textSecondary)}>Executive Summary</p>
                                <p className={cn("text-sm leading-relaxed break-words", textPrimary)}>{content.executiveSummary}</p>
                              </div>
                            )}
                            {content.scopeItems.some(s => s.title) && (
                              <div>
                                <p className={cn("text-xs font-medium mb-2", textSecondary)}>Scope of Work</p>
                                <div className="space-y-2">
                                  {content.scopeItems.filter(s => s.title).map((s, i) => (
                                    <div key={i} className={cn("rounded-lg p-3", isDark ? "bg-white/[0.02]" : "bg-white")}>
                                      <p className={cn("text-sm font-medium break-words", textPrimary)}>{s.title}</p>
                                      {s.description && <p className={cn("text-xs mt-1 break-words", textSecondary)}>{s.description}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {content.pricingItems.some(p => p.item) && (
                              <div>
                                <p className={cn("text-xs font-medium mb-2", textSecondary)}>Pricing Breakdown</p>
                                <div className="space-y-2">
                                  {content.pricingItems.filter(p => p.item).map((p, i) => (
                                    <div key={i} className={cn("rounded-lg p-3 flex items-center justify-between", isDark ? "bg-white/[0.02]" : "bg-white")}>
                                      <div className="min-w-0">
                                        <p className={cn("text-sm font-medium break-words", textPrimary)}>{p.item}</p>
                                        {p.description && <p className={cn("text-xs mt-0.5 break-words", textSecondary)}>{p.description}</p>}
                                      </div>
                                      <p className={cn("text-sm font-bold", isGold ? "text-amber-400" : "text-amber-600")}>{p.amount}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {content.timelineItems.some(t => t.title) && (
                              <div>
                                <p className={cn("text-xs font-medium mb-2", textSecondary)}>Timeline</p>
                                <div className="space-y-2">
                                  {content.timelineItems.filter(t => t.title).map((t, i) => (
                                    <div key={i} className={cn("rounded-lg p-3 flex items-center justify-between", isDark ? "bg-white/[0.02]" : "bg-white")}>
                                      <div className="min-w-0">
                                        <p className={cn("text-sm font-medium break-words", textPrimary)}>{t.title}</p>
                                        {t.phase && <p className={cn("text-xs mt-0.5 break-words", textSecondary)}>Phase: {t.phase}</p>}
                                      </div>
                                      {t.duration && <p className={cn("text-xs font-medium", textSecondary)}>{t.duration}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {content.customTerms && (
                              <div>
                                <p className={cn("text-xs font-medium mb-1", textSecondary)}>Terms & Conditions</p>
                                <p className={cn("text-sm leading-relaxed break-words", textSecondary)}>{content.customTerms}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                  {/* Client Info */}
                  <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                    <CardContent className="p-4">
                      <h3 className={cn("text-sm font-semibold mb-3", textPrimary)}>Client Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Name</p>
                            <p className={cn("font-medium", textPrimary)}>{selectedProposal.clientName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Email</p>
                            <p className={cn("font-medium", textPrimary)}>{selectedProposal.clientEmail}</p>
                          </div>
                        </div>
                        {selectedProposal.clientCompany && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className={cn("text-xs text-slate-400")}>Company</p>
                              <p className={cn("font-medium", textPrimary)}>{selectedProposal.clientCompany}</p>
                            </div>
                          </div>
                        )}
                        {selectedProposal.clientPhone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className={cn("text-xs text-slate-400")}>Phone</p>
                              <p className={cn("font-medium", textPrimary)}>{selectedProposal.clientPhone}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Proposal Info */}
                  <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                    <CardContent className="p-4">
                      <h3 className={cn("text-sm font-semibold mb-3", textPrimary)}>Proposal Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className={cn("text-xs text-slate-400")}>Type</p>
                          <p className={cn("text-sm font-medium", textPrimary)}>{getTypeLabel(selectedProposal.type)}</p>
                        </div>
                        <div>
                          <p className={cn("text-xs text-slate-400")}>Status</p>
                          <Badge variant="outline" className={cn("text-xs border", getStatusBadge(selectedProposal.status))}>
                            {selectedProposal.status.charAt(0).toUpperCase() + selectedProposal.status.slice(1)}
                          </Badge>
                        </div>
                        <div>
                          <p className={cn("text-xs text-slate-400")}>Total Cost</p>
                          <p className={cn("text-sm font-bold", isGold ? "text-amber-400" : "text-amber-600")}>
                            {selectedProposal.totalCost != null
                              ? formatCurrency(selectedProposal.totalCost, selectedProposal.currencySymbol)
                              : "Not specified"}
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-xs text-slate-400")}>Currency</p>
                          <p className={cn("text-sm font-medium", textPrimary)}>
                            {selectedProposal.currencySymbol} ({selectedProposal.currency})
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-xs text-slate-400")}>Created</p>
                          <p className={cn("text-sm font-medium", textPrimary)}>{formatDate(selectedProposal.createdAt)}</p>
                        </div>
                        {selectedProposal.validUntil && (
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Valid Until</p>
                            <p className={cn("text-sm font-medium", textPrimary)}>{formatDate(selectedProposal.validUntil)}</p>
                          </div>
                        )}
                        {selectedProposal.sentAt && (
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Sent At</p>
                            <p className={cn("text-sm font-medium", textPrimary)}>{formatDate(selectedProposal.sentAt)}</p>
                          </div>
                        )}
                        {selectedProposal.viewedAt && (
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Viewed At</p>
                            <p className={cn("text-sm font-medium", textPrimary)}>{formatDate(selectedProposal.viewedAt)}</p>
                          </div>
                        )}
                        {selectedProposal.respondedAt && (
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Responded At</p>
                            <p className={cn("text-sm font-medium", textPrimary)}>{formatDate(selectedProposal.respondedAt)}</p>
                          </div>
                        )}
                        {selectedProposal.paymentStatus && selectedProposal.paymentStatus !== "unpaid" && (
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Payment Status</p>
                            <Badge variant="outline" className={cn("text-xs border", getPaymentBadge(selectedProposal.paymentStatus)!)}>
                              {selectedProposal.paymentStatus === "paid" ? "Paid" : selectedProposal.paymentStatus === "pending" ? "Payment Pending" : selectedProposal.paymentStatus === "failed" ? "Payment Failed" : selectedProposal.paymentStatus === "refunded" ? "Refunded" : selectedProposal.paymentStatus}
                            </Badge>
                          </div>
                        )}
                        {selectedProposal.paidAt && (
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Paid At</p>
                            <p className={cn("text-sm font-medium", textPrimary)}>{formatDate(selectedProposal.paidAt)}</p>
                          </div>
                        )}
                        {selectedProposal.paymentAmount != null && (
                          <div>
                            <p className={cn("text-xs text-slate-400")}>Payment Amount</p>
                            <p className={cn("text-sm font-bold", isGold ? "text-emerald-400" : "text-emerald-600")}>
                              {formatCurrency(selectedProposal.paymentAmount, selectedProposal.currencySymbol)}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Internal Notes */}
                  {selectedProposal.notes && (
                    <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                      <CardContent className="p-4">
                        <h3 className={cn("text-sm font-semibold mb-2", textPrimary)}>Internal Notes</h3>
                        <p className={cn("text-sm", textSecondary)}>{selectedProposal.notes}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Acceptance Info */}
                  {(() => {
                    try {
                      const parsed = JSON.parse(selectedProposal.content || "{}");
                      if (parsed.acceptedAt || parsed.rejectedAt) {
                        return (
                          <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                            <CardContent className="p-4">
                              <h3 className={cn("text-sm font-semibold mb-2", textPrimary)}>Acceptance Details</h3>
                              <div className="space-y-2">
                                {parsed.acceptedAt && (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <p className={cn("text-sm", textPrimary)}>
                                      Accepted on <span className="font-medium">{formatDate(parsed.acceptedAt as string)}</span>
                                      {parsed.acceptedByName && <span> by <span className="font-medium">{parsed.acceptedByName as string}</span></span>}
                                    </p>
                                  </div>
                                )}
                                {parsed.rejectedAt && (
                                  <div className="flex items-start gap-2">
                                    <X className="h-4 w-4 text-red-500 mt-0.5" />
                                    <div>
                                      <p className={cn("text-sm", textPrimary)}>
                                        Rejected on <span className="font-medium">{formatDate(parsed.rejectedAt as string)}</span>
                                        {parsed.rejectedByName && <span> by <span className="font-medium">{parsed.rejectedByName as string}</span></span>}
                                      </p>
                                      {parsed.rejectionReason && (
                                        <p className={cn("text-xs mt-1", textSecondary)}>Reason: {parsed.rejectionReason as string}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }
                    } catch { /* ignore */ }
                    return null;
                  })()}

                  {/* Version History */}
                  <Collapsible>
                    <CollapsibleTrigger className={cn("w-full rounded-lg border p-3 flex items-center justify-between transition-colors hover:bg-white/[0.02]", isDark ? "border-white/[0.06]" : "border-slate-200")}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-amber-500" />
                        <span className={cn("text-sm font-semibold", textPrimary)}>Version History</span>
                        {versionHistory.length > 0 && (
                          <Badge variant="outline" className={cn("text-[10px] border", isGold ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-amber-100 text-amber-700 border-amber-200")}>
                            {versionHistory.length} version{versionHistory.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                        <CardContent className="p-3">
                          {versionsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                              <span className={cn("text-sm ml-2", textSecondary)}>Loading versions...</span>
                            </div>
                          ) : versionHistory.length === 0 ? (
                            <div className="text-center py-4">
                              <GitBranch className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                              <p className={cn("text-sm", textSecondary)}>No version history yet. Edit with "Save as New Version" to create versions.</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {versionHistory.map((version) => (
                                <div key={version.versionNumber} className={cn(
                                  "rounded-lg border p-3 flex items-center justify-between transition-colors",
                                  isDark ? "border-white/[0.06]" : "border-slate-200",
                                  viewingVersion === version.versionNumber && (isGold ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-300")
                                )}>
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline" className={cn(
                                      "text-xs font-bold border",
                                      version.versionNumber === versionHistory[0]?.versionNumber
                                        ? isGold ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-amber-100 text-amber-700 border-amber-200"
                                        : isDark ? "bg-slate-500/15 text-slate-400 border-slate-500/25" : "bg-slate-100 text-slate-600 border-slate-200"
                                    )}>
                                      v{version.versionNumber}
                                    </Badge>
                                    <div>
                                      <p className={cn("text-sm font-medium", textPrimary)}>{version.title}</p>
                                      <p className={cn("text-xs", textSecondary)}>
                                        {formatDate(version.createdAt)} {version.createdBy !== "system" && `· by ${version.createdBy}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {version.totalCost != null && (
                                      <span className={cn("text-xs font-semibold", isGold ? "text-amber-400" : "text-amber-600")}>
                                        {formatCurrency(version.totalCost, selectedProposal?.currencySymbol)}
                                      </span>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={cn(
                                        "h-7 text-xs gap-1",
                                        viewingVersion === version.versionNumber ? "text-amber-500" : "text-slate-400"
                                      )}
                                      onClick={() => handleViewVersion(version)}
                                      disabled={viewingVersion === version.versionNumber}
                                    >
                                      <Eye className="h-3 w-3" />
                                      {viewingVersion === version.versionNumber ? "Current View" : "View"}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                </TabsContent>

                <TabsContent value="actions" className="mt-4 space-y-4">
                  {/* Quick Actions */}
                  <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                    <CardContent className="p-4">
                      <h3 className={cn("text-sm font-semibold mb-3", textPrimary)}>Quick Actions</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedProposal.status === "draft" && (
                          <Button
                            onClick={() => handleSend(selectedProposal)}
                            disabled={actionLoading}
                            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Send Proposal
                          </Button>
                        )}
                        <Button
                          onClick={() => handleGeneratePDF(selectedProposal)}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          size="sm"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </Button>
                        {selectedProposal.totalCost != null && selectedProposal.totalCost > 0 && selectedProposal.paymentStatus !== "paid" && (
                          <Button
                            onClick={() => handleRequestPayment(selectedProposal)}
                            disabled={paymentLoading === selectedProposal.id}
                            className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
                            size="sm"
                          >
                            <CreditCard className={cn("h-3.5 w-3.5", paymentLoading === selectedProposal.id && "animate-pulse")} />
                            {paymentLoading === selectedProposal.id ? "Generating..." : "Request Payment"}
                          </Button>
                        )}
                        {selectedProposal.paymentStatus === "paid" && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-sm font-medium">Paid{selectedProposal.paidAt ? ` on ${formatDate(selectedProposal.paidAt)}` : ""}</span>
                            {selectedProposal.paymentAmount != null && (
                              <span className="text-sm font-semibold">
                                ({formatCurrency(selectedProposal.paymentAmount, selectedProposal.currencySymbol)})
                              </span>
                            )}
                          </div>
                        )}
                        <Button
                          onClick={() => openShareDialog(selectedProposal, "whatsapp")}
                          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Share via WhatsApp
                        </Button>
                        <Button
                          onClick={() => openShareDialog(selectedProposal, "email")}
                          className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                          size="sm"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Share via Email
                        </Button>
                        <Button
                          onClick={() => handleDelete(selectedProposal)}
                          disabled={actionLoading}
                          variant="outline"
                          className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                          size="sm"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Acceptance Workflow */}
                  <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                    <CardContent className="p-4">
                      <h3 className={cn("text-sm font-semibold mb-3", textPrimary)}>Acceptance Workflow</h3>
                      <div className="space-y-3">
                        {/* Terms Acceptance */}
                        <div className={cn("rounded-lg border p-3", isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-slate-200 bg-white")}>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="terms-accepted"
                              checked={termsAccepted}
                              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                              disabled={selectedProposal.status === "accepted"}
                            />
                            <div className="flex-1">
                              <Label htmlFor="terms-accepted" className={cn("text-sm font-medium cursor-pointer", textPrimary)}>
                                Terms Accepted
                              </Label>
                              <p className={cn("text-xs mt-0.5", textSecondary)}>
                                Confirm the client has reviewed and agreed to all terms, pricing, and scope outlined in this proposal.
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Accept/Reject Actions */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleAcceptProposal(selectedProposal)}
                            disabled={actionLoading || !termsAccepted || selectedProposal.status === "accepted"}
                            className={cn(
                              "gap-2 text-white",
                              selectedProposal.status === "accepted"
                                ? "bg-emerald-600"
                                : "bg-emerald-600 hover:bg-emerald-700"
                            )}
                            size="sm"
                          >
                            <Handshake className="h-3.5 w-3.5" />
                            {selectedProposal.status === "accepted" ? "Accepted" : "Accept Proposal"}
                          </Button>
                          <Button
                            onClick={() => setRejectDialogOpen(true)}
                            disabled={actionLoading || selectedProposal.status === "rejected"}
                            variant="outline"
                            className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                            size="sm"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            {selectedProposal.status === "rejected" ? "Rejected" : "Reject Proposal"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Status Update */}
                  <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                    <CardContent className="p-4">
                      <h3 className={cn("text-sm font-semibold mb-3", textPrimary)}>Quick Status Change</h3>
                      <div className="flex flex-wrap gap-2">
                        {PROPOSAL_STATUSES.filter((s) => s.value !== selectedProposal.status && s.value !== "accepted" && s.value !== "rejected").map((s) => (
                          <Button
                            key={s.value}
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleUpdateStatus(selectedProposal.id, s.value)}
                            disabled={actionLoading}
                          >
                            {s.label}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Timeline */}
                  <Card className={cn(isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                    <CardContent className="p-4">
                      <h3 className={cn("text-sm font-semibold mb-3", textPrimary)}>Activity Timeline</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-amber-500" />
                          <p className={cn("text-sm", textSecondary)}>
                            Created - <span className="text-slate-400">{formatDate(selectedProposal.createdAt)}</span>
                          </p>
                        </div>
                        {selectedProposal.sentAt && (
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                            <p className={cn("text-sm", textSecondary)}>
                              Sent - <span className="text-slate-400">{formatDate(selectedProposal.sentAt)}</span>
                            </p>
                          </div>
                        )}
                        {selectedProposal.viewedAt && (
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-yellow-500" />
                            <p className={cn("text-sm", textSecondary)}>
                              Viewed - <span className="text-slate-400">{formatDate(selectedProposal.viewedAt)}</span>
                            </p>
                          </div>
                        )}
                        {selectedProposal.respondedAt && (
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-2 w-2 rounded-full",
                              selectedProposal.status === "accepted" ? "bg-emerald-500" : "bg-red-500"
                            )} />
                            <p className={cn("text-sm", textSecondary)}>
                              {selectedProposal.status === "accepted" ? "Accepted" : "Rejected"} -{" "}
                              <span className="text-slate-400">{formatDate(selectedProposal.respondedAt)}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { setRejectDialogOpen(open); if (!open) setRejectReason(""); }}>
        <DialogContent className={cn("max-w-md", isDark && "bg-slate-900 border-slate-700")}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              <DialogTitle className={textPrimary}>Reject Proposal</DialogTitle>
            </div>
            <p className={cn("text-sm mt-1", textSecondary)}>
              Please provide a reason for rejecting this proposal. This will be recorded for future reference.
            </p>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className={textSecondary}>Rejection Reason</Label>
              <Textarea
                placeholder="Enter the reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className={cn(isDark && "bg-slate-800 border-slate-600")}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={handleRejectProposal}
                disabled={actionLoading || !rejectReason.trim()}
                className="gap-2 bg-red-600 hover:bg-red-700 text-white"
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Proposal Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setSelectedProposal(null); setSaveAsNewVersion(false); } }}>
        <DialogContent className={cn("max-w-3xl max-h-[90vh] overflow-y-auto", isDark && "bg-slate-900 border-slate-700")}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-amber-500" />
              <DialogTitle className={textPrimary}>Edit Proposal</DialogTitle>
            </div>
          </DialogHeader>

          <Tabs defaultValue="basic" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="basic" className="flex-1">Basic Info</TabsTrigger>
              <TabsTrigger value="content" className="flex-1">Content Editor</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={textSecondary}>Client Name *</Label>
                  <Input value={editForm.clientName} onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className={textSecondary}>Client Email *</Label>
                  <Input type="email" value={editForm.clientEmail} onChange={(e) => setEditForm({ ...editForm, clientEmail: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={textSecondary}>Company</Label>
                  <Input value={editForm.clientCompany} onChange={(e) => setEditForm({ ...editForm, clientCompany: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className={textSecondary}>Phone</Label>
                  <Input value={editForm.clientPhone} onChange={(e) => setEditForm({ ...editForm, clientPhone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={textSecondary}>Proposal Type *</Label>
                  <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {PROPOSAL_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className={textSecondary}>Title *</Label>
                  <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className={textSecondary}>Total Cost</Label>
                  <Input type="number" value={editForm.totalCost} onChange={(e) => setEditForm({ ...editForm, totalCost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className={textSecondary}>Currency</Label>
                  <Select value={editForm.currency} onValueChange={(v) => {
                    const cur = CURRENCY_OPTIONS.find((c) => c.value === v);
                    setEditForm({ ...editForm, currency: v, currencySymbol: cur?.symbol || v });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className={textSecondary}>Valid Until</Label>
                  <Input type="date" value={editForm.validUntil} onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className={textSecondary}>Notes (Internal)</Label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
              </div>
            </TabsContent>

            <TabsContent value="content" className="mt-4 space-y-6">
              {/* Executive Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={cn("text-sm font-semibold", textPrimary)}>Executive Summary</Label>
                  <span className={cn("text-xs", textSecondary)}>Custom summary for the PDF</span>
                </div>
                <Textarea
                  value={editForm.executiveSummary}
                  onChange={(e) => setEditForm({ ...editForm, executiveSummary: e.target.value })}
                  placeholder="Leave blank to use default template summary..."
                  rows={4}
                  className="text-sm"
                />
              </div>

              {/* Scope of Work */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className={cn("text-sm font-semibold", textPrimary)}>Scope of Work Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 h-7 text-xs"
                    onClick={() => setEditForm({ ...editForm, scopeItems: [...editForm.scopeItems, { title: "", description: "" }] })}
                  >
                    <PlusCircle className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {editForm.scopeItems.map((item, idx) => (
                    <div key={idx} className={cn("rounded-lg border p-3 space-y-2", isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-slate-50")}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-medium", textSecondary)}>Item {idx + 1}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => setEditForm({ ...editForm, scopeItems: editForm.scopeItems.filter((_, i) => i !== idx) })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input placeholder="Title" value={item.title} onChange={(e) => {
                        const updated = [...editForm.scopeItems];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setEditForm({ ...editForm, scopeItems: updated });
                      }} className="h-8 text-sm" />
                      <Textarea placeholder="Description" value={item.description} onChange={(e) => {
                        const updated = [...editForm.scopeItems];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setEditForm({ ...editForm, scopeItems: updated });
                      }} rows={2} className="text-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline / Milestones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className={cn("text-sm font-semibold", textPrimary)}>Timeline / Milestones</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 h-7 text-xs"
                    onClick={() => setEditForm({ ...editForm, timelineItems: [...editForm.timelineItems, { phase: "", title: "", duration: "" }] })}
                  >
                    <PlusCircle className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {editForm.timelineItems.map((item, idx) => (
                    <div key={idx} className={cn("rounded-lg border p-3 space-y-2", isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-slate-50")}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-medium", textSecondary)}>Milestone {idx + 1}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => setEditForm({ ...editForm, timelineItems: editForm.timelineItems.filter((_, i) => i !== idx) })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Phase (e.g. Week 1-2)" value={item.phase} onChange={(e) => {
                          const updated = [...editForm.timelineItems];
                          updated[idx] = { ...updated[idx], phase: e.target.value };
                          setEditForm({ ...editForm, timelineItems: updated });
                        }} className="h-8 text-sm" />
                        <Input placeholder="Duration" value={item.duration} onChange={(e) => {
                          const updated = [...editForm.timelineItems];
                          updated[idx] = { ...updated[idx], duration: e.target.value };
                          setEditForm({ ...editForm, timelineItems: updated });
                        }} className="h-8 text-sm" />
                      </div>
                      <Input placeholder="Title" value={item.title} onChange={(e) => {
                        const updated = [...editForm.timelineItems];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setEditForm({ ...editForm, timelineItems: updated });
                      }} className="h-8 text-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className={cn("text-sm font-semibold", textPrimary)}>Pricing Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 h-7 text-xs"
                    onClick={() => setEditForm({ ...editForm, pricingItems: [...editForm.pricingItems, { item: "", description: "", amount: "" }] })}
                  >
                    <PlusCircle className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {editForm.pricingItems.map((item, idx) => (
                    <div key={idx} className={cn("rounded-lg border p-3 space-y-2", isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-slate-50")}>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-medium", textSecondary)}>Pricing {idx + 1}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => setEditForm({ ...editForm, pricingItems: editForm.pricingItems.filter((_, i) => i !== idx) })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Item name" value={item.item} onChange={(e) => {
                          const updated = [...editForm.pricingItems];
                          updated[idx] = { ...updated[idx], item: e.target.value };
                          setEditForm({ ...editForm, pricingItems: updated });
                        }} className="h-8 text-sm" />
                        <Input placeholder="Amount (e.g. Rs. 50,000)" value={item.amount} onChange={(e) => {
                          const updated = [...editForm.pricingItems];
                          updated[idx] = { ...updated[idx], amount: e.target.value };
                          setEditForm({ ...editForm, pricingItems: updated });
                        }} className="h-8 text-sm" />
                      </div>
                      <Textarea placeholder="Description" value={item.description} onChange={(e) => {
                        const updated = [...editForm.pricingItems];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setEditForm({ ...editForm, pricingItems: updated });
                      }} rows={2} className="text-sm" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Terms & Conditions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={cn("text-sm font-semibold", textPrimary)}>Custom Terms & Conditions</Label>
                  <span className={cn("text-xs", textSecondary)}>Leave blank to use default terms</span>
                </div>
                <Textarea
                  value={editForm.customTerms}
                  onChange={(e) => setEditForm({ ...editForm, customTerms: e.target.value })}
                  placeholder="Custom terms and conditions text for the PDF..."
                  rows={5}
                  className="text-sm"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Save as New Version Toggle */}
          <div className={cn("rounded-lg border p-3 mt-2", isDark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-200 bg-amber-50")}>
            <div className="flex items-start gap-3">
              <Checkbox
                id="save-as-new-version"
                checked={saveAsNewVersion}
                onCheckedChange={(checked) => setSaveAsNewVersion(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="save-as-new-version" className={cn("text-sm font-medium cursor-pointer", textPrimary)}>
                  Save as New Version
                </Label>
                <p className={cn("text-xs mt-0.5", textSecondary)}>
                  Creates a new version (keeps previous version in history). Uncheck to overwrite the current version.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleEditSave} disabled={saving} className={cn(
              saveAsNewVersion
                ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                : "bg-amber-600 hover:bg-amber-700 text-white"
            )}>
              <GitBranch className="h-3.5 w-3.5" />
              {saving ? "Saving..." : saveAsNewVersion ? "Save as New Version" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Preview Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={(open) => { setShareDialogOpen(open); if (!open) setSelectedProposal(null); }}>
        <DialogContent className={cn("max-w-lg max-h-[90vh] overflow-y-auto", isDark && "bg-slate-900 border-slate-700")}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-amber-500" />
              <DialogTitle className={textPrimary}>Share Proposal</DialogTitle>
            </div>
            <p className={cn("text-sm mt-1", textSecondary)}>
              Preview and send the proposal to {selectedProposal?.clientName}
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Method Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={shareMethod === "whatsapp" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "gap-2",
                  shareMethod === "whatsapp"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : isDark ? "border-slate-600 text-slate-300" : ""
                )}
                onClick={() => {
                  if (selectedProposal) {
                    setShareMethod("whatsapp");
                    setShareMessage(buildWhatsAppMessage(selectedProposal));
                    setShareSubject("");
                  }
                }}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
              <Button
                variant={shareMethod === "email" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "gap-2",
                  shareMethod === "email"
                    ? "bg-sky-600 hover:bg-sky-700 text-white"
                    : isDark ? "border-slate-600 text-slate-300" : ""
                )}
                onClick={() => {
                  if (selectedProposal) {
                    setShareMethod("email");
                    const { subject, body } = buildEmailBody(selectedProposal);
                    setShareSubject(subject);
                    setShareMessage(body);
                  }
                }}
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </Button>
            </div>

            {/* Email Subject (only for email) */}
            {shareMethod === "email" && shareSubject && (
              <div className="space-y-1.5">
                <Label className={cn("text-xs font-medium", textSecondary)}>Subject</Label>
                <Input
                  value={shareSubject}
                  onChange={(e) => setShareSubject(e.target.value)}
                  className={cn("text-sm", isDark && "bg-slate-800 border-slate-600")}
                />
              </div>
            )}

            {/* Message Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className={cn("text-xs font-medium", textSecondary)}>
                  {shareMethod === "whatsapp" ? "WhatsApp Message" : "Email Body"}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleCopyShareMessage}
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                rows={10}
                className={cn("text-sm resize-none", isDark && "bg-slate-800 border-slate-600")}
              />
            </div>

            {/* Recipient Info */}
            {selectedProposal && (
              <div className={cn("rounded-lg p-3 text-xs space-y-1", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                <p className={cn("font-medium", textPrimary)}>Recipient Details</p>
                <div className={cn("space-y-0.5", textSecondary)}>
                  <p>Name: {selectedProposal.clientName}</p>
                  <p>Email: {selectedProposal.clientEmail || "Not provided"}</p>
                  <p>Phone: {selectedProposal.clientPhone || "Not provided"}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <DialogClose asChild>
                <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
              </DialogClose>
              {shareMethod === "whatsapp" ? (
                <Button
                  onClick={() => handleShareWhatsApp()}
                  className="w-full sm:w-auto gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageSquare className="h-4 w-4" />
                  Send via WhatsApp
                </Button>
              ) : (
                <Button
                  onClick={() => handleShareEmail()}
                  className="w-full sm:w-auto gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                >
                  <Mail className="h-4 w-4" />
                  Send via Email
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
