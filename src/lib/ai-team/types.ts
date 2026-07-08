// ============================================================================
// AI Workforce Module — Shared Types
// ============================================================================
// All types mirror the Prisma schema. Kept here so API routes and UI
// components share a single source of truth without importing @prisma/client
// (which is server-only).
// ============================================================================

export type AgentKey =
  | "ceo"
  | "operations"
  | "support"
  | "marketing"
  | "sales"
  | "finance"
  | "analytics"
  | "content"
  | "security"
  | "developer";

export const ALL_AGENT_KEYS: AgentKey[] = [
  "ceo",
  "operations",
  "support",
  "marketing",
  "sales",
  "finance",
  "analytics",
  "content",
  "security",
  "developer",
];

export type AgentStatus = "active" | "paused" | "error";
export type AgentRuntimeStatus = "idle" | "busy" | "waiting" | "error";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskSource =
  | "workflow_execution"
  | "manual"
  | "scheduled"
  | "escalated"
  | "system_event";

export type MessageType =
  | "request_metrics"
  | "notify_event"
  | "ask_question"
  | "share_data"
  | "escalate"
  | "broadcast";

export type MemoryType =
  | "fact"
  | "policy"
  | "preference"
  | "history"
  | "summary"
  | "customer"
  | "product"
  | "campaign"
  | "financial";

export type WorkflowTrigger = "manual" | "event" | "schedule";

export type WorkflowExecutionStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export type ApprovalActionType =
  | "financial_transfer"
  | "record_deletion"
  | "config_change"
  | "external_api_credential_change"
  | "major_decision"
  | "custom";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "executed"
  | "failed";

export type ActionType =
  | "task_created"
  | "task_completed"
  | "message_sent"
  | "decision_made"
  | "approval_requested"
  | "approval_granted"
  | "approval_denied"
  | "workflow_started"
  | "workflow_step_completed"
  | "workflow_completed"
  | "memory_updated"
  | "spending_occurred"
  | "error"
  | "escalation"
  | "config_changed";

export interface AgentTemplate {
  key: AgentKey;
  name: string;
  role: string;
  description: string;
  avatar: string;
  defaultGoals: string;
  defaultConfig: Record<string, unknown>;
  defaultSpendingLimits: {
    daily: number;
    monthly: number;
    perAction: number;
  };
  defaultApprovalRequiredActions: ApprovalActionType[];
}

export interface AgentDTO {
  id: string;
  organizationId: string;
  agentKey: AgentKey;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  runtimeStatus: AgentRuntimeStatus;
  avatar: string | null;
  goals: string;
  config: Record<string, unknown>;
  spendingLimits: { daily: number; monthly: number; perAction: number };
  approvalRequiredActions: ApprovalActionType[];
  autoResumeAfter: number;
  lastActiveAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  activeTaskCount?: number;
  todayCompletedCount?: number;
  pendingApprovalCount?: number;
}

export interface TaskDTO {
  id: string;
  organizationId: string;
  agentId: string;
  agentKey?: string;
  agentName?: string;
  source: TaskSource;
  workflowExecutionId: string | null;
  title: string;
  description: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: TaskStatus;
  priority: TaskPriority;
  impactScore: number;
  reasoning: string;
  approvalRequestId: string | null;
  deadlineAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDTO {
  id: string;
  organizationId: string;
  fromAgentId: string;
  fromAgentKey?: string;
  fromAgentName?: string;
  toAgentId: string;
  toAgentKey?: string;
  toAgentName?: string;
  type: MessageType;
  subject: string;
  payload: Record<string, unknown>;
  parentMessageId: string | null;
  isProcessed: boolean;
  processedAt: string | null;
  reply: string | null;
  sentAt: string;
  createdAt: string;
}

export interface MemoryDTO {
  id: string;
  organizationId: string;
  agentId: string | null;
  agentKey?: string | null;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  importance: number;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepDTO {
  id: string;
  workflowId: string;
  order: number;
  agentKey: AgentKey;
  agentId: string | null;
  name: string;
  description: string;
  inputTemplate: Record<string, unknown>;
  skipCondition: string | null;
  requiresApproval: boolean;
  timeoutSeconds: number;
}

export interface WorkflowDTO {
  id: string;
  organizationId: string;
  workflowKey: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  triggerConfig: Record<string, unknown>;
  inputSchema: Record<string, unknown>;
  isEnabled: boolean;
  steps: WorkflowStepDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionDTO {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowKey?: string;
  workflowName?: string;
  status: WorkflowExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  currentStep: number;
  totalSteps: number;
  approvalRequestId: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  tasks?: TaskDTO[];
}

export interface ApprovalRequestDTO {
  id: string;
  organizationId: string;
  requestedByAgentId: string;
  requestedByAgentKey?: string;
  requestedByAgentName?: string;
  actionType: ApprovalActionType;
  title: string;
  description: string;
  proposedAction: Record<string, unknown>;
  reasoning: string;
  approvedAction: Record<string, unknown> | null;
  status: ApprovalStatus;
  reviewedByUserId: string | null;
  reviewerNote: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  executedAt: string | null;
  executionResult: string | null;
  errorMessage: string | null;
  taskId: string | null;
  createdAt: string;
}

export interface ActionLogDTO {
  id: string;
  organizationId: string;
  agentId: string | null;
  agentKey?: string | null;
  agentName?: string | null;
  actionType: ActionType;
  description: string;
  details: Record<string, unknown>;
  reason: string;
  amount: number | null;
  triggeredByUserId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface DashboardStats {
  agents: {
    total: number;
    active: number;
    paused: number;
    error: number;
    busy: number;
    waiting: number;
  };
  tasks: {
    pending: number;
    inProgress: number;
    completedToday: number;
    failedToday: number;
    urgentPending: number;
  };
  approvals: {
    pending: number;
    approvedToday: number;
    deniedToday: number;
  };
  workflows: {
    runningNow: number;
    completedToday: number;
    failedToday: number;
  };
  messages: {
    sentToday: number;
    unprocessed: number;
  };
  revenue?: {
    today: number;
    week: number;
    month: number;
  };
}

export interface AskRequest {
  query: string;
  targetAgentKey?: AgentKey;
  context?: Record<string, unknown>;
}

export interface AskResponse {
  query: string;
  response: string;
  agentKey: AgentKey;
  agentName: string;
  reasoning: string;
  recommendedActions: Array<{
    type: string;
    description: string;
    requiresApproval: boolean;
    payload: Record<string, unknown>;
  }>;
  retrievedMemory: MemoryDTO[];
  traceId: string;
  llmPowered: boolean;
}
