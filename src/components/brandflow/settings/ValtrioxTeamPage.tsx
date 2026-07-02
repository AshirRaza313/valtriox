// @ts-nocheck — Phase 8: pre-existing TS errors (Decimal/Prisma types, etc.) pending migration
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, UserPlus, Mail, Clock, Shield, ShieldCheck, ChevronDown,
  Copy, Check, X, AlertTriangle, Ban, RefreshCw, Trash2, Edit3,
  Building2, Code, Headphones, TrendingUp, Settings, DollarSign,
  Palette, UserCheck, Eye, EyeOff, Search, MoreHorizontal, Loader2,
  Phone, ExternalLink, MessageCircle, LayoutDashboard, ShoppingCart, Package,
  BarChart3, Megaphone, Cog, Link, BookOpen, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { getRoleBadgeStyle } from "@/lib/roles";
import { SIDEBAR_STRUCTURE, SIDEBAR_GROUP_ORDER } from "@/store/brandflow-store";

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  status: string;
  visibleSections?: string | null;
  invitedBy: string | null;
  joinedAt: string;
  lastActive: string | null;
}

interface Invitation {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface InviteResponse {
  success: boolean;
  invitation: {
    id: string;
    email: string;
    name: string;
    role: string;
    department: string | null;
    token: string;
    expiresAt: string;
    joinUrl: string;
  };
  emailSent: boolean;
  emailConfigured: boolean;
  whatsappLink: string | null;
  plainTextInvite: string;
}

const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Support", "Operations", "Finance", "Design", "Management"];

const VALTROIX_ROLES = [
  { name: "platform_owner", label: "Platform Owner", description: "Full access to everything - the Valtriox portal owner", icon: Shield },
  { name: "platform_admin", label: "Platform Admin", description: "Full access except platform settings modification", icon: ShieldCheck },
  { name: "platform_engineer", label: "Platform Engineer", description: "Engineering access - code, infrastructure, technical operations", icon: Code },
  { name: "platform_support", label: "Platform Support", description: "Support access - client support tickets and conversations", icon: Headphones },
  { name: "platform_sales", label: "Platform Sales", description: "Sales access - clients, subscriptions, and payments", icon: TrendingUp },
  { name: "platform_marketing", label: "Platform Marketing", description: "Marketing access - content, campaigns, and SEO", icon: Palette },
];

const DEPT_ICONS: Record<string, any> = {
  Engineering: Code,
  Sales: TrendingUp,
  Marketing: Palette,
  Support: Headphones,
  Operations: Settings,
  Finance: DollarSign,
  Design: Palette,
  Management: Users,
};

export function ValtrioxTeamPage() {
  const { user } = useValtrioxStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("platform_admin");
  const [inviteDept, setInviteDept] = useState("");
  const [inviting, setInviting] = useState(false);

  // Post-invite feedback state
  const [lastInviteResult, setLastInviteResult] = useState<InviteResponse | null>(null);
  const [showInviteResult, setShowInviteResult] = useState(false);

  // Edit member state
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState("");
  const [saving, setSaving] = useState(false);

  // Page visibility toggle state (stores array of HIDDEN section IDs)
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [showPageToggles, setShowPageToggles] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/admin/valtriox-team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error("Failed to fetch team:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  // ── Invite Handler ──
  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setInviting(true);
    try {
      const res = await fetchWithAuth("/api/admin/valtriox-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          department: inviteDept || null,
          phone: invitePhone || undefined,
        }),
      });
      const data: InviteResponse = await res.json();
      if (res.ok) {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setLastInviteResult(data);
        setShowInviteResult(true);
        setShowInviteForm(false);
        setInviteName("");
        setInviteEmail("");
        setInvitePhone("");
        setInviteRole("platform_admin");
        setInviteDept("");
        fetchTeam();
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setInviting(false);
    }
  };

  // ── Copy Helpers ──
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // ── Revoke Invitation ──
  const handleRevoke = async (invitationId: string) => {
    try {
      const res = await fetchWithAuth(`/api/admin/valtriox-team?invitationId=${invitationId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Invitation revoked");
        fetchTeam();
      } else {
        toast.error("Failed to revoke invitation");
      }
    } catch {
      toast.error("Network error");
    }
  };

  // ── Update Member ──
  const handleUpdateMember = async () => {
    if (!editingMember) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/admin/valtriox-team/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          department: editDept || null,
          visibleSections: JSON.stringify([...hiddenSections]),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${editingMember.name} updated successfully`);
        setEditingMember(null);
        setShowPageToggles(false);
        fetchTeam();
      } else {
        toast.error(data.error || "Failed to update member");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  // ── Suspend / Reactivate Member ──
  const handleToggleStatus = async (member: TeamMember) => {
    const newStatus = member.status === "active" ? "suspended" : "active";
    try {
      const res = await fetchWithAuth(`/api/admin/valtriox-team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`${member.name} has been ${newStatus === "active" ? "reactivated" : "suspended"}`);
        fetchTeam();
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Network error");
    }
  };

  // ── Remove Member ──
  const handleRemove = async (member: TeamMember) => {
    if (!confirm(`Are you sure you want to remove ${member.name} from the Valtriox team?`)) return;
    try {
      const res = await fetchWithAuth(`/api/admin/valtriox-team/${member.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`${member.name} removed from Valtriox team`);
        fetchTeam();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove member");
      }
    } catch {
      toast.error("Network error");
    }
  };

  // ── Stats ──
  const activeMembers = members.filter(m => m.status === "active");
  const suspendedMembers = members.filter(m => m.status === "suspended");
  const deptCounts = DEPARTMENTS.reduce((acc, dept) => {
    const count = members.filter(m => m.department === dept && m.status === "active").length;
    if (count > 0) acc[dept] = count;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getRoleLabel = (roleName: string) => VALTROIX_ROLES.find(r => r.name === roleName)?.label || roleName;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading Valtriox Team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-400" />
            Valtriox Team
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage internal Valtriox platform team members</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { if (lastInviteResult) setShowInviteResult(true); }}
            variant="outline"
            className="border-white/10 text-slate-400 hover:text-white rounded-xl gap-2 self-start"
            disabled={!lastInviteResult}
          >
            <Mail className="h-4 w-4" />
            Last Invite
          </Button>
          <Button
            onClick={() => setShowInviteForm(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl gap-2 self-start"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-2xl font-bold text-white">{members.length}</p>
          <p className="text-xs text-slate-500">Total Members</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-2xl font-bold text-green-400">{activeMembers.length}</p>
          <p className="text-xs text-slate-500">Active</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-2xl font-bold text-yellow-400">{invitations.length}</p>
          <p className="text-xs text-slate-500">Pending Invitations</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-2xl font-bold text-red-400">{suspendedMembers.length}</p>
          <p className="text-xs text-slate-500">Suspended</p>
        </div>
      </div>

      {/* Department Breakdown */}
      {Object.keys(deptCounts).length > 0 && (
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-400" />
            Department Breakdown
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(deptCounts).map(([dept, count]) => {
              const DeptIcon = DEPT_ICONS[dept] || Building2;
              return (
                <div key={dept} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <DeptIcon className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-sm text-slate-400">{dept}</span>
                  <span className="text-xs font-semibold text-white bg-amber-500/20 px-1.5 py-0.5 rounded">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "members" ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Active Members ({activeMembers.length})
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "invitations" ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Invitations ({invitations.length})
        </button>
      </div>

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No team members yet. Invite someone to get started!</p>
            </div>
          ) : (
            members.map((member) => {
              const roleBadge = getRoleBadgeStyle(member.role);
              return (
                <div key={member.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/20 flex items-center justify-center text-amber-400 font-semibold text-sm shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{member.name}</p>
                      {member.status === "suspended" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Suspended</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                  </div>
                  {member.department && (
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                      {(() => { const DIcon = DEPT_ICONS[member.department] || Building2; return <DIcon className="h-3.5 w-3.5" /> })()}
                      {member.department}
                    </div>
                  )}
                  <span className={`hidden sm:inline-block text-[11px] font-medium px-2 py-1 rounded-lg ${roleBadge.dark}`}>
                    {getRoleLabel(member.role)}
                  </span>
                  <div className="hidden md:block text-right">
                    <p className="text-[11px] text-slate-500">Joined {formatDate(member.joinedAt)}</p>
                    {member.lastActive && (
                      <p className="text-[10px] text-slate-600">Last active {formatDate(member.lastActive)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingMember(member);
                        setEditRole(member.role);
                        setEditDept(member.department || "");
                        // Load hidden sections
                        try {
                          const parsed = JSON.parse(member.visibleSections || "[]");
                          setHiddenSections(new Set(parsed));
                        } catch {
                          setHiddenSections(new Set());
                        }
                        setShowPageToggles(false);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-white/[0.05] transition-all"
                      title="Edit member"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    {member.role !== "platform_owner" && (
                      <>
                        <button
                          onClick={() => handleToggleStatus(member)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-yellow-400 hover:bg-white/[0.05] transition-all"
                          title={member.status === "active" ? "Suspend" : "Reactivate"}
                        >
                          {member.status === "active" ? <Ban className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleRemove(member)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-white/[0.05] transition-all"
                          title="Remove member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === "invitations" && (
        <div className="space-y-3">
          {invitations.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No pending invitations</p>
            </div>
          ) : (
            invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{inv.name}</p>
                  <p className="text-xs text-slate-500 truncate">{inv.email}</p>
                </div>
                <div className="hidden sm:block text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg">{inv.token}</span>
                    <button
                      onClick={() => copyToClipboard(inv.token, "Token")}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-white/[0.05] transition-all"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">Expires {formatDate(inv.expiresAt)}</p>
                </div>
                {inv.department && (
                  <span className="hidden md:inline-block text-[11px] text-slate-400">{inv.department}</span>
                )}
                <button
                  onClick={() => handleRevoke(inv.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-white/[0.05] transition-all shrink-0"
                  title="Revoke invitation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Role Descriptions */}
      <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" />
          Valtriox Team Roles
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {VALTROIX_ROLES.map((role) => {
            const RoleIcon = role.icon;
            return (
              <div key={role.name} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <RoleIcon className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{role.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-[#12121a] border border-white/[0.08] p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-400" />
                Invite Valtriox Team Member
              </h3>
              <button onClick={() => setShowInviteForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.05]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Full Name *</label>
                <Input
                  placeholder="John Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-600 rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Email *</label>
                <Input
                  type="email"
                  placeholder="john@valtriox.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-600 rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Phone (for WhatsApp)</label>
                <Input
                  type="tel"
                  placeholder="+92 300 1234567"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-600 rounded-xl h-10"
                />
                <p className="text-[11px] text-slate-600">Optional. Used to generate a WhatsApp invitation link.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 text-sm px-3 focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                >
                  {VALTROIX_ROLES.map((role) => (
                    <option key={role.name} value={role.name} className="bg-[#12121a]">{role.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Department</label>
                <select
                  value={inviteDept}
                  onChange={(e) => setInviteDept(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 text-sm px-3 focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                >
                  <option value="">No department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept} className="bg-[#12121a]">{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowInviteForm(false)} className="flex-1 border-white/10 text-slate-400 hover:text-white rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl gap-2"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {inviting ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Invite Result Modal */}
      {showInviteResult && lastInviteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-[#12121a] border border-white/[0.08] p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-400" />
                Invitation Created
              </h3>
              <button onClick={() => setShowInviteResult(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.05]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Email status */}
            <div className={`p-4 rounded-xl border ${
              lastInviteResult.emailSent
                ? "bg-green-500/5 border-green-500/20"
                : lastInviteResult.emailConfigured
                  ? "bg-yellow-500/5 border-yellow-500/20"
                  : "bg-orange-500/5 border-orange-500/20"
            }`}>
              <div className="flex items-start gap-3">
                {lastInviteResult.emailSent ? (
                  <Check className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">
                    {lastInviteResult.emailSent
                      ? "Email sent successfully"
                      : lastInviteResult.emailConfigured
                        ? "Email delivery failed"
                        : "Email provider not configured"
                    }
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {lastInviteResult.emailSent
                      ? `A professional invitation email was delivered to ${lastInviteResult.invitation.email}`
                      : lastInviteResult.emailConfigured
                        ? "The email could not be delivered. Please use the copy buttons below to share the invitation manually."
                        : "Set RESEND_API_KEY or SMTP_HOST in Vercel environment variables to enable automatic emails. For now, use the buttons below to share manually."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Invitation details */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Invited</span>
                <span className="text-sm text-white font-medium">{lastInviteResult.invitation.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Email</span>
                <span className="text-sm text-slate-400">{lastInviteResult.invitation.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Role</span>
                <span className="text-sm text-amber-400 font-medium">{getRoleLabel(lastInviteResult.invitation.role)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Token</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono text-amber-400">{lastInviteResult.invitation.token}</span>
                  <button
                    onClick={() => copyToClipboard(lastInviteResult.invitation.token, "Token")}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-amber-400 hover:bg-white/[0.05] transition-all"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Expires</span>
                <span className="text-xs text-slate-400">{formatDate(lastInviteResult.invitation.expiresAt)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={() => copyToClipboard(lastInviteResult.invitation.joinUrl, "Invitation link")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                Copy Invitation Link
              </button>

              <button
                onClick={() => copyToClipboard(lastInviteResult.plainTextInvite, "Invitation text")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] text-sm text-amber-400 hover:bg-amber-500/[0.1] transition-all"
              >
                <Copy className="h-4 w-4" />
                Copy Full Invitation Text
              </button>

              {lastInviteResult.whatsappLink && (
                <a
                  href={lastInviteResult.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600/20 border border-green-500/20 text-sm text-green-400 hover:bg-green-600/30 transition-all"
                >
                  <MessageCircle className="h-4 w-4" />
                  Send via WhatsApp
                </a>
              )}
            </div>

            <Button
              onClick={() => setShowInviteResult(false)}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl"
            >
              Done
            </Button>
          </motion.div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-[#12121a] border border-white/[0.08] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-amber-400" />
                Edit {editingMember.name}
              </h3>
              <button onClick={() => setEditingMember(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.05]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 text-sm px-3 focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                >
                  {VALTROIX_ROLES.map((role) => (
                    <option key={role.name} value={role.name} className="bg-[#12121a]">{role.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Department</label>
                <select
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 text-sm px-3 focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                >
                  <option value="">No department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept} className="bg-[#12121a]">{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Page Visibility Toggles */}
            <div>
              <button
                type="button"
                onClick={() => setShowPageToggles(!showPageToggles)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] hover:bg-violet-500/[0.1] transition-all"
              >
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-medium text-violet-300">Page Access Control</span>
                  <span className="text-[10px] text-violet-400/70">Toggle which pages this member can see</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-violet-400 transition-transform ${showPageToggles ? "rotate-180" : ""}`} />
              </button>

              {showPageToggles && (
                <div className="mt-3 max-h-[300px] overflow-y-auto space-y-3 pr-1">
                  {SIDEBAR_GROUP_ORDER.map((groupId) => {
                    const group = SIDEBAR_STRUCTURE[groupId];
                    return (
                      <div key={groupId}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                          <span>{group.emoji}</span> {group.label}
                        </p>
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const isHidden = hiddenSections.has(item.id);
                            return (
                              <label
                                key={item.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.04] cursor-pointer group transition-all"
                              >
                                <span className={`text-xs ${isHidden ? "text-slate-600 line-through" : "text-slate-300"}`}>
                                  {item.label}
                                </span>
                                <div
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setHiddenSections(prev => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                  className="relative"
                                >
                                  {isHidden ? (
                                    <ToggleRight className="h-5 w-5 text-slate-600" />
                                  ) : (
                                    <ToggleLeft className="h-5 w-5 text-violet-400" />
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Quick actions */}
                  <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setHiddenSections(new Set())}
                      className="flex-1 text-[11px] font-medium py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all"
                    >
                      Show All Pages
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = SIDEBAR_GROUP_ORDER.flatMap(g => SIDEBAR_STRUCTURE[g].items.map(i => i.id));
                        setHiddenSections(new Set(allIds));
                      }}
                      className="flex-1 text-[11px] font-medium py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      Hide All Pages
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setEditingMember(null); setShowPageToggles(false); }} className="flex-1 border-white/10 text-slate-400 hover:text-white rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={handleUpdateMember}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
