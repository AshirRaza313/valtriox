"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Plus,
  RefreshCw,
  Copy,
  Trash2,
  Edit3,
  Eye,
  Save,
  X,
  Send,
  FileCode,
  ToggleLeft,
  ToggleRight,
  Megaphone,
  MailCheck,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// ─── Types ──────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  type: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string;
  isActive: boolean;
  updatedAt: string;
  createdAt: string;
}

const TEMPLATE_VARIABLES = [
  "{{leadName}}", "{{leadEmail}}", "{{leadPhone}}", "{{companyName}}",
  "{{companySize}}", "{{industry}}", "{{consultationType}}", "{{preferredDate}}",
  "{{preferredTime}}", "{{timezone}}", "{{brandName}}", "{{brandEmail}}",
  "{{brandPhone}}", "{{brandWebsite}}",
];

const TYPE_LABELS: Record<string, string> = {
  lead_welcome: "Lead Welcome",
  lead_follow_up: "Follow-Up",
  consultation_reminder: "Consultation Reminder",
  consultation_inquiry: "Consultation Inquiry",
  proposal_sent: "Proposal Sent",
  proposal_delivery: "Proposal Delivery",
  setup_fee_request: "Setup Fee Request",
  payment_confirmation: "Payment Confirmation",
  thank_you: "Thank You",
  custom: "Custom",
};

const TYPE_COLORS: Record<string, string> = {
  lead_welcome: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  lead_follow_up: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  consultation_reminder: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  consultation_inquiry: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  proposal_sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  proposal_delivery: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  setup_fee_request: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  payment_confirmation: "bg-green-500/15 text-green-400 border-green-500/25",
  thank_you: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  custom: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};

// ─── Default Templates ──────────────────────────────────────────────────

function getDefaultTemplates(): Array<{ type: string; name: string; subject: string; htmlContent: string; variables: string[] }> {
  return [
    {
      type: "lead_welcome",
      name: "Lead Welcome Email",
      subject: "Welcome to {{brandName}}, {{leadName}}!",
      htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="color: #1a1a2e; margin-bottom: 16px;">Welcome, {{leadName}}! 👋</h1>
    <p style="color: #4a4a6a; line-height: 1.6;">Thank you for reaching out to <strong>{{brandName}}</strong>. We're excited to learn more about your needs.</p>
    <p style="color: #4a4a6a; line-height: 1.6;">Our team will review your inquiry and get back to you within 24 hours.</p>
    <div style="margin-top: 24px; padding: 16px; background: #f0f4ff; border-radius: 8px; border-left: 4px solid #4a6cf7;">
      <p style="margin: 0; color: #4a4a6a; font-size: 14px;"><strong>What's next?</strong></p>
      <p style="margin: 4px 0 0; color: #6b6b8a; font-size: 13px;">A team member will contact you to schedule a consultation at your convenience.</p>
    </div>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">Best regards,<br>{{brandName}} Team</p>
  </div>
</body>
</html>`,
      variables: ["leadName", "brandName", "brandEmail"],
    },
    {
      type: "lead_follow_up",
      name: "Follow-Up Email",
      subject: "Following up on your inquiry, {{leadName}}",
      htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #1a1a2e;">Hi {{leadName}},</h2>
    <p style="color: #4a4a6a; line-height: 1.6;">We noticed we haven't heard back from you yet. We'd love the opportunity to discuss how <strong>{{brandName}}</strong> can help with your goals.</p>
    <p style="color: #4a4a6a; line-height: 1.6;">Feel free to reply to this email or schedule a consultation at your convenience.</p>
    <p style="color: #888; font-size: 12px; margin-top: 24px;">Regards, The {{brandName}} Team</p>
  </div>
</body>
</html>`,
      variables: ["leadName", "brandName"],
    },
    {
      type: "consultation_reminder",
      name: "Consultation Reminder",
      subject: "Reminder: Your consultation is coming up!",
      htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #1a1a2e;">Consultation Reminder 📅</h2>
    <p style="color: #4a4a6a; line-height: 1.6;">Hi {{leadName}}, this is a friendly reminder about your upcoming consultation with <strong>{{brandName}}</strong>.</p>
    <div style="margin: 20px 0; padding: 16px; background: #f5f3ff; border-radius: 8px;">
      <p style="margin: 0; color: #4a4a6a;"><strong>Date:</strong> {{preferredDate}}</p>
      <p style="margin: 4px 0 0; color: #4a4a6a;"><strong>Time:</strong> {{preferredTime}}</p>
      <p style="margin: 4px 0 0; color: #4a4a6a;"><strong>Type:</strong> {{consultationType}}</p>
    </div>
    <p style="color: #4a4a6a; line-height: 1.6;">If you need to reschedule, please reply to this email.</p>
    <p style="color: #888; font-size: 12px; margin-top: 24px;">Regards, {{brandName}} Team</p>
  </div>
</body>
</html>`,
      variables: ["leadName", "brandName", "preferredDate", "preferredTime", "consultationType"],
    },
    {
      type: "proposal_sent",
      name: "Proposal Sent Notification",
      subject: "Your proposal from {{brandName}} is ready!",
      htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #1a1a2e;">Proposal Ready 📋</h2>
    <p style="color: #4a4a6a; line-height: 1.6;">Hi {{leadName}}, the {{brandName}} team has prepared a proposal based on your consultation.</p>
    <p style="color: #4a4a6a; line-height: 1.6;">Please review it at your earliest convenience. We're happy to discuss any questions or adjustments.</p>
    <p style="color: #888; font-size: 12px; margin-top: 24px;">Regards, {{brandName}} Team</p>
  </div>
</body>
</html>`,
      variables: ["leadName", "brandName"],
    },
  ];
}

// ─── Main Component ───────────────────────────────────────────────────────

export function EmailTemplatesPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  // ── State ──
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editForm, setEditForm] = useState({ name: "", subject: "", htmlContent: "", isActive: true });
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<EmailTemplate | null>(null);
  const [sendForm, setSendForm] = useState({ recipientEmail: "", clientName: "" });
  const [sending, setSending] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/email-templates?limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchTemplates();
    };
    init();
  }, [fetchTemplates]);

  // Auto-seed when no templates exist
  useEffect(() => {
    if (!loading && templates.length === 0) {
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
        body: JSON.stringify({ seedTemplates: true }),
      });
      if (!res.ok) throw new Error("Failed to seed");
      const data = await res.json();
      if (data.templatesCreated > 0) {
        toast.success(`Created ${data.templatesCreated} professional templates`);
        fetchTemplates();
      } else {
        toast.info("Templates already exist");
      }
    } catch {
      toast.error("Failed to seed templates");
    }
  };

  // ─── Save ──────────────────────────────────────────────────────────────
  const saveTemplate = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTemplate.id,
          ...editForm,
          variables: JSON.stringify(
            [...new Set(
              TEMPLATE_VARIABLES.filter((v) =>
                editForm.htmlContent.includes(v) || editForm.subject.includes(v)
              )
            )]
          ),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Template saved");
      setEditingTemplate(null);
      fetchTemplates();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle Active ───────────────────────────────────────────────────
  const toggleActive = async (template: EmailTemplate) => {
    try {
      const res = await fetchWithAuth("/api/admin/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id, isActive: !template.isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      toast.success(template.isActive ? "Template deactivated" : "Template activated");
      fetchTemplates();
    } catch {
      toast.error("Failed to toggle template");
    }
  };

  // ─── Duplicate ───────────────────────────────────────────────────────
  const duplicateTemplate = async (template: EmailTemplate) => {
    try {
      const res = await fetchWithAuth("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: `custom_${Date.now()}`,
          name: `${template.name} (Copy)`,
          subject: template.subject,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          variables: template.variables,
        }),
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      toast.success("Template duplicated");
      fetchTemplates();
    } catch {
      toast.error("Failed to duplicate template");
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────
  const deleteTemplate = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithAuth(`/api/admin/email-templates?id=${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Template deleted");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchTemplates();
    } catch {
      toast.error("Failed to delete template");
    }
  };

  // ─── Send Email ───────────────────────────────────────────────────────
  const openSendDialog = (template: EmailTemplate) => {
    setSendTarget(template);
    setSendForm({ recipientEmail: "", clientName: "" });
    setSendDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!sendTarget || !sendForm.recipientEmail) return;
    setSending(true);
    try {
      const res = await fetchWithAuth("/api/admin/email-templates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: sendTarget.id,
          recipientEmail: sendForm.recipientEmail,
          clientName: sendForm.clientName,
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      toast.success(`Email sent to ${sendForm.recipientEmail}`);
      setSendDialogOpen(false);
      setSendTarget(null);
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleMailchimpClick = () => {
    toast.info("Mailchimp integration coming soon", { description: "We are working on connecting your Mailchimp account for bulk email campaigns." });
  };

  // ─── Open editor ───────────────────────────────────────────────────────
  const openEditor = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      isActive: template.isActive,
    });
  };

  // ─── Insert variable ───────────────────────────────────────────────────
  const insertVariable = (variable: string) => {
    setEditForm((prev) => ({ ...prev, htmlContent: prev.htmlContent + variable }));
  };

  // ─── Format helpers ──────────────────────────────────────────────────────
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", textPrimary)}>Email Templates</h1>
          <p className={cn("text-sm mt-0.5", textSecondary)}>Manage and customize your email templates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={seedDefaults}>
            <FileCode className="h-3.5 w-3.5" />
            Seed Defaults
          </Button>
          <Button variant="outline" size="sm" onClick={fetchTemplates} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Template Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("h-40 rounded-xl animate-pulse", isDark ? "bg-white/[0.03]" : "bg-slate-100")} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className={cn(cardBg)}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mail className="h-12 w-12 text-slate-300 mb-3" />
            <p className={cn("text-sm font-medium", textPrimary)}>No email templates yet</p>
            <p className="text-xs text-slate-400 mt-1">Click below to load professional starter templates.</p>
            <Button size="sm" className="gap-1.5 mt-3" onClick={seedDefaults}>
              <FileCode className="h-3.5 w-3.5" />
              Seed Defaults
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={cn(cardBg, "transition-colors hover:border-white/[0.12]")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={cn("text-sm font-semibold truncate", textPrimary)}>{template.name}</h3>
                        <Badge variant="outline" className={cn("text-[10px] border shrink-0", TYPE_COLORS[template.type] || TYPE_COLORS.custom)}>
                          {TYPE_LABELS[template.type] || template.type}
                        </Badge>
                      </div>
                      <p className={cn("text-xs truncate", textSecondary)}>Subject: {template.subject}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleActive(template)} title={template.isActive ? "Deactivate" : "Activate"}>
                        {template.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{template.isActive ? "Active" : "Inactive"}</span>
                      <span>Updated {formatDate(template.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openSendDialog(template)} title="Send via Email">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleMailchimpClick} title="Send via Mailchimp">
                        <Megaphone className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditor(template)} title="Edit">
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewHtml(template.htmlContent)} title="Preview">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => duplicateTemplate(template)} title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-400" onClick={() => { setDeleteTarget(template); setDeleteDialogOpen(true); }} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Editor Dialog ── */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) setEditingTemplate(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className={cn("text-base", textPrimary)}>
              Edit Template: {editingTemplate?.name}
            </DialogTitle>
            <DialogDescription className={textSecondary}>
              Modify the template name, subject, and HTML content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col lg:flex-row gap-4 overflow-auto max-h-[70vh]">
            {/* Left: Editor */}
            <div className="flex-1 space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Template Name</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Subject Line</Label>
                <Input value={editForm.subject} onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))} className="mt-1 text-sm" placeholder="e.g. Welcome, {{leadName}}!" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">HTML Content</Label>
                <Textarea
                  value={editForm.htmlContent}
                  onChange={(e) => setEditForm((p) => ({ ...p, htmlContent: e.target.value }))}
                  className="mt-1 text-sm font-mono min-h-[300px] leading-relaxed"
                  placeholder="Enter HTML email template..."
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editForm.isActive}
                    onCheckedChange={(checked) => setEditForm((p) => ({ ...p, isActive: checked }))}
                  />
                  <Label className="text-xs text-slate-400">{editForm.isActive ? "Active" : "Inactive"}</Label>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreviewHtml(editForm.htmlContent)}>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={saveTemplate} disabled={saving} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={() => setEditingTemplate(null)} className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>

            {/* Right: Variables sidebar */}
            <div className="w-full lg:w-48 shrink-0">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Variables</h4>
              <p className="text-[10px] text-slate-500 mb-2">Click to insert into HTML</p>
              <div className="space-y-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <Button
                    key={v}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-7 text-[11px] font-mono text-slate-400 hover:text-amber-400"
                    onClick={() => insertVariable(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ── */}
      <Dialog open={!!previewHtml} onOpenChange={(open) => { if (!open) setPreviewHtml(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className={cn("text-base", textPrimary)}>Email Preview</DialogTitle>
            <DialogDescription className={textSecondary}>
              Preview how this email template will look when sent.
            </DialogDescription>
          </DialogHeader>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <iframe
              ref={iframeRef}
              srcDoc={previewHtml || ""}
              className="w-full h-[500px] bg-white"
              sandbox="allow-same-origin"
              title="Email Preview"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Send Email Dialog ── */}
      <Dialog open={sendDialogOpen} onOpenChange={(open) => { if (!open) setSendDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={cn("text-base", textPrimary)}>
              <div className="flex items-center gap-2">
                <MailCheck className="h-5 w-5 text-amber-500" />
                Send Email: {sendTarget?.name}
              </div>
            </DialogTitle>
            <DialogDescription className={textSecondary}>
              Send this email template to a recipient with optional personalization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-slate-400">Recipient Email Address</Label>
              <Input
                type="email"
                value={sendForm.recipientEmail}
                onChange={(e) => setSendForm((p) => ({ ...p, recipientEmail: e.target.value }))}
                className="mt-1 text-sm"
                placeholder="e.g. client@company.com"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Client Name (for personalization)</Label>
              <Input
                value={sendForm.clientName}
                onChange={(e) => setSendForm((p) => ({ ...p, clientName: e.target.value }))}
                className="mt-1 text-sm"
                placeholder="e.g. John Doe (optional)"
              />
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <p className="text-xs text-slate-400">Template variables like <code className="text-amber-400">{"{{leadName}}"}</code> will be replaced with the client name if provided.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sending || !sendForm.recipientEmail} className="gap-1.5">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={textPrimary}>Delete Template</DialogTitle>
            <DialogDescription className={textSecondary}>
              This action cannot be undone. The template will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <p className={cn("text-sm", textSecondary)}>
            Delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteTemplate}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
