/**
 * Module 42 — Stephanie.ai Orchestrator
 * CEO-operations AI with human-in-the-loop escalation boundaries
 */

export type EscalationLevel = 'INFO' | 'ADVISORY' | 'APPROVAL_REQUIRED' | 'HUMAN_ONLY';

export interface AITask {
  taskId: string;
  type: string;
  description: string;
  escalationLevel: EscalationLevel;
  assignedPlatform: string;
  status: 'QUEUED' | 'PROCESSING' | 'AWAITING_HUMAN' | 'COMPLETED' | 'FAILED';
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  correlationId: string;
  createdAt: number;
  completedAt: number | null;
  humanApprovalRequired: boolean;
  humanApprovedBy: string | null;
}

export interface EscalationBoundary {
  domain: string;
  actions: string[];
  maxAutonomyLevel: EscalationLevel;
  requiresHumanApproval: string[];
  maxDollarAmount: number;
  cooldownMinutes: number;
}

export interface OrchestratorConfig {
  boundaries: EscalationBoundary[];
  aiPlatforms: Array<{ name: string; capabilities: string[]; priority: number }>;
  defaultEscalation: EscalationLevel;
  maxConcurrentTasks: number;
}

export class StephanieAIOrchestrator {
  private tasks = new Map<string, AITask>();
  private config: OrchestratorConfig;
  private taskCounter = 0;
  private activeTaskCount = 0;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  async submitTask(
    type: string,
    description: string,
    input: Record<string, unknown>,
    domain?: string
  ): Promise<AITask> {
    if (this.activeTaskCount >= this.config.maxConcurrentTasks) {
      throw new Error('Max concurrent tasks reached — queue full');
    }

    const escalationLevel = this.determineEscalation(type, domain, input);
    const platform = this.selectPlatform(type);
    const correlationId = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const taskId = `task-${++this.taskCounter}`;

    const task: AITask = {
      taskId,
      type,
      description,
      escalationLevel,
      assignedPlatform: platform,
      status: escalationLevel === 'HUMAN_ONLY' || escalationLevel === 'APPROVAL_REQUIRED'
        ? 'AWAITING_HUMAN'
        : 'QUEUED',
      input,
      output: null,
      correlationId,
      createdAt: Date.now(),
      completedAt: null,
      humanApprovalRequired: escalationLevel === 'APPROVAL_REQUIRED' || escalationLevel === 'HUMAN_ONLY',
      humanApprovedBy: null,
    };

    this.tasks.set(taskId, task);
    this.activeTaskCount++;

    // Auto-process if no human approval needed
    if (!task.humanApprovalRequired) {
      await this.processTask(taskId);
    }

    return task;
  }

  async approveTask(taskId: string, approvedBy: string): Promise<AITask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (task.status !== 'AWAITING_HUMAN') throw new Error('Task not awaiting approval');

    task.humanApprovedBy = approvedBy;
    task.status = 'QUEUED';
    await this.processTask(taskId);

    return task;
  }

  async rejectTask(taskId: string, rejectedBy: string, reason: string): Promise<AITask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = 'FAILED';
    task.output = { rejected: true, rejectedBy, reason };
    task.completedAt = Date.now();
    this.activeTaskCount--;

    return task;
  }

  private async processTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'PROCESSING';

    // In production: route to appropriate AI platform via MCP
    task.output = {
      platform: task.assignedPlatform,
      result: `Processed by ${task.assignedPlatform}`,
      processingTimeMs: Math.random() * 5000 + 1000,
    };

    task.status = 'COMPLETED';
    task.completedAt = Date.now();
    this.activeTaskCount--;
  }

  private determineEscalation(type: string, domain: string | undefined, input: Record<string, unknown>): EscalationLevel {
    if (!domain) return this.config.defaultEscalation;

    const boundary = this.config.boundaries.find((b) => b.domain === domain);
    if (!boundary) return this.config.defaultEscalation;

    // Check if action requires human approval
    if (boundary.requiresHumanApproval.includes(type)) return 'HUMAN_ONLY';

    // Check dollar thresholds
    const amount = (input.amount as number) ?? 0;
    if (amount > boundary.maxDollarAmount) return 'APPROVAL_REQUIRED';

    return boundary.maxAutonomyLevel;
  }

  private selectPlatform(type: string): string {
    const sorted = [...this.config.aiPlatforms].sort((a, b) => a.priority - b.priority);
    const match = sorted.find((p) => p.capabilities.some((c) => type.toLowerCase().includes(c)));
    return match?.name ?? sorted[0]?.name ?? 'claude';
  }

  getTask(taskId: string): AITask | undefined { return this.tasks.get(taskId); }

  getActiveTasks(): AITask[] {
    return Array.from(this.tasks.values()).filter((t) => !['COMPLETED', 'FAILED'].includes(t.status));
  }

  getTasksByCorrelation(correlationId: string): AITask[] {
    return Array.from(this.tasks.values()).filter((t) => t.correlationId === correlationId);
  }
}
