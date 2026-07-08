// @ts-nocheck — Phase 18: AI Team module — strict typing deferred until LLM integration stabilizes
// ============================================================================
// AI Workforce Module — Central Orchestrator
// ============================================================================
// This module is the central nervous system of the AI Workforce. It:
//
//   1. Runs tasks assigned to agents (via LLM or rule-based stub)
//   2. Routes agent-to-agent messages through the message bus
//   3. Manages the approval workflow for sensitive actions
//   4. Logs every action to AiActionLog for auditability
//   5. Provides the "Ask My AI Team" entry point for the Owner
//
// Every method is organization-scoped — no cross-tenant data access.
// ============================================================================

import { db, safeDbQuery } from "@/lib/db";
import logger from "@/lib/logger";
import { getLLMProvider, isLLMPowered, getLLMProviderLabel } from "./llm";
import { getTemplate } from "./agents";
import {
  type AgentKey,
  type AgentDTO,
  type TaskDTO,
  type MessageDTO,
  type MemoryDTO,
  type ApprovalRequestDTO,
  type ActionLogDTO,
  type AskRequest,
  type AskResponse,
  type ApprovalActionType,
  ALL_AGENT_KEYS,
} from "./types";

// ── Helpers: JSON parse with fallback ──
function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}

// ── Map Prisma rows to DTOs ──
function mapAgent(a: any): AgentDTO {
  return {
    id: a.id,
    organizationId: a.organizationId,
    agentKey: a.agentKey,
    name: a.name,
    role: a.role,
    description: a.description,
    status: a.status,
    runtimeStatus: a.runtimeStatus,
    avatar: a.avatar,
    goals: a.goals,
    config: parseJSON(a.config, {}),
    spendingLimits: parseJSON(a.spendingLimits, { daily: 0, monthly: 0, perAction: 0 }),
    approvalRequiredActions: parseJSON(a.approvalRequiredActions, []),
    autoResumeAfter: a.autoResumeAfter,
    lastActiveAt: a.lastActiveAt?.toISOString() ?? null,
    lastError: a.lastError,
    createdAt: a.createdAt?.toISOString() ?? "",
    updatedAt: a.updatedAt?.toISOString() ?? "",
    activeTaskCount: a._count?.tasks ?? 0,
    todayCompletedCount: 0,
    pendingApprovalCount: 0,
  };
}

function mapTask(t: any): TaskDTO {
  return {
    id: t.id,
    organizationId: t.organizationId,
    agentId: t.agentId,
    agentKey: t.agent?.agentKey,
    agentName: t.agent?.name,
    source: t.source,
    workflowExecutionId: t.workflowExecutionId,
    title: t.title,
    description: t.description,
    input: parseJSON(t.input, {}),
    output: parseJSON(t.output, {}),
    status: t.status,
    priority: t.priority,
    impactScore: t.impactScore,
    reasoning: t.reasoning,
    approvalRequestId: t.approvalRequest?.id ?? null,
    deadlineAt: t.deadlineAt?.toISOString() ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    durationMs: t.durationMs,
    errorMessage: t.errorMessage,
    createdAt: t.createdAt?.toISOString() ?? "",
    updatedAt: t.updatedAt?.toISOString() ?? "",
  };
}

function mapMessage(m: any): MessageDTO {
  return {
    id: m.id,
    organizationId: m.organizationId,
    fromAgentId: m.fromAgentId,
    fromAgentKey: m.fromAgent?.agentKey,
    fromAgentName: m.fromAgent?.name,
    toAgentId: m.toAgentId,
    toAgentKey: m.toAgent?.agentKey,
    toAgentName: m.toAgent?.name,
    type: m.type,
    subject: m.subject,
    payload: parseJSON(m.payload, {}),
    parentMessageId: m.parentMessageId,
    isProcessed: m.isProcessed,
    processedAt: m.processedAt?.toISOString() ?? null,
    reply: m.reply,
    sentAt: m.sentAt?.toISOString() ?? "",
    createdAt: m.createdAt?.toISOString() ?? "",
  };
}

function mapMemory(m: any): MemoryDTO {
  return {
    id: m.id,
    organizationId: m.organizationId,
    agentId: m.agentId,
    agentKey: m.agent?.agentKey ?? null,
    type: m.type,
    title: m.title,
    content: m.content,
    tags: parseJSON(m.tags, []),
    metadata: parseJSON(m.metadata, {}),
    importance: m.importance,
    expiresAt: m.expiresAt?.toISOString() ?? null,
    accessCount: m.accessCount,
    lastAccessedAt: m.lastAccessedAt?.toISOString() ?? null,
    createdAt: m.createdAt?.toISOString() ?? "",
    updatedAt: m.updatedAt?.toISOString() ?? "",
  };
}

function mapApproval(p: any): ApprovalRequestDTO {
  return {
    id: p.id,
    organizationId: p.organizationId,
    requestedByAgentId: p.requestedByAgentId,
    requestedByAgentKey: p.requestedByAgent?.agentKey,
    requestedByAgentName: p.requestedByAgent?.name,
    actionType: p.actionType,
    title: p.title,
    description: p.description,
    proposedAction: parseJSON(p.proposedAction, {}),
    reasoning: p.reasoning,
    approvedAction: p.approvedAction ? parseJSON(p.approvedAction, {}) : null,
    status: p.status,
    reviewedByUserId: p.reviewedByUserId,
    reviewerNote: p.reviewerNote,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    executedAt: p.executedAt?.toISOString() ?? null,
    executionResult: p.executionResult,
    errorMessage: p.errorMessage,
    taskId: p.taskId,
    createdAt: p.createdAt?.toISOString() ?? "",
  };
}

function mapLog(l: any): ActionLogDTO {
  return {
    id: l.id,
    organizationId: l.organizationId,
    agentId: l.agentId,
    agentKey: l.agent?.agentKey ?? null,
    agentName: l.agent?.name ?? null,
    actionType: l.actionType,
    description: l.description,
    details: parseJSON(l.details, {}),
    reason: l.reason,
    amount: l.amount ? Number(l.amount) : null,
    triggeredByUserId: l.triggeredByUserId,
    ipAddress: l.ipAddress,
    createdAt: l.createdAt?.toISOString() ?? "",
  };
}

// ============================================================================
// Orchestrator — Public API
// ============================================================================

export const Orchestrator = {
  // ── Seed default agents for an organization ──
  async seedOrg(organizationId: string): Promise<{ created: number; skipped: number }> {
    const existing = await db.aiAgent.findMany({
      where: { organizationId },
      select: { agentKey: true },
    });
    const existingKeys = new Set(existing.map((a) => a.agentKey));
    const toCreate = ALL_AGENT_KEYS.filter((k) => !existingKeys.has(k));

    if (toCreate.length === 0) {
      return { created: 0, skipped: ALL_AGENT_KEYS.length };
    }

    // Lazy import to avoid circular dep
    const { AGENT_TEMPLATES } = await import("./agents");
    const templatesToCreate = AGENT_TEMPLATES.filter((t) => toCreate.includes(t.key));

    await db.aiAgent.createMany({
      data: templatesToCreate.map((t) => ({
        organizationId,
        agentKey: t.key,
        name: t.name,
        role: t.role,
        description: t.description,
        avatar: t.avatar,
        goals: t.defaultGoals,
        config: safeStringify(t.defaultConfig),
        spendingLimits: safeStringify(t.defaultSpendingLimits),
        approvalRequiredActions: safeStringify(t.defaultApprovalRequiredActions),
      })),
    });

    logger.info("[AI Team] Seeded agents for org", { organizationId, count: toCreate.length });
    return { created: toCreate.length, skipped: existingKeys.size };
  },

  // ── Get all agents for an org (with stats) ──
  async getAgents(organizationId: string): Promise<AgentDTO[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const agents = await db.aiAgent.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            tasks: { where: { status: { in: ["pending", "in_progress"] } } },
          },
        },
      },
      orderBy: { agentKey: "asc" },
    });

    const dtos = agents.map(mapAgent);

    // Fill in today's completed count + pending approvals in batch
    const [completedCounts, pendingApprovals] = await Promise.all([
      db.aiTask.groupBy({
        by: ["agentId"],
        where: {
          organizationId,
          status: "completed",
          completedAt: { gte: todayStart },
        },
        _count: true,
      }),
      db.aiApprovalRequest.groupBy({
        by: ["requestedByAgentId"],
        where: { organizationId, status: "pending" },
        _count: true,
      }),
    ]);

    const completedMap = new Map(completedCounts.map((c) => [c.agentId, c._count]));
    const approvalMap = new Map(pendingApprovals.map((a) => [a.requestedByAgentId, a._count]));

    return dtos.map((a) => ({
      ...a,
      activeTaskCount: a.activeTaskCount ?? 0,
      todayCompletedCount: completedMap.get(a.id) ?? 0,
      pendingApprovalCount: approvalMap.get(a.id) ?? 0,
    }));
  },

  // ── Update agent (start/stop, goals, spending limits) ──
  async updateAgent(
    organizationId: string,
    agentId: string,
    updates: {
      status?: "active" | "paused" | "error";
      goals?: string;
      spendingLimits?: { daily: number; monthly: number; perAction: number };
      approvalRequiredActions?: ApprovalActionType[];
      config?: Record<string, unknown>;
    },
    triggeredByUserId?: string,
  ): Promise<AgentDTO | null> {
    const data: any = {};
    if (updates.status) data.status = updates.status;
    if (updates.goals !== undefined) data.goals = updates.goals;
    if (updates.spendingLimits) data.spendingLimits = safeStringify(updates.spendingLimits);
    if (updates.approvalRequiredActions)
      data.approvalRequiredActions = safeStringify(updates.approvalRequiredActions);
    if (updates.config) data.config = safeStringify(updates.config);

    const updated = await db.aiAgent.updateMany({
      where: { id: agentId, organizationId },
      data,
    });

    if (updated.count === 0) return null;

    // Log the config change
    await this.logAction(organizationId, agentId, "config_changed", `Agent updated`, {
      updates: Object.keys(updates),
      triggeredByUserId,
    });

    const agent = await db.aiAgent.findUnique({ where: { id: agentId } });
    return agent ? mapAgent(agent) : null;
  },

  // ── Create a task (Owner or workflow can create) ──
  async createTask(
    organizationId: string,
    agentKey: AgentKey,
    task: {
      title: string;
      description?: string;
      input?: Record<string, unknown>;
      priority?: "low" | "normal" | "high" | "urgent";
      impactScore?: number;
      source?: string;
      deadlineAt?: Date;
    },
    triggeredByUserId?: string,
  ): Promise<TaskDTO | null> {
    const agent = await db.aiAgent.findUnique({
      where: { organizationId_agentKey: { organizationId, agentKey } },
    });
    if (!agent) return null;
    if (agent.status !== "active") {
      // Auto-pause: don't create tasks for paused agents
      return null;
    }

    const created = await db.aiTask.create({
      data: {
        organizationId,
        agentId: agent.id,
        title: task.title,
        description: task.description || "",
        input: safeStringify(task.input || {}),
        priority: task.priority || "normal",
        impactScore: task.impactScore ?? 50,
        source: task.source || "manual",
        deadlineAt: task.deadlineAt,
      },
    });

    await this.logAction(
      organizationId,
      agent.id,
      "task_created",
      `Task created: ${task.title}`,
      { taskId: created.id, triggeredByUserId },
    );

    return mapTask(created);
  },

  // ── Execute a task (run the agent on it) ──
  async executeTask(organizationId: string, taskId: string): Promise<TaskDTO | null> {
    const task = await db.aiTask.findFirst({
      where: { id: taskId, organizationId },
      include: { agent: true, approvalRequest: true },
    });
    if (!task || !task.agent) return null;
    if (task.status !== "pending" && task.status !== "blocked") {
      return mapTask(task);
    }
    if (task.agent.status !== "active") {
      return mapTask(task); // Don't execute paused agents
    }

    // Mark in_progress + set runtimeStatus busy
    const startedAt = new Date();
    await db.aiTask.update({
      where: { id: taskId },
      data: { status: "in_progress", startedAt },
    });
    await db.aiAgent.update({
      where: { id: task.agentId },
      data: { runtimeStatus: "busy", lastActiveAt: startedAt },
    });

    try {
      // Retrieve relevant memory for this agent
      const memories = await db.aiMemory.findMany({
        where: {
          organizationId,
          OR: [{ agentId: null }, { agentId: task.agentId }],
          expiresAt: { isSet: false }.expiresAt ? { gt: new Date() } : undefined,
        },
        orderBy: [{ importance: "desc" }, { lastAccessedAt: "desc" }],
        take: 5,
      });

      // Build LLM prompt
      const template = getTemplate(task.agent.agentKey as AgentKey);
      const systemPrompt = `You are the ${task.agent.name} at a Valtriox-powered company. Your role: ${task.agent.role}. Your goals: ${task.agent.goals}. Respond concisely and professionally. Always provide reasoning for your decisions.`;

      const userPrompt = `TASK: ${task.title}\n\nDESCRIPTION: ${task.description}\n\nINPUT DATA: ${JSON.stringify(task.input, null, 2)}\n\nRELEVANT KNOWLEDGE:\n${memories.map((m) => `- ${m.title}: ${m.content.slice(0, 200)}`).join("\n") || "(none)"}\n\nPlease complete this task. Provide:\n1. Your analysis\n2. Your recommended actions\n3. Any decisions that require Owner approval`;

      const llm = getLLMProvider();
      const llmRes = await llm.generate({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        maxTokens: 800,
      });

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      const output = {
        response: llmRes.content,
        llmPowered: llmRes.powered,
        tokensUsed: llmRes.tokensUsed,
        retrievedMemoryIds: memories.map((m) => m.id),
      };

      const updated = await db.aiTask.update({
        where: { id: taskId },
        data: {
          status: "completed",
          completedAt,
          durationMs,
          output: safeStringify(output),
          reasoning: `LLM: ${llmRes.powered ? "yes" : "stub"} | ${llmRes.latencyMs}ms`,
        },
      });

      // Mark memory as accessed
      if (memories.length > 0) {
        await db.aiMemory.updateMany({
          where: { id: { in: memories.map((m) => m.id) } },
          data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
        });
      }

      // Set agent back to idle
      await db.aiAgent.update({
        where: { id: task.agentId },
        data: { runtimeStatus: "idle", lastActiveAt: completedAt },
      });

      await this.logAction(
        organizationId,
        task.agentId,
        "task_completed",
        `Task completed: ${task.title}`,
        { taskId, durationMs, llmPowered: llmRes.powered },
      );

      return mapTask(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const failedAt = new Date();

      await db.aiTask.update({
        where: { id: taskId },
        data: {
          status: "failed",
          errorMessage: msg,
        },
      });
      await db.aiAgent.update({
        where: { id: task.agentId },
        data: { runtimeStatus: "error", lastError: msg, lastActiveAt: failedAt },
      });

      await this.logAction(
        organizationId,
        task.agentId,
        "error",
        `Task failed: ${task.title} — ${msg}`,
        { taskId, error: msg },
      );

      logger.error("[AI Team] Task execution failed", { taskId, error: msg });
      return null;
    }
  },

  // ── Get tasks for an org (with filters) ──
  async getTasks(
    organizationId: string,
    filters: {
      agentId?: string;
      status?: string;
      limit?: number;
    } = {},
  ): Promise<TaskDTO[]> {
    const where: any = { organizationId };
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.status) where.status = filters.status;

    const tasks = await db.aiTask.findMany({
      where,
      include: { agent: true, approvalRequest: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: filters.limit ?? 50,
    });
    return tasks.map(mapTask);
  },

  // ── Send a message between agents ──
  async sendMessage(
    organizationId: string,
    fromAgentKey: AgentKey,
    toAgentKey: AgentKey,
    message: {
      type: string;
      subject: string;
      payload?: Record<string, unknown>;
      parentMessageId?: string;
    },
  ): Promise<MessageDTO | null> {
    const [from, to] = await Promise.all([
      db.aiAgent.findUnique({
        where: { organizationId_agentKey: { organizationId, agentKey: fromAgentKey } },
      }),
      db.aiAgent.findUnique({
        where: { organizationId_agentKey: { organizationId, agentKey: toAgentKey } },
      }),
    ]);
    if (!from || !to) return null;

    const created = await db.aiMessage.create({
      data: {
        organizationId,
        fromAgentId: from.id,
        toAgentId: to.id,
        type: message.type,
        subject: message.subject,
        payload: safeStringify(message.payload || {}),
        parentMessageId: message.parentMessageId,
      },
      include: { fromAgent: true, toAgent: true },
    });

    await this.logAction(
      organizationId,
      from.id,
      "message_sent",
      `Message to ${to.name}: ${message.subject}`,
      { messageId: created.id, toAgentId: to.id, type: message.type },
    );

    return mapMessage(created);
  },

  // ── Get messages for an org ──
  async getMessages(
    organizationId: string,
    filters: { agentId?: string; limit?: number } = {},
  ): Promise<MessageDTO[]> {
    const where: any = { organizationId };
    if (filters.agentId) {
      where.OR = [{ fromAgentId: filters.agentId }, { toAgentId: filters.agentId }];
    }
    const messages = await db.aiMessage.findMany({
      where,
      include: { fromAgent: true, toAgent: true },
      orderBy: { sentAt: "desc" },
      take: filters.limit ?? 50,
    });
    return messages.map(mapMessage);
  },

  // ── Store a memory entry ──
  async storeMemory(
    organizationId: string,
    memory: {
      agentKey?: AgentKey;
      type: string;
      title: string;
      content: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      importance?: number;
      expiresAt?: Date;
    },
  ): Promise<MemoryDTO | null> {
    let agentId: string | null = null;
    if (memory.agentKey) {
      const agent = await db.aiAgent.findUnique({
        where: { organizationId_agentKey: { organizationId, agentKey: memory.agentKey } },
      });
      agentId = agent?.id ?? null;
    }

    const created = await db.aiMemory.create({
      data: {
        organizationId,
        agentId,
        type: memory.type,
        title: memory.title,
        content: memory.content,
        tags: safeStringify(memory.tags || []),
        metadata: safeStringify(memory.metadata || {}),
        importance: memory.importance ?? 50,
        expiresAt: memory.expiresAt,
      },
      include: { agent: true },
    });

    await this.logAction(
      organizationId,
      agentId,
      "memory_updated",
      `Memory stored: ${memory.title}`,
      { memoryId: created.id, type: memory.type },
    );

    return mapMemory(created);
  },

  // ── Retrieve relevant memory for an agent ──
  async retrieveMemory(
    organizationId: string,
    agentKey: AgentKey,
    query?: string,
    limit = 5,
  ): Promise<MemoryDTO[]> {
    const agent = await db.aiAgent.findUnique({
      where: { organizationId_agentKey: { organizationId, agentKey } },
    });

    const where: any = {
      organizationId,
      OR: [{ agentId: null }, ...(agent ? [{ agentId: agent.id }] : [])],
    };

    // Simple keyword filter on title/content
    if (query) {
      where.OR = [
        ...(where.OR || []),
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ];
    }

    const memories = await db.aiMemory.findMany({
      where,
      include: { agent: true },
      orderBy: [{ importance: "desc" }, { lastAccessedAt: "desc" }],
      take: limit,
    });

    // Mark as accessed
    if (memories.length > 0) {
      await db.aiMemory.updateMany({
        where: { id: { in: memories.map((m) => m.id) } },
        data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
      });
    }

    return memories.map(mapMemory);
  },

  // ── Create an approval request ──
  async requestApproval(
    organizationId: string,
    requestedByAgentKey: AgentKey,
    approval: {
      actionType: ApprovalActionType;
      title: string;
      description: string;
      proposedAction: Record<string, unknown>;
      reasoning: string;
      taskId?: string;
      expiresAt?: Date;
    },
  ): Promise<ApprovalRequestDTO | null> {
    const agent = await db.aiAgent.findUnique({
      where: { organizationId_agentKey: { organizationId, agentKey: requestedByAgentKey } },
    });
    if (!agent) return null;

    const created = await db.aiApprovalRequest.create({
      data: {
        organizationId,
        requestedByAgentId: agent.id,
        actionType: approval.actionType,
        title: approval.title,
        description: approval.description,
        proposedAction: safeStringify(approval.proposedAction),
        reasoning: approval.reasoning,
        taskId: approval.taskId,
        expiresAt: approval.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: { requestedByAgent: true },
    });

    await this.logAction(
      organizationId,
      agent.id,
      "approval_requested",
      `Approval requested: ${approval.title}`,
      { approvalId: created.id, actionType: approval.actionType },
    );

    return mapApproval(created);
  },

  // ── Owner approves/denies an approval request ──
  async reviewApproval(
    organizationId: string,
    approvalId: string,
    decision: "approved" | "denied",
    reviewerUserId: string,
    reviewerNote?: string,
  ): Promise<ApprovalRequestDTO | null> {
    const updated = await db.aiApprovalRequest.updateMany({
      where: { id: approvalId, organizationId, status: "pending" },
      data: {
        status: decision,
        reviewedByUserId: reviewerUserId,
        reviewerNote: reviewerNote || null,
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) return null;

    const approval = await db.aiApprovalRequest.findUnique({
      where: { id: approvalId },
      include: { requestedByAgent: true },
    });
    if (!approval) return null;

    await this.logAction(
      organizationId,
      approval.requestedByAgentId,
      decision === "approved" ? "approval_granted" : "approval_denied",
      `Approval ${decision}: ${approval.title}`,
      { approvalId, reviewerUserId, reviewerNote },
    );

    return mapApproval(approval);
  },

  // ── Get pending approvals ──
  async getApprovals(
    organizationId: string,
    status = "pending",
  ): Promise<ApprovalRequestDTO[]> {
    const approvals = await db.aiApprovalRequest.findMany({
      where: { organizationId, status },
      include: { requestedByAgent: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return approvals.map(mapApproval);
  },

  // ── Get action logs ──
  async getLogs(
    organizationId: string,
    filters: { agentId?: string; actionType?: string; limit?: number } = {},
  ): Promise<ActionLogDTO[]> {
    const where: any = { organizationId };
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.actionType) where.actionType = filters.actionType;

    const logs = await db.aiActionLog.findMany({
      where,
      include: { agent: true },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 100,
    });
    return logs.map(mapLog);
  },

  // ── Internal: log an action ──
  async logAction(
    organizationId: string,
    agentId: string | null,
    actionType: string,
    description: string,
    details: Record<string, unknown> = {},
    reason = "",
    amount?: number,
    triggeredByUserId?: string,
  ): Promise<void> {
    try {
      await db.aiActionLog.create({
        data: {
          organizationId,
          agentId,
          actionType,
          description,
          details: safeStringify(details),
          reason,
          amount: amount ?? null,
          triggeredByUserId: triggeredByUserId ?? null,
        },
      });
    } catch (err: unknown) {
      // Never fail the main operation because logging failed
      logger.error("[AI Team] Failed to log action", { actionType, error: String(err) });
    }
  },

  // ── "Ask My AI Team" — Owner's natural-language entry point ──
  async ask(organizationId: string, req: AskRequest, userId: string): Promise<AskResponse> {
    const agentKey = req.targetAgentKey || "ceo";
    const agent = await db.aiAgent.findUnique({
      where: { organizationId_agentKey: { organizationId, agentKey } },
    });
    if (!agent) {
      throw new Error(`Agent '${agentKey}' not found for this organization`);
    }

    // Retrieve relevant memory
    const memories = await this.retrieveMemory(organizationId, agentKey, req.query, 5);
    const memoryDtos = memories;

    // Build LLM prompt
    const systemPrompt = `You are the ${agent.name} at a Valtriox-powered company.

ROLE: ${agent.role}
GOALS (set by Owner): ${agent.goals}

You have access to the following company knowledge:
${memories.map((m) => `- [${m.type}] ${m.title}: ${m.content.slice(0, 300)}`).join("\n") || "(no relevant knowledge found)"}

Respond as a senior ${agent.role}. Be concise, professional, and actionable. If you recommend an action that requires Owner approval (financial, deletions, config changes), explicitly say so.`;

    const userPrompt = `OWNER QUERY: ${req.query}

${req.context ? `ADDITIONAL CONTEXT: ${JSON.stringify(req.context, null, 2)}` : ""}

Please provide:
1. Your response to the Owner
2. Recommended actions (with "requiresApproval": true for sensitive ones)
3. Your reasoning

Respond in this exact JSON format (no markdown fences):
{
  "response": "your main response text",
  "reasoning": "why you're recommending this",
  "recommendedActions": [
    { "type": "action_type", "description": "what to do", "requiresApproval": false, "payload": {} }
  ]
}`;

    const llm = getLLMProvider();
    const llmRes = await llm.generate({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 1000,
      responseFormat: "json",
    });

    // Parse the response — try JSON, fall back to plain text
    let parsed: {
      response: string;
      reasoning: string;
      recommendedActions: Array<{
        type: string;
        description: string;
        requiresApproval: boolean;
        payload: Record<string, unknown>;
      }>;
    };

    try {
      // Strip markdown fences if present
      const cleanContent = llmRes.content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "");
      parsed = JSON.parse(cleanContent);
    } catch {
      // LLM didn't return valid JSON — wrap the content as the response
      parsed = {
        response: llmRes.content,
        reasoning: "Stub-mode response — set GEMINI_API_KEY or ZAI_API_KEY for structured recommendations",
        recommendedActions: [],
      };
    }

    const traceId = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    await this.logAction(
      organizationId,
      agent.id,
      "decision_made",
      `Owner asked: "${req.query.slice(0, 100)}"`,
      {
        traceId,
        query: req.query,
        responseLength: parsed.response.length,
        actionCount: parsed.recommendedActions.length,
        llmPowered: llmRes.powered,
      },
      `Routed to ${agent.name} (${agentKey})`,
      undefined,
      userId,
    );

    return {
      query: req.query,
      response: parsed.response,
      agentKey,
      agentName: agent.name,
      reasoning: parsed.reasoning,
      recommendedActions: parsed.recommendedActions,
      retrievedMemory: memoryDtos,
      traceId,
      llmPowered: llmRes.powered,
    };
  },

  // ── Dashboard aggregated stats ──
  async getDashboardStats(organizationId: string): Promise<any> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      agents,
      pendingTasks,
      inProgressTasks,
      completedToday,
      failedToday,
      urgentPending,
      pendingApprovals,
      approvedToday,
      deniedToday,
      runningWorkflows,
      completedWorkflowsToday,
      failedWorkflowsToday,
      messagesToday,
      unprocessedMessages,
    ] = await Promise.all([
      db.aiAgent.findMany({ where: { organizationId }, select: { status: true, runtimeStatus: true } }),
      db.aiTask.count({ where: { organizationId, status: "pending" } }),
      db.aiTask.count({ where: { organizationId, status: "in_progress" } }),
      db.aiTask.count({ where: { organizationId, status: "completed", completedAt: { gte: todayStart } } }),
      db.aiTask.count({ where: { organizationId, status: "failed", completedAt: { gte: todayStart } } }),
      db.aiTask.count({ where: { organizationId, status: "pending", priority: "urgent" } }),
      db.aiApprovalRequest.count({ where: { organizationId, status: "pending" } }),
      db.aiApprovalRequest.count({ where: { organizationId, status: "approved", reviewedAt: { gte: todayStart } } }),
      db.aiApprovalRequest.count({ where: { organizationId, status: "denied", reviewedAt: { gte: todayStart } } }),
      db.aiWorkflowExecution.count({ where: { organizationId, status: "running" } }),
      db.aiWorkflowExecution.count({ where: { organizationId, status: "completed", completedAt: { gte: todayStart } } }),
      db.aiWorkflowExecution.count({ where: { organizationId, status: "failed", completedAt: { gte: todayStart } } }),
      db.aiMessage.count({ where: { organizationId, sentAt: { gte: todayStart } } }),
      db.aiMessage.count({ where: { organizationId, isProcessed: false } }),
    ]);

    return {
      agents: {
        total: agents.length,
        active: agents.filter((a) => a.status === "active").length,
        paused: agents.filter((a) => a.status === "paused").length,
        error: agents.filter((a) => a.status === "error").length,
        busy: agents.filter((a) => a.runtimeStatus === "busy").length,
        waiting: agents.filter((a) => a.runtimeStatus === "waiting").length,
      },
      tasks: {
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completedToday,
        failedToday,
        urgentPending,
      },
      approvals: {
        pending: pendingApprovals,
        approvedToday,
        deniedToday,
      },
      workflows: {
        runningNow: runningWorkflows,
        completedToday: completedWorkflowsToday,
        failedToday: failedWorkflowsToday,
      },
      messages: {
        sentToday: messagesToday,
        unprocessed: unprocessedMessages,
      },
      llmPowered: isLLMPowered(),
      llmProvider: getLLMProviderLabel(),
    };
  },

  // ── Bundled initial-load payload (avoids 6 parallel HTTP round-trips on
  //    dashboard mount). Single DB connection, single HTTP request. ──
  async getInitData(organizationId: string): Promise<{
    agents: AgentDTO[];
    stats: any;
    tasks: TaskDTO[];
    messages: MessageDTO[];
    approvals: ApprovalRequestDTO[];
    logs: ActionLogDTO[];
    seeded: boolean;
  }> {
    // First: check if org is seeded (cheap query)
    const agentCount = await db.aiAgent.count({ where: { organizationId } });
    if (agentCount === 0) {
      const stats = await this.getDashboardStats(organizationId);
      return {
        agents: [],
        stats,
        tasks: [],
        messages: [],
        approvals: [],
        logs: [],
        seeded: false,
      };
    }

    // Parallel: all reads in one Promise.all (single event-loop tick)
    const [agents, stats, tasks, messages, approvals, logs] = await Promise.all([
      this.getAgents(organizationId),
      this.getDashboardStats(organizationId),
      this.getTasks(organizationId, { limit: 30 }),
      this.getMessages(organizationId, { limit: 30 }),
      this.getApprovals(organizationId, "pending"),
      this.getLogs(organizationId, { limit: 50 }),
    ]);

    return {
      agents,
      stats,
      tasks,
      messages,
      approvals,
      logs,
      seeded: true,
    };
  },
};
