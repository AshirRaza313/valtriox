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
  BarChart3,
  ShoppingCart,
  Users,
  Package,
  Receipt,
  CalendarRange,
  Download,
  Mail,
  Loader2,
  RefreshCw,
  FileText,
  Clock,
  Send,
  History,
  TrendingUp,
} from "lucide-react";

// ── Report type definitions ──

interface ReportType {
  id: string;
  label: string;
  description: string;
  icon: typeof BarChart3;
  endpoint: string;
  defaultPeriod?: string;
  color: string;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: "sales",
    label: "Sales Report",
    description: "Revenue, order volume, top products, channel breakdown",
    icon: TrendingUp,
    endpoint: "/api/reports/export?type=sales",
    defaultPeriod: "monthly",
    color: "amber",
  },
  {
    id: "orders",
    label: "Orders Report",
    description: "All orders with status breakdown and customer details",
    icon: ShoppingCart,
    endpoint: "/api/reports/orders",
    defaultPeriod: "monthly",
    color: "blue",
  },
  {
    id: "customer_statement",
    label: "Customer Statement",
    description: "Per-customer order history & lifetime spend",
    icon: Users,
    endpoint: "/api/reports/customer-statement",
    defaultPeriod: "",
    color: "emerald",
  },
  {
    id: "inventory",
    label: "Inventory Report",
    description: "Stock levels, valuation, low-stock & out-of-stock alerts",
    icon: Package,
    endpoint: "/api/reports/inventory",
    defaultPeriod: "",
    color: "purple",
  },
  {
    id: "tax",
    label: "Tax Summary",
    description: "Sales tax + income tax estimate per period",
    icon: Receipt,
    endpoint: "/api/reports/tax",
    defaultPeriod: "monthly",
    color: "rose",
  },
  {
    id: "custom_range",
    label: "Custom Date-Range",
    description: "Build a custom report across orders, customers, expenses",
    icon: CalendarRange,
    endpoint: "/api/reports/custom-range",
    defaultPeriod: "",
    color: "amber",
  },
];

// ── Audit log entry ──

interface AuditEntry {
  id: string;
  type: string;
  title: string;
  period: string;
  dateFrom: string | null;
  dateTo: string | null;
  recipientEmail: string | null;
  emailedAt: string | null;
  emailStatus: string | null;
  fileSizeKb: number | null;
  createdAt: string;
}

// ── Helpers ──

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main Component ──

export function ReportsCenterPage() {
  const { organization, appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";

  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [period, setPeriod] = useState("monthly");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dataTypes, setDataTypes] = useState<string[]>(["orders", "customers", "expenses"]);

  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [lastBlob, setLastBlob] = useState<{ url: string; filename: string; title: string } | null>(null);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);

  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-400" : "text-slate-500";

  // ── Fetch audit log ──
  const fetchAuditLog = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingAudit(true);
    try {
      const res = await fetchWithAuth(`/api/reports-center?orgId=${organization.id}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLog(data.reports || []);
      }
    } catch {
      // ignore — audit log is best-effort
    } finally {
      setLoadingAudit(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  /* eslint-disable react-hooks/set-state-in-effect -- fetching initial data on mount */
  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Build endpoint URL ──
  const buildUrl = (rt: ReportType, opts: { period: string; from: string; to: string; customerId: string; dataTypes: string[] }) => {
    const params = new URLSearchParams();
    if (organization?.id) params.set("orgId", organization.id);
    if (rt.id === "sales") params.set("period", opts.period || "monthly");
    if (rt.id === "orders") params.set("period", opts.period || "monthly");
    if (rt.id === "tax") params.set("period", opts.period || "monthly");
    if (rt.id === "customer_statement" && opts.customerId) params.set("customerId", opts.customerId);
    if (rt.id === "custom_range") {
      if (opts.from) params.set("from", opts.from);
      if (opts.to) params.set("to", opts.to);
      params.set("dataTypes", opts.dataTypes.join(","));
    }
    return `${rt.endpoint}?${params.toString()}`;
  };

  // ── Open config dialog ──
  const openConfig = (rt: ReportType) => {
    setSelectedType(rt);
    setPeriod(rt.defaultPeriod || "monthly");
    setFromDate("");
    setToDate("");
    setCustomerId("");
    setDataTypes(["orders", "customers", "expenses"]);
    setConfigOpen(true);
  };

  // ── Generate + Download ──
  const handleGenerate = async () => {
    if (!selectedType || !organization?.id) return;
    setGenerating(true);
    try {
      const url = buildUrl(selectedType, { period, from: fromDate, to: toDate, customerId, dataTypes });
      const res = await fetchWithAuth(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || `Failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const today = new Date().toISOString().split("T")[0];
      const filename = `${selectedType.id}-report-${today}.pdf`;
      setLastBlob({ url: blobUrl, filename, title: selectedType.label });

      // Trigger download
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success(`${selectedType.label} PDF generated & downloaded`);

      // Audit log entry
      try {
        await fetchWithAuth("/api/reports-center", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: organization.id,
            type: selectedType.id,
            title: selectedType.label,
            period: selectedType.id === "custom_range" ? "custom" : period,
            dateFrom: fromDate || null,
            dateTo: toDate || null,
            fileSizeKb: Math.round(blob.size / 1024),
          }),
        });
      } catch {
        // best-effort
      }

      await fetchAuditLog();
      setConfigOpen(false);
    } catch (err) {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  };

  // ── Email dialog ──
  const openEmailDialog = () => {
    if (!lastBlob) {
      toast.error("Generate a report first");
      return;
    }
    setEmailRecipient("");
    setEmailSubject(`Valtriox Report: ${lastBlob.title}`);
    setEmailMessage(`Hi,\n\nPlease find attached the ${lastBlob.title} from Valtriox.\n\nBest regards,\nThe Valtriox Team`);
    setEmailOpen(true);
  };

  const handleSendEmail = async () => {
    if (!lastBlob) return;
    if (!emailRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRecipient)) {
      toast.error("Enter a valid recipient email");
      return;
    }
    setEmailing(true);
    try {
      // Best-effort audit log: record this email action as a new ReportExport entry
      // (using the same POST /api/reports-center endpoint, but marking it as emailed)
      try {
        await fetchWithAuth("/api/reports-center", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: organization?.id,
            type: lastBlob.title.toLowerCase().replace(/\s+/g, "_"),
            title: `${lastBlob.title} → ${emailRecipient}`,
            period: "emailed",
            recipientEmail: emailRecipient,
            emailedAt: new Date().toISOString(),
            emailStatus: "sent",
          }),
        });
      } catch {
        // best-effort — don't block the email on audit log failure
      }

      // Open mailto with attachment note (browser limitation: can't auto-attach PDF)
      const mailto = `mailto:${emailRecipient}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailMessage + "\n\n[Attachment: " + lastBlob.filename + "]")}`;
      window.open(mailto, "_blank");

      toast.success(`Email client opened for ${emailRecipient}. PDF was downloaded — attach it manually.`);
      setEmailOpen(false);
      await fetchAuditLog();
    } catch (err) {
      toast.error("Failed to send email");
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className={cn("text-2xl font-bold tracking-tight flex items-center gap-2", textPrimary)}>
            <BarChart3 className="h-6 w-6 text-amber-500" />
            Unified Reports Center
          </h1>
          <p className={cn("text-sm mt-1", textSecondary)}>
            Generate branded PDF reports · Download · Email to clients · All Valtriox-branded
          </p>
        </div>
        <Button variant="outline" onClick={fetchAuditLog} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh History
        </Button>
      </div>

      {/* Report type cards */}
      <div>
        <h2 className={cn("text-sm font-semibold mb-3", textPrimary)}>Choose a report type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_TYPES.map((rt) => {
            const Icon = rt.icon;
            return (
              <motion.div
                key={rt.id}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
              >
                <Card className={cn(cardBg, "cursor-pointer hover:border-amber-500/30 transition-colors h-full")} onClick={() => openConfig(rt)}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5">
                        <Icon className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={cn("text-sm font-semibold mb-1", textPrimary)}>{rt.label}</h3>
                        <p className={cn("text-xs leading-relaxed", textSecondary)}>{rt.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-amber-500 font-medium">PDF Export</span>
                      <Download className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Email banner */}
      {lastBlob && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02]">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-amber-500" />
                <div>
                  <p className={cn("text-sm font-medium", textPrimary)}>{lastBlob.title} ready</p>
                  <p className={cn("text-xs", textSecondary)}>{lastBlob.filename}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = lastBlob.url;
                    a.download = lastBlob.filename;
                    a.click();
                  }}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Re-download
                </Button>
                <Button
                  size="sm"
                  onClick={openEmailDialog}
                  className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Mail className="h-3.5 w-3.5" /> Email to Client
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Audit log */}
      <div>
        <h2 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", textPrimary)}>
          <History className="h-4 w-4 text-amber-500" /> Recent Report Activity
        </h2>
        {loadingAudit ? (
          <Card className={cardBg}>
            <CardContent className="p-6 text-center">
              <Loader2 className="h-5 w-5 mx-auto animate-spin text-amber-400" />
              <p className={cn("text-xs mt-2", textSecondary)}>Loading history…</p>
            </CardContent>
          </Card>
        ) : auditLog.length === 0 ? (
          <Card className={cardBg}>
            <CardContent className="p-8 text-center">
              <Clock className="h-8 w-8 mx-auto text-amber-400/40 mb-2" />
              <p className={cn("text-sm", textPrimary)}>No reports generated yet</p>
              <p className={cn("text-xs mt-1", textSecondary)}>Generate your first report above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {auditLog.slice(0, 15).map((entry) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <Card className={cardBg}>
                    <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="rounded-md bg-amber-500/10 p-1.5">
                          <FileText className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", textPrimary)}>{entry.title}</p>
                          <p className={cn("text-xs", textSecondary)}>
                            {entry.period} · {entry.fileSizeKb ? `${entry.fileSizeKb} KB · ` : ""}{fmtDate(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.emailedAt ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
                            <Send className="h-2.5 w-2.5" /> Emailed
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30 gap-1 text-[10px]">
                            <Download className="h-2.5 w-2.5" /> Downloaded
                          </Badge>
                        )}
                        {entry.recipientEmail && (
                          <span className={cn("text-xs hidden sm:inline", textSecondary)}>→ {entry.recipientEmail}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Configure report dialog ── */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedType && (() => {
                const Icon = selectedType.icon;
                return <Icon className="h-5 w-5 text-amber-500" />;
              })()}
              {selectedType?.label}
            </DialogTitle>
            <DialogDescription>{selectedType?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Period — for sales/orders/tax */}
            {(selectedType?.id === "sales" || selectedType?.id === "orders" || selectedType?.id === "tax") && (
              <div>
                <Label className="text-xs">Period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Today (daily)</SelectItem>
                    <SelectItem value="weekly">Last 7 days (weekly)</SelectItem>
                    <SelectItem value="monthly">This month (monthly)</SelectItem>
                    {selectedType.id === "tax" && <SelectItem value="quarterly">This quarter</SelectItem>}
                    {selectedType.id === "tax" && <SelectItem value="yearly">This year (FY)</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Custom range date pickers */}
            {selectedType?.id === "custom_range" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Include data types</Label>
                  <div className="space-y-2 mt-1">
                    {["orders", "customers", "expenses"].map((dt) => (
                      <label key={dt} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dataTypes.includes(dt)}
                          onChange={(e) => {
                            if (e.target.checked) setDataTypes([...dataTypes, dt]);
                            else setDataTypes(dataTypes.filter((d) => d !== dt));
                          }}
                          className="h-4 w-4 accent-amber-500"
                        />
                        <span className="capitalize">{dt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Customer statement: customer picker (optional) */}
            {selectedType?.id === "customer_statement" && (
              <div>
                <Label className="text-xs">Customer ID (optional — leave blank for all customers)</Label>
                <Input
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="e.g. abc123 (leave blank for aggregate)"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Tip: To get a single customer's statement, paste their customer ID. Otherwise, an aggregate report of all customers is generated.
                </p>
              </div>
            )}

            {/* Branded note */}
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-slate-500">
              <strong className="text-amber-500">Valtriox branding:</strong> All exported PDFs include the Valtriox logo, brand colors (#D4A73A), and contact info. Enterprise-tier clients can hide Valtriox branding from their reports.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || (selectedType?.id === "custom_range" && (!fromDate || !toDate))}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Generate & Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Email dialog ── */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-500" />
              Email Report to Client
            </DialogTitle>
            <DialogDescription>
              Send the report PDF to a client. We'll open your email client with the report details pre-filled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Recipient Email *</Label>
              <Input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea rows={5} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} />
            </div>
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-slate-500">
              <strong className="text-amber-500">Note:</strong> Browsers cannot auto-attach PDFs to email. The report PDF was already downloaded — please attach it manually when your email client opens.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSendEmail}
              disabled={emailing}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Open Email Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
