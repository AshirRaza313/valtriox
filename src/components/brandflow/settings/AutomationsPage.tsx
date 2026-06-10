"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  Plus,
  RefreshCw,
  Play,
  Trash2,
  Edit3,
  ToggleLeft,
  ToggleRight,
  Clock,
  Mail,
  Send,
  Bell,
  FileCode,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// ─── Types ──────────────────────────────────────────────────────────────

interface AutomationTemplate {
  id: string;
  name: string;
  type: string;
}

interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  triggerConfig: string;
  templateId: string | null;
  template: AutomationTemplate | null;
  action: string;
  actionConfig: string;
  delayMinutes: number;
  enabled: boolean;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: "Lead Created",
  consultation_scheduled: "Consultation Scheduled",
  proposal_sent: "Proposal Sent",
  status_changed: "Status Changed",
  manual: "Manual Trigger",
};

const TRIGGER_COLORS: Record<string, string> = {
  lead_created: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  consultation_scheduled: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  proposal_sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  status_changed: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  manual: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

const ACTION_ICONS: Record<string, typeof Mail> = {
  send_email: Mail,
  send_whatsapp: Send,
  notify_admin: Bell,
};

// ─── Main Component ───────────────────────────────────────────────────────

export function AutomationsPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  // ── State ──
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null);
  const [editTarget, setEditTarget] = useState<Automation | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTrigger, setFormTrigger] = useState("lead_created");
  const [formTemplateId, setFormTemplateId] = useState<string>("none");
  const [formDelay, setFormDelay] = useState("0");
  const [formAction, setFormAction] = useState("send_email");
  const [saving, setSaving] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/automations");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAutomations(data.automations || []);
    } catch {
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/email-templates?limit=100");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
    fetchTemplates();
  }, [fetchAutomations, fetchTemplates]);

  // Auto-seed when no automations exist
  useEffect(() => {
    if (!loading && automations.length === 0) {
      seedDefaults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ─── Seed defaults ─────────────────────────────────────────────────────
  const seedDefaults = async () => {
    try {
      const res = await fetchWithAuth("/api/admin/seed-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedAutomations: true }),
      });
      if (!res.ok) throw new Error("Failed to seed");
      const data = await res.json();
      if (data.automationsCreated > 0) {
        toast.success(`Created ${data.automationsCreated} starter automations`);
        fetchAutomations();
        fetchTemplates();
      } else {
        toast.info("Automations already exist");
      }
    } catch {
      toast.error("Failed to seed automations");
    }
  };

  // ─── Reset form ────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormTrigger("lead_created");
    setFormTemplateId("none");
    setFormDelay("0");
    setFormAction("send_email");
  };

  // ─── Create ───────────────────────────────────────────────────────────
  const createAutomation = async () => {
    if (!formName) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription || null,
          trigger: formTrigger,
          templateId: formTemplateId === "none" ? null : formTemplateId,
          action: formAction,
          delayMinutes: parseInt(formDelay) || 0,
          enabled: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast.success("Automation created");
      setCreateDialogOpen(false);
      resetForm();
      fetchAutomations();
    } catch {
      toast.error("Failed to create automation");
    } finally {
      setSaving(false);
    }
  };

  // ─── Update ───────────────────────────────────────────────────────────
  const updateAutomation = async () => {
    if (!editTarget || !formName) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editTarget.id,
          name: formName,
          description: formDescription || null,
          trigger: formTrigger,
          templateId: formTemplateId === "none" ? null : formTemplateId,
          action: formAction,
          delayMinutes: parseInt(formDelay) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Automation updated");
      setEditDialogOpen(false);
      setEditTarget(null);
      resetForm();
      fetchAutomations();
    } catch {
      toast.error("Failed to update automation");
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle ───────────────────────────────────────────────────────────
  const toggleAutomation = async (automation: Automation) => {
    try {
      const res = await fetchWithAuth("/api/admin/automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: automation.id, toggleEnabled: true }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      toast.success(automation.enabled ? "Automation disabled" : "Automation enabled");
      fetchAutomations();
    } catch {
      toast.error("Failed to toggle automation");
    }
  };

  // ─── Run now ───────────────────────────────────────────────────────────
  const runNow = async (automation: Automation) => {
    try {
      const res = await fetchWithAuth("/api/admin/automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: automation.id, runNow: true }),
      });
      if (!res.ok) throw new Error("Failed to run");
      const data = await res.json();
      toast.success(data.message || `Automation "${automation.name}" triggered`);
      fetchAutomations();
    } catch {
      toast.error("Failed to run automation");
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────
  const deleteAutomation = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/admin/automations?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Automation deleted");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchAutomations();
    } catch {
      toast.error("Failed to delete automation");
    }
  };

  // ─── Open edit ────────────────────────────────────────────────────────
  const openEdit = (automation: Automation) => {
    setEditTarget(automation);
    setFormName(automation.name);
    setFormDescription(automation.description || "");
    setFormTrigger(automation.trigger);
    setFormTemplateId(automation.templateId || "none");
    setFormDelay(String(automation.delayMinutes));
    setFormAction(automation.action);
    setEditDialogOpen(true);
  };

  // ─── Format helpers ──────────────────────────────────────────────────
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return "Immediate";
    if (minutes < 60) return `${minutes} min`;
    if (minutes === 1440) return "1 day";
    if (minutes === 4320) return "3 days";
    if (minutes === 10080) return "7 days";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", textPrimary)}>Automations</h1>
          <p className={cn("text-sm mt-0.5", textSecondary)}>Configure automated actions triggered by lead events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
            New Automation
          </Button>
          <Button size="sm" className="gap-1.5" onClick={seedDefaults}>
            <FileCode className="h-3.5 w-3.5" />
            Seed Defaults
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAutomations} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Automation Cards ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("h-36 rounded-xl animate-pulse", isDark ? "bg-white/[0.03]" : "bg-slate-100")} />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <Card className={cn(cardBg)}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Zap className="h-12 w-12 text-slate-300 mb-3" />
            <p className={cn("text-sm font-medium", textPrimary)}>No automations yet</p>
            <p className="text-xs text-slate-400 mt-1">Click below to create starter automations or set up your own.</p>
            <Button size="sm" className="gap-1.5 mt-3" onClick={seedDefaults}>
              <FileCode className="h-3.5 w-3.5" />
              Seed Defaults
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {automations.map((automation, i) => {
            const ActionIcon = ACTION_ICONS[automation.action] || Zap;
            return (
              <motion.div
                key={automation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={cn(cardBg, "transition-colors", !automation.enabled && "opacity-60")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                          automation.enabled ? "bg-emerald-500/10" : "bg-slate-500/10"
                        )}>
                          <Zap className={cn("h-4 w-4", automation.enabled ? "text-emerald-400" : "text-slate-400")} />
                        </div>
                        <div className="min-w-0">
                          <h3 className={cn("text-sm font-semibold truncate", textPrimary)}>{automation.name}</h3>
                          {automation.description && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{automation.description}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => toggleAutomation(automation)}
                        title={automation.enabled ? "Disable" : "Enable"}
                      >
                        {automation.enabled ? (
                          <ToggleRight className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-slate-400" />
                        )}
                      </Button>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline" className={cn("text-[10px] border", TRIGGER_COLORS[automation.trigger] || TRIGGER_COLORS.manual)}>
                        {TRIGGER_LABELS[automation.trigger] || automation.trigger}
                      </Badge>
                      {automation.template && (
                        <Badge variant="outline" className="text-[10px] border bg-white/[0.04] text-slate-400 border-slate-500/20">
                          <Mail className="h-2.5 w-2.5 mr-0.5" />
                          {automation.template.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] border bg-white/[0.04] text-slate-400 border-slate-500/20 gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDelay(automation.delayMinutes)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border bg-white/[0.04] text-slate-400 border-slate-500/20 gap-0.5">
                        <ActionIcon className="h-2.5 w-2.5" />
                        {automation.action.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-3">
                        <span>Runs: {automation.runCount}</span>
                        <span>Last: {formatDate(automation.lastRunAt)}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => runNow(automation)} title="Run now">
                          <Play className="h-3 w-3 text-blue-400" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(automation)} title="Edit">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-400" onClick={() => { setDeleteTarget(automation); setDeleteDialogOpen(true); }} title="Delete">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══ Create / Edit Dialog ═══ */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => { if (!open) { setCreateDialogOpen(false); setEditDialogOpen(false); setEditTarget(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={cn("text-base", textPrimary)}>
              {editTarget ? "Edit Automation" : "Create Automation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1 text-sm" placeholder="e.g. Welcome Email on Lead" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Description</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="mt-1 text-sm" placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400">Trigger *</Label>
                <Select value={formTrigger} onValueChange={setFormTrigger}>
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Template</Label>
                <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Template</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400">Delay (minutes)</Label>
                <Select value={formDelay} onValueChange={setFormDelay}>
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Immediate (0 min)</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                    <SelectItem value="1440">1 day</SelectItem>
                    <SelectItem value="4320">3 days</SelectItem>
                    <SelectItem value="10080">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Action</Label>
                <Select value={formAction} onValueChange={setFormAction}>
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_email">Send Email</SelectItem>
                    <SelectItem value="send_whatsapp">Send WhatsApp</SelectItem>
                    <SelectItem value="notify_admin">Notify Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setEditDialogOpen(false); setEditTarget(null); resetForm(); }}>Cancel</Button>
              <Button onClick={editTarget ? updateAutomation : createAutomation} disabled={saving || !formName} className="gap-1.5">
                {saving ? "Saving..." : editTarget ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={textPrimary}>Delete Automation</DialogTitle>
          </DialogHeader>
          <p className={cn("text-sm", textSecondary)}>
            Delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAutomation}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
