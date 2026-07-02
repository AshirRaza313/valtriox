// @ts-nocheck — Phase 8: pre-existing TS errors (Decimal/Prisma types, etc.) pending migration
"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  Download,
  Trash2,
  Eye,
  Phone,
  Mail,
  Building,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// ─── Types ──────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  consultationType: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  timezone: string | null;
  availabilityNote: string | null;
  status: string;
  source: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  converted: number;
}

// ─── Status Config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; goldColor: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700", goldColor: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  contacted: { label: "Contacted", color: "bg-yellow-100 text-yellow-700", goldColor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" },
  qualified: { label: "Qualified", color: "bg-green-100 text-green-700", goldColor: "bg-green-500/15 text-green-400 border-green-500/25" },
  consultation_scheduled: { label: "Consultation", color: "bg-purple-100 text-purple-700", goldColor: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
  proposal_sent: { label: "Proposal", color: "bg-amber-100 text-amber-700", goldColor: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  converted: { label: "Converted", color: "bg-emerald-100 text-emerald-700", goldColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  archived: { label: "Archived", color: "bg-gray-100 text-gray-700", goldColor: "bg-slate-500/15 text-slate-400 border-slate-500/25" },
};

const ALL_STATUSES = ["all", "new", "contacted", "qualified", "consultation_scheduled", "proposal_sent", "converted", "archived"];

const getStatusBadge = (status: string, isGold: boolean) => {
  const config = STATUS_CONFIG[status] || { label: status, color: "bg-slate-100 text-slate-600", goldColor: "bg-slate-500/15 text-slate-400 border-slate-500/25" };
  return isGold ? config.goldColor : config.color;
};

// ─── Main Component ────────────────────────────────────────────────────

export function LeadsManagementPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  // ── State ──
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats>({ total: 0, new: 0, contacted: 0, converted: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  // ─── Fetch leads ──────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetchWithAuth(`/api/admin/leads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      setLeads(data.leads || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const resAll = await fetchWithAuth("/api/admin/leads?limit=1");
      if (resAll.ok) {
        const dataAll = await resAll.json();
        const total = dataAll.total || 0;

        const [resNew, resContacted, resConverted] = await Promise.all([
          fetch("/api/admin/leads?status=new&limit=1"),
          fetch("/api/admin/leads?status=contacted&limit=1"),
          fetch("/api/admin/leads?status=converted&limit=1"),
        ]);

        const [dataNew, dataContacted, dataConverted] = await Promise.all([
          resNew.ok ? resNew.json() : { total: 0 },
          resContacted.ok ? resContacted.json() : { total: 0 },
          resConverted.ok ? resConverted.json() : { total: 0 },
        ]);

        setStats({
          total,
          new: dataNew.total || 0,
          contacted: dataContacted.total || 0,
          converted: dataConverted.total || 0,
        });
      }
    } catch (err) {
      console.error("[LeadsManagementPage] Failed to fetch lead stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  // ─── Actions ──────────────────────────────────────────────────────────
  const updateStatus = async (leadId: string, newStatus: string) => {
    try {
      const res = await fetchWithAuth("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success("Lead status updated");
      fetchLeads();
      fetchStats();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const saveNotes = async (leadId: string) => {
    try {
      const res = await fetchWithAuth("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, notes: notesValue }),
      });
      if (!res.ok) throw new Error("Failed to save notes");
      toast.success("Notes saved");
      setEditingNotes(null);
      fetchLeads();
    } catch {
      toast.error("Failed to save notes");
    }
  };

  const deleteLead = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/admin/leads?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete lead");
      toast.success("Lead deleted");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchLeads();
      fetchStats();
    } catch {
      toast.error("Failed to delete lead");
    }
  };

  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Company", "Consultation Type", "Preferred Date", "Preferred Time", "Status", "Source", "Notes", "Created"];
    const rows = leads.map((l) => [
      l.fullName, l.email, l.phone || "", l.company || "", l.consultationType || "",
      l.preferredDate || "", l.preferredTime || "", l.status, l.source,
      (l.notes || "").replace(/"/g, '""'), l.createdAt,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  // ─── Format helpers ──────────────────────────────────────────────────
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", textPrimary)}>Leads Management</h1>
          <p className={cn("text-sm mt-0.5", textSecondary)}>Track and manage your incoming leads</p>
        </div>
        <Button variant="outline" onClick={() => { fetchLeads(); fetchStats(); }} disabled={loading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats.total, icon: Users, accent: "from-slate-500 to-slate-600" },
          { label: "New", value: stats.new, icon: Mail, accent: "from-blue-500 to-blue-600" },
          { label: "Contacted", value: stats.contacted, icon: Phone, accent: "from-yellow-500 to-yellow-600" },
          { label: "Converted", value: stats.converted, icon: Building, accent: "from-emerald-500 to-emerald-600" },
        ].map((stat) => (
          <Card key={stat.label} className={cn(cardBg)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center", stat.accent)}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", textPrimary)}>{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters & Search ── */}
      <Card className={cn(cardBg)}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[170px] text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All Statuses" : STATUS_CONFIG[s]?.label || s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV} disabled={leads.length === 0}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.06] hover:bg-transparent" : ""}>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Phone</TableHead>
                  <TableHead className="text-xs">Company</TableHead>
                  <TableHead className="text-xs">Consultation</TableHead>
                  <TableHead className="text-xs">Preferred</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j} className="py-3">
                          <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-10 w-10 text-slate-300" />
                        <p className={cn("text-sm font-medium", textPrimary)}>No leads found</p>
                        <p className="text-xs text-slate-400">Leads will appear here when visitors submit the contact form.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead, i) => (
                    <AnimatePresence key={lead.id}>
                      <>
                        <tr
                          className={cn(
                            "border-b transition-colors cursor-pointer",
                            isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-slate-100 hover:bg-slate-50"
                          )}
                          onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                        >
                          <TableCell className="py-3">
                            <p className={cn("text-sm font-medium", textPrimary)}>{lead.fullName}</p>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm text-slate-400">{lead.email}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm text-slate-400">{lead.phone || "Not provided"}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm text-slate-400">{lead.company || "Not provided"}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs text-slate-400">{lead.consultationType?.replace(/_/g, " ") || "Not provided"}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs text-slate-400">
                              {lead.preferredDate ? formatDate(lead.preferredDate) : "Not provided"}
                              {lead.preferredTime ? ` ${lead.preferredTime}` : ""}
                            </span>
                          </TableCell>
                          <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                            <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                              <SelectTrigger className={cn("h-7 w-[130px] text-[11px] border", getStatusBadge(lead.status, isGold))}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ALL_STATUSES.filter((s) => s !== "all").map((s) => (
                                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs text-slate-400">{formatDate(lead.createdAt)}</span>
                          </TableCell>
                          <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                                title="Toggle details"
                              >
                                {expandedId === lead.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-400"
                                onClick={() => { setDeleteTarget(lead); setDeleteDialogOpen(true); }}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </tr>
                        {/* Expanded row */}
                        {expandedId === lead.id && (
                          <tr
                          >
                            <TableCell colSpan={9} className={cn("px-6 py-4", isDark ? "bg-white/[0.02]" : "bg-slate-50/50")}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <h4 className={cn("text-xs font-semibold uppercase tracking-wider text-slate-400")}>Details</h4>
                                  {lead.message && (
                                    <div className={cn("rounded-lg p-3", isDark ? "bg-white/[0.03]" : "bg-white border border-slate-200")}>
                                      <div className="flex items-center gap-1.5 mb-1">
                                        <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="text-xs font-medium text-slate-400">Message</span>
                                      </div>
                                      <p className={cn("text-sm", textPrimary)}>{lead.message}</p>
                                    </div>
                                  )}
                                  <div className={cn("rounded-lg p-3", isDark ? "bg-white/[0.03]" : "bg-white border border-slate-200")}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                      <span className="text-xs font-medium text-slate-400">Scheduling</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div><span className="text-slate-400">Timezone:</span> <span className={textPrimary}>{lead.timezone || "Not provided"}</span></div>
                                      <div><span className="text-slate-400">Source:</span> <span className={textPrimary}>{lead.source}</span></div>
                                    </div>
                                    {lead.availabilityNote && (
                                      <div className="mt-2">
                                        <span className="text-slate-400 text-xs">Availability:</span>
                                        <p className={cn("text-xs mt-0.5", textPrimary)}>{lead.availabilityNote}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <h4 className={cn("text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5")}>
                                    <StickyNote className="h-3.5 w-3.5" />
                                    Notes
                                  </h4>
                                  {editingNotes === lead.id ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={notesValue}
                                        onChange={(e) => setNotesValue(e.target.value)}
                                        className="text-sm min-h-[80px]"
                                        placeholder="Add notes about this lead..."
                                      />
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={() => saveNotes(lead.id)} className="h-7">Save</Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingNotes(null)} className="h-7">Cancel</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={cn("rounded-lg p-3 cursor-pointer transition-colors", isDark ? "bg-white/[0.03] hover:bg-white/[0.05]" : "bg-white border border-slate-200 hover:bg-slate-50")} onClick={() => { setEditingNotes(lead.id); setNotesValue(lead.notes || ""); }}>
                                      <p className={cn("text-sm", lead.notes ? textPrimary : "text-slate-400")}>
                                        {lead.notes || "Click to add notes..."}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </tr>
                        )}
                      </>
                    </AnimatePresence>
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
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <Users className="h-10 w-10 text-slate-300" />
                <p className={cn("text-sm font-medium", textPrimary)}>No leads found</p>
              </div>
            ) : leads.map((lead) => (
              <div
                key={lead.id}
                className={cn(
                  "rounded-lg border p-3 cursor-pointer transition-colors",
                  isDark ? "border-white/[0.06] hover:bg-white/[0.02]" : "border-slate-200 hover:bg-slate-50"
                )}
                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-blue-500 to-blue-600")}>
                      {lead.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={cn("text-sm font-semibold", textPrimary)}>{lead.fullName}</p>
                      <p className="text-[11px] text-slate-400">{lead.company || lead.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] border", getStatusBadge(lead.status, isGold))}>
                    {STATUS_CONFIG[lead.status]?.label || lead.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>
                  {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                </div>
                {expandedId === lead.id && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2" onClick={(e) => e.stopPropagation()}>
                    {lead.message && (
                      <p className={cn("text-xs", textPrimary)}><MessageSquare className="h-3 w-3 inline mr-1 text-slate-400" />{lead.message}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                        <SelectTrigger className={cn("h-7 w-[130px] text-[11px] border", getStatusBadge(lead.status, isGold))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.filter((s) => s !== "all").map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { setDeleteTarget(lead); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <p className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={textPrimary}>Delete Lead</DialogTitle>
          </DialogHeader>
          <p className={cn("text-sm", textSecondary)}>
            Are you sure you want to delete <span className="font-semibold text-white">{deleteTarget?.fullName}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteLead}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
