// @ts-nocheck — Phase 18: AI Team module — strict typing deferred
// ============================================================================
// AI Workforce Dashboard — Main Page
// ============================================================================
// Owner's command center for the AI Workforce. Shows:
//   - Agent grid (status, runtime, active tasks, today's work)
//   - Owner command bar ("Ask My AI Team")
//   - Approval queue (sensitive actions needing Owner decision)
//   - Task list (live + today's completed)
//   - Message bus (agent-to-agent conversations)
//   - Activity log (audit trail of every AI action)
//   - Workflow visualizer (running + recent executions)
//   - Memory panel (knowledge store)
//
// Auto-refreshes every 30s. Owner controls (start/stop, goals, spending
// limits) available via the agent detail drawer.
// ============================================================================

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Play, Pause, RefreshCw, Send, AlertTriangle, CheckCircle2, XCircle,
  Clock, Activity, MessageSquare, FileText, Brain, Zap, ChevronRight,
  Search, Loader2, Sparkles, Shield, TrendingUp, Inbox, Eye, Cpu,
} from "lucide-react";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types (mirrors API DTOs) ──
interface AgentDTO {
  id: string;
  agentKey: string;
  name: string;
  role: string;
  description: string;
  status: "active" | "paused" | "error";
  runtimeStatus: "idle" | "busy" | "waiting" | "error";
  avatar: string | null;
  goals: string;
  spendingLimits: { daily: number; monthly: number; perAction: number };
  approvalRequiredActions: string[];
  activeTaskCount?: number;
  todayCompletedCount?: number;
  pendingApprovalCount?: number;
}

interface TaskDTO {
  id: string;
  agentId: string;
  agentKey?: string;
  agentName?: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  impactScore: number;
  reasoning: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface MessageDTO {
  id: string;
  fromAgentKey?: string;
  fromAgentName?: string;
  toAgentKey?: string;
  toAgentName?: string;
  type: string;
  subject: string;
  payload: Record<string, unknown>;
  sentAt: string;
  isProcessed: boolean;
}

interface ApprovalDTO {
  id: string;
  requestedByAgentKey?: string;
  requestedByAgentName?: string;
  actionType: string;
  title: string;
  description: string;
  proposedAction: Record<string, unknown>;
  reasoning: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

interface LogDTO {
  id: string;
  agentKey?: string | null;
  agentName?: string | null;
  actionType: string;
  description: string;
  reason: string;
  amount: number | null;
  createdAt: string;
}

interface WorkflowDTO {
  id: string;
  workflowKey: string;
  name: string;
  description: string;
  trigger: string;
  isEnabled: boolean;
  steps: Array<{ order: number; agentKey: string; name: string; requiresApproval: boolean }>;
}

interface ExecutionDTO {
  id: string;
  workflowKey?: string;
  workflowName?: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

interface MemoryDTO {
  id: string;
  type: string;
  title: string;
  content: string;
  importance: number;
  agentKey?: string | null;
  createdAt: string;
}

interface Stats {
  agents: { total: number; active: number; paused: number; error: number; busy: number; waiting: number };
  tasks: { pending: number; inProgress: number; completedToday: number; failedToday: number; urgentPending: number };
  approvals: { pending: number; approvedToday: number; deniedToday: number };
  workflows: { runningNow: number; completedToday: number; failedToday: number };
  messages: { sentToday: number; unprocessed: number };
  llmPowered: boolean;
  llmProvider?: string;
}

interface AskResponse {
  query: string;
  response: string;
  agentKey: string;
  agentName: string;
  reasoning: string;
  recommendedActions: Array<{ type: string; description: string; requiresApproval: boolean }>;
  llmPowered: boolean;
  llmProvider?: string;
  llmError?: string | null;
  traceId: string;
}

// ── Status color helpers ──
const STATUS_COLORS = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  idle: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  busy: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  waiting: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const PRIORITY_COLORS = {
  urgent: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  normal: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  low: "bg-slate-500/5 text-slate-500 border-slate-500/10",
};

// ============================================================================
// Main Dashboard Component
// ============================================================================

export function AiTeamDashboard() {
  const { toast } = useToast();
  const { user } = useValtrioxStore();
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [approvals, setApprovals] = useState<ApprovalDTO[]>([]);
  const [logs, setLogs] = useState<LogDTO[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDTO[]>([]);
  const [executions, setExecutions] = useState<ExecutionDTO[]>([]);
  const [memory, setMemory] = useState<MemoryDTO[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"agents" | "tasks" | "messages" | "approvals" | "logs" | "workflows" | "memory">("agents");
  const [selectedAgent, setSelectedAgent] = useState<AgentDTO | null>(null);
  const [askQuery, setAskQuery] = useState("");
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load everything ──
  // Phase 18 rev 4: bundled initial load via /api/ai-team/init (1 HTTP round-trip
  // instead of 6). Subsequent refreshes use the same endpoint. Tab switches no
  // longer trigger any refetch (state already in memory).
  const loadAll = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/ai-team/init");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        setTasks(data.tasks || []);
        setMessages(data.messages || []);
        setApprovals(data.approvals || []);
        setLogs(data.logs || []);
        setWorkflows(data.workflows || []);
        setExecutions(data.executions || []);
        setStats(data.stats || null);
        setSeeded(!!data.seeded);
      }
    } catch (err) {
      // Silent — toast only on first load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    // Phase 18 rev 4: 60s refresh interval (was 30s) — reduces server load by 50%
    // and matches the actual data-change frequency for an AI Workforce dashboard.
    refreshTimer.current = setInterval(loadAll, 60_000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [loadAll]);

  // ── Seed the AI Team for this org ──
  const handleSeed = async () => {
    try {
      const res = await fetchWithAuth("/api/ai-team/seed", { method: "POST" });
      if (!res.ok) {
        toast({ title: "Failed to seed AI Team", variant: "destructive" });
        return;
      }
      const data = await res.json();
      toast({
        title: "AI Team Ready",
        description: data.message || "Agents and workflows seeded successfully.",
      });
      setSeeded(true);
      loadAll();
    } catch {
      toast({ title: "Failed to seed AI Team", variant: "destructive" });
    }
  };

  // ── Toggle agent start/stop ──
  const toggleAgent = async (agent: AgentDTO) => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      const res = await fetchWithAuth(`/api/ai-team/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast({
          title: newStatus === "active" ? "Agent Activated" : "Agent Paused",
          description: `${agent.name} is now ${newStatus}.`,
        });
        loadAll();
      }
    } catch {
      toast({ title: "Failed to update agent", variant: "destructive" });
    }
  };

  // ── Owner asks a question ──
  const handleAsk = async () => {
    if (!askQuery.trim()) return;
    setAskLoading(true);
    setAskResponse(null);
    try {
      const res = await fetchWithAuth("/api/ai-team/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: askQuery.trim() }),
      });
      if (!res.ok) {
        toast({ title: "Failed to get response", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setAskResponse(data.response);
    } catch {
      toast({ title: "Failed to reach AI Team", variant: "destructive" });
    } finally {
      setAskLoading(false);
    }
  };

  // ── Approve / deny ──
  const reviewApproval = async (id: string, decision: "approved" | "denied") => {
    try {
      const res = await fetchWithAuth(`/api/ai-team/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        toast({
          title: decision === "approved" ? "Approved" : "Denied",
          description: `The agent's request has been ${decision}.`,
        });
        loadAll();
      }
    } catch {
      toast({ title: "Failed to review approval", variant: "destructive" });
    }
  };

  // ── Trigger a workflow ──
  const runWorkflow = async (workflowKey: string) => {
    try {
      const res = await fetchWithAuth("/api/ai-team/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowKey, input: { triggeredBy: user?.name || "Owner" } }),
      });
      if (res.ok) {
        toast({
          title: "Workflow Started",
          description: "Watch the Workflows tab for live progress.",
        });
        loadAll();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Failed to start workflow", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to start workflow", variant: "destructive" });
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <span className="ml-3 text-slate-400">Loading AI Workforce...</span>
      </div>
    );
  }

  // ── Not seeded state ──
  if (!seeded && agents.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-20 p-8 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <Cpu className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to your AI Workforce</h2>
          <p className="text-slate-400 mb-6">
            You're about to hire 10 AI agents — CEO, Operations, Support, Marketing, Sales,
            Finance, Analytics, Content, Security, and Developer. They'll operate your company
            autonomously under your supervision. Click below to onboard them.
          </p>
          <button
            onClick={handleSeed}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Onboard AI Workforce
          </button>
          <p className="text-xs text-slate-500 mt-4">
            This will create 10 agent profiles + 3 starter workflows for your organization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-amber-500" />
            AI Workforce
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {stats?.llmPowered ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected — {stats?.llmProvider || "LLM"} powered
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Stub mode — set GEMINI_API_KEY or ZAI_API_KEY to enable real AI
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const res = await fetchWithAuth("/api/ai-team/health");
                const data = await res.json();
                if (data.actualCallSucceeded) {
                  toast({
                    title: "✅ LLM Connected",
                    description: `${data.providerName} (${data.model || "?"}) responded in ${data.latencyMs}ms. Sample: "${data.responseSample?.slice(0, 80) || ""}"`,
                  });
                } else {
                  toast({
                    title: "❌ LLM Connection Failed",
                    description: data.errorMessage || "Unknown error",
                    variant: "destructive",
                  });
                }
              } catch (err: any) {
                toast({
                  title: "Health check failed",
                  description: err.message,
                  variant: "destructive",
                });
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm transition-colors border border-amber-500/20"
          >
            <Activity className="h-4 w-4" />
            Test LLM
          </button>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard icon={Bot} label="Active Agents" value={`${stats.agents.active}/${stats.agents.total}`} color="emerald" />
          <StatCard icon={Activity} label="Busy Now" value={stats.agents.busy} color="blue" />
          <StatCard icon={Clock} label="Pending Tasks" value={stats.tasks.pending} color="amber" />
          <StatCard icon={CheckCircle2} label="Done Today" value={stats.tasks.completedToday} color="emerald" />
          <StatCard icon={Shield} label="Approvals" value={stats.approvals.pending} color="orange" />
          <StatCard icon={Zap} label="Running Workflows" value={stats.workflows.runningNow} color="purple" />
          <StatCard icon={MessageSquare} label="Messages Today" value={stats.messages.sentToday} color="slate" />
        </div>
      )}

      {/* ── Owner Command Bar ── */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-white">Ask My AI Team</h2>
          <span className="text-xs text-slate-500">— routed to CEO Agent by default</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={askQuery}
            onChange={(e) => setAskQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="e.g., Give me a summary of today's business. What should I prioritize?"
            className="flex-1 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          <button
            onClick={handleAsk}
            disabled={askLoading || !askQuery.trim()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold transition-colors"
          >
            {askLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ask
          </button>
        </div>
        {askResponse && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-400">
                {askResponse.agentName} {askResponse.llmPowered ? "✨" : "(stub)"}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{askResponse.traceId}</span>
            </div>
            {!askResponse.llmPowered && askResponse.llmError && (
              <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-300 font-mono">
                  ⚠️ LLM Error: {askResponse.llmError}
                </p>
                <p className="text-[10px] text-red-400/70 mt-1">
                  Check: (1) GEMINI_API_KEY is valid, (2) model name is correct
                  (default: gemini-2.0-flash), (3) API quota not exceeded.
                  Click "Test LLM" button above for full diagnostics.
                </p>
              </div>
            )}
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{askResponse.response}</p>
            {askResponse.recommendedActions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs font-semibold text-slate-400 mb-2">Recommended Actions:</p>
                {askResponse.recommendedActions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300 mb-1">
                    {a.requiresApproval ? (
                      <Shield className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-slate-500 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{a.description}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex flex-wrap gap-1 border-b border-slate-800">
        {[
          { id: "agents", label: "Agents", icon: Bot, count: agents.length },
          { id: "approvals", label: "Approvals", icon: Shield, count: approvals.length, highlight: approvals.length > 0 },
          { id: "tasks", label: "Tasks", icon: CheckCircle2, count: tasks.length },
          { id: "messages", label: "Messages", icon: MessageSquare, count: messages.length },
          { id: "workflows", label: "Workflows", icon: Zap, count: workflows.length },
          { id: "logs", label: "Activity Log", icon: Activity, count: logs.length },
          { id: "memory", label: "Memory", icon: Brain, count: memory.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200",
              tab.highlight && activeTab !== tab.id && "text-amber-400",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                tab.highlight ? "bg-amber-500 text-slate-900" : "bg-slate-700/50 text-slate-400",
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "agents" && (
            <AgentGrid
              agents={agents}
              onToggle={toggleAgent}
              onSelect={setSelectedAgent}
              selectedAgent={selectedAgent}
            />
          )}
          {activeTab === "approvals" && (
            <ApprovalQueue approvals={approvals} onReview={reviewApproval} />
          )}
          {activeTab === "tasks" && <TaskList tasks={tasks} />}
          {activeTab === "messages" && <MessageBus messages={messages} />}
          {activeTab === "workflows" && (
            <WorkflowPanel
              workflows={workflows}
              executions={executions}
              onRun={runWorkflow}
            />
          )}
          {activeTab === "logs" && <ActivityLog logs={logs} />}
          {activeTab === "memory" && <MemoryPanel memory={memory} onLoad={setMemory} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    orange: "text-orange-400 bg-orange-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    slate: "text-slate-400 bg-slate-500/10",
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("p-1.5 rounded-md", colorMap[color])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function AgentGrid({
  agents,
  onToggle,
  onSelect,
  selectedAgent,
}: {
  agents: AgentDTO[];
  onToggle: (a: AgentDTO) => void;
  onSelect: (a: AgentDTO) => void;
  selectedAgent: AgentDTO | null;
}) {
  if (agents.length === 0) {
    return <EmptyState icon={Bot} title="No agents yet" description="Seed your AI Team to get started." />;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onToggle={() => onToggle(agent)}
          onSelect={() => onSelect(agent)}
          isSelected={selectedAgent?.id === agent.id}
        />
      ))}
    </div>
  );
}

function AgentCard({
  agent,
  onToggle,
  onSelect,
  isSelected,
}: {
  agent: AgentDTO;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-all cursor-pointer",
        isSelected ? "border-amber-500/50 bg-amber-500/5" : "border-slate-800 bg-slate-900/40 hover:border-slate-700",
        agent.status === "paused" && "opacity-60",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{agent.avatar || "🤖"}</div>
          <div>
            <h3 className="font-semibold text-white">{agent.name}</h3>
            <p className="text-xs text-slate-500">{agent.role}</p>
          </div>
        </div>
        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold border", STATUS_COLORS[agent.status])}>
          {agent.status}
        </span>
      </div>

      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{agent.description}</p>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="rounded-lg bg-slate-800/40 py-2">
          <div className="text-lg font-bold text-white">{agent.activeTaskCount ?? 0}</div>
          <div className="text-[10px] text-slate-500">Active</div>
        </div>
        <div className="rounded-lg bg-slate-800/40 py-2">
          <div className="text-lg font-bold text-emerald-400">{agent.todayCompletedCount ?? 0}</div>
          <div className="text-[10px] text-slate-500">Done Today</div>
        </div>
        <div className="rounded-lg bg-slate-800/40 py-2">
          <div className="text-lg font-bold text-amber-400">{agent.pendingApprovalCount ?? 0}</div>
          <div className="text-[10px] text-slate-500">Approvals</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium border", STATUS_COLORS[agent.runtimeStatus])}>
          {agent.runtimeStatus}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
            agent.status === "active"
              ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
          )}
        >
          {agent.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {agent.status === "active" ? "Pause" : "Start"}
        </button>
      </div>
    </div>
  );
}

function ApprovalQueue({
  approvals,
  onReview,
}: {
  approvals: ApprovalDTO[];
  onReview: (id: string, decision: "approved" | "denied") => void;
}) {
  if (approvals.length === 0) {
    return <EmptyState icon={Shield} title="No pending approvals" description="AI agents will request your approval here for sensitive actions." />;
  }
  return (
    <div className="space-y-3">
      {approvals.map((a) => (
        <div key={a.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-white">{a.title}</h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {a.actionType}
                </span>
              </div>
              <p className="text-xs text-slate-400">Requested by {a.requestedByAgentName || "Unknown Agent"}</p>
            </div>
            <span className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
          <p className="text-sm text-slate-300 mb-2">{a.description}</p>
          {a.reasoning && (
            <div className="mb-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800">
              <p className="text-xs text-slate-500 mb-1">Agent's reasoning:</p>
              <p className="text-xs text-slate-300 italic">"{a.reasoning}"</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onReview(a.id, "approved")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={() => onReview(a.id, "denied")}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium"
            >
              <XCircle className="h-3.5 w-3.5" />
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskList({ tasks }: { tasks: TaskDTO[] }) {
  if (tasks.length === 0) {
    return <EmptyState icon={CheckCircle2} title="No tasks yet" description="Tasks will appear here as agents pick up work." />;
  }
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold border", PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.normal)}>
                  {t.priority}
                </span>
                <span className="text-xs text-slate-500">{t.agentName || "Agent"}</span>
                {t.status === "completed" && t.durationMs && (
                  <span className="text-xs text-slate-600">{(t.durationMs / 1000).toFixed(1)}s</span>
                )}
              </div>
              <p className="text-sm text-white truncate">{t.title}</p>
              {t.reasoning && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{t.reasoning}</p>}
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap",
              t.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : t.status === "in_progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : t.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20",
            )}>
              {t.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageBus({ messages }: { messages: MessageDTO[] }) {
  if (messages.length === 0) {
    return <EmptyState icon={MessageSquare} title="No messages yet" description="Agents will communicate here when they collaborate." />;
  }
  return (
    <div className="space-y-2">
      {messages.map((m) => (
        <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-amber-400">{m.fromAgentName || "?"}</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-xs font-medium text-blue-400">{m.toAgentName || "?"}</span>
            <span className="ml-auto text-[10px] text-slate-500">{new Date(m.sentAt).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm text-white">{m.subject}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{m.type}</p>
        </div>
      ))}
    </div>
  );
}

function WorkflowPanel({
  workflows,
  executions,
  onRun,
}: {
  workflows: WorkflowDTO[];
  executions: ExecutionDTO[];
  onRun: (key: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Available Workflows</h3>
        <div className="space-y-3">
          {workflows.map((w) => (
            <div key={w.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-white">{w.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{w.description}</p>
                </div>
                <button
                  onClick={() => onRun(w.workflowKey)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium"
                >
                  <Play className="h-3 w-3" />
                  Run
                </button>
              </div>
              <div className="flex items-center gap-1 mt-3 overflow-x-auto">
                {w.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 flex-shrink-0">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-slate-700" />}
                    <div className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-medium border",
                      s.requiresApproval ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-slate-800/40 text-slate-400 border-slate-700",
                    )}>
                      {s.order}. {s.agentKey}
                      {s.requiresApproval && " ⚠"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Recent Executions</h3>
        {executions.length === 0 ? (
          <p className="text-xs text-slate-500">No executions yet. Run a workflow to see it here.</p>
        ) : (
          <div className="space-y-2">
            {executions.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{e.workflowName || "Workflow"}</p>
                    <p className="text-xs text-slate-500">
                      Step {e.currentStep}/{e.totalSteps} • {new Date(e.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                    e.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : e.status === "running" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : e.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : e.status === "paused" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20",
                  )}>
                    {e.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityLog({ logs }: { logs: LogDTO[] }) {
  if (logs.length === 0) {
    return <EmptyState icon={Activity} title="No activity yet" description="Every AI action will be logged here for audit." />;
  }
  return (
    <div className="space-y-1">
      {logs.map((l) => (
        <div key={l.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-900/40">
          <div className={cn(
            "h-2 w-2 rounded-full mt-1.5 flex-shrink-0",
            l.actionType === "error" ? "bg-red-500"
              : l.actionType === "approval_requested" ? "bg-amber-500"
              : l.actionType === "approval_granted" ? "bg-emerald-500"
              : l.actionType === "approval_denied" ? "bg-red-500"
              : l.actionType === "task_completed" ? "bg-emerald-500"
              : l.actionType === "workflow_completed" ? "bg-purple-500"
              : "bg-slate-600",
          )} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200">{l.description}</p>
            <p className="text-[10px] text-slate-500">
              {l.agentName || "System"} • {l.actionType} • {new Date(l.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MemoryPanel({ memory, onLoad }: { memory: MemoryDTO[]; onLoad: (m: MemoryDTO[]) => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const url = query
        ? `/api/ai-team/memory?q=${encodeURIComponent(query)}`
        : `/api/ai-team/memory`;
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        onLoad(data.memories || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search memory..."
          className="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-sm"
        />
        <button
          onClick={search}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          Search
        </button>
      </div>

      {memory.length === 0 ? (
        <EmptyState icon={Brain} title="Memory is empty" description="Agents will store knowledge here as they learn." />
      ) : (
        <div className="space-y-2">
          {memory.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {m.type}
                </span>
                <span className="text-xs text-slate-500">importance: {m.importance}</span>
                {m.agentKey && <span className="text-xs text-slate-500">• {m.agentKey}</span>}
              </div>
              <p className="text-sm font-medium text-white">{m.title}</p>
              <p className="text-xs text-slate-400 mt-1 line-clamp-3">{m.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800/40 mb-4">
        <Icon className="h-6 w-6 text-slate-600" />
      </div>
      <h3 className="text-sm font-semibold text-slate-300 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto">{description}</p>
    </div>
  );
}
