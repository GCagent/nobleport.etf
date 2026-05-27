export type TruthLabel = 'LIVE' | 'MODELED' | 'BLOCKED';

export interface ModuleKPI {
  module_id: number;
  module_name: string;
  owner_agent: string;
  layer: string;
  kpi_name: string;
  kpi_unit: string;
  kpi_value: number | null;
  truth_label: TruthLabel;
  source_table: string | null;
  source_ref: string | null;
  blocked_reason: string | null;
  next_action: string | null;
  measured_at: string | null;
}

export interface KPISummary {
  total: number;
  LIVE: number;
  MODELED: number;
  BLOCKED: number;
}

export interface AgentDef {
  agent_name: string;
  endpoint: string;
  owner_domain: string;
  status: string;
  description: string;
  hard_boundary: string;
  tool_count: number;
}

export interface ToolDef {
  agent_name: string;
  tool_name: string;
  module_name: string;
  approval_level: string;
  write_capable: boolean;
  description: string;
}

export interface MCPCallLogEntry {
  run_id: string;
  requesting_agent: string;
  target_agent: string;
  module: string;
  action: string;
  approval_level: string;
  truth_label: string;
  status: string;
  latency_ms: number;
  error: string | null;
  ts: string;
}

export interface AuditEvent {
  event_id: string;
  run_id: string;
  phase: string;
  agent: string;
  action: string;
  module: string;
  hash: string;
  prev_hash: string;
  timestamp: string;
}
