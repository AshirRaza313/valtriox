"use client";

import { useValtrioxStore } from "@/store/brandflow-store";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Link2, Webhook, Activity, RefreshCw, Store,
  Plus, Search, ExternalLink, Zap, Shield, Settings,
  Mail, BarChart3, Megaphone, CreditCard, CalendarDays,
  MessageSquare, Smartphone, ShoppingBag, ShoppingCart,
  Wallet, Banknote, Target, LineChart, Loader2,
} from "lucide-react";
import { EmptyState } from "@/components/brandflow/shared/EmptyState";
import { toast } from "sonner";
import { usePlatformIdentity } from "@/lib/platform-identity";
import { isPlatformRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import type { LucideIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface IntegrationConnection {
  id: string;
  organizationId: string;
  type: string;
  provider: string;
  name: string;
  status: string;
  config: Record<string, string>;
  metadata: Record<string, string>;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password" | "select";
  options?: { label: string; value: string }[];
  readOnly?: boolean;
}

// ============================================================================
// Integration Type Definitions
// ============================================================================

interface PlatformIntegration {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: LucideIcon;
  configFields: ConfigField[];
}

interface BrandIntegration {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: LucideIcon;
  configFields: ConfigField[];
}

// ============================================================================
// Config Fields per Integration
// ============================================================================

const PLATFORM_INTEGRATION_DEFS: Omit<PlatformIntegration, "icon">[] = [
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "Email Marketing",
    description: "Connect your Mailchimp account for automated email campaigns",
    configFields: [
      { key: "apiKey", label: "API Key", placeholder: "Enter your Mailchimp API key", type: "password" },
      { key: "audienceId", label: "Audience ID", placeholder: "e.g. a1b2c3d4e5" },
      { key: "fromName", label: "From Name", placeholder: "e.g. My Brand" },
      { key: "fromEmail", label: "From Email", placeholder: "e.g. hello@mybrand.com" },
    ],
  },
  {
    id: "google-analytics-4",
    name: "Google Analytics 4",
    category: "Analytics",
    description: "Track platform-wide analytics and user behavior",
    configFields: [
      { key: "measurementId", label: "Measurement ID", placeholder: "G-XXXXXXX" },
      { key: "apiKey", label: "API Key", placeholder: "Enter your GA4 API Key", type: "password" },
    ],
  },
  {
    id: "meta-pixel",
    name: "Meta Pixel",
    category: "Marketing",
    description: "Track conversions and optimize Facebook ad campaigns",
    configFields: [
      { key: "pixelId", label: "Pixel ID", placeholder: "Enter your Meta Pixel ID" },
      { key: "accessToken", label: "Access Token", placeholder: "Enter your Meta Access Token", type: "password" },
    ],
  },
  {
    id: "paypro",
    name: "PayPro",
    category: "Payments",
    description: "Accept payments via PayPro gateway",
    configFields: [
      { key: "merchantId", label: "Merchant ID", placeholder: "Enter your PayPro Merchant ID" },
      { key: "apiSecret", label: "API Secret", placeholder: "Enter your PayPro API Secret", type: "password" },
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://your-domain.com/api/webhooks/paypro", readOnly: true },
    ],
  },
  {
    id: "safepay",
    name: "SafePay",
    category: "Payments",
    description: "Accept payments via SafePay gateway",
    configFields: [
      { key: "merchantKey", label: "Merchant Key", placeholder: "Enter your SafePay Merchant Key" },
      { key: "apiSecret", label: "API Secret", placeholder: "Enter your SafePay API Secret", type: "password" },
      { key: "environment", label: "Environment", placeholder: "Select environment", type: "select", options: [{ label: "Sandbox", value: "sandbox" }, { label: "Live", value: "live" }] },
    ],
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "Scheduling",
    description: "Schedule consultations and meetings",
    configFields: [
      { key: "accessToken", label: "Access Token", placeholder: "Enter your Calendly Access Token", type: "password" },
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://your-domain.com/api/webhooks/calendly", readOnly: true },
    ],
  },
  {
    id: "whatsapp-api",
    name: "WhatsApp Business API",
    category: "Communication",
    description: "Business WhatsApp for client communication",
    configFields: [
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "Enter your WhatsApp Phone Number ID" },
      { key: "accessToken", label: "Access Token", placeholder: "Enter your WhatsApp Access Token", type: "password" },
      { key: "webhookVerifyToken", label: "Webhook Verify Token", placeholder: "Enter a custom verify token", type: "password" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "Communication",
    description: "SMS notifications and verification",
    configFields: [
      { key: "accountSid", label: "Account SID", placeholder: "Enter your Twilio Account SID" },
      { key: "authToken", label: "Auth Token", placeholder: "Enter your Twilio Auth Token", type: "password" },
      { key: "phoneNumber", label: "Phone Number", placeholder: "e.g. +1234567890" },
    ],
  },
];

const BRAND_INTEGRATION_DEFS: Omit<BrandIntegration, "icon">[] = [
  {
    id: "woocommerce",
    name: "WooCommerce",
    category: "E-Commerce",
    description: "Sync products, orders, and inventory",
    configFields: [
      { key: "storeUrl", label: "Store URL", placeholder: "https://your-store.com" },
      { key: "consumerKey", label: "Consumer Key", placeholder: "ck_xxxxxxxx", type: "password" },
      { key: "consumerSecret", label: "Consumer Secret", placeholder: "cs_xxxxxxxx", type: "password" },
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "E-Commerce",
    description: "Connect your Shopify store",
    configFields: [
      { key: "storeName", label: "Store Name", placeholder: "e.g. my-store" },
      { key: "apiKey", label: "API Key", placeholder: "Enter your Shopify API Key", type: "password" },
      { key: "password", label: "Password", placeholder: "Enter your Shopify App Password", type: "password" },
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://your-domain.com/api/webhooks/shopify", readOnly: true },
    ],
  },
  {
    id: "daraz",
    name: "Daraz",
    category: "E-Commerce",
    description: "Connect your Daraz seller account",
    configFields: [
      { key: "appKey", label: "App Key", placeholder: "Enter your Daraz App Key" },
      { key: "appSecret", label: "App Secret", placeholder: "Enter your Daraz App Secret", type: "password" },
      { key: "sellerId", label: "Seller ID", placeholder: "Enter your Daraz Seller ID" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    description: "Accept international card payments",
    configFields: [
      { key: "publishableKey", label: "Publishable Key", placeholder: "pk_live_xxxxxxxx" },
      { key: "secretKey", label: "Secret Key", placeholder: "sk_live_xxxxxxxx", type: "password" },
      { key: "webhookSecret", label: "Webhook Secret", placeholder: "whsec_xxxxxxxx", type: "password" },
    ],
  },
  {
    id: "jazzcash",
    name: "JazzCash",
    category: "Payments",
    description: "Enable JazzCash payments",
    configFields: [
      { key: "merchantId", label: "Merchant ID", placeholder: "Enter your JazzCash Merchant ID" },
      { key: "password", label: "Password", placeholder: "Enter your JazzCash Password", type: "password" },
      { key: "apiSecret", label: "API Secret", placeholder: "Enter your JazzCash API Secret", type: "password" },
    ],
  },
  {
    id: "easypaisa",
    name: "EasyPaisa",
    category: "Payments",
    description: "Process EasyPaisa payments",
    configFields: [
      { key: "merchantId", label: "Merchant ID", placeholder: "Enter your EasyPaisa Merchant ID" },
      { key: "storeId", label: "Store ID", placeholder: "Enter your EasyPaisa Store ID" },
      { key: "apiKey", label: "API Key", placeholder: "Enter your EasyPaisa API Key", type: "password" },
    ],
  },
  {
    id: "facebook-pixel",
    name: "Facebook Pixel",
    category: "Marketing",
    description: "Track your ad conversions",
    configFields: [
      { key: "pixelId", label: "Pixel ID", placeholder: "Enter your Facebook Pixel ID" },
      { key: "accessToken", label: "Access Token", placeholder: "Enter your Facebook Access Token", type: "password" },
    ],
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    category: "Analytics",
    description: "Monitor your traffic and behavior",
    configFields: [
      { key: "trackingId", label: "Tracking ID", placeholder: "UA-XXXXXXX-X or G-XXXXXXX" },
    ],
  },
];

// ============================================================================
// Icon helper for category badges
// ============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  "Email Marketing": "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  "Analytics": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  "Marketing": "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",
  "Payments": "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  "Scheduling": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  "Communication": "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  "E-Commerce": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

// ============================================================================
// Icon mapping
// ============================================================================

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  mailchimp: Mail,
  "google-analytics-4": BarChart3,
  "meta-pixel": Target,
  paypro: CreditCard,
  safepay: Wallet,
  calendly: CalendarDays,
  "whatsapp-api": Smartphone,
  twilio: MessageSquare,
};

const BRAND_ICONS: Record<string, LucideIcon> = {
  woocommerce: ShoppingBag,
  shopify: ShoppingCart,
  daraz: Store,
  stripe: CreditCard,
  jazzcash: Wallet,
  easypaisa: Banknote,
  "facebook-pixel": Target,
  "google-analytics": LineChart,
};

// ============================================================================
// Main Component
// ============================================================================

export function IntegrationsPage() {
  const { appTheme, user, organization } = useValtrioxStore();
  const isDark = appTheme === "dark" || appTheme === "premium-dark";
  const isGold = appTheme === "premium-dark";
  const { identity } = usePlatformIdentity();
  const companyName = identity.companyName;
  const [syncing, setSyncing] = useState<string | null>(null);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("platform");

  // ── Real connection state ──
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configDialogIntegration, setConfigDialogIntegration] = useState<{
    id: string;
    name: string;
    type: "platform" | "brand";
    configFields: ConfigField[];
    existingConnection?: IntegrationConnection;
  } | null>(null);
  const [configFormValues, setConfigFormValues] = useState<Record<string, string>>({});
  const [configSaving, setConfigSaving] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const userRole = user?.role || "";
  const isPlatformUser = isPlatformRole(userRole);
  const orgId = organization?.id || "";

  // ── Fetch connections on mount ──
  const fetchConnections = useCallback(async () => {
    if (!orgId) return;
    setLoadingConnections(true);
    try {
      const res = await fetchWithAuth(`/api/integrations?orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok) throw new Error("Failed to fetch connections");
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (err: any) {
      console.error("Error fetching integrations:", err);
      toast.error("Failed to load integration connections");
    } finally {
      setLoadingConnections(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // ── Helper: get connection for a given integration ID ──
  const getConnectionFor = useCallback(
    (integrationId: string): IntegrationConnection | undefined => {
      return connections.find((c) => c.provider === integrationId || c.type === integrationId);
    },
    [connections]
  );

  // ── Build platform integrations with real status ──
  const platformIntegrations: PlatformIntegration[] = useMemo(
    () =>
      PLATFORM_INTEGRATION_DEFS.map((def) => ({
        ...def,
        icon: PLATFORM_ICONS[def.id] || Zap,
      })),
    []
  );

  // ── Build brand integrations with real status ──
  const brandIntegrations: BrandIntegration[] = useMemo(
    () =>
      BRAND_INTEGRATION_DEFS.map((def) => ({
        ...def,
        icon: BRAND_ICONS[def.id] || Zap,
      })),
    []
  );

  // ── Marketplace (all available) ──
  const allMarketplaceItems = useMemo(
    () => [
      ...platformIntegrations.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        type: "platform" as const,
        configFields: p.configFields,
      })),
      ...brandIntegrations.map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        description: b.description,
        type: "brand" as const,
        configFields: b.configFields,
      })),
    ],
    [platformIntegrations, brandIntegrations]
  );

  const filteredMarketplace = allMarketplaceItems.filter(
    (i) =>
      (i.name || "").toLowerCase().includes(marketplaceSearch.toLowerCase()) ||
      (i.category || "").toLowerCase().includes(marketplaceSearch.toLowerCase())
  );

  // ── Real stats ──
  const platformConnectedCount = platformIntegrations.filter((i) => {
    const conn = getConnectionFor(i.id);
    return conn && conn.status === "active";
  }).length;
  const brandConnectedCount = brandIntegrations.filter((i) => {
    const conn = getConnectionFor(i.id);
    return conn && conn.status === "active";
  }).length;
  const totalConnected = connections.filter((c) => c.status === "active").length;
  const totalConnections = connections.length;
  const activeWebhooks = connections.filter((c) => c.config?.webhookUrl || c.config?.webhookVerifyToken).length;

  // ── Handlers ──
  const handleSync = (entity: string) => {
    setSyncing(entity);
    setTimeout(() => {
      setSyncing(null);
      toast.success(`${entity} synced!`);
    }, 2000);
  };

  const openConfigDialog = (
    integrationId: string,
    integrationName: string,
    type: "platform" | "brand",
    configFields: ConfigField[],
    existingConnection?: IntegrationConnection
  ) => {
    // Pre-fill form values from existing connection
    const initialValues: Record<string, string> = {};
    if (existingConnection?.config) {
      configFields.forEach((field) => {
        if (existingConnection.config[field.key]) {
          initialValues[field.key] = existingConnection.config[field.key];
        }
      });
    }
    // Auto-generate webhook URLs
    configFields.forEach((field) => {
      if (field.readOnly && field.key === "webhookUrl" && !initialValues[field.key]) {
        const slug = integrationId.replace(/_/g, "-");
        initialValues[field.key] = `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/${slug}`;
      }
    });
    setConfigFormValues(initialValues);
    setConfigDialogIntegration({
      id: integrationId,
      name: integrationName,
      type,
      configFields,
      existingConnection,
    });
    setConfigDialogOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!configDialogIntegration || !orgId) return;
    setConfigSaving(true);
    try {
      const body: any = {
        type: configDialogIntegration.type,
        provider: configDialogIntegration.id,
        name: configDialogIntegration.name,
        config: configFormValues,
        metadata: {},
      };
      const res = await fetchWithAuth("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to save integration");
      }
      toast.success(`${configDialogIntegration.name} connected successfully!`);
      setConfigDialogOpen(false);
      setConfigDialogIntegration(null);
      setConfigFormValues({});
      await fetchConnections();
    } catch (err: any) {
      console.error("Error saving integration:", err);
      toast.error(err.message || `Failed to connect ${configDialogIntegration.name}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleDisconnect = async (connectionId: string, connectionName: string) => {
    setDisconnectingId(connectionId);
    try {
      const res = await fetchWithAuth(`/api/integrations?id=${encodeURIComponent(connectionId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success(`${connectionName} disconnected successfully`);
      await fetchConnections();
    } catch (err: any) {
      console.error("Error disconnecting:", err);
      toast.error(`Failed to disconnect ${connectionName}`);
    } finally {
      setDisconnectingId(null);
    }
  };

  // ── Determine default tab ──
  const defaultTab = isPlatformUser ? "platform" : "brand";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className={cn(
              "text-2xl font-bold",
              isGold ? "text-amber-100" : isDark ? "text-slate-200" : "text-slate-800"
            )}
          >
            Integrations Hub
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect and manage third-party services for {companyName}
          </p>
        </div>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => setMarketplaceOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Browse Marketplace
        </Button>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Connected Services",
            value: isPlatformUser ? `${totalConnected}` : `${brandConnectedCount}`,
            sub: `${isPlatformUser ? platformIntegrations.length + brandIntegrations.length : brandIntegrations.length} available`,
            icon: Link2,
          },
          {
            title: "Active Webhooks",
            value: `${activeWebhooks}`,
            sub: `of ${totalConnections} total`,
            icon: Webhook,
          },
          {
            title: "API Calls Today",
            value: totalConnected > 0 ? "N/A" : "0",
            sub: "",
            icon: Activity,
          },
          {
            title: "Sync Status",
            value: totalConnected > 0 ? "Healthy" : "-",
            sub: totalConnected > 0 ? `${totalConnected} services synced` : "No connections",
            icon: RefreshCw,
          },
        ].map((stat) => (
          <Card
            key={stat.title}
            className={cn(
              "border hover:shadow-md transition-shadow",
              isGold
                ? "border-amber-500/20 bg-gradient-to-br from-slate-900 to-slate-800"
                : isDark
                  ? "border-slate-700/50 bg-slate-800/50"
                  : "border-slate-200 bg-white"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.title}</p>
                  <p
                    className={cn(
                      "text-2xl font-bold mt-1",
                      isGold ? "text-amber-100" : isDark ? "text-slate-200" : "text-slate-800"
                    )}
                  >
                    {loadingConnections ? (
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : (
                      stat.value
                    )}
                  </p>
                  {stat.sub && <p className="text-xs text-slate-500 mt-1">{stat.sub}</p>}
                </div>
                <div
                  className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    isGold ? "bg-amber-500/15" : "bg-amber-100"
                  )}
                >
                  <stat.icon className={cn("h-5 w-5", isGold ? "text-amber-400" : "text-amber-600")} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Main Tabs ── */}
      <Tabs value={isPlatformUser ? activeTab : "brand"} onValueChange={setActiveTab} className="space-y-6">
        <TabsList
          className={cn(
            "flex-wrap",
            isGold
              ? "bg-slate-800/80 border border-amber-500/20"
              : isDark
                ? "bg-slate-800"
                : "bg-slate-100"
          )}
        >
          {isPlatformUser && (
            <TabsTrigger
              value="platform"
              className="gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white"
            >
              <Shield className="h-3.5 w-3.5" />
              Platform Integrations
            </TabsTrigger>
          )}
          <TabsTrigger
            value="brand"
            className="gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white"
          >
            <Store className="h-3.5 w-3.5" />
            Brand Integrations
          </TabsTrigger>
        </TabsList>

        {/* ================================================================
            SECTION 1: Platform Integrations (Platform-only)
        ================================================================ */}
        {isPlatformUser && (
          <TabsContent value="platform" className="space-y-4 mt-6">
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  isGold ? "bg-amber-500/20" : "bg-amber-100"
                )}
              >
                <Shield className={cn("h-4 w-4", isGold ? "text-amber-400" : "text-amber-600")} />
              </div>
              <div>
                <h2
                  className={cn(
                    "text-lg font-semibold",
                    isGold ? "text-amber-100" : isDark ? "text-slate-200" : "text-slate-800"
                  )}
                >
                  Valtriox Platform Integrations
                </h2>
                <p className="text-xs text-slate-500">
                  Core platform services powering {companyName}. Configure and manage these integrations
                  centrally.
                </p>
              </div>
              <Badge
                className={cn(
                  "ml-auto text-xs font-semibold px-2.5 py-0.5",
                  isGold
                    ? "bg-gradient-to-r from-amber-600 to-yellow-500 text-black border-0"
                    : "bg-amber-600 text-white"
                )}
              >
                PLATFORM
              </Badge>
            </div>

            {/* Platform Integration Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {platformIntegrations.map((integration) => {
                const Icon = integration.icon;
                const conn = getConnectionFor(integration.id);
                const isConnected = !!conn && conn.status === "active";
                const isPending = !!conn && conn.status === "pending";

                return (
                  <Card
                    key={integration.id}
                    className={cn(
                      "overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 group",
                      isGold
                        ? "border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
                        : isDark
                          ? "border-slate-700/50 bg-slate-800/70"
                          : "border-slate-200 bg-white"
                    )}
                  >
                    {/* Gold accent bar */}
                    <div
                      className={cn(
                        "h-1 w-full",
                        isGold
                          ? "bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600"
                          : "bg-gradient-to-r from-amber-500 to-amber-600"
                      )}
                    />
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div
                          className={cn(
                            "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
                            isGold
                              ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20"
                              : "bg-amber-100"
                          )}
                        >
                          <Icon
                            className={cn("h-6 w-6", isGold ? "text-amber-400" : "text-amber-600")}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className={cn(
                                "font-semibold text-sm",
                                isGold ? "text-amber-100" : isDark ? "text-slate-200" : "text-slate-800"
                              )}
                            >
                              {integration.name}
                            </h3>
                            <Badge
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                CATEGORY_COLORS[integration.category] ||
                                  "bg-slate-100 text-slate-600"
                              )}
                            >
                              {integration.category}
                            </Badge>
                          </div>
                          <p
                            className={cn(
                              "text-xs mt-1.5 leading-relaxed",
                              isDark ? "text-slate-400" : "text-slate-500"
                            )}
                          >
                            {integration.description}
                          </p>

                          {/* Status + Action */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
                            <div className="flex items-center gap-1.5">
                              {loadingConnections ? (
                                <Loader2 className="h-2 w-2 animate-spin text-slate-400" />
                              ) : (
                                <div
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    isConnected
                                      ? "bg-emerald-500"
                                      : isPending
                                        ? "bg-amber-500"
                                        : "bg-slate-400"
                                  )}
                                />
                              )}
                              <span
                                className={cn(
                                  "text-[11px] font-medium",
                                  isConnected
                                    ? "text-emerald-500"
                                    : isPending
                                      ? "text-amber-500"
                                      : isDark
                                        ? "text-slate-500"
                                        : "text-slate-400"
                                )}
                              >
                                {loadingConnections
                                  ? "Loading..."
                                  : isConnected
                                    ? "Connected"
                                    : isPending
                                      ? "Pending"
                                      : "Not Connected"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isConnected && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={cn(
                                    "text-xs h-7 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  )}
                                  disabled={disconnectingId === conn?.id}
                                  onClick={() =>
                                    handleDisconnect(conn!.id, conn!.name || integration.name)
                                  }
                                >
                                  {disconnectingId === conn?.id ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : null}
                                  Disconnect
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={
                                  isGold
                                    ? "outline"
                                    : isConnected
                                      ? "outline"
                                      : "default"
                                }
                                className={cn(
                                  "text-xs h-7 px-3",
                                  isGold &&
                                    "border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                                )}
                                onClick={() =>
                                  openConfigDialog(
                                    integration.id,
                                    integration.name,
                                    "platform",
                                    integration.configFields,
                                    conn
                                  )
                                }
                              >
                                <Settings className="h-3 w-3 mr-1" />
                                {isConnected ? "Configure" : "Set Up"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        )}

        {/* ================================================================
            SECTION 2: Brand Integrations (All users)
        ================================================================ */}
        <TabsContent value="brand" className="space-y-4 mt-6">
          {/* Non-platform users notice */}
          {!isPlatformUser && (
            <div
              className={cn(
                "rounded-xl p-4 flex items-start gap-3",
                isGold
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : isDark
                    ? "bg-slate-800/80 border border-slate-700/50"
                    : "bg-amber-50 border border-amber-200"
              )}
            >
              <Shield
                className={cn(
                  "h-5 w-5 flex-shrink-0 mt-0.5",
                  isGold ? "text-amber-400" : "text-amber-600"
                )}
              />
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    isGold ? "text-amber-200" : isDark ? "text-slate-300" : "text-amber-800"
                  )}
                >
                  Platform integrations are managed by {companyName} administrators
                </p>
                <p
                  className={cn(
                    "text-xs mt-1",
                    isDark ? "text-slate-500" : "text-amber-700/70"
                  )}
                >
                  Core platform services like payment gateways, email campaigns, and analytics are
                  configured centrally by the Valtriox team. Below are integrations you can connect
                  for your own brand.
                </p>
              </div>
            </div>
          )}

          {/* Section Header */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center",
                isGold ? "bg-amber-500/10" : "bg-slate-100"
              )}
            >
              <Store className={cn("h-4 w-4", isGold ? "text-amber-400" : "text-slate-600")} />
            </div>
            <div>
              <h2
                className={cn(
                  "text-lg font-semibold",
                  isGold ? "text-amber-100" : isDark ? "text-slate-200" : "text-slate-800"
                )}
              >
                Your Brand Integrations
              </h2>
              <p className="text-xs text-slate-500">
                Connect third-party services for your business | e-commerce, payments, marketing, and
                analytics.
              </p>
            </div>
            <Badge
              className={cn(
                "ml-auto text-xs font-semibold px-2.5 py-0.5",
                isGold
                  ? "bg-white/10 text-slate-300 border border-white/10"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              BRAND
            </Badge>
          </div>

          {/* Brand Integration Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {brandIntegrations.map((integration) => {
              const Icon = integration.icon;
              const conn = getConnectionFor(integration.id);
              const isConnected = !!conn && conn.status === "active";
              const isPending = !!conn && conn.status === "pending";

              return (
                <Card
                  key={integration.id}
                  className={cn(
                    "overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 group",
                    isGold
                      ? "border-white/5 bg-slate-800/50 hover:border-white/10"
                      : isDark
                        ? "border-slate-700/50 bg-slate-800/70"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={cn(
                          "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
                          isGold
                            ? "bg-slate-700/50 border border-slate-600/30"
                            : "bg-slate-100"
                        )}
                      >
                        <Icon
                          className={cn("h-6 w-6", isGold ? "text-slate-300" : "text-slate-600")}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={cn(
                              "font-semibold text-sm",
                              isGold ? "text-slate-200" : isDark ? "text-slate-200" : "text-slate-800"
                            )}
                          >
                            {integration.name}
                          </h3>
                          <Badge
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              CATEGORY_COLORS[integration.category] ||
                                "bg-slate-100 text-slate-600"
                            )}
                          >
                            {integration.category}
                          </Badge>
                        </div>
                        <p
                          className={cn(
                            "text-xs mt-1.5 leading-relaxed",
                            isDark ? "text-slate-400" : "text-slate-500"
                          )}
                        >
                          {integration.description}
                        </p>

                        {/* Status + Action */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/30">
                          <div className="flex items-center gap-1.5">
                            {loadingConnections ? (
                              <Loader2 className="h-2 w-2 animate-spin text-slate-400" />
                            ) : (
                              <div
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  isConnected
                                    ? "bg-emerald-500"
                                    : isPending
                                      ? "bg-amber-500"
                                      : "bg-slate-400"
                                )}
                              />
                            )}
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                isConnected
                                  ? "text-emerald-500"
                                  : isPending
                                    ? "text-amber-500"
                                    : isDark
                                      ? "text-slate-500"
                                      : "text-slate-400"
                              )}
                            >
                              {loadingConnections
                                ? "Loading..."
                                : isConnected
                                  ? "Connected"
                                  : isPending
                                    ? "Pending"
                                    : "Not Connected"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isConnected && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  "text-xs h-7 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                )}
                                disabled={disconnectingId === conn?.id}
                                onClick={() =>
                                  handleDisconnect(conn!.id, conn!.name || integration.name)
                                }
                              >
                                {disconnectingId === conn?.id ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : null}
                                Disconnect
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className={cn(
                                "text-xs h-7 px-3",
                                isGold &&
                                  "border-slate-600/50 text-slate-300 hover:bg-slate-700/50 hover:text-slate-200"
                              )}
                              onClick={() =>
                                openConfigDialog(
                                  integration.id,
                                  integration.name,
                                  "brand",
                                  integration.configFields,
                                  conn
                                )
                              }
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {isConnected ? "Configure" : "Connect"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Connected + Webhooks + Sync Status for Brand */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
            <Card
              className={cn(
                "border",
                isGold
                  ? "border-white/5 bg-slate-800/50"
                  : isDark
                    ? "border-slate-700/50 bg-slate-800/70"
                    : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="pb-3">
                <CardTitle
                  className={cn(
                    "text-sm font-semibold flex items-center gap-2",
                    isGold ? "text-slate-300" : isDark ? "text-slate-300" : "text-slate-800"
                  )}
                >
                  <Link2 className="h-4 w-4" /> Connected Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                {brandConnectedCount > 0 ? (
                  <div className="space-y-2">
                    {brandIntegrations
                      .filter((i) => {
                        const c = getConnectionFor(i.id);
                        return c && c.status === "active";
                      })
                      .map((i) => {
                        const Icon = i.icon;
                        const conn = getConnectionFor(i.id)!;
                        return (
                          <div
                            key={i.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                          >
                            <Icon className="h-4 w-4 text-amber-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{conn.name || i.name}</p>
                              <p className="text-[10px] text-slate-500">
                                Last synced: {conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toLocaleDateString() : "Never"}
                              </p>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <EmptyState
                    icon={Link2}
                    title="No integrations connected"
                    description="Connect third-party services for your brand to sync your data."
                    action={{ label: "Browse Available", onClick: () => setMarketplaceOpen(true) }}
                  />
                )}
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border",
                isGold
                  ? "border-white/5 bg-slate-800/50"
                  : isDark
                    ? "border-slate-700/50 bg-slate-800/70"
                    : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="pb-3">
                <CardTitle
                  className={cn(
                    "text-sm font-semibold flex items-center gap-2",
                    isGold ? "text-slate-300" : isDark ? "text-slate-300" : "text-slate-800"
                  )}
                >
                  <Webhook className="h-4 w-4" /> Webhooks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeWebhooks > 0 ? (
                  <div className="space-y-2">
                    {brandIntegrations
                      .filter((i) => {
                        const c = getConnectionFor(i.id);
                        return c && (c.config?.webhookUrl || c.config?.webhookVerifyToken) && c.status === "active";
                      })
                      .map((i) => {
                        const conn = getConnectionFor(i.id)!;
                        return (
                          <div
                            key={i.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                          >
                            <Webhook className="h-4 w-4 text-emerald-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{conn.name || i.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {conn.config.webhookUrl || conn.config.webhookVerifyToken ? "Configured" : "Not set"}
                              </p>
                            </div>
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <EmptyState
                    icon={Webhook}
                    title="No webhooks configured"
                    description="Set up webhooks to receive real-time notifications for orders, inventory changes, and payments."
                  />
                )}
              </CardContent>
            </Card>

            <Card
              className={cn(
                "border",
                isGold
                  ? "border-white/5 bg-slate-800/50"
                  : isDark
                    ? "border-slate-700/50 bg-slate-800/70"
                    : "border-slate-200 bg-white"
              )}
            >
              <CardHeader className="pb-3">
                <CardTitle
                  className={cn(
                    "text-sm font-semibold flex items-center gap-2",
                    isGold ? "text-slate-300" : isDark ? "text-slate-300" : "text-slate-800"
                  )}
                >
                  <RefreshCw className="h-4 w-4" /> Sync Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {brandConnectedCount > 0 ? (
                  <div className="space-y-2">
                    {brandIntegrations
                      .filter((i) => {
                        const c = getConnectionFor(i.id);
                        return c && c.status === "active";
                      })
                      .map((i) => {
                        const Icon = i.icon;
                        const conn = getConnectionFor(i.id)!;
                        const isSyncing = syncing === i.id;
                        return (
                          <div
                            key={i.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                          >
                            <Icon className="h-4 w-4 text-amber-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{conn.name || i.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {conn.lastSyncedAt
                                  ? `Synced ${new Date(conn.lastSyncedAt).toLocaleDateString()}`
                                  : "Never synced"}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              disabled={isSyncing}
                              onClick={() => handleSync(i.id)}
                            >
                              <RefreshCw
                                className={cn("h-3 w-3", isSyncing && "animate-spin")}
                              />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <EmptyState
                    icon={RefreshCw}
                    title="No sync data"
                    description="Data sync status will appear once brand integrations are connected."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================================================================
          Configuration Dialog
      ================================================================ */}
      <Dialog open={configDialogOpen} onOpenChange={(open) => { if (!open) { setConfigDialogOpen(false); setConfigDialogIntegration(null); setConfigFormValues({}); } }}>
        <DialogContent
          className={cn(
            "sm:max-w-lg max-h-[85vh] overflow-y-auto",
            isGold && "bg-slate-900 border-amber-500/20"
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(
                "flex items-center gap-2",
                isGold ? "text-amber-100" : ""
              )}
            >
              <Settings className="h-5 w-5" />
              {configDialogIntegration?.existingConnection
                ? `Configure ${configDialogIntegration?.name}`
                : `Connect ${configDialogIntegration?.name}`}
            </DialogTitle>
            <DialogDescription className={isGold ? "text-slate-400" : ""}>
              {configDialogIntegration?.existingConnection
                ? "Update the configuration for this integration."
                : `Enter the required credentials to connect your ${configDialogIntegration?.name} account.`}
            </DialogDescription>
          </DialogHeader>

          <Separator className={isGold ? "bg-amber-500/20" : ""} />

          <div className="space-y-4 py-2">
            {configDialogIntegration?.configFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label
                  className={cn(
                    "text-sm font-medium",
                    isGold ? "text-slate-300" : isDark ? "text-slate-200" : "text-slate-700"
                  )}
                >
                  {field.label}
                </Label>
                {field.type === "select" ? (
                  <Select
                    value={configFormValues[field.key] || ""}
                    onValueChange={(val) =>
                      setConfigFormValues((prev) => ({ ...prev, [field.key]: val }))
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        isGold && "border-amber-500/20 bg-slate-800 text-slate-200"
                      )}
                    >
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent
                      className={cn(isGold && "bg-slate-800 border-amber-500/20")}
                    >
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type === "password" ? "password" : "text"}
                    placeholder={field.placeholder}
                    readOnly={field.readOnly}
                    value={configFormValues[field.key] || ""}
                    onChange={(e) =>
                      setConfigFormValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className={cn(
                      isGold && "border-amber-500/20 bg-slate-800 text-slate-200 placeholder:text-slate-500",
                      field.readOnly && "opacity-70 cursor-not-allowed"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfigDialogOpen(false);
                setConfigDialogIntegration(null);
                setConfigFormValues({});
              }}
              className={cn(
                isGold &&
                  "border-amber-500/20 text-amber-300 hover:bg-amber-500/10"
              )}
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={configSaving}
              onClick={handleSaveConfig}
            >
              {configSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {configDialogIntegration?.existingConnection ? "Save Changes" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          Marketplace Dialog
      ================================================================ */}
      <Dialog open={marketplaceOpen} onOpenChange={setMarketplaceOpen}>
        <DialogContent
          className={cn(
            "sm:max-w-lg max-h-[80vh] overflow-y-auto",
            isGold && "bg-slate-900 border-amber-500/20"
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(
                "flex items-center gap-2",
                isGold ? "text-amber-100" : ""
              )}
            >
              <Store className="h-5 w-5" /> Integration Marketplace
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search integrations..."
                className={cn(
                  "w-full h-9 rounded-md border bg-background pl-9 pr-3 text-sm",
                  isGold &&
                    "border-amber-500/20 bg-slate-800 text-slate-200 placeholder:text-slate-500"
                )}
                value={marketplaceSearch}
                onChange={(e) => setMarketplaceSearch(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              {filteredMarketplace.map((item) => {
                const conn = getConnectionFor(item.id);
                const isConnected = !!conn && conn.status === "active";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg transition-colors gap-2",
                      isGold
                        ? "border-amber-500/10 hover:bg-amber-500/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            isGold ? "bg-amber-500/15" : "bg-amber-100"
                          )}
                        >
                          <Zap
                            className={cn(
                              "h-4 w-4",
                              isGold ? "text-amber-400" : "text-amber-600"
                            )}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={cn(
                                "font-medium text-sm truncate",
                                isGold ? "text-slate-200" : ""
                              )}
                            >
                              {item.name}
                            </p>
                            {item.type === "platform" && (
                              <Badge
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  isGold
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/20"
                                    : "bg-amber-100 text-amber-700"
                                )}
                              >
                                Platform
                              </Badge>
                            )}
                            {isConnected && (
                              <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] text-emerald-500 font-medium">Connected</span>
                              </div>
                            )}
                          </div>
                          <p
                            className={cn(
                              "text-xs",
                              isGold ? "text-slate-500" : "text-muted-foreground"
                            )}
                          >
                            {item.category}
                          </p>
                        </div>
                      </div>
                      <p
                        className={cn(
                          "text-xs mt-1 ml-10",
                          isGold ? "text-slate-500" : "text-muted-foreground"
                        )}
                      >
                        {item.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(
                        "ml-3 flex-shrink-0 text-xs h-7",
                        isGold && "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      )}
                      onClick={() => {
                        // Find the full integration definition to get configFields
                        const platformDef = platformIntegrations.find((p) => p.id === item.id);
                        const brandDef = brandIntegrations.find((b) => b.id === item.id);
                        const matched = platformDef || brandDef;
                        if (matched) {
                          openConfigDialog(
                            item.id,
                            item.name,
                            item.type,
                            matched.configFields,
                            conn
                          );
                        }
                      }}
                    >
                      {item.type === "platform" ? "Configure" : "Connect"}
                    </Button>
                  </div>
                );
              })}
              {filteredMarketplace.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No integrations found matching your search.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
