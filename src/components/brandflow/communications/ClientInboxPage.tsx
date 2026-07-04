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
  MessageSquare, Send, Inbox, Pin, Archive,
  RefreshCw, Loader2, Building2, User, Mail, Clock, Paperclip,
  CheckCircle2, FileText, Calendar, Sparkles,
  TrendingUp, Receipt, Lightbulb, Bell, Tag,
  Search, X, Upload, CreditCard, ExternalLink,
} from "lucide-react";

// ── Types ──

interface MessageAction {
  id: string;
  label: string;
  type: "renew_subscription" | "upload_payment_proof" | "view_invoice" | "view_report" | "open_billing" | "dismiss" | "custom_url";
  payload?: Record<string, any>;
  style?: "primary" | "secondary" | "danger" | "ghost";
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
  // Phase 16
  actions?: MessageAction[] | null;
  metadata?: Record<string, any> | null;
  isSystemMessage?: boolean;
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
  deadlineDate: string | null;
  attachments: any[];
}

// ── Category config (mirrors admin) ──

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  deadline: { label: "Deadline", icon: Calendar, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  subscription_features: { label: "Subscription", icon: Sparkles, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  document: { label: "Document", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  improvements: { label: "Improvements", icon: Lightbulb, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  invoice: { label: "Invoice", icon: Receipt, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  report: { label: "Report", icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  onboarding: { label: "Onboarding", icon: User, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30" },
  billing: { label: "Billing", icon: Receipt, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  general: { label: "General", icon: MessageSquare, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30" },
};

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

export function ClientInboxPage() {
  const { organization, appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Reply state
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const inputBg = isDark ? "border-white/[0.1] bg-white/[0.03]" : "";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const textMuted = isDark ? "text-slate-500" : "text-slate-400";

  // ── Fetch inbox ──
  const fetchInbox = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterUnread) params.set("unreadOnly", "true");

      const res = await fetchWithAuth(`/api/communications/inbox?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      } else {
        toast.error("Failed to load inbox");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [organization?.id, filterCategory, filterUnread]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Filter by search
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter((t) =>
      t.subject.toLowerCase().includes(q) ||
      t.messages.some((m) => m.body.toLowerCase().includes(q))
    );
  }, [threads, searchQuery]);

  // ── Open a thread ──
  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setThreadMessages([]);
    setLoadingThread(true);
    try {
      const firstMsg = thread.messages[0];
      if (!firstMsg) {
        setThreadMessages([]);
        setLoadingThread(false);
        return;
      }
      const res = await fetchWithAuth(`/api/communications/${firstMsg.id}`);
      if (res.ok) {
        const data = await res.json();
        setThreadMessages(data.thread || []);
        // Mark as read locally
        setThreads((prev) =>
          prev.map((t) =>
            t.threadId === thread.threadId
              ? { ...t, unreadCount: 0, messages: data.thread || t.messages }
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

  // ── Phase 16: Handle action button click on a message ──
  // Routes the action to the right surface (navigation, modal, or external URL).
  const handleMessageAction = async (msg: Message, action: MessageAction) => {
    if (!action || !action.type) return;
    const payload = action.payload || {};
    switch (action.type) {
      case "open_billing": {
        // Navigate to the Billing & Plans page (subscriptions)
        const { setActiveSection } = useValtrioxStore.getState();
        setActiveSection("subscriptions");
        toast.success("Opening Billing & Plans…");
        break;
      }
      case "renew_subscription": {
        // Navigate to subscriptions and pre-fill the renewal form
        const { setActiveSection } = useValtrioxStore.getState();
        setActiveSection("subscriptions");
        // Stash the pre-fill payload in sessionStorage so the subscriptions
        // page can pick it up after the route switch.
        try {
          sessionStorage.setItem(
            "pendingRenewalPrefill",
            JSON.stringify({
              planId: payload.planId,
              amount: payload.amount,
              billingCycle: payload.billingCycle,
              sourceMessageId: msg.id,
              sourceThreadId: msg.threadId,
            })
          );
        } catch {}
        toast.success("Opening subscription renewal form…");
        break;
      }
      case "upload_payment_proof": {
        const { setActiveSection } = useValtrioxStore.getState();
        setActiveSection("subscriptions");
        try {
          sessionStorage.setItem(
            "pendingPaymentUpload",
            JSON.stringify({
              planId: payload.planId,
              amount: payload.amount,
              billingCycle: payload.billingCycle,
              invoiceId: payload.invoiceId,
              sourceMessageId: msg.id,
              sourceThreadId: msg.threadId,
            })
          );
        } catch {}
        toast.success("Opening payment upload form…");
        break;
      }
      case "view_invoice": {
        const { setActiveSection } = useValtrioxStore.getState();
        setActiveSection("invoice-management");
        try {
          sessionStorage.setItem("pendingInvoiceId", String(payload.invoiceId || ""));
        } catch {}
        toast.success("Opening invoice…");
        break;
      }
      case "view_report": {
        const { setActiveSection } = useValtrioxStore.getState();
        setActiveSection("reports");
        try {
          sessionStorage.setItem("pendingReportId", String(payload.reportId || ""));
        } catch {}
        toast.success("Opening report…");
        break;
      }
      case "custom_url": {
        if (payload.url) {
          window.open(String(payload.url), "_blank", "noopener,noreferrer");
        }
        break;
      }
      case "dismiss": {
        // No-op: just visually dismiss the action row by marking it
        toast.info("Action dismissed");
        break;
      }
      default:
        toast.error(`Unknown action: ${action.type}`);
    }
  };

  // ── Reply ──
  const handleReply = async () => {
    if (!selectedThread || !replyBody.trim()) {
      toast.error("Reply body is required");
      return;
    }
    setReplying(true);
    try {
      const lastMsg = selectedThread.messages[selectedThread.messages.length - 1];
      const res = await fetchWithAuth(`/api/communications/${lastMsg.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Reply sent to Valtriox admin");
        setReplyBody("");
        setThreadMessages((prev) => [...prev, data.reply]);
        await fetchInbox();
      } else {
        toast.error(data.error || "Failed to send reply");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setReplying(false);
    }
  };

  const stats = useMemo(() => ({
    total: threads.length,
    unread: threads.reduce((s, t) => s + t.unreadCount, 0),
    pinned: threads.filter((t) => t.isPinned).length,
    deadlines: threads.filter((t) => t.category === "deadline").length,
  }), [threads]);

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className={cn("text-2xl font-bold tracking-tight flex items-center gap-2", textPrimary)}>
            <Inbox className="h-6 w-6 text-amber-500" />
            Messages from Valtriox
          </h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Communications from Muhammad Ashir Raza · Deadlines · Documents · Plan updates · Improvements
          </p>
        </div>
        <Button variant="outline" onClick={fetchInbox} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Inbox className="h-4 w-4 text-amber-400" />
              <p className={cn("text-xs", textSecondary)}>Total</p>
            </div>
            <p className={cn("text-xl font-bold", textPrimary)}>{stats.total}</p>
          </CardContent>
        </Card>
        <Card className={cardBg}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-rose-400" />
              <p className={cn("text-xs", textSecondary)}>Unread</p>
            </div>
            <p className="text-xl font-bold text-rose-400">{stats.unread}</p>
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

      {/* Filters */}
      <Card className={cardBg}>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
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
        </CardContent>
      </Card>

      {/* 2-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 min-h-[600px]">
        {/* Thread list */}
        <Card className={cn(cardBg, "lg:max-h-[80vh] lg:overflow-y-auto")}>
          <CardHeader className="pb-2 sticky top-0 bg-inherit z-10 backdrop-blur-sm">
            <CardTitle className="text-sm flex items-center gap-2">
              <Inbox className="h-4 w-4 text-amber-500" /> Inbox
              <Badge variant="outline" className="ml-auto text-xs">
                {filteredThreads.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 mx-auto animate-spin text-amber-400" />
                <p className={cn("text-xs mt-2", textSecondary)}>Loading…</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="h-8 w-8 mx-auto text-amber-400/40 mb-2" />
                <p className={cn("text-sm font-medium", textPrimary)}>No messages yet</p>
                <p className={cn("text-xs mt-1", textSecondary)}>
                  Messages from Valtriox admin will appear here.
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
                              {thread.unreadCount > 0 && (
                                <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] px-1.5 py-0">
                                  {thread.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className={cn("text-xs mt-0.5", textSecondary)}>
                              {fmtRelative(thread.lastMessageAt)}
                            </p>
                            {lastMsg && (
                              <p className={cn("text-xs mt-1 truncate", textMuted)}>
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
              <p className={cn("text-base font-medium", textPrimary)}>Select a message</p>
              <p className={cn("text-sm mt-1", textSecondary)}>
                Choose a message from the left to read it.
              </p>
            </CardContent>
          ) : loadingThread ? (
            <CardContent className="p-12 text-center">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-amber-400" />
              <p className={cn("text-xs mt-2", textSecondary)}>Loading…</p>
            </CardContent>
          ) : (
            <>
              {/* Header */}
              <CardHeader className="pb-3 border-b border-amber-500/10 sticky top-0 bg-inherit z-10 backdrop-blur-sm">
                <div className="flex items-start gap-3">
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
                    </div>
                    <CardTitle className="text-base">
                      {selectedThread.subject}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <User className="h-3.5 w-3.5" />
                      From Valtriox Admin · {fmtRelative(selectedThread.lastMessageAt)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="p-4 space-y-4">
                {threadMessages.length === 0 ? (
                  <p className={cn("text-sm text-center py-8", textSecondary)}>
                    No messages.
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
                            {/* Phase 16: Action buttons */}
                            {Array.isArray(msg.actions) && msg.actions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {msg.actions.map((action: MessageAction, ai: number) => {
                                  const style = action.style || "primary";
                                  const baseBtn =
                                    "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all hover:scale-[1.02] active:scale-[0.98]";
                                  const styleCls =
                                    style === "primary"
                                      ? "bg-amber-500 hover:bg-amber-400 text-charcoal"
                                      : style === "secondary"
                                      ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                                      : style === "danger"
                                      ? "bg-rose-500 hover:bg-rose-400 text-white"
                                      : "bg-transparent hover:bg-white/5 text-slate-400 border border-white/10";
                                  const iconFor = (t: string) => {
                                    if (t === "renew_subscription") return <RefreshCw className="h-3 w-3" />;
                                    if (t === "upload_payment_proof") return <Upload className="h-3 w-3" />;
                                    if (t === "view_invoice") return <Receipt className="h-3 w-3" />;
                                    if (t === "view_report") return <FileText className="h-3 w-3" />;
                                    if (t === "open_billing") return <CreditCard className="h-3 w-3" />;
                                    if (t === "custom_url") return <ExternalLink className="h-3 w-3" />;
                                    return <Sparkles className="h-3 w-3" />;
                                  };
                                  return (
                                    <button
                                      key={action.id || ai}
                                      type="button"
                                      onClick={() => handleMessageAction(msg, action)}
                                      className={cn(baseBtn, styleCls)}
                                    >
                                      {iconFor(action.type)}
                                      {action.label}
                                    </button>
                                  );
                                })}
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
                    placeholder="Reply to Valtriox admin…"
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
                    Reply
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
    </div>
  );
}
