"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isPlatformRole } from "@/lib/roles";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { motion } from "framer-motion";
import {
  Shield,
  Search,
  LayoutGrid,
  Eye,
  EyeOff,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Save,
  RefreshCw,
  User,
  Mail,
  Phone,
  Building2,
  Users,
  Factory,
  Target,
  Video,
  CalendarDays,
  Clock,
  Globe,
  StickyNote,
  MessageSquare,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────

interface FormFieldConfig {
  key: string;
  label: string;
  placeholder: string;
  status: "required" | "optional" | "hidden";
  order: number;
  type: "text" | "email" | "tel" | "select" | "textarea" | "date";
  icon: string;
}

const DEFAULT_FIELDS: FormFieldConfig[] = [
  { key: "fullName", label: "Full Name", placeholder: "John Doe", status: "required", order: 0, type: "text", icon: "User" },
  { key: "email", label: "Work Email", placeholder: "john@company.com", status: "required", order: 1, type: "email", icon: "Mail" },
  { key: "phone", label: "Phone Number", placeholder: "+92 300 1234567", status: "optional", order: 2, type: "tel", icon: "Phone" },
  { key: "company", label: "Company Name", placeholder: "Your Brand Inc.", status: "optional", order: 3, type: "text", icon: "Building2" },
  { key: "companySize", label: "Team Size", placeholder: "Select team size", status: "optional", order: 4, type: "select", icon: "Users" },
  { key: "industry", label: "Industry", placeholder: "Select industry", status: "optional", order: 5, type: "select", icon: "Factory" },
  { key: "interest", label: "Area of Interest", placeholder: "What are you most interested in?", status: "optional", order: 6, type: "select", icon: "Target" },
  { key: "consultationType", label: "Consultation Method", placeholder: "Preferred consultation method", status: "optional", order: 7, type: "select", icon: "Video" },
  { key: "preferredDate", label: "Preferred Date", placeholder: "Select a date", status: "optional", order: 8, type: "date", icon: "CalendarDays" },
  { key: "preferredTime", label: "Time Slot", placeholder: "Select time slot", status: "optional", order: 9, type: "select", icon: "Clock" },
  { key: "timezone", label: "Timezone", placeholder: "Asia/Karachi", status: "optional", order: 10, type: "select", icon: "Globe" },
  { key: "availabilityNote", label: "Availability Notes", placeholder: "e.g. Any weekday after 2PM...", status: "optional", order: 11, type: "text", icon: "StickyNote" },
  { key: "message", label: "Message", placeholder: "Describe your brand, challenges, and goals...", status: "optional", order: 12, type: "textarea", icon: "MessageSquare" },
];

const ICON_MAP: Record<string, any> = {
  User, Mail, Phone, Building2, Users, Factory, Target, Video, CalendarDays, Clock, Globe, StickyNote, MessageSquare,
};

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

export function ContactFormBuilderPage() {
  const { user, appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [fields, setFields] = useState<FormFieldConfig[]>(DEFAULT_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const hasAccess = Boolean(user?.role && isPlatformRole(user.role));

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";

  // ── Fetch form config ──
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/contact-form");
      if (res.ok) {
        const data = await res.json();
        if (data.fields && Array.isArray(data.fields)) {
          setFields(data.fields);
        }
      }
    } catch (err) {
      console.error("[ContactFormBuilderPage] Failed to fetch form config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) fetchConfig();
  }, [hasAccess, fetchConfig]);

  // ── Save form config ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/contact-form", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save configuration");

      toast.success("Form configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Field manipulation ──
  const updateField = (key: string, updates: Partial<FormFieldConfig>) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...updates } : f)));
  };

  const moveField = (key: string, direction: "up" | "down") => {
    setFields((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((f) => f.key === key);
      if (idx < 0) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === sorted.length - 1) return prev;

      const newFields = [...sorted];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [newFields[idx], newFields[swapIdx]] = [newFields[swapIdx], newFields[idx]];

      return newFields.map((f, i) => ({ ...f, order: i }));
    });
  };

  const cycleStatus = (key: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const next = f.status === "required" ? "optional" : f.status === "optional" ? "hidden" : "required";
        return { ...f, status: next as "required" | "optional" | "hidden" };
      })
    );
  };

  const resetDefaults = () => {
    setFields(DEFAULT_FIELDS);
    toast.info("Reset to default configuration");
  };

  const visibleFields = fields
    .filter((f) => (f.key || "").toLowerCase().includes(search.toLowerCase()) || (f.label || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.order - b.order);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "required":
        return <Badge className="bg-red-500/15 text-red-500 border-red-500/25 text-[10px] border font-medium">Required</Badge>;
      case "optional":
        return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/25 text-[10px] border font-medium">Optional</Badge>;
      case "hidden":
        return <Badge className="bg-slate-500/15 text-slate-500 border-slate-500/25 text-[10px] border font-medium">Hidden</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "required": return <CheckCircle2 className="h-4 w-4 text-red-400" />;
      case "optional": return <MinusCircle className="h-4 w-4 text-amber-400" />;
      case "hidden": return <XCircle className="h-4 w-4 text-slate-400" />;
      default: return null;
    }
  };

  if (!hasAccess) return <AccessDenied />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold flex items-center gap-2", textPrimary)}>
            <LayoutGrid className="h-6 w-6 text-amber-500" />
            Contact Form Builder
          </h1>
          <p className={cn("text-sm mt-0.5", textSecondary)}>
            Configure the lead generation form fields, labels, and visibility
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetDefaults} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)} className="gap-2">
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? "Editor" : "Preview"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Save className={cn("h-4 w-4", saving && "animate-spin")} />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {showPreview ? (
        /* ── Preview Mode ── */
        <Card className={cn(cardBg)}>
          <CardHeader>
            <CardTitle className={cn("text-base font-semibold", textPrimary)}>Form Preview</CardTitle>
            <CardDescription className={textSecondary}>
              This is how the contact form will appear to visitors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields
              .filter((f) => f.status !== "hidden")
              .sort((a, b) => a.order - b.order)
              .map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className={cn("text-xs font-medium", textSecondary)}>
                    {field.label} {field.status === "required" && <span className="text-red-400">*</span>}
                  </Label>
                  {field.type === "textarea" ? (
                    <div
                      className={cn(
                        "w-full rounded-xl border p-3 text-sm min-h-[60px]",
                        isDark ? "border-white/10 bg-white/[0.03] text-slate-500" : "border-slate-200 bg-slate-50 text-slate-400"
                      )}
                    >
                      {field.placeholder}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "w-full h-11 rounded-xl border px-3 flex items-center text-sm",
                        isDark ? "border-white/10 bg-white/[0.03] text-slate-500" : "border-slate-200 bg-slate-50 text-slate-400"
                      )}
                    >
                      {field.placeholder}
                    </div>
                  )}
                </div>
              ))}
            <div className="pt-2">
              <Button className="w-full h-12 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-700 hover:via-yellow-600 hover:to-amber-700 text-black font-semibold rounded-xl">
                Send Message
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── Editor Mode ── */
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Card className={cn(cardBg)}>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mx-auto mb-2" />
                  <div className="h-3 w-24 bg-slate-200 rounded animate-pulse mx-auto" />
                </div>
              ) : (
                <div className="divide-y divide-slate-100/50">
                  {visibleFields.map((field, i) => {
                    const IconComp = ICON_MAP[field.icon] || User;
                    return (
                      <motion.div
                        key={field.key}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={cn(
                          "flex items-center gap-3 p-4 transition-colors",
                          isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50",
                          field.status === "hidden" && "opacity-50"
                        )}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveField(field.key, "up")}
                            disabled={i === 0}
                            className={cn(
                              "p-0.5 rounded hover:bg-slate-200/50 disabled:opacity-20",
                              isDark && "hover:bg-white/10"
                            )}
                          >
                            <ChevronUp className="h-3 w-3 text-slate-400" />
                          </button>
                          <button
                            onClick={() => moveField(field.key, "down")}
                            disabled={i === visibleFields.length - 1}
                            className={cn(
                              "p-0.5 rounded hover:bg-slate-200/50 disabled:opacity-20",
                              isDark && "hover:bg-white/10"
                            )}
                          >
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </button>
                        </div>

                        <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0" />

                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", isGold ? "bg-amber-500/10" : "bg-amber-50")}>
                          <IconComp className={cn("h-4 w-4", isGold ? "text-amber-400" : "text-amber-600")} />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Label className={cn("text-xs font-semibold", textPrimary)}>{field.label}</Label>
                            {getStatusBadge(field.status)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              value={field.placeholder}
                              onChange={(e) => updateField(field.key, { placeholder: e.target.value })}
                              className="h-7 text-xs max-w-[250px]"
                              placeholder="Placeholder text..."
                            />
                            <Input
                              value={field.label}
                              onChange={(e) => updateField(field.key, { label: e.target.value })}
                              className="h-7 text-xs max-w-[180px]"
                              placeholder="Field label..."
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => cycleStatus(field.key)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" title="Click to cycle: Required → Optional → Hidden">
                            {getStatusIcon(field.status)}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-red-400" /> Required</span>
            <span className="flex items-center gap-1"><MinusCircle className="h-3 w-3 text-amber-400" /> Optional</span>
            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-slate-400" /> Hidden</span>
            <span className="ml-2">Click status icon to cycle</span>
          </div>
        </>
      )}
    </div>
  );
}
