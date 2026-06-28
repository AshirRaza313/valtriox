"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  User,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  MessageCircle,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  CreditCard,
  Palette,
  DollarSign,
  Save,
  Upload,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Shield,
  ImageIcon,
  Type,
  FileText,
  QrCode,
  Check,
  ArrowLeftRight,
  Hash,
  ShieldCheck,
  Users,
  Package,
  ShoppingCart,
  Timer,
  Lock,
  AlertTriangle,
  Eye,
  ExternalLink,
  Music,
  HardDrive,
  Cloud,
  Zap,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { isPlatformRole } from "@/lib/roles";
import { getFeaturesByPlan } from "@/lib/feature-lock";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// ============================================================================
// Types
// ============================================================================

interface PlatformSettingsData {
  id?: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  companyAddress: string;
  supportHours: string;
  whatsappNumber: string;
  instagramUrl: string;
  facebookUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  discordUrl: string;
  redditUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  socialLinksVisible: string;
  showInstagram: boolean;
  showFacebook: boolean;
  showTwitter: boolean;
  showLinkedin: boolean;
  showDiscord: boolean;
  showReddit: boolean;
  showYoutube: boolean;
  showTiktok: boolean;
  showWhatsApp: boolean;
  paymentMethods: PaymentMethod[];
  currency: string;
  logoUrl: string;
  faviconUrl: string;
  primaryBrandColor: string;
  secondaryBrandColor: string;
  currencySymbol: string;
  customCss: string;
  emailFooterText: string;
  invoiceHeaderText: string;
}

interface PaymentMethod {
  id: string;
  methodName: string;
  accountTitle: string;
  accountNumber: string;
  bankName: string;
  iban: string;
  qrCodeUrl: string;
  isActive: boolean;
}

// ============================================================================
// Sub-tabs Configuration
// ============================================================================

const subTabs = [
  { id: "personal", label: "Personal Details", icon: User },
  { id: "company", label: "Company Info", icon: Building2 },
  { id: "social", label: "Social Media", icon: Globe },
  { id: "contact", label: "Contact & Support", icon: Phone },
  { id: "plans", label: "Plans & Pricing", icon: DollarSign },
  { id: "payment", label: "Payment Methods", icon: CreditCard },
  { id: "storage", label: "Storage (Cloudinary)", icon: Cloud },
  { id: "branding", label: "Branding", icon: Palette },
];

// ============================================================================
// Animation Variants
// ============================================================================

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const presetColors = [
  "#D4A73A", "#D4A73A", "#dc2626", "#7c3aed", "#ec4899",
  "#0891b2", "#475569", "#ea580c", "#0d9488", "#2563eb",
  "#db2777", "#65a30d",
];

// ============================================================================
// Access Denied Component
// ============================================================================

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
            Platform settings are restricted to platform owners and administrators only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PlatformSettingsPage() {
  const { user, appTheme, setActiveSection } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [activeTab, setActiveTab] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbFixing, setDbFixing] = useState(false);
  const [regeneratingPdf, setRegeneratingPdf] = useState(false);

  // ── Settings State ──────────────────────────────────────────────────────

  const [settings, setSettings] = useState<PlatformSettingsData>({
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    companyWebsite: "",
    companyAddress: "",
    supportHours: "Mon-Fri: 9AM-6PM PKT",
    whatsappNumber: "",
    instagramUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    linkedinUrl: "",
    discordUrl: "",
    redditUrl: "",
    youtubeUrl: "",
    tiktokUrl: "",
    socialLinksVisible: "true",
    showInstagram: false,
    showFacebook: false,
    showTwitter: false,
    showLinkedin: false,
    showDiscord: false,
    showReddit: false,
    showYoutube: false,
    showTiktok: false,
    showWhatsApp: false,
    paymentMethods: [],
    currency: "PKR",
    logoUrl: "",
    faviconUrl: "",
    primaryBrandColor: "#D4A73A",
    secondaryBrandColor: "#D4A73A",
    currencySymbol: "Rs.",
    customCss: "",
    emailFooterText: "",
    invoiceHeaderText: "",
  });

  // ── Personal Details State ──────────────────────────────────────────────

  const [personalDetails, setPersonalDetails] = useState({
    fullName: "",
    email: "",
    phone: "",
    bio: "",
    position: "",
    profilePicture: "",
  });

  // ── Plans & Pricing State ───────────────────────────────────────────────
  const [plans, setPlans] = useState<Array<any>>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanForm, setEditPlanForm] = useState({
    price: "",
    annualPrice: "",
    orderLimit: "",
    teamLimit: "",
    productLimit: "",
    trialDays: "",
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // ── Feature Toggles State ───────────────────────────────────────────────
  const [lockedProfessional, setLockedProfessional] = useState<string[]>([]);
  const [lockedEnterprise, setLockedEnterprise] = useState<string[]>([]);
  const [loadingToggles, setLoadingToggles] = useState(false);
  const [savingToggles, setSavingToggles] = useState(false);
  const professionalFeatures = getFeaturesByPlan("professional");
  const enterpriseFeatures = getFeaturesByPlan("enterprise");

  // ── Cloudinary Storage Settings State ─────────────────────────────────────
  const [cloudinarySettings, setCloudinarySettings] = useState({
    cloudName: "",
    apiKey: "",
    apiSecret: "",
    enabled: false,
    folderPrefix: "org",
  });
  const [cloudinaryStatus, setCloudinaryStatus] = useState<{
    available: boolean;
    source: string;
    cloudName: string;
    apiKeyMasked?: string;
    apiSecretMasked?: string;
    enabled?: boolean;
    message?: string;
  } | null>(null);
  const [loadingCloudinary, setLoadingCloudinary] = useState(false);
  const [savingCloudinary, setSavingCloudinary] = useState(false);
  const [testingCloudinary, setTestingCloudinary] = useState(false);

  const fetchCloudinarySettings = useCallback(async () => {
    setLoadingCloudinary(true);
    try {
      const res = await fetchWithAuth("/api/admin/storage-settings");
      if (res.ok) {
        const data = await res.json();
        setCloudinaryStatus(data);
        // Pre-fill form with current values (masked keys show as empty for editing)
        setCloudinarySettings(prev => ({
          ...prev,
          cloudName: data.cloudName || "",
          enabled: data.enabled ?? false,
          folderPrefix: data.folderPrefix || "org",
          // Don't pre-fill API keys — user must enter them to change
        }));
      }
    } catch (err) {
      console.error("Failed to fetch Cloudinary settings:", err);
    }
    setLoadingCloudinary(false);
  }, []);

  const testCloudinaryConnection = useCallback(async () => {
    setTestingCloudinary(true);
    try {
      const res = await fetchWithAuth("/api/admin/storage-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudName: cloudinarySettings.cloudName,
          apiKey: cloudinarySettings.apiKey,
          apiSecret: cloudinarySettings.apiSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Connection successful!");
      } else {
        toast.error(data.message || "Connection failed. Check your credentials.");
      }
    } catch {
      toast.error("Connection test failed");
    }
    setTestingCloudinary(false);
  }, [cloudinarySettings]);

  const saveCloudinarySettings = useCallback(async () => {
    setSavingCloudinary(true);
    try {
      const res = await fetchWithAuth("/api/admin/storage-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloudinarySettings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Cloudinary settings saved!");
        await fetchCloudinarySettings();
      } else {
        toast.error(data.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save Cloudinary settings");
    }
    setSavingCloudinary(false);
  }, [cloudinarySettings, fetchCloudinarySettings]);

  // ── Payment Method Dialog ───────────────────────────────────────────────

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);
  const [paymentForm, setPaymentForm] = useState<Omit<PaymentMethod, "id">>({
    methodName: "",
    accountTitle: "",
    accountNumber: "",
    bankName: "",
    iban: "",
    qrCodeUrl: "",
    isActive: true,
  });

  // ── Logo/Favicon upload refs ────────────────────────────────────────────

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);

  // ── Access Check ────────────────────────────────────────────────────────

  const isPlatformAdmin = isPlatformRole(user?.role || "");

  // ── Theme Helpers ───────────────────────────────────────────────────────

  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const inputBg = isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200";
  const accentClass = isGold
    ? "text-amber-400 bg-amber-500/10"
    : "text-amber-400 bg-amber-500/10";
  const accentBtn = isGold
    ? "bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-black hover:opacity-90"
    : "bg-amber-600 text-white hover:bg-amber-700";
  const accentBorder = isGold
    ? "border-amber-500"
    : "border-amber-500";
  const accentText = isGold ? "text-amber-400" : "text-amber-400";

  // ============================================================================
  // Fetch Settings
  // ============================================================================

  const DEFAULT_SETTINGS_FALLBACK: PlatformSettingsData = {
    companyName: "Valtriox",
    companyEmail: "ashir@valtriox.com",
    companyPhone: "",
    companyWebsite: "",
    companyAddress: "",
    supportHours: "Mon-Fri: 9AM-6PM PKT",
    whatsappNumber: "",
    instagramUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    linkedinUrl: "",
    discordUrl: "",
    redditUrl: "",
    youtubeUrl: "",
    tiktokUrl: "",
    socialLinksVisible: "true",
    showInstagram: false,
    showFacebook: false,
    showTwitter: false,
    showLinkedin: false,
    showDiscord: false,
    showReddit: false,
    showYoutube: false,
    showTiktok: false,
    showWhatsApp: false,
    paymentMethods: [],
    currency: "PKR",
    logoUrl: "",
    faviconUrl: "",
    primaryBrandColor: "#D4A73A",
    secondaryBrandColor: "#D4A73A",
    currencySymbol: "Rs.",
    customCss: "",
    emailFooterText: "",
    invoiceHeaderText: "",
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/settings");
      const data = await res.json();
      const s = data.settings || {};

      // Even if the API returned an error, if it has fallback settings, use them
      if (!res.ok && !data.settings) {
        // API failed with no fallback data - use client-side defaults and warn
        setSettings(DEFAULT_SETTINGS_FALLBACK);
        if (user) {
          setPersonalDetails({
            fullName: user.name || "",
            email: user.email || "",
            phone: "",
            bio: "",
            position: user.role === "platform_owner" ? "Platform Owner" : user.role === "platform_admin" ? "Platform Admin" : "Administrator",
            profilePicture: user.image || "",
          });
        }
        toast.warning("Using default settings. Database is currently unavailable");
        return;
      }

      setSettings({
        id: s.id,
        companyName: s.companyName || DEFAULT_SETTINGS_FALLBACK.companyName,
        companyEmail: s.companyEmail || DEFAULT_SETTINGS_FALLBACK.companyEmail,
        companyPhone: s.companyPhone || "",
        companyWebsite: s.companyWebsite || "",
        companyAddress: s.companyAddress || "",
        supportHours: s.supportHours || DEFAULT_SETTINGS_FALLBACK.supportHours,
        whatsappNumber: s.whatsappNumber || "",
        instagramUrl: s.instagramUrl || "",
        facebookUrl: s.facebookUrl || "",
        twitterUrl: s.twitterUrl || "",
        linkedinUrl: s.linkedinUrl || "",
        discordUrl: s.discordUrl || "",
        redditUrl: s.redditUrl || "",
        youtubeUrl: s.youtubeUrl || "",
        tiktokUrl: s.tiktokUrl || "",
        socialLinksVisible: s.socialLinksVisible || DEFAULT_SETTINGS_FALLBACK.socialLinksVisible,
        showInstagram: s.showInstagram || false,
        showFacebook: s.showFacebook || false,
        showTwitter: s.showTwitter || false,
        showLinkedin: s.showLinkedin || false,
        showDiscord: s.showDiscord || false,
        showReddit: s.showReddit || false,
        showYoutube: s.showYoutube || false,
        showTiktok: s.showTiktok || false,
        showWhatsApp: s.showWhatsApp || false,
        paymentMethods: s.paymentMethods || [],
        currency: s.currency || DEFAULT_SETTINGS_FALLBACK.currency,
        logoUrl: s.logoUrl || "",
        faviconUrl: s.faviconUrl || "",
        primaryBrandColor: s.primaryBrandColor || DEFAULT_SETTINGS_FALLBACK.primaryBrandColor,
        secondaryBrandColor: s.secondaryBrandColor || DEFAULT_SETTINGS_FALLBACK.secondaryBrandColor,
        currencySymbol: s.currencySymbol || DEFAULT_SETTINGS_FALLBACK.currencySymbol,
        customCss: s.customCss || "",
        emailFooterText: s.emailFooterText || "",
        invoiceHeaderText: s.invoiceHeaderText || "",
      });
      // Set personal details from current user
      if (user) {
        setPersonalDetails({
          fullName: user.name || "",
          email: user.email || "",
          phone: s.companyPhone || "",
          bio: "",
          position: user.role === "platform_owner" ? "Platform Owner" : user.role === "platform_admin" ? "Platform Admin" : "Administrator",
          profilePicture: user.image || "",
        });
      }
      // Show appropriate message based on fallback reason
      if (data.fallback) {
        if (data.reason?.includes("not connected") || data.reason?.includes("DATABASE_URL")) {
          toast.error("Database not connected. Set DATABASE_URL in Vercel > Settings > Environment Variables.", { duration: 8000 });
        } else if (data.reason?.includes("not found") || data.reason?.includes("table")) {
          toast.warning("Database tables not found. Click 'Fix Database' to create them.", { duration: 6000 });
        }
        // Otherwise, silently use fallback settings (no warning for transient errors)
      }
    } catch (err) {
      // Network error or parse error - still render the page with defaults
      setSettings(DEFAULT_SETTINGS_FALLBACK);
      if (user) {
        setPersonalDetails({
          fullName: user.name || "",
          email: user.email || "",
          phone: "",
          bio: "",
          position: user.role === "platform_owner" ? "Platform Owner" : user.role === "platform_admin" ? "Platform Admin" : "Administrator",
          profilePicture: user.image || "",
        });
      }
      toast.warning("Could not connect to server. Showing default settings");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Fetch Plans ─────────────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/admin/plans?userId=${user?.id}`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    }
  }, [user?.id]);

  // ── Start Editing Plan ─────────────────────────────────────────────────
  const startEditingPlan = (plan: any) => {
    setEditingPlanId(plan.id);
    setEditPlanForm({
      price: String(plan.price ?? ""),
      annualPrice: String(plan.annualPrice ?? ""),
      orderLimit: String(plan.orderLimit ?? ""),
      teamLimit: String(plan.teamLimit ?? ""),
      productLimit: String(plan.productLimit ?? ""),
      trialDays: String(plan.trialDays ?? ""),
    });
  };

  const cancelEditingPlan = () => {
    setEditingPlanId(null);
    setEditPlanForm({ price: "", annualPrice: "", orderLimit: "", teamLimit: "", productLimit: "", trialDays: "" });
  };

  // ── Save Plan Properties ────────────────────────────────────────────────
  const savePlan = async (planId: string) => {
    const { price, annualPrice, orderLimit, teamLimit, productLimit, trialDays } = editPlanForm;
    if (!price || isNaN(Number(price)) || Number(price) < 0) {
      toast.error("Please enter a valid monthly price");
      return;
    }
    if (annualPrice && (isNaN(Number(annualPrice)) || Number(annualPrice) < 0)) {
      toast.error("Please enter a valid annual price");
      return;
    }
    setSavingPlan(true);
    try {
      const body: any = { planId, price: Number(price), userId: user?.id };
      if (annualPrice !== "") body.annualPrice = Number(annualPrice);
      if (orderLimit !== "") body.orderLimit = Number(orderLimit);
      if (teamLimit !== "") body.teamLimit = Number(teamLimit);
      if (productLimit !== "") body.productLimit = Number(productLimit);
      if (trialDays !== "") body.trialDays = Number(trialDays);

      const res = await fetchWithAuth("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("Plan updated successfully!");
        cancelEditingPlan();
        await fetchPlans();
      } else {
        toast.error("Failed to update plan");
      }
    } catch {
      toast.error("Failed to update plan");
    }
    setSavingPlan(false);
  };

  // ── Feature Toggles ─────────────────────────────────────────────────────
  const fetchFeatureToggles = useCallback(async () => {
    setLoadingToggles(true);
    try {
      const res = await fetchWithAuth("/api/admin/feature-toggles");
      if (res.ok) {
        const data = await res.json();
        setLockedProfessional(data.lockedGrowth || []);
        setLockedEnterprise(data.lockedEnterprise || []);
      }
    } catch (err) {
      console.error("Failed to fetch feature toggles:", err);
    }
    setLoadingToggles(false);
  }, []);

  const toggleProfessionalFeature = (featureId: string) => {
    setLockedProfessional((prev) =>
      prev.includes(featureId) ? prev.filter((f) => f !== featureId) : [...prev, featureId]
    );
  };

  const toggleEnterpriseFeature = (featureId: string) => {
    setLockedEnterprise((prev) =>
      prev.includes(featureId) ? prev.filter((f) => f !== featureId) : [...prev, featureId]
    );
  };

  const saveFeatureToggles = async () => {
    setSavingToggles(true);
    try {
      const res = await fetchWithAuth("/api/admin/feature-toggles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedGrowth: lockedProfessional, lockedEnterprise }),
      });
      if (res.ok) {
        toast.success("Feature toggles saved!");
      } else {
        toast.error("Failed to save feature toggles");
      }
    } catch {
      toast.error("Failed to save feature toggles");
    }
    setSavingToggles(false);
  };

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchSettings();
      fetchPlans();
      fetchFeatureToggles();
      fetchCloudinarySettings();
    }
  }, [isPlatformAdmin, fetchSettings, fetchPlans, fetchFeatureToggles, fetchCloudinarySettings]);

  // ============================================================================
  // Save Settings
  // ============================================================================

  const saveSettings = useCallback(async (section?: string) => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          ...settings,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.details || data.error || "Failed to save settings";
        console.error("[Settings] Save failed:", data);
        throw new Error(msg);
      }

      toast.success(section ? `${section} saved successfully!` : "Settings saved successfully!");
      // Refresh settings from server to confirm
      await fetchSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings", { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }, [settings, user?.id, fetchSettings]);

  // ── Regenerate Lead Magnet PDF ──
  const regeneratePdf = useCallback(async () => {
    setRegeneratingPdf(true);
    try {
      const res = await fetchWithAuth("/api/lead-magnet", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`PDF regenerated! (${(data.size / 1024).toFixed(0)}KB, ${data.pages} pages)`);
        // Open in new tab to preview
        window.open("/api/lead-magnet", "_blank");
      } else {
        toast.error(data.error || "Failed to regenerate PDF");
      }
    } catch {
      toast.error("Could not regenerate PDF");
    } finally {
      setRegeneratingPdf(false);
    }
  }, []);

  // ── Fix Database ──
  const fixDatabase = useCallback(async () => {
    setDbFixing(true);
    try {
      const res = await fetchWithAuth("/api/db/init", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Database tables created successfully! Refreshing settings...");
        await fetchSettings();
      } else {
        toast.error(data.error || "Failed to create tables. Check your DATABASE_URL.", { duration: 8000 });
      }
    } catch {
      toast.error("Could not connect to server.");
    } finally {
      setDbFixing(false);
    }
  }, [fetchSettings]);

  // ============================================================================
  // File Upload Helpers - Convert to base64 data URLs for DB persistence
  // ============================================================================

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }
    try {
      const dataUrl = await fileToBase64(file);
      setSettings((prev) => ({ ...prev, logoUrl: dataUrl }));
      toast.success("Logo uploaded! Save to apply.");
    } catch {
      toast.error("Failed to process image");
    }
  }, []);

  const handleFaviconUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Favicon must be less than 1MB");
      return;
    }
    try {
      const dataUrl = await fileToBase64(file);
      setSettings((prev) => ({ ...prev, faviconUrl: dataUrl }));
      toast.success("Favicon uploaded! Save to apply.");
    } catch {
      toast.error("Failed to process image");
    }
  }, []);

  const handleProfilePicUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }
    try {
      const dataUrl = await fileToBase64(file);
      setPersonalDetails((prev) => ({ ...prev, profilePicture: dataUrl }));
      toast.success("Profile picture updated!");
    } catch {
      toast.error("Failed to process image");
    }
  }, []);

  // ============================================================================
  // Payment Method CRUD
  // ============================================================================

  const openPaymentDialog = (method?: PaymentMethod) => {
    if (method) {
      setEditingPayment(method);
      setPaymentForm({
        methodName: method.methodName,
        accountTitle: method.accountTitle,
        accountNumber: method.accountNumber,
        bankName: method.bankName,
        iban: method.iban,
        qrCodeUrl: method.qrCodeUrl,
        isActive: method.isActive,
      });
    } else {
      setEditingPayment(null);
      setPaymentForm({
        methodName: "",
        accountTitle: "",
        accountNumber: "",
        bankName: "",
        iban: "",
        qrCodeUrl: "",
        isActive: true,
      });
    }
    setPaymentDialogOpen(true);
  };

  const savePaymentMethod = () => {
    if (!paymentForm.methodName.trim()) {
      toast.error("Method name is required");
      return;
    }
    if (!paymentForm.accountNumber.trim()) {
      toast.error("Account number is required");
      return;
    }

    const newMethod: PaymentMethod = {
      id: editingPayment?.id || `pm_${Date.now()}`,
      ...paymentForm,
    };

    let updatedMethods: PaymentMethod[];
    if (editingPayment) {
      updatedMethods = settings.paymentMethods.map((m) =>
        m.id === editingPayment.id ? newMethod : m
      );
    } else {
      updatedMethods = [...settings.paymentMethods, newMethod];
    }

    setSettings((prev) => ({ ...prev, paymentMethods: updatedMethods }));
    setPaymentDialogOpen(false);
    toast.success(editingPayment ? "Payment method updated" : "Payment method added");
  };

  const deletePaymentMethod = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.filter((m) => m.id !== id),
    }));
    toast.success("Payment method deleted");
  };

  const togglePaymentMethodStatus = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((m) =>
        m.id === id ? { ...m, isActive: !m.isActive } : m
      ),
    }));
  };

  // ============================================================================
  // Access Check Render
  // ============================================================================

  if (!isPlatformAdmin) {
    return <AccessDenied />;
  }

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <Card className={cardBg}>
          <CardContent className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-200 rounded animate-pulse" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-bold", textPrimary)}>Platform Settings</h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Configure platform owner profile, company info, and branding
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => fixDatabase()}
            disabled={dbFixing}
            variant="outline"
            className={cn("gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10")}
          >
            {dbFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            {dbFixing ? "Fixing..." : "Fix Database"}
          </Button>
          <Button
            onClick={() => regeneratePdf()}
            disabled={regeneratingPdf}
            variant="outline"
            className={cn("gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10")}
          >
            {regeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {regeneratingPdf ? "Generating..." : "Regenerate Lead PDF"}
          </Button>
          <Button
            onClick={() => saveSettings()}
            disabled={saving}
            className={cn("gap-2", accentBtn)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Changes
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <X className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchSettings} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sub-tabs */}
      <div className={cn("flex gap-1 border-b overflow-x-auto", isDark ? "border-white/[0.06]" : "border-slate-200")}>
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? isGold
                  ? "border-amber-400 text-amber-400"
                  : isDark
                    ? "border-amber-400 text-amber-400"
                    : "border-amber-600 text-amber-600"
                : isDark
                  ? "border-transparent text-slate-500 hover:text-slate-300"
                  : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ================================================================ */}
        {/* TAB 1: PERSONAL DETAILS                                          */}
        {/* ================================================================ */}
        {activeTab === "personal" && (
          <motion.div
            key="personal"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-3xl"
          >
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <User className="h-4 w-4" />
                  Owner Profile
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Your personal information as the platform owner
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Profile Picture */}
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className={cn(
                      "h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white overflow-hidden",
                      personalDetails.profilePicture
                        ? "bg-gradient-to-br from-amber-500 to-amber-700"
                        : isGold
                          ? "bg-gradient-to-br from-amber-500 to-amber-700"
                          : "bg-gradient-to-br from-amber-500 to-amber-700"
                    )}>
                      {personalDetails.profilePicture ? (
                        <img
                          src={personalDetails.profilePicture}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        personalDetails.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "AD"
                      )}
                    </div>
                    <button
                      onClick={() => profilePicInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-700 flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                    >
                      <Upload className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                    </button>
                    <input
                      ref={profilePicInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProfilePicUpload}
                    />
                  </div>
                  <div>
                    <p className={cn("text-sm font-semibold", textPrimary)}>
                      {personalDetails.fullName || "Platform Owner"}
                    </p>
                    <p className={cn("text-xs", textSecondary)}>
                      {personalDetails.position || "Administrator"}
                    </p>
                    <Badge variant="outline" className={cn("mt-1 text-[10px]", accentClass)}>
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Platform Admin
                    </Badge>
                  </div>
                </div>

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                {/* Full Name */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <User className="h-3.5 w-3.5 mr-1.5 inline" />
                    Full Name
                  </Label>
                  <Input
                    placeholder="Enter your full name"
                    value={personalDetails.fullName}
                    onChange={(e) => setPersonalDetails((p) => ({ ...p, fullName: e.target.value }))}
                    className={inputBg}
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <Mail className="h-3.5 w-3.5 mr-1.5 inline" />
                    Email Address
                  </Label>
                  <Input
                    type="email"
                    placeholder="owner@valtriox.com"
                    value={personalDetails.email}
                    onChange={(e) => setPersonalDetails((p) => ({ ...p, email: e.target.value }))}
                    className={inputBg}
                  />
                </div>

                {/* Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      <Phone className="h-3.5 w-3.5 mr-1.5 inline" />
                      Phone Number
                    </Label>
                    <Input
                      placeholder="+92 300 1234567"
                      value={personalDetails.phone}
                      onChange={(e) => setPersonalDetails((p) => ({ ...p, phone: e.target.value }))}
                      className={inputBg}
                    />
                  </div>

                  {/* Position/Title */}
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5 inline" />
                      Position / Title
                    </Label>
                    <Input
                      placeholder="Platform Owner"
                      value={personalDetails.position}
                      onChange={(e) => setPersonalDetails((p) => ({ ...p, position: e.target.value }))}
                      className={inputBg}
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <FileText className="h-3.5 w-3.5 mr-1.5 inline" />
                    Bio / About
                  </Label>
                  <Textarea
                    placeholder="Tell clients about yourself and the platform..."
                    rows={4}
                    value={personalDetails.bio}
                    onChange={(e) => setPersonalDetails((p) => ({ ...p, bio: e.target.value }))}
                    className={cn(inputBg, "resize-none")}
                  />
                  <p className={cn("text-xs", textSecondary)}>
                    {personalDetails.bio.length}/500 characters
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: COMPANY INFORMATION                                       */}
        {/* ================================================================ */}
        {activeTab === "company" && (
          <motion.div
            key="company"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-3xl"
          >
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <Building2 className="h-4 w-4" />
                  Company Information
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Business details shown across the portal and in communications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Company Name */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <Building2 className="h-3.5 w-3.5 mr-1.5 inline" />
                    Company Name
                  </Label>
                  <Input
                    placeholder="Valtriox"
                    value={settings.companyName}
                    onChange={(e) => setSettings((p) => ({ ...p, companyName: e.target.value }))}
                    className={inputBg}
                  />
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      <Mail className="h-3.5 w-3.5 mr-1.5 inline" />
                      Company Email
                    </Label>
                    <Input
                      type="email"
                      placeholder="ashir@valtriox.com"
                      value={settings.companyEmail}
                      onChange={(e) => setSettings((p) => ({ ...p, companyEmail: e.target.value }))}
                      className={inputBg}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      <Phone className="h-3.5 w-3.5 mr-1.5 inline" />
                      Company Phone
                    </Label>
                    <Input
                      placeholder="+92 300 1234567"
                      value={settings.companyPhone}
                      onChange={(e) => setSettings((p) => ({ ...p, companyPhone: e.target.value }))}
                      className={inputBg}
                    />
                  </div>
                </div>

                {/* Website */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <Globe className="h-3.5 w-3.5 mr-1.5 inline" />
                    Company Website
                  </Label>
                  <Input
                    placeholder="https://valtriox.com"
                    value={settings.companyWebsite}
                    onChange={(e) => setSettings((p) => ({ ...p, companyWebsite: e.target.value }))}
                    className={inputBg}
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <MapPin className="h-3.5 w-3.5 mr-1.5 inline" />
                    Company Address
                  </Label>
                  <Textarea
                    placeholder="123 Business Street, Lahore, Pakistan"
                    rows={2}
                    value={settings.companyAddress}
                    onChange={(e) => setSettings((p) => ({ ...p, companyAddress: e.target.value }))}
                    className={cn(inputBg, "resize-none")}
                  />
                </div>

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                {/* Logo & Favicon Uploads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Logo */}
                  <div className="space-y-3">
                    <Label className={cn(isDark && "text-slate-300")}>
                      <ImageIcon className="h-3.5 w-3.5 mr-1.5 inline" />
                      Company Logo
                    </Label>
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className={cn(
                        "h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors",
                        isDark
                          ? "border-white/10 hover:border-white/20 bg-white/[0.02]"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50"
                      )}
                    >
                      {settings.logoUrl ? (
                        <img
                          src={settings.logoUrl}
                          alt="Logo"
                          className="h-full w-full object-contain rounded-xl p-2"
                        />
                      ) : (
                        <>
                          <Upload className={cn("h-6 w-6 mb-1", textSecondary)} />
                          <p className={cn("text-xs", textSecondary)}>Click to upload logo</p>
                          <p className={cn("text-[10px]", textSecondary)}>SVG, PNG, JPG (max 2MB)</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </div>

                  {/* Favicon */}
                  <div className="space-y-3">
                    <Label className={cn(isDark && "text-slate-300")}>
                      <ImageIcon className="h-3.5 w-3.5 mr-1.5 inline" />
                      Favicon
                    </Label>
                    <div
                      onClick={() => faviconInputRef.current?.click()}
                      className={cn(
                        "h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors",
                        isDark
                          ? "border-white/10 hover:border-white/20 bg-white/[0.02]"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50"
                      )}
                    >
                      {settings.faviconUrl ? (
                        <img
                          src={settings.faviconUrl}
                          alt="Favicon"
                          className="h-12 w-12 object-contain rounded"
                        />
                      ) : (
                        <>
                          <Upload className={cn("h-6 w-6 mb-1", textSecondary)} />
                          <p className={cn("text-xs", textSecondary)}>Click to upload favicon</p>
                          <p className={cn("text-[10px]", textSecondary)}>ICO, PNG (max 1MB)</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFaviconUpload}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: SOCIAL MEDIA                                              */}
        {/* ================================================================ */}
        {activeTab === "social" && (
          <motion.div
            key="social"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-3xl"
          >
            {/* Social Links Visibility Toggle */}
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <Globe className="h-4 w-4" />
                  Social Media Links
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Configure your social media handles. Enabled links will be displayed to clients on the landing page, footer, and navbar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Show/Hide Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Eye className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <p className={cn("text-sm font-medium", textPrimary)}>Show Social Links to Clients</p>
                      <p className={cn("text-xs", textSecondary)}>When enabled, social icons appear on the public landing page</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.socialLinksVisible === "true"}
                    onCheckedChange={(checked) =>
                      setSettings((p) => ({ ...p, socialLinksVisible: checked ? "true" : "false" }))
                    }
                  />
                </div>

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                {/* Individual Social Platform Cards with Toggle + URL */}
                {[
                  { key: "instagram", showKey: "showInstagram" as const, label: "Instagram", icon: Instagram, iconColor: "text-pink-500", bgHover: "hover:border-pink-500/30", placeholder: "https://instagram.com/valtriox" },
                  { key: "facebook", showKey: "showFacebook" as const, label: "Facebook", icon: Facebook, iconColor: "text-blue-500", bgHover: "hover:border-blue-500/30", placeholder: "https://facebook.com/valtriox" },
                  { key: "twitter", showKey: "showTwitter" as const, label: "X (Twitter)", icon: Twitter, iconColor: "text-slate-300", bgHover: "hover:border-slate-400/30", placeholder: "https://x.com/valtriox" },
                  { key: "linkedin", showKey: "showLinkedin" as const, label: "LinkedIn", icon: Linkedin, iconColor: "text-blue-600", bgHover: "hover:border-blue-600/30", placeholder: "https://linkedin.com/company/valtriox" },
                  { key: "youtube", showKey: "showYoutube" as const, label: "YouTube", icon: Youtube, iconColor: "text-red-500", bgHover: "hover:border-red-500/30", placeholder: "https://youtube.com/@valtriox" },
                  { key: "discord", showKey: "showDiscord" as const, label: "Discord", icon: MessageCircle, iconColor: "text-indigo-400", bgHover: "hover:border-indigo-500/30", placeholder: "https://discord.gg/valtriox" },
                  { key: "reddit", showKey: "showReddit" as const, label: "Reddit", icon: Hash, iconColor: "text-orange-500", bgHover: "hover:border-orange-500/30", placeholder: "https://reddit.com/r/valtriox" },
                  { key: "tiktok", showKey: "showTiktok" as const, label: "TikTok", icon: Music, iconColor: "text-slate-300", bgHover: "hover:border-slate-400/30", placeholder: "https://tiktok.com/@valtriox" },
                  { key: "whatsapp", showKey: "showWhatsApp" as const, label: "WhatsApp", icon: Phone, iconColor: "text-green-500", bgHover: "hover:border-green-500/30", placeholder: "+92 300 1234567", isWhatsapp: true },
                ].map((platform) => {
                  const urlValue = platform.isWhatsapp
                    ? settings.whatsappNumber
                    : (settings as any)[`${platform.key}Url`];
                  const isEnabled = settings[platform.showKey];

                  return (
                    <div
                      key={platform.key}
                      className={cn(
                        "p-4 rounded-xl border transition-all duration-200",
                        isEnabled
                          ? cn("border-amber-500/30 bg-amber-500/[0.03]", platform.bgHover)
                          : cn("border-white/[0.06] bg-white/[0.01]", isDark ? "" : "bg-slate-50")
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center", isEnabled && "bg-amber-500/10")}>
                            <platform.icon className={cn("h-4 w-4", platform.iconColor, isEnabled && "text-amber-400")} />
                          </div>
                          <span className={cn("text-sm font-medium", isEnabled ? textPrimary : textSecondary)}>
                            {platform.label}
                          </span>
                          {isEnabled && (
                            <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                              <Check className="h-3 w-3 mr-1" /> Visible
                            </Badge>
                          )}
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) =>
                            setSettings((p) => ({ ...p, [platform.showKey]: checked }))
                          }
                        />
                      </div>
                      <Input
                        placeholder={platform.placeholder}
                        value={urlValue || ""}
                        onChange={(e) => {
                          if (platform.isWhatsapp) {
                            setSettings((p) => ({ ...p, whatsappNumber: e.target.value }));
                          } else {
                            setSettings((p) => ({ ...p, [`${platform.key}Url`]: e.target.value }));
                          }
                          // Auto-enable the show toggle when a URL is being typed
                          if (e.target.value.trim() && !settings[platform.showKey]) {
                            setSettings((p) => ({ ...p, [platform.showKey]: true }));
                          }
                        }}
                        className={cn(inputBg)}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Preview Card */}
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <Eye className="h-4 w-4" />
                  Live Preview
                </CardTitle>
                <CardDescription className={textSecondary}>
                  This is how your social links will appear to clients on the landing page
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "Instagram", url: settings.instagramUrl, color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
                    { name: "Facebook", url: settings.facebookUrl, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
                    { name: "LinkedIn", url: settings.linkedinUrl, color: "bg-blue-600/10 text-blue-400 border-blue-600/20" },
                    { name: "X", url: settings.twitterUrl, color: "bg-slate-500/10 text-slate-300 border-slate-500/20" },
                    { name: "YouTube", url: settings.youtubeUrl, color: "bg-red-500/10 text-red-400 border-red-500/20" },
                    { name: "Discord", url: settings.discordUrl, color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
                    { name: "Reddit", url: settings.redditUrl, color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
                    { name: "TikTok", url: settings.tiktokUrl, color: "bg-slate-400/10 text-slate-300 border-slate-400/20" },
                  ].map((link) => (
                    link.url ? (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors", link.color)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        {link.name}
                      </a>
                    ) : (
                      <span
                        key={link.name}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.06] text-slate-600 bg-white/[0.02]"
                      >
                        {link.name} (not set)
                      </span>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* TAB 4: CONTACT & SUPPORT                                         */}
        {/* ================================================================ */}
        {activeTab === "contact" && (
          <motion.div
            key="contact"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-3xl"
          >
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <Phone className="h-4 w-4" />
                  Contact & Support
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Support channels and contact details for your customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Support Hours */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <Clock className="h-3.5 w-3.5 mr-1.5 inline" />
                    Support Hours
                  </Label>
                  <Input
                    placeholder="Mon-Fri: 9AM-6PM PKT"
                    value={settings.supportHours}
                    onChange={(e) => setSettings((p) => ({ ...p, supportHours: e.target.value }))}
                    className={inputBg}
                  />
                  <p className={cn("text-xs", textSecondary)}>
                    Displayed on the landing page and client dashboard
                  </p>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5 inline" />
                    WhatsApp Number
                  </Label>
                  <Input
                    placeholder="+92 300 1234567"
                    value={settings.whatsappNumber}
                    onChange={(e) => setSettings((p) => ({ ...p, whatsappNumber: e.target.value }))}
                    className={inputBg}
                  />
                  <p className={cn("text-xs", textSecondary)}>
                    Used for customer support and order notifications. Also shown as a social link on the landing page.
                  </p>
                </div>

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                <p className={cn("text-xs", textSecondary)}>
                  <ArrowLeftRight className="h-3 w-3 mr-1 inline" />
                  Social media links have been moved to the <strong className="text-amber-400">Social Media</strong> tab above.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* TAB 4: PLANS & PRICING                                           */}
        {/* ================================================================ */}
        {activeTab === "plans" && (
          <motion.div
            key="plans"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-4xl"
          >
            {/* ── Plan Cards ────────────────────────────────────────────────── */}
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <DollarSign className="h-4 w-4" />
                  Subscription Plans & Pricing
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Manage plan properties shown to clients. Changes apply immediately.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {plans.map((plan: any) => {
                    const colors: Record<string, { bg: string; text: string; border: string }> = {
                      starter: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
                      professional: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
                      enterprise: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
                    };
                    const c = colors[plan.name] || colors.starter;
                    const features = typeof plan.features === "string" ? JSON.parse(plan.features) : (plan.features || []);
                    const isEditing = editingPlanId === plan.id;

                    return (
                      <div key={plan.id} className={cn(
                        "p-4 sm:p-5 rounded-xl border transition-all",
                        isEditing
                          ? isDark
                            ? "border-amber-500/30 bg-amber-500/[0.03]"
                            : "border-amber-300 bg-amber-50/50"
                          : isDark
                            ? "border-white/[0.06] hover:border-white/[0.12]"
                            : "border-slate-200 hover:border-slate-300"
                      )}>
                        {/* Plan Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className={cn("p-2 sm:p-2.5 rounded-lg shrink-0", c.bg)}>
                              <DollarSign className={cn("h-4 w-4 sm:h-5 sm:w-5", c.text)} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className={cn("font-bold capitalize text-sm sm:text-base", textPrimary)}>{plan.name}</h3>
                                <Badge className={cn("text-[9px] font-semibold", c.bg, c.text, c.border)}>{plan.period}</Badge>
                              </div>
                              {/* Summary line (non-editing mode) */}
                              {!isEditing && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] sm:text-xs mt-1 text-slate-400">
                                  <span className={cn("font-medium", accentText)}>
                                    {plan.price === 0 ? "Free" : `Rs. ${plan.price.toLocaleString()}/mo`}
                                  </span>
                                  {plan.annualPrice > 0 && (
                                    <span>
                                      Annual: Rs. {plan.annualPrice.toLocaleString()}
                                    </span>
                                  )}
                                  <span><Users className="h-3 w-3 inline mr-0.5" />{plan.teamLimit === -1 ? "Unlimited" : plan.teamLimit} team</span>
                                  <span><ShoppingCart className="h-3 w-3 inline mr-0.5" />{plan.orderLimit === -1 ? "Unlimited" : plan.orderLimit} orders</span>
                                  <span><Package className="h-3 w-3 inline mr-0.5" />{plan.productLimit === -1 ? "Unlimited" : plan.productLimit} products</span>
                                  <span><Timer className="h-3 w-3 inline mr-0.5" />{plan.trialDays}-day trial</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:gap-3 pl-12 sm:pl-0">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => savePlan(plan.id)}
                                  disabled={savingPlan}
                                  className={cn("h-8 gap-1 text-xs", accentBtn)}
                                >
                                  {savingPlan ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Save All
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditingPlan}
                                  className="h-8 text-slate-400 hover:text-white"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditingPlan(plan)}
                                className={cn("h-8 gap-1 text-xs", isDark ? "border-white/[0.1] text-slate-300 hover:bg-white/[0.05]" : "")}
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Editable Fields Grid */}
                        {isEditing && (
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {/* Monthly Price */}
                            <div className={cn("space-y-1.5 p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-slate-50")}>
                              <Label className={cn("text-[11px] font-medium", textSecondary)}>
                                <DollarSign className="h-3 w-3 inline mr-1" />Monthly Price (PKR)
                              </Label>
                              <Input
                                type="number"
                                value={editPlanForm.price}
                                onChange={(e) => setEditPlanForm((p) => ({ ...p, price: e.target.value }))}
                                className={cn("h-8 text-sm", inputBg)}
                                min={0}
                                placeholder="0"
                              />
                            </div>

                            {/* Annual Price */}
                            <div className={cn("space-y-1.5 p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-slate-50")}>
                              <Label className={cn("text-[11px] font-medium", textSecondary)}>
                                <DollarSign className="h-3 w-3 inline mr-1" />Annual Price (PKR)
                              </Label>
                              <Input
                                type="number"
                                value={editPlanForm.annualPrice}
                                onChange={(e) => setEditPlanForm((p) => ({ ...p, annualPrice: e.target.value }))}
                                className={cn("h-8 text-sm", inputBg)}
                                min={0}
                                placeholder="0 = no annual"
                              />
                            </div>

                            {/* Team Limit */}
                            <div className={cn("space-y-1.5 p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-slate-50")}>
                              <Label className={cn("text-[11px] font-medium", textSecondary)}>
                                <Users className="h-3 w-3 inline mr-1" />Team Member Limit
                              </Label>
                              <Input
                                type="number"
                                value={editPlanForm.teamLimit}
                                onChange={(e) => setEditPlanForm((p) => ({ ...p, teamLimit: e.target.value }))}
                                className={cn("h-8 text-sm", inputBg)}
                                placeholder="-1 = Unlimited"
                              />
                            </div>

                            {/* Order Limit */}
                            <div className={cn("space-y-1.5 p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-slate-50")}>
                              <Label className={cn("text-[11px] font-medium", textSecondary)}>
                                <ShoppingCart className="h-3 w-3 inline mr-1" />Order Limit (total)
                              </Label>
                              <Input
                                type="number"
                                value={editPlanForm.orderLimit}
                                onChange={(e) => setEditPlanForm((p) => ({ ...p, orderLimit: e.target.value }))}
                                className={cn("h-8 text-sm", inputBg)}
                                placeholder="-1 = Unlimited"
                              />
                            </div>

                            {/* Product Limit */}
                            <div className={cn("space-y-1.5 p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-slate-50")}>
                              <Label className={cn("text-[11px] font-medium", textSecondary)}>
                                <Package className="h-3 w-3 inline mr-1" />Product Limit
                              </Label>
                              <Input
                                type="number"
                                value={editPlanForm.productLimit}
                                onChange={(e) => setEditPlanForm((p) => ({ ...p, productLimit: e.target.value }))}
                                className={cn("h-8 text-sm", inputBg)}
                                placeholder="-1 = Unlimited"
                              />
                            </div>

                            {/* Trial Days */}
                            <div className={cn("space-y-1.5 p-3 rounded-lg", isDark ? "bg-white/[0.02]" : "bg-slate-50")}>
                              <Label className={cn("text-[11px] font-medium", textSecondary)}>
                                <Timer className="h-3 w-3 inline mr-1" />Trial Days
                              </Label>
                              <Input
                                type="number"
                                value={editPlanForm.trialDays}
                                onChange={(e) => setEditPlanForm((p) => ({ ...p, trialDays: e.target.value }))}
                                className={cn("h-8 text-sm", inputBg)}
                                min={0}
                                placeholder="14"
                              />
                            </div>
                          </div>
                        )}

                        {/* Features list */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {features.map((f: string, i: number) => (
                            <span key={i} className={cn("text-[11px] px-2 py-0.5 rounded-full", isDark ? "bg-white/[0.04] text-slate-400" : "bg-slate-100 text-slate-500")}>
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {plans.length === 0 && (
                  <div className={cn("text-center py-12", textSecondary)}>
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No plans found</p>
                    <p className="text-xs mt-1">Run the seed script to create default plans</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Feature Toggles ────────────────────────────────────────────── */}
            <Card className={cardBg}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                      <Lock className="h-4 w-4" />
                      Feature Toggles
                    </CardTitle>
                    <CardDescription className={textSecondary}>
                      Lock or unlock plan-specific features for all clients
                    </CardDescription>
                  </div>
                  <Button
                    onClick={saveFeatureToggles}
                    disabled={savingToggles}
                    className={cn("gap-2", accentBtn)}
                  >
                    {savingToggles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Toggles
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Warning */}
                <div className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  isDark
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-amber-50 border-amber-200"
                )}>
                  <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", isGold ? "text-amber-400" : "text-amber-600")} />
                  <p className={cn("text-xs leading-relaxed", isDark ? "text-amber-300/80" : "text-amber-700")}>
                    Toggling a feature <strong>OFF</strong> will lock it for <strong>ALL clients</strong> on that plan.
                    Toggling a feature <strong>ON</strong> will unlock it again.
                  </p>
                </div>

                {loadingToggles ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className={cn("h-6 w-6 animate-spin", textSecondary)} />
                  </div>
                ) : (
                  <>
                    {/* Professional Features */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-[10px] font-semibold", accentClass, "border border-amber-500/20")}>
                            PROFESSIONAL
                          </Badge>
                          <span className={cn("text-xs font-medium", textPrimary)}>
                            {professionalFeatures.length} features
                          </span>
                        </div>
                        <span className={cn("text-[11px]", textSecondary)}>
                          {lockedProfessional.length} locked
                        </span>
                      </div>
                      <div className={cn("rounded-lg border p-1", isDark ? "border-white/[0.06]" : "border-slate-200")}>
                        <div className="max-h-64 overflow-y-auto">
                          {professionalFeatures.map((feature) => {
                            const isLocked = lockedProfessional.includes(feature.id);
                            return (
                              <div
                                key={feature.id}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2 rounded-md transition-colors",
                                  isDark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50",
                                  isLocked && isDark && "opacity-60"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Lock className={cn("h-3.5 w-3.5 shrink-0", isLocked ? "text-red-400" : isDark ? "text-slate-400" : "text-slate-500")} />
                                  <span className={cn("text-sm truncate", isLocked ? textSecondary : textPrimary)}>
                                    {feature.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={cn("text-[10px] font-medium", isLocked ? "text-red-400" : isDark ? "text-slate-400" : "text-slate-500")}>
                                    {isLocked ? "Locked" : "Active"}
                                  </span>
                                  <Switch
                                    checked={!isLocked}
                                    onCheckedChange={() => toggleProfessionalFeature(feature.id)}
                                    className={cn(isLocked && "data-[state=checked]:bg-red-500")}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                    {/* Enterprise Features */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-[10px] font-semibold", "text-amber-400 bg-amber-500/10 border border-amber-500/20")}>
                            ENTERPRISE
                          </Badge>
                          <span className={cn("text-xs font-medium", textPrimary)}>
                            {enterpriseFeatures.length} features
                          </span>
                        </div>
                        <span className={cn("text-[11px]", textSecondary)}>
                          {lockedEnterprise.length} locked
                        </span>
                      </div>
                      <div className={cn("rounded-lg border p-1", isDark ? "border-white/[0.06]" : "border-slate-200")}>
                        <div className="max-h-64 overflow-y-auto">
                          {enterpriseFeatures.map((feature) => {
                            const isLocked = lockedEnterprise.includes(feature.id);
                            return (
                              <div
                                key={feature.id}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2 rounded-md transition-colors",
                                  isDark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50",
                                  isLocked && isDark && "opacity-60"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Lock className={cn("h-3.5 w-3.5 shrink-0", isLocked ? "text-red-400" : isDark ? "text-slate-400" : "text-slate-500")} />
                                  <span className={cn("text-sm truncate", isLocked ? textSecondary : textPrimary)}>
                                    {feature.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={cn("text-[10px] font-medium", isLocked ? "text-red-400" : isDark ? "text-slate-400" : "text-slate-500")}>
                                    {isLocked ? "Locked" : "Active"}
                                  </span>
                                  <Switch
                                    checked={!isLocked}
                                    onCheckedChange={() => toggleEnterpriseFeature(feature.id)}
                                    className={cn(isLocked && "data-[state=checked]:bg-red-500")}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* TAB 5: PAYMENT METHODS                                           */}
        {/* ================================================================ */}
        {activeTab === "payment" && (
          <motion.div
            key="payment"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-4xl"
          >
            <Card className={cardBg}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                      <CreditCard className="h-4 w-4" />
                      Payment Methods
                    </CardTitle>
                    <CardDescription className={textSecondary}>
                      Configure payment methods clients use for payment proofs
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => openPaymentDialog()}
                    className={cn("gap-2", accentBtn)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Method
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {settings.paymentMethods.length === 0 ? (
                  <div className={cn("text-center py-12", textSecondary)}>
                    <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No payment methods configured</p>
                    <p className="text-xs mt-1">
                      Add payment methods so clients can submit payment proofs
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {settings.paymentMethods.map((method, idx) => (
                      <motion.div
                        key={method.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          "rounded-xl border p-4 transition-all",
                          isDark
                            ? "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]"
                            : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
                          !method.isActive && "opacity-60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={cn(
                              "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                              method.isActive
                                ? isGold
                                  ? "bg-amber-500/10"
                                  : "bg-amber-500/10"
                                : "bg-slate-100 dark:bg-white/[0.03]"
                            )}>
                              <CreditCard className={cn(
                                "h-5 w-5",
                                method.isActive
                                  ? isGold ? "text-amber-400" : "text-amber-500"
                                  : "text-slate-400"
                              )} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={cn("text-sm font-semibold truncate", textPrimary)}>
                                  {method.methodName}
                                </p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-2 py-0",
                                    method.isActive
                                      ? isDark
                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                      : isDark
                                        ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                        : "bg-slate-100 text-slate-500 border-slate-200"
                                  )}
                                >
                                  {method.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <div className="mt-1 space-y-0.5">
                                <p className={cn("text-xs", textSecondary)}>
                                  <span className="font-medium">Title:</span> {method.accountTitle || "Not provided"}
                                </p>
                                <p className={cn("text-xs", textSecondary)}>
                                  <span className="font-medium">Account:</span> {method.accountNumber}
                                </p>
                                {method.bankName && (
                                  <p className={cn("text-xs", textSecondary)}>
                                    <span className="font-medium">Bank:</span> {method.bankName}
                                  </p>
                                )}
                                {method.iban && (
                                  <p className={cn("text-xs", textSecondary)}>
                                    <span className="font-medium">IBAN:</span> {method.iban}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => togglePaymentMethodStatus(method.id)}
                              className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                              )}
                              title={method.isActive ? "Deactivate" : "Activate"}
                            >
                              {method.isActive ? (
                                <Check className={cn("h-4 w-4", isGold ? "text-amber-400" : "text-amber-500")} />
                              ) : (
                                <X className="h-4 w-4 text-slate-400" />
                              )}
                            </button>
                            <button
                              onClick={() => openPaymentDialog(method)}
                              className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                              )}
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                            <button
                              onClick={() => deletePaymentMethod(method.id)}
                              className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                                isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"
                              )}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>

                        {/* QR Code Preview */}
                        {method.qrCodeUrl && (
                          <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : undefined }}>
                            <div className="flex items-center gap-2">
                              <QrCode className={cn("h-4 w-4", textSecondary)} />
                              <span className={cn("text-xs font-medium", textSecondary)}>QR Code</span>
                            </div>
                            <img
                              src={method.qrCodeUrl}
                              alt="QR Code"
                              className="h-20 w-20 mt-2 rounded-lg border" 
                              style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : undefined }}
                            />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* TAB: STORAGE (CLOUDINARY)                                        */}
        {/* ================================================================ */}
        {activeTab === "storage" && (
          <motion.div
            key="storage"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-3xl"
          >
            {/* Connection Status Card */}
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <Cloud className="h-4 w-4" />
                  Cloudinary Media Storage
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Client brand files (product images, logos, marketing assets) are stored on Cloudinary CDN.
                  Platform files (payment proofs, invoices) stay on Supabase Storage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Status Badge */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                    cloudinaryStatus?.available
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : loadingCloudinary
                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                  )}>
                    {cloudinaryStatus?.available ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        {cloudinaryStatus?.source === "env" ? "Active (Environment Variables)" : "Active (Database Config)"}
                      </>
                    ) : loadingCloudinary ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <X className="h-3.5 w-3.5" />
                        Not Configured
                      </>
                    )}
                  </div>
                </div>

                {cloudinaryStatus?.message && (
                  <p className={cn("text-sm", textSecondary)}>{cloudinaryStatus.message}</p>
                )}

                {/* Current Config Display */}
                {cloudinaryStatus?.available && (
                  <div className={cn("rounded-lg p-4 space-y-2", isDark ? "bg-white/[0.02] border border-white/[0.04]" : "bg-slate-50 border border-slate-100")}>
                    <p className={cn("text-xs font-medium uppercase tracking-wider", textSecondary)}>Current Configuration</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className={textSecondary}>Cloud Name:</span>{" "}
                        <span className={textPrimary}>{cloudinaryStatus.cloudName}</span>
                      </div>
                      <div>
                        <span className={textSecondary}>API Key:</span>{" "}
                        <span className={textPrimary}>{cloudinaryStatus.apiKeyMasked || "Not set"}</span>
                      </div>
                      <div>
                        <span className={textSecondary}>API Secret:</span>{" "}
                        <span className={textPrimary}>{cloudinaryStatus.apiSecretMasked || "Not set"}</span>
                      </div>
                      <div>
                        <span className={textSecondary}>Folder Prefix:</span>{" "}
                        <span className={textPrimary}>{cloudinaryStatus.folderPrefix || "org"}</span>
                      </div>
                    </div>
                  </div>
                )}

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                {/* Configuration Form */}
                <div className="space-y-4">
                  <p className={cn("text-sm font-medium", textPrimary)}>Update Cloudinary Configuration</p>

                  {/* Cloud Name */}
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      Cloud Name <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      placeholder="your-cloud-name"
                      value={cloudinarySettings.cloudName}
                      onChange={(e) => setCloudinarySettings(prev => ({ ...prev, cloudName: e.target.value }))}
                      className={inputBg}
                    />
                    <p className={cn("text-xs", textSecondary)}>
                      Found in Cloudinary Dashboard → Settings → Cloud name
                    </p>
                  </div>

                  {/* API Key */}
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      API Key <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="password"
                      placeholder="Enter new API key (leave empty to keep current)"
                      value={cloudinarySettings.apiKey}
                      onChange={(e) => setCloudinarySettings(prev => ({ ...prev, apiKey: e.target.value }))}
                      className={inputBg}
                    />
                    <p className={cn("text-xs", textSecondary)}>
                      Dashboard → Settings → API Keys → API Key
                    </p>
                  </div>

                  {/* API Secret */}
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      API Secret <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="password"
                      placeholder="Enter new API secret (leave empty to keep current)"
                      value={cloudinarySettings.apiSecret}
                      onChange={(e) => setCloudinarySettings(prev => ({ ...prev, apiSecret: e.target.value }))}
                      className={inputBg}
                    />
                    <p className={cn("text-xs", textSecondary)}>
                      Dashboard → Settings → API Keys → API Secret
                    </p>
                  </div>

                  {/* Folder Prefix */}
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      Folder Prefix
                    </Label>
                    <Input
                      placeholder="org"
                      value={cloudinarySettings.folderPrefix}
                      onChange={(e) => setCloudinarySettings(prev => ({ ...prev, folderPrefix: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "") }))}
                      className={inputBg}
                    />
                    <p className={cn("text-xs", textSecondary)}>
                      Client files stored as: {cloudinarySettings.folderPrefix || "org"}-{"{orgId}"} / bucket / file
                    </p>
                  </div>

                  {/* Enable Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className={cn(isDark && "text-slate-300")}>Enable Cloudinary</Label>
                      <p className={cn("text-xs mt-0.5", textSecondary)}>
                        When disabled, files use Supabase Storage as fallback
                      </p>
                    </div>
                    <Switch
                      checked={cloudinarySettings.enabled}
                      onCheckedChange={(checked) => setCloudinarySettings(prev => ({ ...prev, enabled: checked }))}
                    />
                  </div>
                </div>

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={testCloudinaryConnection}
                    disabled={testingCloudinary || !cloudinarySettings.cloudName || !cloudinarySettings.apiKey || !cloudinarySettings.apiSecret}
                    variant="outline"
                    className={cn("gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10")}
                  >
                    {testingCloudinary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {testingCloudinary ? "Testing..." : "Test Connection"}
                  </Button>
                  <Button
                    onClick={saveCloudinarySettings}
                    disabled={savingCloudinary}
                    className={cn("gap-2", accentBtn)}
                  >
                    {savingCloudinary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingCloudinary ? "Saving..." : "Save Cloudinary Config"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Architecture Info Card */}
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <HardDrive className="h-4 w-4" />
                  Storage Architecture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={cn("rounded-lg p-4", isDark ? "bg-blue-500/5 border border-blue-500/10" : "bg-blue-50 border border-blue-100")}>
                    <p className={cn("text-sm font-medium text-blue-400 flex items-center gap-1.5")}>
                      <Cloud className="h-3.5 w-3.5" />
                      Cloudinary (Client Files)
                    </p>
                    <ul className={cn("text-xs mt-2 space-y-1", textSecondary)}>
                      <li>• Product images</li>
                      <li>• Brand logos & assets</li>
                      <li>• Chat attachments</li>
                      <li>• Marketing materials</li>
                      <li>• Auto image optimization</li>
                      <li>• CDN worldwide delivery</li>
                      <li>• On-the-fly transformations</li>
                    </ul>
                  </div>
                  <div className={cn("rounded-lg p-4", isDark ? "bg-green-500/5 border border-green-500/10" : "bg-green-50 border border-green-100")}>
                    <p className={cn("text-sm font-medium text-green-400 flex items-center gap-1.5")}>
                      <HardDrive className="h-3.5 w-3.5" />
                      Supabase (Platform Files)
                    </p>
                    <ul className={cn("text-xs mt-2 space-y-1", textSecondary)}>
                      <li>• Payment proofs</li>
                      <li>• Invoice PDFs</li>
                      <li>• Platform documents</li>
                      <li>• System assets</li>
                      <li>• Row-level security (RLS)</li>
                      <li>• Admin-only access</li>
                      <li>• Private by default</li>
                    </ul>
                  </div>
                </div>

                <div className={cn("rounded-lg p-3", isDark ? "bg-amber-500/5 border border-amber-500/10" : "bg-amber-50 border border-amber-100")}>
                  <p className={cn("text-xs text-amber-400 font-medium flex items-center gap-1.5")}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Storage Limits (Enforced by Valtriox per Subscription Plan)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {[
                      { plan: "Starter", storage: "5 GB" },
                      { plan: "Growth", storage: "20 GB" },
                      { plan: "Professional", storage: "50 GB" },
                      { plan: "Enterprise", storage: "Unlimited" },
                    ].map(item => (
                      <div key={item.plan} className={cn("text-center py-2 rounded-md", isDark ? "bg-white/[0.03]" : "bg-white")}>
                        <p className={cn("text-xs font-medium", textPrimary)}>{item.plan}</p>
                        <p className={cn("text-xs font-bold", accentText)}>{item.storage}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cloudinary Setup Guide */}
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <Eye className="h-4 w-4" />
                  Cloudinary Setup Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className={cn("text-sm space-y-3", textSecondary)}>
                  <li className="flex gap-3">
                    <span className={cn("flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold", isGold ? "bg-amber-500/20 text-amber-400" : "bg-amber-500/20 text-amber-600")}>1</span>
                    <span>Go to <a href="https://cloudinary.com/users/register_free" target="_blank" rel="noopener" className="text-blue-400 underline hover:text-blue-300">cloudinary.com</a> and create a free account</span>
                  </li>
                  <li className="flex gap-3">
                    <span className={cn("flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold", isGold ? "bg-amber-500/20 text-amber-400" : "bg-amber-500/20 text-amber-600")}>2</span>
                    <span>Go to Dashboard → Settings → copy <b>Cloud name</b>, <b>API Key</b>, and <b>API Secret</b></span>
                  </li>
                  <li className="flex gap-3">
                    <span className={cn("flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold", isGold ? "bg-amber-500/20 text-amber-400" : "bg-amber-500/20 text-amber-600")}>3</span>
                    <span>Paste credentials above, click <b>"Test Connection"</b> to verify</span>
                  </li>
                  <li className="flex gap-3">
                    <span className={cn("flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold", isGold ? "bg-amber-500/20 text-amber-400" : "bg-amber-500/20 text-amber-600")}>4</span>
                    <span>Click <b>"Save Cloudinary Config"</b> to activate | client uploads will now use Cloudinary CDN</span>
                  </li>
                </ol>
                <div className={cn("rounded-lg p-3", isDark ? "bg-white/[0.02] border border-white/[0.04]" : "bg-slate-50 border border-slate-100")}>
                  <p className={cn("text-xs font-medium", textPrimary)}>Free Plan Limits</p>
                  <p className={cn("text-xs mt-1", textSecondary)}>
                    25 credits/month (1 credit = 1,000 transformations OR 1 GB storage OR 1 GB bandwidth).
                    Sufficient for Starter clients. Upgrade Cloudinary plan as client base grows.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ================================================================ */}
        {/* TAB 5: BRANDING & APPEARANCE                                     */}
        {/* ================================================================ */}
        {activeTab === "branding" && (
          <motion.div
            key="branding"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-3xl"
          >
            <Card className={cardBg}>
              <CardHeader>
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <Palette className="h-4 w-4" />
                  Brand Colors
                </CardTitle>
                <CardDescription className={textSecondary}>
                  Define the visual identity of your platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Primary Brand Color */}
                <div className="space-y-3">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <Palette className="h-3.5 w-3.5 mr-1.5 inline" />
                    Primary Brand Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg border-2 cursor-pointer"
                      style={{
                        backgroundColor: settings.primaryBrandColor,
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0",
                      }}
                    />
                    <Input
                      type="text"
                      value={settings.primaryBrandColor}
                      onChange={(e) => setSettings((p) => ({ ...p, primaryBrandColor: e.target.value }))}
                      className={cn("w-32 font-mono text-sm", inputBg)}
                      placeholder="#D4A73A"
                    />
                    <input
                      type="color"
                      value={settings.primaryBrandColor}
                      onChange={(e) => setSettings((p) => ({ ...p, primaryBrandColor: e.target.value }))}
                      className="h-10 w-10 rounded-lg cursor-pointer border-0"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSettings((p) => ({ ...p, primaryBrandColor: color }))}
                        className={cn(
                          "h-7 w-7 rounded-lg transition-transform hover:scale-110",
                          settings.primaryBrandColor === color && "ring-2 ring-offset-2 ring-offset-transparent scale-110"
                        )}
                        style={{
                          backgroundColor: color,
                          ringColor: color,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="space-y-3">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5 inline" />
                    Secondary Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg border-2 cursor-pointer"
                      style={{
                        backgroundColor: settings.secondaryBrandColor,
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0",
                      }}
                    />
                    <Input
                      type="text"
                      value={settings.secondaryBrandColor}
                      onChange={(e) => setSettings((p) => ({ ...p, secondaryBrandColor: e.target.value }))}
                      className={cn("w-32 font-mono text-sm", inputBg)}
                      placeholder="#D4A73A"
                    />
                    <input
                      type="color"
                      value={settings.secondaryBrandColor}
                      onChange={(e) => setSettings((p) => ({ ...p, secondaryBrandColor: e.target.value }))}
                      className="h-10 w-10 rounded-lg cursor-pointer border-0"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSettings((p) => ({ ...p, secondaryBrandColor: color }))}
                        className={cn(
                          "h-7 w-7 rounded-lg transition-transform hover:scale-110",
                          settings.secondaryBrandColor === color && "ring-2 ring-offset-2 ring-offset-transparent scale-110"
                        )}
                        style={{
                          backgroundColor: color,
                          ringColor: color,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Color Preview */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>Gradient Preview</Label>
                  <div
                    className="h-16 rounded-xl flex items-center justify-center text-white font-semibold text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${settings.primaryBrandColor} 0%, ${settings.secondaryBrandColor} 100%)`,
                    }}
                  >
                    Valtriox Portal
                  </div>
                </div>

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                {/* Currency Symbol */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      <DollarSign className="h-3.5 w-3.5 mr-1.5 inline" />
                      Currency Symbol
                    </Label>
                    <Input
                      placeholder="Rs."
                      value={settings.currencySymbol}
                      onChange={(e) => setSettings((p) => ({ ...p, currencySymbol: e.target.value }))}
                      className={inputBg}
                    />
                    <p className={cn("text-xs", textSecondary)}>
                      Displayed on invoices and reports
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className={cn(isDark && "text-slate-300")}>
                      <Hash className="h-3.5 w-3.5 mr-1.5 inline" />
                      Currency Code
                    </Label>
                    <Input
                      placeholder="PKR"
                      value={settings.currency}
                      onChange={(e) => setSettings((p) => ({ ...p, currency: e.target.value }))}
                      className={inputBg}
                    />
                  </div>
                </div>

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                {/* Email Footer Text */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <Type className="h-3.5 w-3.5 mr-1.5 inline" />
                    Email Footer Text
                  </Label>
                  <Textarea
                    placeholder="Powered by Valtriox | https://valtriox.com"
                    rows={2}
                    value={settings.emailFooterText}
                    onChange={(e) => setSettings((p) => ({ ...p, emailFooterText: e.target.value }))}
                    className={cn(inputBg, "resize-none")}
                  />
                  <p className={cn("text-xs", textSecondary)}>
                    Appended to all outgoing platform emails
                  </p>
                </div>

                {/* Invoice Header Text */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <FileText className="h-3.5 w-3.5 mr-1.5 inline" />
                    Invoice Header Text
                  </Label>
                  <Textarea
                    placeholder="BRANDFLOW - Official Invoice"
                    rows={2}
                    value={settings.invoiceHeaderText}
                    onChange={(e) => setSettings((p) => ({ ...p, invoiceHeaderText: e.target.value }))}
                    className={cn(inputBg, "resize-none")}
                  />
                </div>

                <Separator className={isDark ? "border-white/[0.06]" : "border-slate-200"} />

                {/* Custom CSS */}
                <div className="space-y-2">
                  <Label className={cn(isDark && "text-slate-300")}>
                    <Type className="h-3.5 w-3.5 mr-1.5 inline" />
                    Custom CSS
                    <span className={cn("ml-2 text-[10px] px-1.5 py-0.5 rounded", isDark ? "bg-white/5 text-slate-500" : "bg-slate-100 text-slate-500")}>
                      Advanced
                    </span>
                  </Label>
                  <Textarea
                    placeholder="/* Custom CSS for advanced styling */&#10;.my-class { color: red; }"
                    rows={6}
                    value={settings.customCss}
                    onChange={(e) => setSettings((p) => ({ ...p, customCss: e.target.value }))}
                    className={cn(inputBg, "font-mono text-xs resize-none")}
                  />
                  <p className={cn("text-xs", textSecondary)}>
                    Injected into the portal for advanced customizations. Use with caution.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Lead Magnet PDF Info Card - shown below any active tab */}
        <Card className={cardBg}>
          <CardHeader>
            <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
              <FileText className="h-4 w-4" />
              Lead Magnet PDF
            </CardTitle>
            <CardDescription className={textSecondary}>
              The PDF guide sent to new leads after form submission. Auto-generated from your current settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <p className={cn("text-xs", textSecondary)}>
                  Uses your <strong className={textPrimary}>logo</strong> from Branding tab
                </p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <p className={cn("text-xs", textSecondary)}>
                  Pulls <strong className={textPrimary}>contact info</strong> from Company Info tab
                </p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <p className={cn("text-xs", textSecondary)}>
                  Shows <strong className={textPrimary}>social links</strong> from Social Media tab
                </p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <p className={cn("text-xs", textSecondary)}>
                  <strong className={textPrimary}>9-page</strong> professional introduction guide
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => regeneratePdf()}
                disabled={regeneratingPdf}
                variant="outline"
                className={cn("gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10")}
              >
                {regeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {regeneratingPdf ? "Generating..." : "Preview & Regenerate PDF"}
              </Button>
              <p className={cn("text-xs", textSecondary)}>
                Updates your logo, contact info, and social links automatically
              </p>
            </div>
          </CardContent>
        </Card>
      </AnimatePresence>

      {/* ================================================================== */}
      {/* Payment Method Dialog                                              */}
      {/* ================================================================== */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className={cn("sm:max-w-lg max-h-[90vh] overflow-y-auto", isGold && "bg-[#1C2333] border-white/[0.08]")}>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", isDark && "text-white")}>
              <CreditCard className="h-5 w-5" />
              {editingPayment ? "Edit Payment Method" : "Add Payment Method"}
            </DialogTitle>
            <DialogDescription className={cn(isDark && "text-slate-400")}>
              {editingPayment
                ? "Update payment method details"
                : "Add a new payment method for clients"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Method Name */}
            <div className="space-y-2">
              <Label className={cn(isDark && "text-slate-300")}>
                Method Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g., HBL Bank Transfer, JazzCash, EasyPaisa"
                value={paymentForm.methodName}
                onChange={(e) => setPaymentForm((p) => ({ ...p, methodName: e.target.value }))}
                className={inputBg}
              />
            </div>

            {/* Account Title & Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={cn(isDark && "text-slate-300")}>
                  Account Title
                </Label>
                <Input
                  placeholder="Account holder name"
                  value={paymentForm.accountTitle}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, accountTitle: e.target.value }))}
                  className={inputBg}
                />
              </div>
              <div className="space-y-2">
                <Label className={cn(isDark && "text-slate-300")}>
                  Account Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Account number"
                  value={paymentForm.accountNumber}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, accountNumber: e.target.value }))}
                  className={inputBg}
                />
              </div>
            </div>

            {/* Bank Name & IBAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={cn(isDark && "text-slate-300")}>
                  Bank Name
                </Label>
                <Input
                  placeholder="e.g., HBL, Meezan Bank"
                  value={paymentForm.bankName}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, bankName: e.target.value }))}
                  className={inputBg}
                />
              </div>
              <div className="space-y-2">
                <Label className={cn(isDark && "text-slate-300")}>
                  IBAN (optional)
                </Label>
                <Input
                  placeholder="PK36SCBL0000001234567890"
                  value={paymentForm.iban}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, iban: e.target.value }))}
                  className={inputBg}
                />
              </div>
            </div>

            {/* QR Code URL */}
            <div className="space-y-2">
              <Label className={cn(isDark && "text-slate-300")}>
                <QrCode className="h-3.5 w-3.5 mr-1.5 inline" />
                QR Code Image URL (optional)
              </Label>
              <Input
                placeholder="https://example.com/qr-code.png"
                value={paymentForm.qrCodeUrl}
                onChange={(e) => setPaymentForm((p) => ({ ...p, qrCodeUrl: e.target.value }))}
                className={inputBg}
              />
              {paymentForm.qrCodeUrl && (
                <div className="mt-2">
                  <img
                    src={paymentForm.qrCodeUrl}
                    alt="QR Preview"
                    className="h-20 w-20 rounded-lg border"
                    style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : undefined }}>
              <div>
                <Label className={cn("text-sm", textPrimary)}>Active</Label>
                <p className={cn("text-xs", textSecondary)}>
                  Inactive methods won&apos;t be shown to clients
                </p>
              </div>
              <Switch
                checked={paymentForm.isActive}
                onCheckedChange={(checked) => setPaymentForm((p) => ({ ...p, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
              className={cn(isGold && "border-white/10 text-slate-300 hover:bg-white/5")}
            >
              Cancel
            </Button>
            <Button onClick={savePaymentMethod} className={cn("gap-2", accentBtn)}>
              <Check className="h-4 w-4" />
              {editingPayment ? "Update" : "Add"} Method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enterprise Beta Guide */}
      <Card className={cn("border mt-6", cardBg)}>
        <Collapsible>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between cursor-pointer group">
                <CardTitle className={cn("text-base flex items-center gap-2", textPrimary)}>
                  <BookOpen className="h-4 w-4" />
                  Enterprise Beta Guide
                </CardTitle>
                <ChevronDown className={cn("h-4 w-4 transition-transform group-data-[state=open]:rotate-180", textSecondary)} />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6 pb-6">
              <div className={cn("rounded-lg border p-4 space-y-4", isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200")}>
                <div>
                  <h4 className={cn("text-sm font-semibold mb-2", textPrimary)}>HOW TO GIVE ENTERPRISE PLAN TO BRAND OWNERS:</h4>
                  <ol className={cn("list-decimal list-inside space-y-1 text-sm", textSecondary)}>
                    <li>Go to Admin &gt; Beta Invites (or Settings &gt; Beta Invites)</li>
                    <li>Enter the brand owner&apos;s email</li>
                    <li>Select &quot;Enterprise&quot; plan</li>
                    <li>Set trial days (recommend 30 for beta)</li>
                    <li>Click &quot;Send Invite&quot;</li>
                    <li>The brand owner will receive an email to sign up</li>
                    <li>Their account will be created with Enterprise plan automatically</li>
                  </ol>
                </div>
                <div>
                  <h4 className={cn("text-sm font-semibold mb-2", textPrimary)}>WHEN FREE TRIAL ENDS:</h4>
                  <ul className={cn("list-disc list-inside space-y-1 text-sm", textSecondary)}>
                    <li>Users can export all their data from Settings &gt; Export Data</li>
                    <li>Export includes: Products, Customers, Orders, Expenses, Tasks, Coupons</li>
                    <li>Data exports as JSON file, available anytime during active subscription</li>
                  </ul>
                </div>
                <div>
                  <h4 className={cn("text-sm font-semibold mb-2", textPrimary)}>HOW TO COLLECT FEEDBACK:</h4>
                  <ol className={cn("list-decimal list-inside space-y-1 text-sm", textSecondary)}>
                    <li>After 7 days: Send feedback request via email/support chat</li>
                    <li>Ask specific questions: &quot;What&apos;s working?&quot;, &quot;What&apos;s missing?&quot;, &quot;Rate 1-5&quot;</li>
                    <li>For testimonials: Ask satisfied users if they&apos;d recommend Valtriox</li>
                    <li>For video testimonials: Offer extended trial in exchange for 30-60s video</li>
                    <li>For reviews: Share Google Form link for detailed reviews</li>
                    <li>Collect all in Admin &gt; Feedback Manager</li>
                    <li>Approve best testimonials to show on landing page</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
