"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  Globe,
  Shield,
  Mail,
  Eye,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Copy,
  ExternalLink,
  Building2,
  Palette,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Monitor,
  Image,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// Types
// ============================================================================

interface WhiteLabelSettings {
  // Section A: Brand Portal Configuration
  customDomain: string;
  sslStatus: "inactive" | "pending" | "active";
  customPortalTitle: string;
  customFaviconUrl: string;
  customLogoUrl: string;
  // Section B: Brand Removal Settings
  removePoweredByFooter: boolean;
  removeValtrioxLoginLogo: boolean;
  customEmailSenderName: boolean;
  customEmailSenderNameValue: string;
  customLoginHeading: boolean;
  customLoginHeadingValue: string;
  customLoginBgImage: boolean;
  customLoginBgImageUrl: string;
  supportEmail: string;
  // Section C: Email Branding
  emailSenderName: string;
  emailReplyTo: string;
  emailHeaderColor: string;
  emailFooterText: string;
}

interface BrandOrg {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: string;
}

const DEFAULT_SETTINGS: WhiteLabelSettings = {
  customDomain: "",
  sslStatus: "inactive",
  customPortalTitle: "",
  customFaviconUrl: "",
  customLogoUrl: "",
  removePoweredByFooter: false,
  removeValtrioxLoginLogo: false,
  customEmailSenderName: false,
  customEmailSenderNameValue: "",
  customLoginHeading: false,
  customLoginHeadingValue: "",
  customLoginBgImage: false,
  customLoginBgImageUrl: "",
  supportEmail: "",
  emailSenderName: "",
  emailReplyTo: "",
  emailHeaderColor: "#059669",
  emailFooterText: "",
};

// ============================================================================
// Animation Variants
// ============================================================================

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ============================================================================
// Main Component
// ============================================================================

export function WhiteLabelPage() {
  const { appTheme, user } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";
  const isPlatformOwner = user?.role === "platform_owner" || user?.role === "owner";

  // ── State ──
  const [settings, setSettings] = useState<WhiteLabelSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>("portal-config");
  const [brandOrgs, setBrandOrgs] = useState<BrandOrg[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [brandSettingsMap, setBrandSettingsMap] = useState<Record<string, WhiteLabelSettings>>({});
  const [savingBrandId, setSavingBrandId] = useState<string | null>(null);

  // ── Card class helper ──
  const cardClass = isDark
    ? "bg-white/[0.03] border-white/[0.06]"
    : "bg-white border-slate-200";

  const labelClass = isDark ? "text-slate-300" : "text-slate-700";
  const inputClass = isDark ? "bg-white/[0.05] border-white/[0.1] text-white" : "";
  const textClass = isDark ? "text-white" : "text-slate-900";
  const textMutedClass = isDark ? "text-slate-400" : "text-slate-500";
  const borderClass = isDark ? "border-white/[0.06]" : "border-slate-200";
  const hoverBorderClass = isDark ? "hover:border-white/[0.12]" : "hover:border-slate-300";

  // ── Fetch settings on mount ──
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/settings/white-label");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || DEFAULT_SETTINGS);
      } else {
        toast.error("Failed to load white-label settings");
      }
    } catch {
      // Silent fallback to defaults
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  // ── Fetch all brands for platform owner ──
  const loadBrandOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const res = await fetchWithAuth("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        setBrandOrgs(data.clients || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  // ── Handle setting change ──
  const updateSetting = useCallback(<K extends keyof WhiteLabelSettings>(
    key: K,
    value: WhiteLabelSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Save settings ──
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/settings/white-label", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("White-label settings saved successfully");
      } else {
        toast.error("Failed to save white-label settings");
      }
    } catch {
      toast.error("Network error while saving");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  // ── Toggle section expansion ──
  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  // ── Copy DNS instruction ──
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // ── Load brand-specific settings ──
  const loadBrandSettings = useCallback(async (orgId: string) => {
    try {
      const res = await fetchWithAuth(`/api/settings/white-label?orgId=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setBrandSettingsMap((prev) => ({ ...prev, [orgId]: data.settings || DEFAULT_SETTINGS }));
      }
    } catch {
      // silent
    }
  }, []);

  // ── Save brand-specific settings ──
  const saveBrandSettings = useCallback(async (orgId: string) => {
    setSavingBrandId(orgId);
    try {
      const brandSettings = brandSettingsMap[orgId] || DEFAULT_SETTINGS;
      const res = await fetchWithAuth("/api/settings/white-label", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...brandSettings, _targetOrgId: orgId }),
      });
      if (res.ok) {
        toast.success(`Settings saved for brand`);
      } else {
        toast.error("Failed to save brand settings");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingBrandId(null);
    }
  }, [brandSettingsMap]);

  // ── Loading state ──
  if (initialLoad && loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ================================================================ */}
      {/* Header */}
      {/* ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "rounded-2xl p-6 border",
          isDark
            ? "bg-white/[0.03] border-white/[0.06]"
            : "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50"
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "p-3 rounded-xl",
              isGold ? "bg-amber-500/20" : isDark ? "bg-amber-500/10" : "bg-amber-100"
            )}
          >
            <Shield className={cn("w-6 h-6", isGold ? "text-amber-400" : "text-amber-600")} />
          </div>
          <div className="flex-1">
            <h2 className={cn("text-xl font-bold", textClass)}>White-Label Management</h2>
            <p className={cn("mt-1 text-sm", textMutedClass)}>
              Fully brand the portal as your own with custom domains, logos, and messaging.
              Remove all Valtriox references for your clients.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ================================================================ */}
      {/* Section A: Brand Portal Configuration */}
      {/* ================================================================ */}
      <SectionWrapper
        id="portal-config"
        title="Brand Portal Configuration"
        description="Configure your custom domain and portal identity"
        icon={<Globe className="w-5 h-5 text-blue-500" />}
        expanded={expandedSection === "portal-config"}
        onToggle={() => toggleSection("portal-config")}
        isDark={isDark}
        isGold={isGold}
        textClass={textClass}
        textMutedClass={textMutedClass}
        cardClass={cardClass}
        borderClass={borderClass}
      >
        <div className="space-y-4">
          {/* Custom Domain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn("mb-1.5 block text-sm font-medium", labelClass)}>
                Primary Domain
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="app.yourbrand.com"
                  value={settings.customDomain}
                  onChange={(e) => updateSetting("customDomain", e.target.value)}
                  className={cn("pl-10", inputClass)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className={cn("mb-1.5 block text-sm font-medium", labelClass)}>
                SSL Status
              </Label>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border h-10",
                  settings.sslStatus === "active"
                    ? isDark
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-green-50 border-green-200"
                    : settings.sslStatus === "pending"
                      ? isDark
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-amber-50 border-amber-200"
                      : isDark
                        ? "bg-white/[0.05] border-white/[0.1]"
                        : "bg-slate-50 border-slate-200"
                )}
              >
                {settings.sslStatus === "active" ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : settings.sslStatus === "pending" ? (
                  <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    settings.sslStatus === "active"
                      ? isDark
                        ? "text-green-300"
                        : "text-green-700"
                      : settings.sslStatus === "pending"
                        ? isDark
                          ? "text-amber-300"
                          : "text-amber-700"
                        : textMutedClass
                  )}
                >
                  {settings.sslStatus === "active"
                    ? "SSL Active"
                    : settings.sslStatus === "pending"
                      ? "Provisioning..."
                      : "No Custom Domain Set"}
                </span>
              </div>
            </div>
          </div>

          {/* DNS Setup Instructions */}
          <div
            className={cn(
              "p-4 rounded-xl border space-y-3",
              isDark ? "bg-blue-500/5 border-blue-500/20" : "bg-blue-50 border-blue-200"
            )}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-500" />
              <span className={cn("text-sm font-medium", isDark ? "text-blue-300" : "text-blue-800")}>
                DNS Setup Instructions
              </span>
            </div>
            <ol className="space-y-2 text-sm list-decimal list-inside">
              <li className={isDark ? "text-blue-200/70" : "text-blue-700"}>
                Log into your domain registrar (e.g., Namecheap, GoDaddy, Cloudflare)
              </li>
              <li className={isDark ? "text-blue-200/70" : "text-blue-700"}>
                Add a <strong>CNAME</strong> record pointing your subdomain to:
              </li>
            </ol>
            <div className="flex items-center gap-2">
              <code
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg text-xs font-mono",
                  isDark ? "bg-black/30 text-blue-200" : "bg-blue-100 text-blue-900"
                )}
              >
                cname.valtriox.com
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard("cname.valtriox.com")}
                className="shrink-0 h-9 w-9 p-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className={cn("text-xs", isDark ? "text-blue-300/50" : "text-blue-600")}>
              SSL certificate is automatically provisioned within 24 hours after DNS propagation.
            </p>
          </div>

          <Separator className={isDark ? "bg-white/[0.06]" : "bg-slate-200"} />

          {/* Portal Title, Favicon, Logo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className={cn("mb-1.5 block text-sm font-medium", labelClass)}>
                Custom Portal Title
              </Label>
              <Input
                placeholder="My Brand Portal"
                value={settings.customPortalTitle}
                onChange={(e) => updateSetting("customPortalTitle", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn("mb-1.5 block text-sm font-medium", labelClass)}>
                Custom Favicon URL
              </Label>
              <Input
                placeholder="https://cdn.example.com/favicon.ico"
                value={settings.customFaviconUrl}
                onChange={(e) => updateSetting("customFaviconUrl", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn("mb-1.5 block text-sm font-medium", labelClass)}>
                Custom Logo URL
              </Label>
              <Input
                placeholder="https://cdn.example.com/logo.png"
                value={settings.customLogoUrl}
                onChange={(e) => updateSetting("customLogoUrl", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* ================================================================ */}
      {/* Section B: Brand Removal Settings */}
      {/* ================================================================ */}
      <SectionWrapper
        id="brand-removal"
        title="Brand Removal Settings"
        description="Remove Valtriox branding from your client-facing portal"
        icon={<Eye className="w-5 h-5 text-purple-500" />}
        expanded={expandedSection === "brand-removal"}
        onToggle={() => toggleSection("brand-removal")}
        isDark={isDark}
        isGold={isGold}
        textClass={textClass}
        textMutedClass={textMutedClass}
        cardClass={cardClass}
        borderClass={borderClass}
      >
        <div className="space-y-3">
          {/* Toggle: Remove "Powered by Valtriox" footer */}
          <ToggleRow
            label="Remove 'Powered by Valtriox' footer"
            description="Hide platform attribution from portal footer"
            checked={settings.removePoweredByFooter}
            onCheckedChange={(v) => updateSetting("removePoweredByFooter", v)}
            isDark={isDark}
            borderClass={borderClass}
            hoverBorderClass={hoverBorderClass}
          />

          {/* Toggle: Remove Valtriox logo from login page */}
          <ToggleRow
            label="Remove Valtriox logo from login page"
            description="Show your brand logo only on the login screen"
            checked={settings.removeValtrioxLoginLogo}
            onCheckedChange={(v) => updateSetting("removeValtrioxLoginLogo", v)}
            isDark={isDark}
            borderClass={borderClass}
            hoverBorderClass={hoverBorderClass}
          />

          <Separator className={isDark ? "bg-white/[0.06]" : "bg-slate-200"} />

          {/* Toggle: Custom email sender name */}
          <div className="space-y-3">
            <ToggleRow
              label="Custom email sender name"
              description="Use your brand name instead of 'Valtriox' in transactional emails"
              checked={settings.customEmailSenderName}
              onCheckedChange={(v) => updateSetting("customEmailSenderName", v)}
              isDark={isDark}
              borderClass={borderClass}
              hoverBorderClass={hoverBorderClass}
            />
            {settings.customEmailSenderName && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pl-4"
              >
                <Input
                  placeholder="My Brand Name"
                  value={settings.customEmailSenderNameValue}
                  onChange={(e) => updateSetting("customEmailSenderNameValue", e.target.value)}
                  className={inputClass}
                />
              </motion.div>
            )}
          </div>

          {/* Toggle: Custom login heading */}
          <div className="space-y-3">
            <ToggleRow
              label="Custom login page heading"
              description="Replace the default login page heading text"
              checked={settings.customLoginHeading}
              onCheckedChange={(v) => updateSetting("customLoginHeading", v)}
              isDark={isDark}
              borderClass={borderClass}
              hoverBorderClass={hoverBorderClass}
            />
            {settings.customLoginHeading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pl-4"
              >
                <Input
                  placeholder="Welcome to Your Brand Portal"
                  value={settings.customLoginHeadingValue}
                  onChange={(e) => updateSetting("customLoginHeadingValue", e.target.value)}
                  className={inputClass}
                />
              </motion.div>
            )}
          </div>

          {/* Toggle: Custom login background image */}
          <div className="space-y-3">
            <ToggleRow
              label="Custom login page background image"
              description="Set a custom background image for the login/register page"
              checked={settings.customLoginBgImage}
              onCheckedChange={(v) => updateSetting("customLoginBgImage", v)}
              isDark={isDark}
              borderClass={borderClass}
              hoverBorderClass={hoverBorderClass}
            />
            {settings.customLoginBgImage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pl-4"
              >
                <Input
                  placeholder="https://yourbrand.com/assets/login-bg.jpg"
                  value={settings.customLoginBgImageUrl}
                  onChange={(e) => updateSetting("customLoginBgImageUrl", e.target.value)}
                  className={inputClass}
                />
              </motion.div>
            )}
          </div>

          <Separator className={isDark ? "bg-white/[0.06]" : "bg-slate-200"} />

          {/* Support email */}
          <div className="space-y-2">
            <Label className={cn("block text-sm font-medium", labelClass)}>
              Support Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="support@yourbrand.com"
                value={settings.supportEmail}
                onChange={(e) => updateSetting("supportEmail", e.target.value)}
                className={cn("pl-10", inputClass)}
              />
            </div>
            <p className={cn("text-xs", textMutedClass)}>
              This email will be shown in the support footer and contact sections.
            </p>
          </div>
        </div>
      </SectionWrapper>

      {/* ================================================================ */}
      {/* Section C: Email Branding */}
      {/* ================================================================ */}
      <SectionWrapper
        id="email-branding"
        title="Email Branding"
        description="Customize the look and feel of transactional emails"
        icon={<Mail className="w-5 h-5 text-emerald-500" />}
        expanded={expandedSection === "email-branding"}
        onToggle={() => toggleSection("email-branding")}
        isDark={isDark}
        isGold={isGold}
        textClass={textClass}
        textMutedClass={textMutedClass}
        cardClass={cardClass}
        borderClass={borderClass}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn("block text-sm font-medium", labelClass)}>
                Custom Sender Name
              </Label>
              <Input
                placeholder="My Brand Team"
                value={settings.emailSenderName}
                onChange={(e) => updateSetting("emailSenderName", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn("block text-sm font-medium", labelClass)}>
                Reply-To Email
              </Label>
              <Input
                placeholder="noreply@yourbrand.com"
                value={settings.emailReplyTo}
                onChange={(e) => updateSetting("emailReplyTo", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn("block text-sm font-medium", labelClass)}>
                Email Template Header Color
              </Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={settings.emailHeaderColor}
                    onChange={(e) => updateSetting("emailHeaderColor", e.target.value)}
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                    style={{ backgroundColor: settings.emailHeaderColor }}
                  />
                </div>
                <Input
                  placeholder="#059669"
                  value={settings.emailHeaderColor}
                  onChange={(e) => updateSetting("emailHeaderColor", e.target.value)}
                  className={cn("font-mono text-sm", inputClass)}
                />
              </div>
              <div
                className="h-6 rounded-md mt-1"
                style={{ backgroundColor: settings.emailHeaderColor }}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className={cn("block text-sm font-medium", labelClass)}>
                Email Footer Text
              </Label>
              <textarea
                placeholder="© 2024 Your Brand. All rights reserved."
                value={settings.emailFooterText}
                onChange={(e) => updateSetting("emailFooterText", e.target.value)}
                rows={3}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm resize-none",
                  isDark
                    ? "bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30"
                    : "border-slate-200 placeholder:text-slate-400"
                )}
              />
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* ================================================================ */}
      {/* Section D: Client Branding Preview */}
      {/* ================================================================ */}
      <SectionWrapper
        id="branding-preview"
        title="Client Branding Preview"
        description="Preview how your branded login page will appear to clients"
        icon={<Monitor className="w-5 h-5 text-cyan-500" />}
        expanded={expandedSection === "branding-preview"}
        onToggle={() => toggleSection("branding-preview")}
        isDark={isDark}
        isGold={isGold}
        textClass={textClass}
        textMutedClass={textMutedClass}
        cardClass={cardClass}
        borderClass={borderClass}
      >
        <div className="space-y-4">
          {/* Preview Card */}
          <div className="flex justify-center">
            <div
              className={cn(
                "w-full max-w-md rounded-2xl border-2 overflow-hidden shadow-lg",
                borderClass
              )}
            >
              {/* Preview Login Background */}
              <div
                className="relative h-64 flex items-center justify-center"
                style={{
                  backgroundColor: settings.customLoginBgImage
                    ? undefined
                    : isDark
                      ? "#0f172a"
                      : "#f8fafc",
                  ...(settings.customLoginBgImage
                    ? {
                        backgroundImage: `url(${settings.customLoginBgImageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {}),
                }}
              >
                {/* Overlay gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 100%)",
                  }}
                />

                <div className="relative z-10 text-center px-6">
                  {/* Logo */}
                  <div className="w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-sm overflow-hidden">
                    {settings.customLogoUrl ? (
                      <img
                        src={settings.customLogoUrl}
                        alt="Brand Logo"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Building2 className="w-8 h-8 text-white" />
                    )}
                  </div>
                  {/* Heading */}
                  <h3 className="text-white text-xl font-bold">
                    {settings.customLoginHeading
                      ? settings.customLoginHeadingValue
                      : settings.customPortalTitle || "Brand Management Portal"}
                  </h3>
                  {!settings.removePoweredByFooter && (
                    <p className="text-white/60 text-xs mt-2">Powered by Valtriox</p>
                  )}
                </div>
              </div>

              {/* Preview Login Form */}
              <div
                className={cn(
                  "p-6 space-y-3",
                  isDark ? "bg-slate-900" : "bg-white"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    isDark ? "border-white/[0.1] text-white/30" : "border-slate-200 text-slate-300"
                  )}
                >
                  email@example.com
                </div>
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    isDark ? "border-white/[0.1] text-white/30" : "border-slate-200 text-slate-300"
                  )}
                >
                  ••••••••
                </div>
                <button
                  className="w-full rounded-lg py-2 text-sm font-semibold text-white"
                  style={{
                    backgroundColor: settings.emailHeaderColor,
                  }}
                >
                  Sign In
                </button>
              </div>

              {/* Preview Footer */}
              <div
                className={cn(
                  "px-6 py-3 border-t flex items-center justify-between text-xs",
                  isDark
                    ? "bg-slate-900/50 border-white/[0.06] text-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                )}
              >
                <span>
                  {settings.supportEmail || "ashir@valtriox.com"}
                </span>
                {!settings.removePoweredByFooter && (
                  <span>Powered by Valtriox</span>
                )}
              </div>
            </div>
          </div>

          {/* Preview indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PreviewIndicator
              label="Custom Domain"
              active={!!settings.customDomain}
              value={settings.customDomain || "Not set"}
              isDark={isDark}
            />
            <PreviewIndicator
              label="Portal Title"
              active={!!settings.customPortalTitle}
              value={settings.customPortalTitle || "Default"}
              isDark={isDark}
            />
            <PreviewIndicator
              label="Footer Removal"
              active={settings.removePoweredByFooter}
              value={settings.removePoweredByFooter ? "Removed" : "Visible"}
              isDark={isDark}
            />
            <PreviewIndicator
              label="Email Brand"
              active={!!settings.emailSenderName}
              value={settings.emailSenderName || "Valtriox"}
              isDark={isDark}
            />
          </div>
        </div>
      </SectionWrapper>

      {/* ================================================================ */}
      {/* Section E: Per-Brand White-Label Settings (Platform Owner Only) */}
      {/* ================================================================ */}
      {isPlatformOwner && (
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className={cardClass}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", isDark ? "bg-rose-500/10" : "bg-rose-100")}>
                    <Building2 className={cn("w-5 h-5", isDark ? "text-rose-400" : "text-rose-600")} />
                  </div>
                  <div>
                    <CardTitle className={cn("text-base", textClass)}>
                      Per-Brand White-Label Settings
                    </CardTitle>
                    <CardDescription className={textMutedClass}>
                      Configure white-label settings for each registered brand independently
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  className={cn(
                    isGold
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-rose-100 text-rose-700 border-rose-200"
                  )}
                >
                  Platform Owner
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!brandOrgs.length ? (
                <div className="text-center py-8">
                  <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                  <p className={cn("text-sm", textMutedClass)}>No brands loaded yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadBrandOrgs}
                    disabled={loadingOrgs}
                    className="mt-3"
                  >
                    {loadingOrgs ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Load Brands
                  </Button>
                </div>
              ) : (
                <ScrollArea className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className={isDark ? "border-white/[0.06]" : "border-slate-200"}>
                        <TableHead className={cn("text-xs", textMutedClass)}>Brand</TableHead>
                        <TableHead className={cn("text-xs", textMutedClass)}>Plan</TableHead>
                        <TableHead className={cn("text-xs", textMutedClass)}>Custom Domain</TableHead>
                        <TableHead className={cn("text-xs", textMutedClass)}>Branding</TableHead>
                        <TableHead className={cn("text-xs", textMutedClass)}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandOrgs.map((org) => {
                        const bs = brandSettingsMap[org.id];
                        const hasCustomization = bs && (
                          bs.customDomain ||
                          bs.removePoweredByFooter ||
                          bs.emailSenderName
                        );
                        return (
                          <TableRow
                            key={org.id}
                            className={isDark ? "border-white/[0.06]" : "border-slate-200"}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {org.logo ? (
                                  <img
                                    src={org.logo}
                                    alt={org.name}
                                    className="w-6 h-6 rounded object-cover"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                    {org.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className={cn("text-sm font-medium", textClass)}>
                                  {org.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  org.plan === "enterprise"
                                    ? isGold
                                      ? "bg-amber-500/20 text-amber-300"
                                      : "bg-amber-100 text-amber-700"
                                    : ""
                                )}
                              >
                                {org.plan || "starter"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={cn("text-sm", textMutedClass)}>
                                {bs?.customDomain || (
                                  <span className="text-slate-400">Not set</span>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              {hasCustomization ? (
                                <Badge className="bg-green-100 text-green-700 text-xs border-green-200">
                                  <Check className="w-3 h-3 mr-1" />
                                  Customized
                                </Badge>
                              ) : (
                                <span className={cn("text-xs", textMutedClass)}>Default</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => {
                                    setSelectedBrandId(org.id);
                                    loadBrandSettings(org.id);
                                  }}
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  disabled={savingBrandId === org.id}
                                  onClick={() => saveBrandSettings(org.id)}
                                >
                                  {savingBrandId === org.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  Sync
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {/* Selected Brand Detail Panel */}
              <AnimatePresence>
                {selectedBrandId && brandSettingsMap[selectedBrandId] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "mt-4 p-4 rounded-xl border",
                      isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className={cn("text-sm font-semibold", textClass)}>
                        Settings for Brand: {brandOrgs.find((o) => o.id === selectedBrandId)?.name}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedBrandId(null)}
                        className="h-7 px-2"
                      >
                        Close
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <InfoRow
                        label="Domain"
                        value={brandSettingsMap[selectedBrandId]?.customDomain || "Default"}
                        isDark={isDark}
                      />
                      <InfoRow
                        label="Footer Removed"
                        value={brandSettingsMap[selectedBrandId]?.removePoweredByFooter ? "Yes" : "No"}
                        isDark={isDark}
                      />
                      <InfoRow
                        label="Email Sender"
                        value={brandSettingsMap[selectedBrandId]?.emailSenderName || "Valtriox"}
                        isDark={isDark}
                      />
                      <InfoRow
                        label="Portal Title"
                        value={brandSettingsMap[selectedBrandId]?.customPortalTitle || "Default"}
                        isDark={isDark}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ================================================================ */}
      {/* Save Button */}
      {/* ================================================================ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex justify-end pt-2"
      >
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className={cn(
            "px-6 font-semibold transition-all",
            isGold
              ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black"
              : isDark
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
          )}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? "Saving..." : "Save White-Label Settings"}
        </Button>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function SectionWrapper({
  id,
  title,
  description,
  icon,
  expanded,
  onToggle,
  isDark,
  isGold,
  textClass,
  textMutedClass,
  cardClass,
  borderClass,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  isDark: boolean;
  isGold: boolean;
  textClass: string;
  textMutedClass: string;
  cardClass: string;
  borderClass: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div variants={sectionVariants} initial="hidden" animate="visible">
      <Card className={cardClass}>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={onToggle}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", isDark ? "bg-white/[0.06]" : "bg-slate-100")}>
                {icon}
              </div>
              <div>
                <CardTitle className={cn("text-base", textClass)}>{title}</CardTitle>
                <CardDescription className={textMutedClass}>{description}</CardDescription>
              </div>
            </div>
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className={cn("w-5 h-5", textClass)} />
            </motion.div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0">{children}</CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  isDark,
  borderClass,
  hoverBorderClass,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  isDark: boolean;
  borderClass: string;
  hoverBorderClass: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors",
        borderClass,
        hoverBorderClass
      )}
    >
      <div>
        <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-slate-800")}>
          {label}
        </p>
        <p className={cn("text-xs mt-0.5", isDark ? "text-slate-500" : "text-slate-500")}>
          {description}
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function PreviewIndicator({
  label,
  active,
  value,
  isDark,
}: {
  label: string;
  active: boolean;
  value: string;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            active ? "bg-green-500" : isDark ? "bg-white/20" : "bg-slate-300"
          )}
        />
        <span className={cn("text-xs font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
          {label}
        </span>
      </div>
      <p className={cn("text-sm", isDark ? "text-white" : "text-slate-900")}>
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  isDark,
}: {
  label: string;
  value: string;
  isDark: boolean;
}) {
  return (
    <div>
      <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>{label}</p>
      <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-slate-800")}>{value}</p>
    </div>
  );
}
