// @ts-nocheck — Phase 8: pre-existing TS errors pending migration
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  MessageSquare, Send, Plus, Inbox, Pin, Archive, Trash2,
  RefreshCw, Loader2, Building2, User, Mail, Clock, Paperclip,
  AlertCircle, CheckCircle2, FileText, Calendar, Sparkles,
  TrendingUp, Receipt, Package, Lightbulb, Bell, Tag,
  ChevronRight, Star, Search, X, Reply,
} from "lucide-react";

// ── Types ──

interface OrgOption {
  id: string;
  name: string;
  email: string | null;
  plan: string;
  country: string | null;
  currency: string;
  createdAt: string;
}

interface Message {
  id: string;
  threadId: string;
  direction: "admin_to_client" | "client_to_admin";
  senderName: string;
  senderEmail: string;
  senderRole: string;
  category: string;
  subject: string;
  body: string;
  attachments: any[] | null;
  priority: string;
  isReadByAdmin: boolean;
  isReadByClient: boolean;
  isPinned: boolean;
  isArchived: boolean;
  sentAt: string;
  readAt: string | null;
  deadlineDate: string | null;
  scheduledFor: string | null;
  relatedInvoiceId: string | null;
  relatedReportId: string | null;
}

interface Thread {
  threadId: string;
  subject: string;
  category: string;
  priority: string;
  isPinned: boolean;
  messages: Message[];
  lastMessageAt: string;
  unreadCount: number;
  unreadAdminCount: number;
  unreadClientCount: number;
  deadlineDate: string | null;
  attachments: any[];
  organization?: {
    id: string;
    name: string;
    email: string | null;
    plan: string;
    country: string | null;
  };
  categories: string[];
}

// ── Category config ──

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string; description: string }> = {
  deadline: {
    label: "Monthly Deadline",
    icon: Calendar,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    description: "Deadline reminder (e.g. monthly plan renewal, deliverables)",
  },
  subscription_features: {
    label: "Subscription / Features",
    icon: Sparkles,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    description: "Share plan details, features, upgrade options",
  },
  document: {
    label: "Document Sharing",
    icon: FileText,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    description: "Share contracts, agreements, onboarding docs",
  },
  improvements: {
    label: "Improvements / Feedback",
    icon: Lightbulb,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    description: "Share improvement notes, before/after comparisons",
  },
  invoice: {
    label: "Invoice",
    icon: Receipt,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    description: "Invoice notification, payment status",
  },
  report: {
    label: "Report Sharing",
    icon: TrendingUp,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    description: "Share sales, orders, tax reports",
  },
  onboarding: {
    label: "Onboarding",
    icon: User,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    description: "Welcome messages, onboarding checklist",
  },
  billing: {
    label: "Billing",
    icon: Receipt,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    description: "Billing questions, payment methods",
  },
  general: {
    label: "General",
    icon: MessageSquare,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    description: "General professional communication",
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "text-slate-400", bg: "bg-slate-500/15" },
  normal: { label: "Normal", color: "text-blue-400", bg: "bg-blue-500/15" },
  high: { label: "High", color: "text-amber-400", bg: "bg-amber-500/15" },
  urgent: { label: "Urgent", color: "text-rose-400", bg: "bg-rose-500/15" },
};

// ── Helpers ──

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtRelative(s: string | null | undefined): string {
  if (!s) return "—";
  const diff = Date.now() - new Date(s).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(s).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
}

// ── Main Component ──

export function CommunicationCenterPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  const [threads, setThreads] = useState<Thread[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  // Compose dialog
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Filters
  const [filterOrg, setFilterOrg] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Reply state
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const inputBg = isDark ? "border-white/[0.1] bg-white/[0.03]" : "";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const textMuted = isDark ? "text-slate-500" : "text-slate-400";

  // ── Fetch orgs (for client picker) ──
  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/communications/send");
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.organizations || []);
      }
    } catch {
      // best-effort
    }
  }, []);

  // ── Fetch threads ──
  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterOrg) params.set("orgId", filterOrg);
      if (filterCategory) params.set("category", filterCategory);
      if (filterUnread) params.set("unreadOnly", "true");

      const res = await fetchWithAuth(`/api/admin/communications/threads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      } else {
        toast.error("Failed to load threads");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [filterOrg, filterCategory, filterUnread]);

  useEffect(() => {
    fetchThreads();
    fetchOrgs();
  }, [fetchThreads, fetchOrgs]);

  // ── Filter threads by search query ──
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter((t) => {
      const orgName = t.organization?.name || "";
      return (
        t.subject.toLowerCase().includes(q) ||
        orgName.toLowerCase().includes(q) ||
        t.messages.some((m) => m.body.toLowerCase().includes(q))
      );
    });
  }, [threads, searchQuery]);

  // ── Open a thread ──
  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setSelectedMessage(null);
    setThreadMessages([]);
    setLoadingThread(true);
    try {
      // Use the first message ID to fetch the full thread
      const firstMsg = thread.messages[0];
      if (!firstMsg) {
        setThreadMessages([]);
        setLoadingThread(false);
        return;
      }
      const res = await fetchWithAuth(`/api/admin/communications/${firstMsg.id}`);
      if (res.ok) {
        const data = await res.json();
        setThreadMessages(data.thread || []);
        setSelectedMessage(data.message || null);
        // Update thread in list — mark as read
        setThreads((prev) =>
          prev.map((t) =>
            t.threadId === thread.threadId
              ? { ...t, unreadAdminCount: 0, messages: data.thread || t.messages }
              : t
          )
        );
      }
    } catch {
      toast.error("Failed to load thread");
    } finally {
      setLoadingThread(false);
    }
  };

  // ── Thread actions (pin, archive, mark-read, delete) ──
  const handleThreadAction = async (
    thread: Thread,
    action: "pin" | "unpin" | "archive" | "unarchive" | "mark_read" | "mark_unread" | "delete"
  ) => {
    const firstMsg = thread.messages[0];
    if (!firstMsg) return;
    const key = `${action}-${thread.threadId}`;
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetchWithAuth(`/api/admin/communications/${firstMsg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scope: "thread" }),
      });
      const data = await res.json();
      if (res.ok) {
        if (action === "delete") {
          setThreads((prev) => prev.filter((t) => t.threadId !== thread.threadId));
          if (selectedThread?.threadId === thread.threadId) {
            setSelectedThread(null);
            setThreadMessages([]);
          }
          toast.success("Thread deleted");
        } else if (action === "archive") {
          setThreads((prev) => prev.filter((t) => t.threadId !== thread.threadId));
          toast.success("Thread archived");
        } else {
          // Update thread in-place
          setThreads((prev) =>
            prev.map((t) => {
              if (t.threadId !== thread.threadId) return t;
              const updated = { ...t };
              if (action === "pin") updated.isPinned = true;
              if (action === "unpin") updated.isPinned = false;
              if (action === "mark_read") updated.unreadAdminCount = 0;
              return updated;
            })
          );
          toast.success(`Thread ${action.replace("_", " ")}`);
        }
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  };

  // ── Reply to thread (admin continues conversation) ──
  const handleReply = async () => {
    if (!selectedThread || !replyBody.trim()) {
      toast.error("Reply body is required");
      return;
    }
    setReplying(true);
    try {
      const firstMsg = selectedThread.messages[0];
      const lastMsg = selectedThread.messages[selectedThread.messages.length - 1] || firstMsg;
      const res = await fetchWithAuth("/api/admin/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedThread.organization?.id,
          category: selectedThread.category,
          subject: `Re: ${selectedThread.subject}`,
          body: replyBody.trim(),
          priority: selectedThread.priority || "normal",
          threadId: selectedThread.threadId,
          parentMessageId: lastMsg.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Reply sent");
        setReplyBody("");
        // Add to thread view
        setThreadMessages((prev) => [...prev, data.message]);
        // Refresh threads list
        await fetchThreads();
      } else {
        toast.error(data.error || "Failed to send reply");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setReplying(false);
    }
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const totalUnread = threads.reduce((s, t) => s + (t.unreadAdminCount || 0), 0);
    const pinned = threads.filter((t) => t.isPinned).length;
    const deadlines = threads.filter((t) => t.category === "deadline").length;
    return { total: threads.length, totalUnread, pinned, deadlines };
  }, [threads]);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className={cn("text-2xl font-bold tracking-tight flex items-center gap-2", textPrimary)}>
            <MessageSquare className="h-6 w-6 text-amber-500" />
            Client Communication Center
          </h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Professional threaded messaging between Valtriox admin and clients · Deadlines · Documents · Plans · Improvements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchThreads} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            onClick={() => setComposeOpen(true)}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="h-4 w-4" /> New Message
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Inbox className="h-4 w-4 text-amber-400" />
              <p className={cn("text-xs", textSecondary)}>Total Threads</p>
            </div>
            <p className={cn("text-xl font-bold", textPrimary)}>{stats.total}</p>
          </CardContent>
        </Card>
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-rose-400" />
              <p className={cn("text-xs", textSecondary)}>Unread Replies</p>
            </div>
            <p className="text-xl font-bold text-rose-400">{stats.totalUnread}</p>
          </CardContent>
        </Card>
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Pin className="h-4 w-4 text-amber-400" />
              <p className={cn("text-xs", textSecondary)}>Pinned</p>
            </div>
            <p className="text-xl font-bold text-amber-400">{stats.pinned}</p>
          </CardContent>
        </Card>
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-rose-400" />
              <p className={cn("text-xs", textSecondary)}>Deadlines</p>
            </div>
            <p className="text-xl font-bold text-rose-400">{stats.deadlines}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters bar */}
      <Card className={cardBg}>
        <CardContent className="p-3 flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by subject, org name, or message content…"
              className={cn("pl-9", inputBg)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterOrg || "all"} onValueChange={(v) => setFilterOrg(v === "all" ? "" : v)}>
              <SelectTrigger className={cn("w-[200px]", inputBg)}>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}>
              <SelectTrigger className={cn("w-[180px]", inputBg)}>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([k, c]) => (
                  <SelectItem key={k} value={k}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={filterUnread ? "default" : "outline"}
              onClick={() => setFilterUnread(!filterUnread)}
              className="gap-1.5"
            >
              <Bell className="h-3.5 w-3.5" /> Unread
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main 2-pane layout: thread list + conversation view */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 min-h-[600px]">
        {/* Thread list */}
        <Card className={cn(cardBg, "lg:max-h-[80vh] lg:overflow-y-auto")}>
          <CardHeader className="pb-2 sticky top-0 bg-inherit z-10 backdrop-blur-sm">
            <CardTitle className="text-sm flex items-center gap-2">
              <Inbox className="h-4 w-4 text-amber-500" /> Conversations
              <Badge variant="outline" className="ml-auto text-xs">
                {filteredThreads.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 mx-auto animate-spin text-amber-400" />
                <p className={cn("text-xs mt-2", textSecondary)}>Loading threads…</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-amber-400/40 mb-2" />
                <p className={cn("text-sm font-medium", textPrimary)}>No conversations yet</p>
                <p className={cn("text-xs mt-1", textSecondary)}>
                  Click <span className="text-amber-500">New Message</span> to start.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredThreads.map((thread) => {
                  const cat = CATEGORY_CONFIG[thread.category] || CATEGORY_CONFIG.general;
                  const Icon = cat.icon;
                  const lastMsg = thread.messages[thread.messages.length - 1];
                  const isSelected = selectedThread?.threadId === thread.threadId;
                  return (
                    <motion.div
                      key={thread.threadId}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <button
                        onClick={() => openThread(thread)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-colors",
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/40"
                            : "bg-transparent border-transparent hover:bg-amber-500/5 hover:border-amber-500/20"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className={cn("rounded-md p-1.5 shrink-0", cat.bg, cat.border, "border")}>
                            <Icon className={cn("h-3.5 w-3.5", cat.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {thread.isPinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                              <p className={cn("text-sm font-semibold truncate flex-1", textPrimary)}>
                                {thread.subject}
                              </p>
                              {thread.unreadAdminCount > 0 && (
                                <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] px-1.5 py-0">
                                  {thread.unreadAdminCount}
                                </Badge>
                              )}
                            </div>
                            <p className={cn("text-xs mt-0.5 truncate", textSecondary)}>
                              {thread.organization?.name || "—"} · {fmtRelative(thread.lastMessageAt)}
                            </p>
                            {lastMsg && (
                              <p className={cn("text-xs mt-1 truncate", textMuted)}>
                                <span className={cn(lastMsg.direction === "admin_to_client" ? "text-amber-500/70" : "text-emerald-500/70")}>
                                  {lastMsg.direction === "admin_to_client" ? "→" : "←"}
                                </span>{" "}
                                {lastMsg.body.slice(0, 80)}
                              </p>
                            )}
                            {thread.deadlineDate && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-400">
                                <Calendar className="h-2.5 w-2.5" />
                                Due: {new Date(thread.deadlineDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </CardContent>
        </Card>

        {/* Conversation view */}
        <Card className={cn(cardBg, "lg:max-h-[80vh] lg:overflow-y-auto")}>
          {!selectedThread ? (
            <CardContent className="p-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-amber-400/30 mb-3" />
              <p className={cn("text-base font-medium", textPrimary)}>Select a conversation</p>
              <p className={cn("text-sm mt-1", textSecondary)}>
                Choose a thread from the left to view its full history.
              </p>
              <Button
                onClick={() => setComposeOpen(true)}
                className="mt-4 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Plus className="h-4 w-4" /> Start New Conversation
              </Button>
            </CardContent>
          ) : loadingThread ? (
            <CardContent className="p-12 text-center">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-amber-400" />
              <p className={cn("text-xs mt-2", textSecondary)}>Loading conversation…</p>
            </CardContent>
          ) : (
            <>
              {/* Conversation header */}
              <CardHeader className="pb-3 border-b border-amber-500/10 sticky top-0 bg-inherit z-10 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {(() => {
                        const cat = CATEGORY_CONFIG[selectedThread.category] || CATEGORY_CONFIG.general;
                        const Icon = cat.icon;
                        return (
                          <Badge className={cn("gap-1 text-xs", cat.bg, cat.color, cat.border, "border")}>
                            <Icon className="h-3 w-3" /> {cat.label}
                          </Badge>
                        );
                      })()}
                      {selectedThread.isPinned && (
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-xs">
                          <Pin className="h-3 w-3" /> Pinned
                        </Badge>
                      )}
                      <Badge className={cn("text-xs", PRIORITY_CONFIG[selectedThread.priority]?.bg, PRIORITY_CONFIG[selectedThread.priority]?.color)}>
                        {PRIORITY_CONFIG[selectedThread.priority]?.label || "Normal"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base flex items-start gap-2">
                      {selectedThread.subject}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {selectedThread.organization?.name || "—"}
                      {selectedThread.organization?.email && (
                        <>
                          <Separator orientation="vertical" className="h-3" />
                          <Mail className="h-3.5 w-3.5" />
                          {selectedThread.organization.email}
                        </>
                      )}
                      <Separator orientation="vertical" className="h-3" />
                      <Tag className="h-3.5 w-3.5" />
                          {selectedThread.organization?.plan || "—"} plan
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => handleThreadAction(selectedThread, selectedThread.isPinned ? "unpin" : "pin")}
                      disabled={actionLoading[`pin-${selectedThread.threadId}`] || actionLoading[`unpin-${selectedThread.threadId}`]}
                      title={selectedThread.isPinned ? "Unpin" : "Pin"}
                      className="h-8 w-8 p-0"
                    >
                      <Pin className={cn("h-3.5 w-3.5", selectedThread.isPinned ? "text-amber-500 fill-amber-500" : "")} />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => handleThreadAction(selectedThread, "archive")}
                      disabled={actionLoading[`archive-${selectedThread.threadId}`]}
                      title="Archive"
                      className="h-8 w-8 p-0"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => {
                        if (confirm("Delete this entire thread? This cannot be undone.")) {
                          handleThreadAction(selectedThread, "delete");
                        }
                      }}
                      disabled={actionLoading[`delete-${selectedThread.threadId}`]}
                      title="Delete"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="p-4 space-y-4">
                {threadMessages.length === 0 ? (
                  <p className={cn("text-sm text-center py-8", textSecondary)}>
                    No messages in this thread.
                  </p>
                ) : (
                  threadMessages.map((msg) => {
                    const isAdmin = msg.direction === "admin_to_client";
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={cn("flex gap-3", isAdmin ? "flex-row" : "flex-row-reverse")}
                      >
                        <div className={cn(
                          "shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold",
                          isAdmin
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        )}>
                          {(msg.senderName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className={cn("flex-1 min-w-0 max-w-[80%]", !isAdmin && "text-right")}>
                          <div className={cn(
                            "inline-block rounded-lg p-3 text-left",
                            isAdmin
                              ? "bg-amber-500/10 border border-amber-500/20"
                              : "bg-emerald-500/10 border border-emerald-500/20"
                          )}>
                            <div className="flex items-center gap-2 mb-1">
                              <p className={cn("text-xs font-semibold", isAdmin ? "text-amber-300" : "text-emerald-300")}>
                                {msg.senderName}
                              </p>
                              <span className={cn("text-[10px]", textMuted)}>
                                {fmtRelative(msg.sentAt)}
                              </span>
                              {!isAdmin && !msg.isReadByAdmin && (
                                <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-[9px] px-1 py-0">
                                  New
                                </Badge>
                              )}
                              {isAdmin && msg.isReadByClient && (
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              )}
                            </div>
                            <p className={cn("text-sm whitespace-pre-wrap break-words", textPrimary)}>
                              {msg.body}
                            </p>
                            {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {msg.attachments.map((att: any, i: number) => (
                                  <div key={i} className={cn(
                                    "flex items-center gap-2 text-xs p-1.5 rounded border",
                                    isDark ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200"
                                  )}>
                                    <Paperclip className="h-3 w-3 text-amber-400" />
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline truncate">
                                      {att.name}
                                    </a>
                                    {att.size && (
                                      <span className={cn("text-[10px]", textMuted)}>
                                        ({Math.round(att.size / 1024)} KB)
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {msg.deadlineDate && (
                              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded p-1.5">
                                <Calendar className="h-3 w-3" />
                                Deadline: {fmtDateTime(msg.deadlineDate)}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </CardContent>

              {/* Reply box */}
              <div className="border-t border-amber-500/10 p-3 sticky bottom-0 bg-inherit backdrop-blur-sm">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type a reply to continue this conversation…"
                    rows={2}
                    className={cn("flex-1 resize-none", inputBg)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                  <Button
                    onClick={handleReply}
                    disabled={replying || !replyBody.trim()}
                    className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </Button>
                </div>
                <p className={cn("text-[10px] mt-1", textMuted)}>
                  Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px]">⌘/Ctrl + Enter</kbd> to send
                </p>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Compose Dialog ── */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        orgs={orgs}
        sending={sending}
        onSend={async (payload) => {
          setSending(true);
          try {
            const res = await fetchWithAuth("/api/admin/communications/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok) {
              toast.success("Message sent to client");
              setComposeOpen(false);
              await fetchThreads();
            } else {
              toast.error(data.error || "Failed to send");
            }
          } catch {
            toast.error("Network error");
          } finally {
            setSending(false);
          }
        }}
        isDark={isDark}
        inputBg={inputBg}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />
    </div>
  );
}

// ── Compose Dialog Sub-Component ──

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgs: OrgOption[];
  sending: boolean;
  onSend: (payload: any) => Promise<void>;
  isDark: boolean;
  inputBg: string;
  textPrimary: string;
  textSecondary: string;
}

function ComposeDialog({
  open, onOpenChange, orgs, sending, onSend, isDark, inputBg, textPrimary, textSecondary,
}: ComposeDialogProps) {
  const [orgId, setOrgId] = useState("");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; size: number; type: string }>>([]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setOrgId("");
      setCategory("general");
      setSubject("");
      setBody("");
      setPriority("normal");
      setDeadlineDate("");
      setAttachmentName("");
      setAttachmentUrl("");
      setAttachments([]);
    }
  }, [open]);

  // When category changes, prefill subject/body templates
  useEffect(() => {
    if (!open) return;
    const cat = CATEGORY_CONFIG[category];
    if (!cat) return;
    if (category === "deadline" && !subject) {
      setSubject("Monthly Deadline Reminder");
      setBody(`Hi,\n\nThis is a friendly reminder that your monthly deadline is approaching.\n\nDeadline: [INSERT DATE]\nAction needed: [INSERT ACTION]\n\nPlease let us know if you need any assistance.\n\nBest regards,\nMuhammad Ashir Raza\nValtriox`);
    } else if (category === "subscription_features" && !subject) {
      setSubject("Your Valtriox Subscription Plan & Features");
      setBody(`Hi,\n\nHere are the details of your current Valtriox subscription plan:\n\nPlan: [PLAN NAME]\nFeatures included:\n- Feature 1\n- Feature 2\n- Feature 3\n\nLet me know if you'd like to upgrade or have any questions.\n\nBest regards,\nMuhammad Ashir Raza\nValtriox`);
    } else if (category === "document" && !subject) {
      setSubject("Document Sharing");
      setBody(`Hi,\n\nPlease find the document attached below.\n\nDocument: [NAME]\nPurpose: [PURPOSE]\n\nLet me know if you have any questions.\n\nBest regards,\nMuhammad Ashir Raza\nValtriox`);
    } else if (category === "improvements" && !subject) {
      setSubject("Valtriox Improvements & Updates");
      setBody(`Hi,\n\nI wanted to share some improvements we've made to Valtriox that benefit your account:\n\n1. [Improvement 1]\n2. [Improvement 2]\n3. [Improvement 3]\n\nThese updates are now live on your dashboard.\n\nBest regards,\nMuhammad Ashir Raza\nValtriox`);
    } else if (category === "onboarding" && !subject) {
      setSubject("Welcome to Valtriox");
      setBody(`Hi,\n\nWelcome to Valtriox! We're excited to have you on board.\n\nHere's what's next:\n1. Complete your brand profile\n2. Add your first products\n3. Set up your team\n4. Explore the dashboard\n\nLet me know if you need any help getting started.\n\nBest regards,\nMuhammad Ashir Raza\nValtriox`);
    }
  }, [category, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const addAttachment = () => {
    if (!attachmentName.trim() || !attachmentUrl.trim()) return;
    setAttachments((prev) => [
      ...prev,
      {
        name: attachmentName.trim(),
        url: attachmentUrl.trim(),
        size: 0,
        type: "link",
      },
    ]);
    setAttachmentName("");
    setAttachmentUrl("");
  };

  const removeAttachment = (i: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSend = () => {
    if (!orgId) {
      toast.error("Please select a client");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }
    onSend({
      organizationId: orgId,
      category,
      subject: subject.trim(),
      body: body.trim(),
      priority,
      attachments: attachments.length > 0 ? attachments : undefined,
      deadlineDate: category === "deadline" && deadlineDate ? new Date(deadlineDate).toISOString() : undefined,
    });
  };

  const selectedOrg = orgs.find((o) => o.id === orgId);
  const cat = CATEGORY_CONFIG[category];
  const Icon = cat?.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-amber-500" />
            New Client Communication
          </DialogTitle>
          <DialogDescription>
            Send a professional message to a client. Choose a category, write your message, and optionally attach links or schedule deadline reminders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client picker */}
          <div>
            <Label className="text-xs flex items-center gap-1.5 mb-1.5">
              <Building2 className="h-3 w-3" /> Select Client Organization *
            </Label>
            <Select value={orgId || "_none"} onValueChange={(v) => v !== "_none" && setOrgId(v)}>
              <SelectTrigger className={inputBg}>
                <SelectValue placeholder="Choose a client…" />
              </SelectTrigger>
              <SelectContent>
                {orgs.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    No clients available — register one first
                  </SelectItem>
                ) : (
                  orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} — {o.email || "no email"} · {o.plan}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedOrg && (
              <div className={cn("mt-2 p-2 rounded-md text-xs flex items-center gap-3", isDark ? "bg-white/[0.03]" : "bg-slate-50")}>
                <Building2 className="h-3.5 w-3.5 text-amber-400" />
                <span className={textPrimary}>{selectedOrg.name}</span>
                <span className={textSecondary}>·</span>
                <span className={textSecondary}>{selectedOrg.plan} plan</span>
                {selectedOrg.country && (
                  <>
                    <span className={textSecondary}>·</span>
                    <span className={textSecondary}>{selectedOrg.country}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Category picker */}
          <div>
            <Label className="text-xs flex items-center gap-1.5 mb-1.5">
              <Tag className="h-3 w-3" /> Category *
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(CATEGORY_CONFIG).map(([k, c]) => {
                const CatIcon = c.icon;
                const isSelected = category === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCategory(k)}
                    className={cn(
                      "text-left p-2 rounded-md border text-xs transition-all",
                      isSelected
                        ? cn(c.bg, c.border, "border")
                        : isDark
                          ? "bg-white/[0.02] border-white/10 hover:border-amber-500/30"
                          : "bg-white border-slate-200 hover:border-amber-500/30"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CatIcon className={cn("h-3.5 w-3.5", isSelected ? c.color : textSecondary)} />
                      <span className={cn("font-medium", isSelected ? c.color : textPrimary)}>
                        {c.label}
                      </span>
                    </div>
                    <p className={cn("text-[10px] leading-snug", textSecondary)}>
                      {c.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className={inputBg}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, p]) => (
                    <SelectItem key={k} value={k}>
                      <span className={p.color}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {category === "deadline" && (
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Deadline Date
                </Label>
                <Input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className={inputBg}
                />
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <Label className="text-xs">Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief subject line"
              className={inputBg}
            />
          </div>

          {/* Body */}
          <div>
            <Label className="text-xs">Message Body *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={8}
              className={cn(inputBg, "resize-y")}
            />
            <p className={cn("text-[10px] mt-1", textSecondary)}>
              Tip: Use line breaks for readability. The message will be displayed as plain text in the client's inbox.
            </p>
          </div>

          {/* Attachments (links) */}
          <div>
            <Label className="text-xs flex items-center gap-1.5 mb-1.5">
              <Paperclip className="h-3 w-3" /> Attachments (optional links)
            </Label>
            <div className="space-y-2">
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att, i) => (
                    <div key={i} className={cn(
                      "flex items-center justify-between p-2 rounded text-xs",
                      isDark ? "bg-white/[0.03]" : "bg-slate-50"
                    )}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-3 w-3 text-amber-400 shrink-0" />
                        <span className={cn("truncate", textPrimary)}>{att.name}</span>
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline truncate text-[10px]">
                          {att.url}
                        </a>
                      </div>
                      <button
                        onClick={() => removeAttachment(i)}
                        className="text-red-500 hover:text-red-400 shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <Input
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="Name (e.g. Contract.pdf)"
                  className={cn(inputBg, "h-8 text-xs")}
                />
                <Input
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://… (link to file)"
                  className={cn(inputBg, "h-8 text-xs")}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addAttachment}
                  disabled={!attachmentName.trim() || !attachmentUrl.trim()}
                  className="gap-1 h-8"
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            </div>
          </div>

          {/* Preview card */}
          <div className={cn(
            "rounded-lg border p-3 space-y-2",
            isDark ? "bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02] border-amber-500/20" : "bg-amber-50 border-amber-200"
          )}>
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-amber-500" />}
              <p className="text-xs font-semibold text-amber-500">Preview</p>
            </div>
            <div className="text-xs space-y-1">
              <p className={cn("font-medium", textPrimary)}>
                To: {selectedOrg?.name || <span className={textSecondary}>— select client —</span>}
              </p>
              <p className={cn("font-medium", textPrimary)}>
                Subject: {subject || <span className={textSecondary}>— enter subject —</span>}
              </p>
              {category === "deadline" && deadlineDate && (
                <p className="text-rose-400">
                  Deadline: {new Date(deadlineDate).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !orgId || !subject.trim() || !body.trim()}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
