// @ts-nocheck — Phase 18: AI Team module — strict typing deferred until LLM integration stabilizes
// ============================================================================
// AI Workforce Module — Workflow Engine
// ============================================================================
// Executes multi-step workflows that orchestrate multiple agents.
//
// Example workflow: "New Order"
//   Step 1: Operations Agent — process the order, check inventory
//   Step 2: Finance Agent — verify payment, generate invoice
//   Step 3: Marketing Agent — prepare follow-up promotion
//   Step 4: Analytics Agent — update KPIs
//   Step 5: CEO Agent — send summary to Owner
//
// Workflows can be triggered manually, by events, or on a schedule. Each
// execution is fully logged and traceable.
// ============================================================================

import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { Orchestrator } from "./orchestrator";
import type { AgentKey, WorkflowDTO, WorkflowExecutionDTO } from "./types";

// ── Default workflow definitions (seeded per org) ──
export const DEFAULT_WORKFLOWS = [
  {
    workflowKey: "new_order",
    name: "New Order Workflow",
    description:
      "End-to-end order processing: Operations verifies inventory → Finance verifies payment → Marketing prepares follow-up → Analytics updates KPIs → CEO briefs Owner.",
    trigger: "event",
    triggerConfig: { event: "order_created" },
    inputSchema: { orderId: "string", customerId: "string?", amount: "number" },
    steps: [
      {
        order: 1,
        agentKey: "operations" as AgentKey,
        name: "Process Order & Check Inventory",
        description: "Verify the order details and confirm inventory availability.",
        inputTemplate: { orderId: "{{input.orderId}}" },
        requiresApproval: false,
        timeoutSeconds: 300,
      },
      {
        order: 2,
        agentKey: "finance" as AgentKey,
        name: "Verify Payment & Generate Invoice",
        description: "Confirm payment received and generate invoice for the order.",
        inputTemplate: { orderId: "{{input.orderId}}", amount: "{{input.amount}}" },
        requiresApproval: false,
        timeoutSeconds: 300,
      },
      {
        order: 3,
        agentKey: "marketing" as AgentKey,
        name: "Prepare Follow-up Promotion",
        description: "Create a personalized follow-up offer for the customer.",
        inputTemplate: { orderId: "{{input.orderId}}", customerId: "{{input.customerId}}" },
        requiresApproval: false,
        timeoutSeconds: 300,
      },
      {
        order: 4,
        agentKey: "analytics" as AgentKey,
        name: "Update KPIs",
        description: "Update revenue, order count, and AOV dashboards.",
        inputTemplate: { orderId: "{{input.orderId}}", amount: "{{input.amount}}" },
        requiresApproval: false,
        timeoutSeconds: 120,
      },
      {
        order: 5,
        agentKey: "ceo" as AgentKey,
        name: "Send Summary to Owner",
        description: "Brief the Owner on the completed order workflow.",
        inputTemplate: { orderId: "{{input.orderId}}", amount: "{{input.amount}}" },
        requiresApproval: false,
        timeoutSeconds: 120,
      },
    ],
  },
  {
    workflowKey: "low_inventory_alert",
    name: "Low Inventory Alert Workflow",
    description:
      "Triggered when any product drops below threshold. Operations creates a purchase reminder → Finance estimates cost → CEO decides whether to approve purchase.",
    trigger: "event",
    triggerConfig: { event: "inventory_low" },
    inputSchema: { productId: "string", productName: "string", currentStock: "number", threshold: "number" },
    steps: [
      {
        order: 1,
        agentKey: "operations" as AgentKey,
        name: "Create Purchase Reminder",
        description: "Generate a purchase reminder for the low-stock product.",
        inputTemplate: { productId: "{{input.productId}}", currentStock: "{{input.currentStock}}" },
        requiresApproval: false,
        timeoutSeconds: 120,
      },
      {
        order: 2,
        agentKey: "finance" as AgentKey,
        name: "Estimate Purchase Cost",
        description: "Estimate the cost to restock and check budget availability.",
        inputTemplate: { productId: "{{input.productId}}" },
        requiresApproval: false,
        timeoutSeconds: 120,
      },
      {
        order: 3,
        agentKey: "ceo" as AgentKey,
        name: "Decision: Approve Purchase?",
        description: "Decide whether to proceed with the purchase. If cost > $500, escalate to Owner.",
        inputTemplate: { productId: "{{input.productId}}" },
        requiresApproval: true,
        timeoutSeconds: 3600,
      },
    ],
  },
  {
    workflowKey: "weekly_business_summary",
    name: "Weekly Business Summary",
    description:
      "Every Monday at 9 AM: Analytics compiles KPIs → Finance summarizes revenue/expenses → CEO writes the Owner's weekly brief.",
    trigger: "schedule",
    triggerConfig: { cron: "0 9 * * 1" },
    inputSchema: {},
    steps: [
      {
        order: 1,
        agentKey: "analytics" as AgentKey,
        name: "Compile Weekly KPIs",
        description: "Aggregate this week's revenue, orders, conversion, retention.",
        inputTemplate: {},
        requiresApproval: false,
        timeoutSeconds: 600,
      },
      {
        order: 2,
        agentKey: "finance" as AgentKey,
        name: "Summarize Revenue & Expenses",
        description: "Weekly P&L summary with comparisons to last week.",
        inputTemplate: {},
        requiresApproval: false,
        timeoutSeconds: 600,
      },
      {
        order: 3,
        agentKey: "ceo" as AgentKey,
        name: "Write Owner's Weekly Brief",
        description: "Synthesize everything into a 200-word brief for the Owner.",
        inputTemplate: {},
        requiresApproval: false,
        timeoutSeconds: 300,
      },
    ],
  },
];

// ── Workflow Engine ──
export const WorkflowEngine = {
  // ── Seed default workflows for an org ──
  async seedWorkflows(organizationId: string): Promise<{ created: number; skipped: number }> {
    const existing = await db.aiWorkflow.findMany({
      where: { organizationId },
      select: { workflowKey: true },
    });
    const existingKeys = new Set(existing.map((w) => w.workflowKey));
    const toCreate = DEFAULT_WORKFLOWS.filter((w) => !existingKeys.has(w.workflowKey));

    for (const w of toCreate) {
      const created = await db.aiWorkflow.create({
        data: {
          organizationId,
          workflowKey: w.workflowKey,
          name: w.name,
          description: w.description,
          trigger: w.trigger,
          triggerConfig: JSON.stringify(w.triggerConfig),
          inputSchema: JSON.stringify(w.inputSchema),
          steps: {
            create: w.steps.map((s) => ({
              order: s.order,
              agentKey: s.agentKey,
              name: s.name,
              description: s.description,
              inputTemplate: JSON.stringify(s.inputTemplate),
              requiresApproval: s.requiresApproval,
              timeoutSeconds: s.timeoutSeconds,
            })),
          },
        },
      });
      // Link each step to the org's agent instance
      const agents = await db.aiAgent.findMany({
        where: { organizationId, agentKey: { in: w.steps.map((s) => s.agentKey) } },
        select: { id: true, agentKey: true },
      });
      const agentMap = new Map(agents.map((a) => [a.agentKey, a.id]));
      for (const step of w.steps) {
        const stepRow = await db.aiWorkflowStep.findFirst({
          where: { workflowId: created.id, order: step.order },
        });
        if (stepRow && agentMap.has(step.agentKey)) {
          await db.aiWorkflowStep.update({
            where: { id: stepRow.id },
            data: { agentId: agentMap.get(step.agentKey) },
          });
        }
      }
    }

    return { created: toCreate.length, skipped: existingKeys.size };
  },

  // ── Get all workflows for an org ──
  async getWorkflows(organizationId: string): Promise<WorkflowDTO[]> {
    const workflows = await db.aiWorkflow.findMany({
      where: { organizationId },
      include: { steps: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return workflows.map((w) => ({
      id: w.id,
      organizationId: w.organizationId,
      workflowKey: w.workflowKey,
      name: w.name,
      description: w.description,
      trigger: w.trigger,
      triggerConfig: JSON.parse(w.triggerConfig || "{}"),
      inputSchema: JSON.parse(w.inputSchema || "{}"),
      isEnabled: w.isEnabled,
      steps: w.steps.map((s) => ({
        id: s.id,
        workflowId: s.workflowId,
        order: s.order,
        agentKey: s.agentKey,
        agentId: s.agentId,
        name: s.name,
        description: s.description,
        inputTemplate: JSON.parse(s.inputTemplate || "{}"),
        skipCondition: s.skipCondition,
        requiresApproval: s.requiresApproval,
        timeoutSeconds: s.timeoutSeconds,
      })),
      createdAt: w.createdAt?.toISOString() ?? "",
      updatedAt: w.updatedAt?.toISOString() ?? "",
    }));
  },

  // ── Start a workflow execution ──
  async startExecution(
    organizationId: string,
    workflowKey: string,
    input: Record<string, unknown> = {},
    triggeredByUserId?: string,
  ): Promise<WorkflowExecutionDTO | null> {
    const workflow = await db.aiWorkflow.findFirst({
      where: { organizationId, workflowKey, isEnabled: true },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!workflow || workflow.steps.length === 0) return null;

    const execution = await db.aiWorkflowExecution.create({
      data: {
        organizationId,
        workflowId: workflow.id,
        status: "running",
        input: JSON.stringify(input),
        currentStep: 1,
        totalSteps: workflow.steps.length,
      },
    });

    await Orchestrator.logAction(
      organizationId,
      null,
      "workflow_started",
      `Workflow started: ${workflow.name}`,
      { executionId: execution.id, workflowKey, inputKeys: Object.keys(input), triggeredByUserId },
    );

    // Execute the first step (subsequent steps handled by advanceExecution)
    await this.advanceExecution(organizationId, execution.id);

    return this.getExecution(organizationId, execution.id);
  },

  // ── Advance an execution to the next step ──
  async advanceExecution(
    organizationId: string,
    executionId: string,
  ): Promise<void> {
    const execution = await db.aiWorkflowExecution.findFirst({
      where: { id: executionId, organizationId },
      include: {
        workflow: { include: { steps: { orderBy: { order: "asc" } } } },
        tasks: true,
      },
    });
    if (!execution || !execution.workflow) return;
    if (execution.status !== "running") return;

    const steps = execution.workflow.steps;
    if (execution.currentStep > steps.length) {
      // All steps complete — finalize
      const completedAt = new Date();
      await db.aiWorkflowExecution.update({
        where: { id: executionId },
        data: {
          status: "completed",
          completedAt,
          durationMs: completedAt.getTime() - execution.startedAt.getTime(),
          output: JSON.stringify({
            tasksCompleted: execution.tasks.length,
            summary: `Workflow completed in ${execution.tasks.length} steps.`,
          }),
        },
      });
      await Orchestrator.logAction(
        organizationId,
        null,
        "workflow_completed",
        `Workflow completed: ${execution.workflow.name}`,
        { executionId },
      );
      return;
    }

    const step = steps[execution.currentStep - 1];
    if (!step || !step.agentId) {
      // Skip steps without an agent (shouldn't happen, but be defensive)
      await db.aiWorkflowExecution.update({
        where: { id: executionId },
        data: { currentStep: { increment: 1 } },
      });
      return this.advanceExecution(organizationId, executionId);
    }

    // Create a task for this step
    const input = JSON.parse(execution.input || "{}");
    const task = await Orchestrator.createTask(
      organizationId,
      step.agentKey as AgentKey,
      {
        title: `[${execution.workflow.name}] Step ${step.order}: ${step.name}`,
        description: step.description,
        input: { ...input, stepOrder: step.order, workflowKey: execution.workflow.workflowKey },
        source: "workflow_execution",
        priority: "high",
        impactScore: 70,
      },
    );

    if (task) {
      // Link the task to the execution
      await db.aiTask.update({
        where: { id: task.id },
        data: { workflowExecutionId: executionId },
      });

      // If the step requires approval, pause the workflow
      if (step.requiresApproval) {
        const approval = await Orchestrator.requestApproval(
          organizationId,
          step.agentKey as AgentKey,
          {
            actionType: "major_decision",
            title: `Workflow Approval: ${step.name}`,
            description: `Workflow "${execution.workflow.name}" step ${step.order} requires your approval.`,
            proposedAction: { executionId, stepOrder: step.order, taskId: task.id },
            reasoning: `This workflow step is configured to require Owner approval before execution.`,
            taskId: task.id,
          },
        );
        if (approval) {
          await db.aiWorkflowExecution.update({
            where: { id: executionId },
            data: { status: "paused", approvalRequestId: approval.id },
          });
          return;
        }
      }

      // Execute the task immediately (synchronously for now)
      await Orchestrator.executeTask(organizationId, task.id);

      await Orchestrator.logAction(
        organizationId,
        step.agentId,
        "workflow_step_completed",
        `Workflow step ${step.order} completed: ${step.name}`,
        { executionId, stepOrder: step.order, taskId: task.id },
      );
    }

    // Advance to next step
    await db.aiWorkflowExecution.update({
      where: { id: executionId },
      data: { currentStep: { increment: 1 } },
    });

    // Recurse to execute the next step
    return this.advanceExecution(organizationId, executionId);
  },

  // ── Get a single execution ──
  async getExecution(
    organizationId: string,
    executionId: string,
  ): Promise<WorkflowExecutionDTO | null> {
    const execution = await db.aiWorkflowExecution.findFirst({
      where: { id: executionId, organizationId },
      include: {
        workflow: true,
        tasks: { include: { agent: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!execution) return null;

    return {
      id: execution.id,
      organizationId: execution.organizationId,
      workflowId: execution.workflowId,
      workflowKey: execution.workflow?.workflowKey,
      workflowName: execution.workflow?.name,
      status: execution.status,
      input: JSON.parse(execution.input || "{}"),
      output: JSON.parse(execution.output || "{}"),
      currentStep: execution.currentStep,
      totalSteps: execution.totalSteps,
      approvalRequestId: execution.approvalRequestId,
      errorMessage: execution.errorMessage,
      startedAt: execution.startedAt?.toISOString() ?? "",
      completedAt: execution.completedAt?.toISOString() ?? null,
      durationMs: execution.durationMs,
      tasks: execution.tasks.map((t) => ({
        id: t.id,
        organizationId: t.organizationId,
        agentId: t.agentId,
        agentKey: t.agent?.agentKey,
        agentName: t.agent?.name,
        source: t.source,
        workflowExecutionId: t.workflowExecutionId,
        title: t.title,
        description: t.description,
        input: JSON.parse(t.input || "{}"),
        output: JSON.parse(t.output || "{}"),
        status: t.status,
        priority: t.priority,
        impactScore: t.impactScore,
        reasoning: t.reasoning,
        approvalRequestId: t.approvalRequestId,
        deadlineAt: t.deadlineAt?.toISOString() ?? null,
        startedAt: t.startedAt?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        durationMs: t.durationMs,
        errorMessage: t.errorMessage,
        createdAt: t.createdAt?.toISOString() ?? "",
        updatedAt: t.updatedAt?.toISOString() ?? "",
      })),
    };
  },

  // ── Get all executions for an org ──
  async getExecutions(
    organizationId: string,
    limit = 20,
  ): Promise<WorkflowExecutionDTO[]> {
    const executions = await db.aiWorkflowExecution.findMany({
      where: { organizationId },
      include: { workflow: true },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
    return executions.map((e) => ({
      id: e.id,
      organizationId: e.organizationId,
      workflowId: e.workflowId,
      workflowKey: e.workflow?.workflowKey,
      workflowName: e.workflow?.name,
      status: e.status,
      input: JSON.parse(e.input || "{}"),
      output: JSON.parse(e.output || "{}"),
      currentStep: e.currentStep,
      totalSteps: e.totalSteps,
      approvalRequestId: e.approvalRequestId,
      errorMessage: e.errorMessage,
      startedAt: e.startedAt?.toISOString() ?? "",
      completedAt: e.completedAt?.toISOString() ?? null,
      durationMs: e.durationMs,
    }));
  },
};
