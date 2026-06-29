/**
 * Stephanie Orchestras — shared contracts.
 *
 * Type-safe mirror of the backend conductor
 * (`backend/agents/orchestras.py`). A "score" is a named multi-step workflow
 * that Stephanie conducts across the agent mesh; each "movement" is one step
 * played by one agent "section". Frozen (human-gated) movements are staged for
 * approval, never executed — see the authority model in the Python module.
 */

export type MovementStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'requires_approval'
  | 'skipped';

export type PerformanceHealth = 'healthy' | 'degraded' | 'unhealthy';

/** Production Command Freeze reasons (mirror of `FreezeReason`). */
export type GateReason =
  | 'legal_liability'
  | 'financial_risk'
  | 'regulatory'
  | 'human_authority';

export interface MovementDef {
  id: string;
  title: string;
  section: string;
  eventType: string;
  description: string;
  critical: boolean;
  /** True when the movement's event is on the Production Command Freeze. */
  gated: boolean;
  gateReason: GateReason | null;
  humanAlternative: string | null;
}

export interface ScoreDef {
  id: string;
  name: string;
  summary: string;
  advisoryOnly: boolean;
  movementCount: number;
  sections: string[];
  gatedMovements: number;
  movements: MovementDef[];
}

export interface MovementResult {
  id: string;
  title: string;
  section: string;
  eventType: string;
  status: MovementStatus;
  requiresHumanApproval: boolean;
  routedTo: string | null;
  success: boolean | null;
  durationMs: number | null;
  detail: string;
}

export interface PerformanceSummary {
  total: number;
  completed: number;
  failed: number;
  requiresApproval: number;
  skipped: number;
  health: PerformanceHealth;
  durationMs: number;
}

export interface Performance {
  performanceId: string;
  scoreId: string;
  scoreName: string;
  advisoryOnly: boolean;
  startedAt: string;
  completedAt: string;
  movements: MovementResult[];
  summary: PerformanceSummary;
}
