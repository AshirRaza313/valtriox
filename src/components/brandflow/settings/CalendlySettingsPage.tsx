"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useValtrioxStore } from "@/store/brandflow-store";
import {
  Save,
  Loader2,
  CalendarDays,
  RefreshCw,
  ExternalLink,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";

// ============================================================================
// Animation Variants
// ============================================================================

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ============================================================================
// Main Component
// ============================================================================

interface CalendlySettings {
  enabled: boolean;
  calendlyUrl: string;
  widgetHeight: number;
}

export function CalendlySettingsPage() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme === "dark" || appTheme === "premium-dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CalendlySettings>({
    enabled: false,
    calendlyUrl: "",
    widgetHeight: 630,
  });

  // ── Theme Helpers ───────────────────────────────────────────────────────

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const inputBg = isDark ? "border-white/10 bg-white/[0.03] text-white placeholder:text-slate-600" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400";
  const accentClass = "text-amber-400 bg-amber-500/10";
  const accentBtn = "bg-amber-600 text-white hover:bg-amber-700";
  const accentText = "text-amber-400";

  // ============================================================================
  // Fetch Settings
  // ============================================================================

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/admin/calendly");
      if (res.ok) {
        const data = await res.json();
        setSettings({
          enabled: data.enabled || false,
          calendlyUrl: data.calendlyUrl || "",
          widgetHeight: data.widgetHeight || 630,
        });
      } else {
        toast.error("Failed to load Calendly settings");
      }
    } catch (err) {
      console.error("Failed to fetch Calendly settings:", err);
      toast.error("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ============================================================================
  // Save
  // ============================================================================

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/calendly", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Calendly settings saved!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save Calendly settings");
      }
    } catch {
      toast.error("Failed to save Calendly settings");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-64 bg-slate-200 dark:bg-white/[0.06] rounded animate-pulse" />
          <div className="h-4 w-80 bg-slate-200 dark:bg-white/[0.06] rounded animate-pulse" />
        </div>
        <div className={cn("rounded-xl p-6 space-y-4", cardBg)}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-200 dark:bg-white/[0.06] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-4xl"
    >
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold flex items-center gap-3", textPrimary)}>
            <div
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center",
                isDark ? "bg-amber-500/10" : "bg-amber-50"
              )}
            >
              <CalendarDays className={cn("h-5 w-5", accentText)} />
            </div>
            Calendly Integration
          </h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Configure Calendly inline widget for the landing page contact form. Visitors can book consultations directly.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchSettings}
            disabled={saving}
            variant="outline"
            className={cn("gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10")}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={saveSettings}
            disabled={saving}
            className={cn("gap-2", accentBtn)}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* ── Status Overview ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={cn("rounded-xl p-4", cardBg)}>
          <p className={cn("text-xs font-medium", textSecondary)}>Status</p>
          <p className={cn("text-2xl font-bold mt-1", settings.enabled ? "text-emerald-400" : isDark ? "text-slate-500" : "text-slate-400")}>
            {settings.enabled ? "Active" : "Disabled"}
          </p>
        </div>
        <div className={cn("rounded-xl p-4", cardBg)}>
          <p className={cn("text-xs font-medium", textSecondary)}>Widget Height</p>
          <p className={cn("text-2xl font-bold mt-1", accentText)}>{settings.widgetHeight}px</p>
        </div>
        <div className={cn("rounded-xl p-4 col-span-2 sm:col-span-1", cardBg)}>
          <p className={cn("text-xs font-medium", textSecondary)}>URL Set</p>
          <p className={cn("text-2xl font-bold mt-1", settings.calendlyUrl ? "text-emerald-400" : isDark ? "text-slate-500" : "text-slate-400")}>
            {settings.calendlyUrl ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {/* ── Main Settings Card ──────────────────────────────────────────────── */}
      <Card className={cardBg}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center",
                  isDark ? "bg-amber-500/10" : "bg-amber-50"
                )}
              >
                <CalendarDays className={cn("h-4.5 w-4.5", accentText)} />
              </div>
              <div>
                <CardTitle className={cn("text-base", textPrimary)}>
                  Calendly Widget Settings
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Control how the Calendly booking widget appears on the landing page
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-xs", accentClass)}>
              {settings.enabled ? (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  VISIBLE
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  HIDDEN
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle */}
          <div
            className={cn(
              "flex items-center justify-between p-4 rounded-xl transition-colors",
              isDark ? "bg-white/[0.02] hover:bg-white/[0.04]" : "bg-slate-50 hover:bg-slate-100"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center",
                  settings.enabled
                    ? isDark ? "bg-emerald-500/10" : "bg-emerald-50"
                    : isDark ? "bg-white/[0.06]" : "bg-slate-100"
                )}
              >
                {settings.enabled ? (
                  <Eye className={cn("h-5 w-5", "text-emerald-400")} />
                ) : (
                  <EyeOff className={cn("h-5 w-5", textSecondary)} />
                )}
              </div>
              <div>
                <p className={cn("text-sm font-medium", textPrimary)}>
                  Show Calendly Widget on Landing Page
                </p>
                <p className={cn("text-xs mt-0.5", textSecondary)}>
                  When enabled, visitors see an inline Calendly widget after selecting a consultation type
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enabled: checked }))}
              aria-label="Toggle Calendly widget"
            />
          </div>

          {/* Calendly URL */}
          <div className="space-y-2">
            <Label className={cn("text-sm font-medium", textPrimary)}>
              Calendly Scheduling URL
            </Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                value={settings.calendlyUrl}
                onChange={(e) => setSettings((prev) => ({ ...prev, calendlyUrl: e.target.value }))}
                placeholder="https://calendly.com/your-username/consultation"
                className={cn("pl-10 pr-24 h-11 rounded-xl", inputBg)}
              />
              {settings.calendlyUrl && (
                <a
                  href={settings.calendlyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <p className={cn("text-xs", textSecondary)}>
              Paste your Calendly event link. Find it in Calendly &rarr; Event Types &rarr; Share Link.
            </p>
          </div>

          {/* Widget Height */}
          <div className="space-y-2">
            <Label className={cn("text-sm font-medium", textPrimary)}>
              Widget Height (px)
            </Label>
            <Input
              type="number"
              min={300}
              max={1000}
              value={settings.widgetHeight}
              onChange={(e) => setSettings((prev) => ({ ...prev, widgetHeight: parseInt(e.target.value) || 630 }))}
              className={cn("h-11 rounded-xl w-32", inputBg)}
            />
            <p className={cn("text-xs", textSecondary)}>
              Height in pixels for the embedded Calendly widget (default: 630px).
            </p>
          </div>

          {/* Help Tip */}
          <div
            className={cn(
              "flex items-start gap-3 p-4 rounded-xl",
              isDark ? "bg-amber-500/5 border border-amber-500/10" : "bg-amber-50 border border-amber-200"
            )}
          >
            <Info className={cn("h-5 w-5 flex-shrink-0 mt-0.5", accentText)} />
            <div className="text-xs space-y-1">
              <p className={cn("font-medium", textPrimary)}>
                How to get your Calendly URL:
              </p>
              <ol className={cn("list-decimal list-inside space-y-0.5", textSecondary)}>
                <li>Log in to your Calendly account</li>
                <li>Go to Event Types and select your consultation event</li>
                <li>Click &quot;Share Link&quot; or &quot;Link to this event&quot;</li>
                <li>Copy the URL and paste it above</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bottom Save Bar ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "sticky bottom-0 rounded-xl p-4 flex items-center justify-between",
          cardBg,
          isDark ? "backdrop-blur-xl bg-white/[0.06] border border-white/[0.08]" : "backdrop-blur-xl bg-white/80 border border-slate-200 shadow-lg"
        )}
      >
        <p className={cn("text-sm", textSecondary)}>
          <span className={cn("font-medium", textPrimary)}>
            Calendly widget {settings.enabled ? "visible" : "hidden"}
          </span>{" "}
          on the landing page contact form
        </p>
        <Button
          onClick={saveSettings}
          disabled={saving}
          className={cn("gap-2", accentBtn)}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </motion.div>
  );
}
