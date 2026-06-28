"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Bell,
  Clock,
  AlertTriangle,
  Mail,
  Send,
  CheckCircle2,
  RefreshCw,
  Shield,
  Building2,
  Phone,
  Users,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { isPlatformRole } from "@/lib/roles";

// ─── Types ──────────────────────────────────────────────────────────────

interface ReminderItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  industry: string | null;
  interest: string | null;
  status: string;
  source: string;
  message: string | null;
  notes: string | null;
  consultationType: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  timezone: string | null;
  calendlyBookingLink: string | null;
  createdAt: string;
  updatedAt: string;
  daysUntil?: number;
  daysSinceFollowUp?: number;
  followUpCount?: number;
  lastFollowUpAt?: string | null;
}

interface ReminderStats {
  total: number;
  upcoming: number;
  overdue: number;
  followUpDue: number;
}

type TabFilter = "all" | "upcoming" | "overdue" | "followUpDue";

// ─── Helpers ────────────────────────────────────────────────────────────

function getRelativeDate(dateStr: string | null, daysUntil?: number): string {
  if (!dateStr) return "No date set";
  if (daysUntil !== undefined) {
    if (daysUntil === 0) return "Today";
    if (daysUntil === 1) return "Tomorrow";
    if (daysUntil === -1) return "Yesterday";
    if (daysUntil > 0 && daysUntil <= 7) return `In ${daysUntil} days`;
    if (daysUntil < 0 && daysUntil >= -7) return `${Math.abs(daysUntil)} days ago`;
    if (daysUntil < -7) return `${Math.abs(daysUntil)} days ago`;
  }
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getStatusBadge(status: string, isGold: boolean) {
  const config: Record<string, { label: string; gold: string; light: string }> = {
    consultation_scheduled: {
      label: "Scheduled",
      gold: "bg-purple-500/15 text-purple-400 border-purple-500/25",
      light: "bg-purple-100 text-purple-700",
    },
    contacted: {
      label: "Contacted",
      gold: "bg-amber-500/15 text-amber-400 border-amber-500/25",
      light: "bg-amber-100 text-amber-700",
    },
    qualified: {
      label: "Qualified",
      gold: "bg-green-500/15 text-green-400 border-green-500/25",
      light: "bg-green-100 text-green-700",
    },
    new: {
      label: "New",
      gold: "bg-blue-500/15 text-blue-400 border-blue-500/25",
      light: "bg-blue-100 text-blue-700",
    },
    converted: {
      label: "Converted",
      gold: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
      light: "bg-emerald-100 text-emerald-700",
    },
    proposal_sent: {
      label: "Proposal Sent",
      gold: "bg-sky-500/15 text-sky-400 border-sky-500/25",
      light: "bg-sky-100 text-sky-700",
    },
  };
  const c = config[status] || { label: status, gold: "bg-slate-500/15 text-slate-400 border-slate-500/25", light: "bg-slate-100 text-slate-600" };
  return isGold ? c.gold : c.light;
}

function getCategoryBadge(category: string, isGold: boolean) {
  const config: Record<string, { label: string; gold: string }> = {
    upcoming: {
      label: "Upcoming",
      gold: "bg-green-500/15 text-green-400 border border-green-500/25",
    },
    overdue: {
      label: "Overdue",
      gold: "bg-red-500/15 text-red-400 border border-red-500/25",
    },
    followUpDue: {
      label: "Follow-up Due",
      gold: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    },
  };
  const c = config[category] || { label: category, gold: "bg-slate-500/15 text-slate-400 border border-slate-500/25" };
  return isGold ? c.gold : "";
}

// ─── Access Denied ─────────────────────────────────────────────────────

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
            This page is restricted to platform administrators only. Contact your system admin if you believe this is an error.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Loading Skeletons ───────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="bg-white/[0.03] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function ConsultationRemindersPage() {
  const { user, appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  // ── State ──
  const [stats, setStats] = useState<ReminderStats>({ total: 0, upcoming: 0, overdue: 0, followUpDue: 0 });
  const [allItems, setAllItems] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; leadId: string; action: string; name: string }>({
    open: false,
    leadId: "",
    action: "",
    name: "",
  });

  // ─── Fetch reminders ──────────────────────────────────────────────────
  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/consultation-reminders");
      if (!res.ok) throw new Error("Failed to fetch reminders");
      const data = await res.json();
      setStats(data.stats || { total: 0, upcoming: 0, overdue: 0, followUpDue: 0 });
      setAllItems([
        ...(data.upcoming || []).map((item: ReminderItem) => ({ ...item, _category: "upcoming" as const })),
        ...(data.overdue || []).map((item: ReminderItem) => ({ ...item, _category: "overdue" as const })),
        ...(data.followUpDue || []).map((item: ReminderItem) => ({ ...item, _category: "followUpDue" as const })),
      ]);
    } catch {
      toast.error("Failed to load consultation reminders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // ─── Actions ──────────────────────────────────────────────────────────
  const sendEmail = async (leadId: string, templateType: "reminder" | "follow_up" | "reschedule") => {
    setSendingId(leadId);
    try {
      const res = await fetchWithAuth("/api/admin/consultation-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, templateType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      toast.success(data.message || "Email sent successfully");
      fetchReminders();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send email");
    } finally {
      setSendingId(null);
    }
  };

  const markCompleted = async (leadId: string) => {
    setSendingId(leadId);
    try {
      const res = await fetchWithAuth("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: "converted" }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success("Lead marked as completed");
      fetchReminders();
    } catch {
      toast.error("Failed to update lead status");
    } finally {
      setSendingId(null);
    }
  };

  const markRescheduled = async (leadId: string) => {
    setSendingId(leadId);
    try {
      const res = await fetchWithAuth("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: "contacted" }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success("Lead marked as rescheduled");
      fetchReminders();
    } catch {
      toast.error("Failed to update lead status");
    } finally {
      setSendingId(null);
    }
  };

  // ─── Render Lead Card ──────────────────────────────────────────────────
  const renderLeadCard = (item: ReminderItem & { _category: string }, index: number) => {
    const dateLabel = getRelativeDate(item.preferredDate, item.daysUntil);
    const followUpLabel = item._category === "followUpDue" && item.daysSinceFollowUp
      ? `${item.daysSinceFollowUp} days since last activity`
      : undefined;

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className={cn(
          "rounded-xl border p-4 transition-colors",
          isDark ? "bg-[#12121a] border-white/[0.06] hover:bg-white/[0.04]" : "bg-white border-slate-200 hover:bg-slate-50"
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0",
              item._category === "upcoming" ? "bg-gradient-to-br from-green-500 to-emerald-600" :
              item._category === "overdue" ? "bg-gradient-to-br from-red-500 to-rose-600" :
              "bg-gradient-to-br from-amber-500 to-yellow-600"
            )}>
              {item.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-semibold truncate", textPrimary)}>{item.fullName}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 truncate">{item.company || item.email}</span>
                {item.company && <span className="text-[11px] text-slate-500">·</span>}
                {item.company && <span className="text-[11px] text-slate-400 truncate">{item.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <Badge variant="outline" className={cn("text-[10px] border", getCategoryBadge(item._category, isGold))}>
              {item._category === "followUpDue" ? "Follow-up" : item._category === "overdue" ? "Overdue" : "Upcoming"}
            </Badge>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-slate-400">
          {item.preferredDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dateLabel}
            </span>
          )}
          {item.preferredTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.preferredTime}
            </span>
          )}
          {item.consultationType && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {item.consultationType.replace(/_/g, " ")}
            </span>
          )}
          {item.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {item.phone}
            </span>
          )}
          {followUpLabel && (
            <span className="text-amber-400">{followUpLabel}</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {(item._category === "upcoming" || item._category === "overdue") && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-7 text-[11px] gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10",
                sendingId === item.id && "opacity-50 pointer-events-none"
              )}
              onClick={() => sendEmail(item.id, "reminder")}
              disabled={sendingId === item.id}
            >
              <Send className="h-3 w-3" />
              Send Reminder
            </Button>
          )}
          {item._category === "followUpDue" && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-7 text-[11px] gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
                sendingId === item.id && "opacity-50 pointer-events-none"
              )}
              onClick={() => sendEmail(item.id, "follow_up")}
              disabled={sendingId === item.id}
            >
              <Mail className="h-3 w-3" />
              Send Follow-up
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 text-[11px] gap-1 border-slate-500/30 text-slate-400 hover:bg-slate-500/10",
              sendingId === item.id && "opacity-50 pointer-events-none"
            )}
            onClick={() => {
              setConfirmDialog({
                open: true,
                leadId: item.id,
                action: "completed",
                name: item.fullName,
              });
            }}
            disabled={sendingId === item.id}
          >
            <CheckCircle2 className="h-3 w-3" />
            Mark Completed
          </Button>
          {(item._category === "upcoming" || item._category === "overdue") && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-7 text-[11px] gap-1 border-slate-500/30 text-slate-400 hover:bg-slate-500/10",
                sendingId === item.id && "opacity-50 pointer-events-none"
              )}
              onClick={() => sendEmail(item.id, "reschedule")}
              disabled={sendingId === item.id}
            >
              <RefreshCw className="h-3 w-3" />
              Reschedule
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  // ─── Empty State ──────────────────────────────────────────────────────
  const renderEmptyState = (filter: TabFilter) => {
    const configs: Record<string, { icon: typeof Calendar; title: string; desc: string }> = {
      all: { icon: Bell, title: "No Reminders", desc: "No consultation reminders at this time. Leads will appear here when consultations are scheduled or follow-ups are due." },
      upcoming: { icon: Calendar, title: "No Upcoming Consultations", desc: "No upcoming consultations scheduled in the next 7 days." },
      overdue: { icon: AlertTriangle, title: "No Overdue Consultations", desc: "No overdue consultations. Great job staying on top of your schedule!" },
      followUpDue: { icon: Clock, title: "No Follow-ups Due", desc: "No leads requiring follow-up at this time." },
    };
    const cfg = configs[filter];
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className={cn(
          "h-16 w-16 rounded-2xl flex items-center justify-center mb-4",
          isGold ? "bg-amber-500/10" : isDark ? "bg-white/5" : "bg-muted/50"
        )}>
          <cfg.icon className={cn(
            "h-8 w-8",
            isGold ? "text-amber-400/50" : isDark ? "text-slate-500/50" : "text-muted-foreground/50"
          )} />
        </div>
        <h3 className={cn("text-lg font-semibold mb-1", textPrimary)}>{cfg.title}</h3>
        <p className={cn("text-sm max-w-sm", textSecondary)}>{cfg.desc}</p>
      </div>
    );
  };

  // ─── Tab Content ─────────────────────────────────────────────────────
  const getFilteredItems = (filter: TabFilter) => {
    if (filter === "all") return allItems;
    return allItems.filter((item) => item._category === filter);
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            "bg-gradient-to-br from-amber-500 to-yellow-600"
          )}>
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className={cn("text-2xl font-bold", textPrimary)}>Consultation Reminders</h1>
            <p className={cn("text-sm mt-0.5", textSecondary)}>Track and manage consultation follow-ups</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={fetchReminders}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* ── Stats Cards ── */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Scheduled", value: stats.total, icon: Users, accent: "from-blue-500 to-blue-600", textColor: "text-blue-400" },
            { label: "Upcoming This Week", value: stats.upcoming, icon: Calendar, accent: "from-green-500 to-emerald-600", textColor: "text-green-400" },
            { label: "Overdue", value: stats.overdue, icon: AlertTriangle, accent: "from-red-500 to-rose-600", textColor: "text-red-400" },
            { label: "Follow-up Due", value: stats.followUpDue, icon: Clock, accent: "from-amber-500 to-yellow-600", textColor: "text-amber-400" },
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
      )}

      {/* ── Tab Filters ── */}
      <Card className={cn(cardBg)}>
        <CardContent className="p-4">
          <Tabs defaultValue="all" onValueChange={(v) => {}}>
            <TabsList className={cn(
              "w-full justify-start",
              isDark ? "bg-white/[0.04]" : "bg-slate-100"
            )}>
              <TabsTrigger value="all" className="gap-1.5 data-[state=active]:bg-[#D3A638] data-[state=active]:text-black">
                All
                {stats.total > 0 && (
                  <span className={cn(
                    "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                    isDark ? "bg-white/10" : "bg-slate-200"
                  )}>
                    {stats.total}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-1.5 data-[state=active]:bg-[#D3A638] data-[state=active]:text-black">
                Upcoming
                {stats.upcoming > 0 && (
                  <span className={cn(
                    "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                    isDark ? "bg-white/10" : "bg-slate-200"
                  )}>
                    {stats.upcoming}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="overdue" className="gap-1.5 data-[state=active]:bg-[#D3A638] data-[state=active]:text-black">
                Overdue
                {stats.overdue > 0 && (
                  <span className={cn(
                    "ml-1 text-[10px] px-1.5 py-0.5 rounded-full text-red-400",
                    isDark ? "bg-red-500/10" : "bg-red-50"
                  )}>
                    {stats.overdue}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="followUpDue" className="gap-1.5 data-[state=active]:bg-[#D3A638] data-[state=active]:text-black">
                Follow-up Due
                {stats.followUpDue > 0 && (
                  <span className={cn(
                    "ml-1 text-[10px] px-1.5 py-0.5 rounded-full text-amber-400",
                    isDark ? "bg-amber-500/10" : "bg-amber-50"
                  )}>
                    {stats.followUpDue}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Tab panels (rendered sequentially, only one visible at a time) */}
            {(["all", "upcoming", "overdue", "followUpDue"] as TabFilter[]).map((filter) => (
              <TabsContent key={filter} value={filter} className="mt-4">
                {loading ? (
                  <CardSkeleton />
                ) : getFilteredItems(filter).length === 0 ? (
                  renderEmptyState(filter)
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    <AnimatePresence mode="popLayout">
                      {getFilteredItems(filter).map((item, i) => renderLeadCard(item, i))}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Confirm Dialog ── */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={textPrimary}>Mark as Completed</DialogTitle>
            <DialogDescription className={textSecondary}>
              Are you sure you want to mark <span className="font-semibold text-white">{confirmDialog.name}</span>&apos;s consultation as completed? This will update their lead status to &quot;Converted&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                markCompleted(confirmDialog.leadId);
                setConfirmDialog({ open: false, leadId: "", action: "", name: "" });
              }}
            >
              Mark Completed
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
