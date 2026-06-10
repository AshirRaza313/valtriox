"use client";

import { useState, useEffect, useCallback } from "react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, Mail, Send, Ban, CheckCircle2, Clock, AlertCircle, XCircle,
  Users, UserCheck, HourglassIcon, Trash2, RefreshCw, Search, Sparkles,
  Download, Copy, Eye, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// ============================================================================
// Stats Card
// ============================================================================
function StatCard({ label, value, icon: Icon, color, isDark }: {
  label: string; value: number; icon: any; color: string; isDark: boolean;
}) {
  return (
    <Card className={cn("border", isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-card")}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("p-2.5 rounded-lg", color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className={cn("text-2xl font-bold", isDark ? "text-white" : "text-foreground")}>{value}</p>
          <p className={cn("text-xs", isDark ? "text-slate-400" : "text-muted-foreground")}>{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================
export function BetaInviteManager() {
  const { appTheme } = useValtrioxStore();
  const isDark = appTheme !== "light";
  const isGold = appTheme === "premium-dark";

  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("enterprise");
  const [trialDays, setTrialDays] = useState("30");
  const [sendVia, setSendVia] = useState<string>("both");
  const [phone, setPhone] = useState("");
  const [sendResults, setSendResults] = useState<{ emailSent?: boolean; whatsappLink?: string; claimUrl?: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; email: string }>({ open: false, id: "", email: "" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const res = await fetchWithAuth(`/api/admin/beta-invites${params}`);
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to load invites");
      }
    } catch {
      toast.error("Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  // Stats
  const stats = {
    total: invites.length,
    sent: invites.filter(i => i.status === "sent").length,
    accepted: invites.filter(i => i.status === "accepted").length,
    expired: invites.filter(i => ["expired", "revoked"].includes(i.status)).length,
  };

  const filteredInvites = invites.filter(inv =>
    !searchQuery.trim() || inv.email.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleSendInvite = async () => {
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("Enter a valid email"); return; }

    setSending(true);
    setSendResults(null);

    try {
      const res = await fetchWithAuth("/api/admin/beta-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), plan, trialDays: parseInt(trialDays), sendVia, phone }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          toast.error("An invite for this email already exists");
        } else if (res.status === 503) {
          toast.error("Database table not ready - contact support");
        } else {
          toast.error(data.error || "Failed to create invite");
        }
      } else {
        const data = await res.json();
        setSendResults({
          emailSent: data.sendResults?.email,
          whatsappLink: data.sendResults?.whatsapp,
          claimUrl: data.claimUrl,
        });
        toast.success(`Beta invite created for ${email.trim()}`);
        setEmail("");
        setPhone("");
        fetchInvites();
      }
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const handleCopyCode = (token: string, inviteId: string) => {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedCode(inviteId);
      toast.success("Code copied");
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(() => toast.error("Failed to copy"));
  };

  const handlePreviewDocument = async (invite: any) => {
    setActionLoading(invite.id);
    try {
      const res = await fetchWithAuth(`/api/admin/beta-invites?document=${invite.id}`);
      if (res.ok) {
        const html = await res.text();
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
      } else toast.error("Failed to preview");
    } catch { toast.error("Failed to preview"); }
    finally { setActionLoading(null); }
  };

  const handleDownloadDocument = async (invite: any) => {
    setActionLoading(invite.id);
    try {
      const res = await fetchWithAuth(`/api/admin/beta-invites?document=${invite.id}`);
      if (res.ok) {
        const html = await res.text();
        const blob = new Blob([html], { type: "text/html" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Valtriox-Beta-Invitation-${invite.email}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("Document downloaded");
      }
    } catch { toast.error("Failed to download"); }
    finally { setActionLoading(null); }
  };

  const handleRevoke = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetchWithAuth("/api/admin/beta-invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "revoked" }),
      });
      if (res.ok) { toast.success("Invite revoked"); fetchInvites(); }
    } catch { toast.error("Failed to revoke"); }
    finally { setActionLoading(null); }
  };

  const handleResend = async (invite: any) => {
    setActionLoading(invite.id);
    try {
      await fetchWithAuth(`/api/admin/beta-invites?id=${invite.id}`, { method: "DELETE" });
      const res = await fetchWithAuth("/api/admin/beta-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invite.email, plan: invite.plan, trialDays: invite.trialDays }),
      });
      if (res.ok) { toast.success(`Invite resent to ${invite.email}`); fetchInvites(); }
      else { const d = await res.json(); toast.error(d.error || "Failed to resend"); }
    } catch { toast.error("Failed to resend"); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    setActionLoading(deleteDialog.id);
    try {
      const res = await fetchWithAuth(`/api/admin/beta-invites?id=${deleteDialog.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Invite deleted");
        setDeleteDialog({ open: false, id: "", email: "" });
        fetchInvites();
      }
    } catch { toast.error("Failed to delete"); }
    finally { setActionLoading(null); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const isExpired = (inv: any) => inv.expiresAt && new Date(inv.expiresAt) < new Date() && inv.status === "sent";

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string; icon: any }> = {
      sent: { label: "Sent", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
      accepted: { label: "Accepted", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
      expired: { label: "Expired", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: AlertCircle },
      revoked: { label: "Revoked", cls: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
    };
    const e = map[status] || map.sent;
    return <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5 gap-1", e.cls)}><e.icon className="h-2.5 w-2.5" />{e.label}</Badge>;
  };

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      enterprise: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      professional: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      growth: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      starter: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    };
    return <Badge variant="outline" className={cn("text-[10px] font-medium capitalize px-2 py-0.5", colors[plan] || "")}>{plan}</Badge>;
  };

  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "";
  const inputCls = isDark ? "bg-white/5 border-white/10 text-white" : "";
  const textPrimary = isDark ? "text-white" : "";
  const textSecondary = isDark ? "text-slate-400" : "text-muted-foreground";
  const textMuted = isDark ? "text-slate-500" : "text-muted-foreground";

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Crown className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className={cn("text-lg font-semibold", textPrimary)}>Beta Invite System</h2>
            <p className={cn("text-xs", textSecondary)}>Send premium invitations to brand owners</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] gap-1">
          <Sparkles className="h-3 w-3" /> Beta Program
        </Badge>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Invites" value={stats.total} icon={Users} color="bg-blue-500/80" isDark={isDark} />
        <StatCard label="Pending" value={stats.sent} icon={HourglassIcon} color="bg-amber-500/80" isDark={isDark} />
        <StatCard label="Accepted" value={stats.accepted} icon={UserCheck} color="bg-emerald-500/80" isDark={isDark} />
        <StatCard label="Expired / Revoked" value={stats.expired} icon={XCircle} color="bg-red-500/80" isDark={isDark} />
      </div>

      {/* ── Send Invite Form ── */}
      <Card className={cn("border", cardBg)}>
        <CardHeader className="pb-3">
          <CardTitle className={cn("text-sm font-medium flex items-center gap-2", textPrimary)}>
            <Send className="h-4 w-4 text-amber-400" />
            Send New Beta Invite
          </CardTitle>
          <CardDescription className={cn("text-xs", textSecondary)}>
            Invite brand owners with premium plans via email and WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="beta-email" className={cn("text-xs", textSecondary)}>Email Address</Label>
              <Input id="beta-email" name="email" type="email" autoComplete="email" placeholder="brand-owner@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
                className={cn(inputCls)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="beta-plan" className={cn("text-xs", textSecondary)}>Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="beta-plan" name="plan" className={cn(inputCls)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="beta-trial" className={cn("text-xs", textSecondary)}>Trial Duration</Label>
              <Select value={trialDays} onValueChange={setTrialDays}>
                <SelectTrigger id="beta-trial" name="trialDays" className={cn(inputCls)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="14">14 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="60">60 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <div className="space-y-1.5">
              <Label htmlFor="beta-send-via" className={cn("text-xs", textSecondary)}>Send Via</Label>
              <Select value={sendVia} onValueChange={setSendVia}>
                <SelectTrigger id="beta-send-via" name="sendVia" className={cn(inputCls)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Email + WhatsApp</SelectItem>
                  <SelectItem value="email">Email Only</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn("space-y-1.5", (sendVia === "both" || sendVia === "whatsapp") ? "" : "opacity-50 pointer-events-none")}>
              <Label htmlFor="beta-phone" className={cn("text-xs", textSecondary)}>WhatsApp Number</Label>
              <Input id="beta-phone" name="phone" type="tel" autoComplete="tel" placeholder="+92 3XX XXXXXXX"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                disabled={sendVia === "email"} className={cn(inputCls)} />
            </div>
            <div className="flex items-end lg:col-span-2">
              <Button onClick={handleSendInvite}
                disabled={sending || !email.trim() || (sendVia !== "email" && !phone.trim())}
                className={cn("w-full h-10 text-sm", isGold ? "btn-gold" : "bg-amber-600 hover:bg-amber-700 text-white")}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {sending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </div>

          {/* Send Results */}
          {sendResults && (
            <div className={cn("mt-4 rounded-lg border p-4 space-y-3", isDark ? "bg-emerald-500/5 border-emerald-500/20" : "bg-emerald-50 border-emerald-200")}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <p className={cn("text-sm font-medium", isDark ? "text-emerald-300" : "text-emerald-700")}>Invitation Created Successfully</p>
              </div>
              {sendResults.claimUrl && (
                <div className={cn("flex items-center gap-2 p-2 rounded-md", isDark ? "bg-white/[0.03]" : "bg-white")}>
                  <span className={cn("text-[11px] flex-1 truncate", textMuted)}>{sendResults.claimUrl}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]"
                    onClick={() => { navigator.clipboard.writeText(sendResults.claimUrl || ""); toast.success("Copied"); }}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                {sendResults.emailSent === true && <div className={cn("flex items-center gap-1.5", textMuted)}><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Email sent</div>}
                {sendResults.emailSent === false && <div className={cn("flex items-center gap-1.5", textMuted)}><XCircle className="h-3 w-3 text-red-400" /> Email failed</div>}
                {sendResults.whatsappLink && <div className={cn("flex items-center gap-1.5", textMuted)}><CheckCircle2 className="h-3 w-3 text-emerald-400" /> <a href={sendResults.whatsappLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Open WhatsApp</a></div>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Invites Table ── */}
      <Card className={cn("border", cardBg)}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className={cn("text-sm font-medium", textPrimary)}>
              All Invites <span className={cn("ml-2 text-xs font-normal", textMuted)}>({filteredInvites.length})</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input id="beta-search" name="search" placeholder="Search email..." autoComplete="off"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn("h-8 w-[180px] pl-8 text-xs", inputCls)} />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="beta-filter-status" name="filterStatus" className={cn("w-[130px] h-8 text-xs", inputCls)}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-400" /></div>
          ) : filteredInvites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="p-3 rounded-full bg-white/5"><Mail className={cn("h-8 w-8", isDark ? "text-slate-600" : "text-slate-300")} /></div>
              <div className="text-center">
                <p className={cn("text-sm font-medium", textSecondary)}>{searchQuery ? "No matches" : "No invites yet"}</p>
                <p className={cn("text-xs mt-1", textMuted)}>{searchQuery ? "Try a different search" : "Send your first invite above"}</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className={isDark ? "bg-white/[0.03] border-white/[0.06]" : ""}>
                    <TableHead className={cn("text-xs", textSecondary)}>Email</TableHead>
                    <TableHead className={cn("text-xs", textSecondary)}>Code</TableHead>
                    <TableHead className={cn("text-xs", textSecondary)}>Plan</TableHead>
                    <TableHead className={cn("text-xs", textSecondary)}>Trial</TableHead>
                    <TableHead className={cn("text-xs", textSecondary)}>Status</TableHead>
                    <TableHead className={cn("text-xs", textSecondary)}>Sent On</TableHead>
                    <TableHead className="w-[160px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvites.map((invite) => (
                    <TableRow key={invite.id} className={cn("border-b", isDark && "border-white/[0.06]")}>
                      <TableCell className={cn("text-sm font-medium", isDark ? "text-slate-200" : "")}>
                        {invite.email}
                        {isExpired(invite) && <Badge variant="outline" className="ml-2 text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20">Expired</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <code className={cn("text-xs font-mono tracking-wider px-1.5 py-0.5 rounded", isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600")}>{invite.token || "N/A"}</code>
                          {invite.token && (
                            <button onClick={() => handleCopyCode(invite.token, invite.id)} className="p-0.5 rounded hover:bg-white/10">
                              {copiedCode === invite.id ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-500" />}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{planBadge(invite.plan)}</TableCell>
                      <TableCell className={cn("text-xs", textSecondary)}>{invite.trialDays}d</TableCell>
                      <TableCell>{statusBadge(invite.status)}</TableCell>
                      <TableCell className={cn("text-xs", textMuted)}>{formatDate(invite.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {(invite.status === "sent" || isExpired(invite)) && (
                            <Button variant="ghost" size="sm" onClick={() => handleResend(invite)} disabled={actionLoading === invite.id}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 text-[11px] px-2" title="Resend">
                              {actionLoading === invite.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handlePreviewDocument(invite)} disabled={actionLoading === invite.id}
                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-7 text-[11px] px-2" title="Preview">
                            {actionLoading === invite.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadDocument(invite)} disabled={actionLoading === invite.id}
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7 text-[11px] px-2" title="Download">
                            {actionLoading === invite.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          </Button>
                          {invite.status === "sent" && (
                            <Button variant="ghost" size="sm" onClick={() => handleRevoke(invite.id)} disabled={actionLoading === invite.id}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 text-[11px] px-2" title="Revoke">
                              {actionLoading === invite.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, id: invite.id, email: invite.email })}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 text-[11px] px-2" title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(p => ({ ...p, open }))}>
        <DialogContent className={cn("sm:max-w-[400px]", isDark && "bg-[#1a1a2e] border-white/10")}>
          <DialogHeader>
            <DialogTitle className={cn("text-sm", textPrimary)}>Delete Invite</DialogTitle>
            <DialogDescription className={cn("text-xs", textSecondary)}>
              Delete invite for <strong className="text-foreground">{deleteDialog.email}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteDialog({ open: false, id: "", email: "" })} className={cn("text-xs", isDark && "border-white/10 text-slate-300")}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={actionLoading === deleteDialog.id} className="text-xs">
              {actionLoading === deleteDialog.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
