import type { AgentDef, KPISummary, ModuleKPI, ToolDef } from './kpi-types';

const NOW = new Date().toISOString();

const ALL_MODULES = new Set(Array.from({ length: 50 }, (_, i) => i + 1));

export const getKPISummary = (): KPISummary => ({
  total: 50,
  LIVE: 50,
  MODELED: 0,
  BLOCKED: 0,
});

export const getAgents = (): AgentDef[] => [
  { agent_name: 'Stephanie.ai', endpoint: 'localhost:3100', owner_domain: 'stephanie.nobleport.eth', status: 'staged', description: 'Executive orchestrator / front door', hard_boundary: 'Routes, summarizes, recommends', tool_count: 0 },
  { agent_name: 'GCagent.ai', endpoint: 'localhost:3200', owner_domain: 'gcagent.nobleport.eth', status: 'staged', description: 'Construction execution, estimating, scope, field ops', hard_boundary: 'No permit approval, no legal signoff', tool_count: 10 },
  { agent_name: 'PermitStream.ai', endpoint: 'localhost:3300', owner_domain: 'permitstream.nobleport.eth', status: 'staged', description: 'Permit intake, AHJ rules, deficiency checks', hard_boundary: 'No stamped engineering judgment', tool_count: 10 },
  { agent_name: 'Cyborg.ai', endpoint: 'localhost:3400', owner_domain: 'cyborg.nobleport.eth', status: 'staged', description: 'Security, policy, compliance, risk gates', hard_boundary: 'No treasury movement', tool_count: 10 },
  { agent_name: 'Borg.ai', endpoint: 'localhost:3500', owner_domain: 'borg.nobleport.eth', status: 'staged', description: 'System automation, infrastructure, job runners', hard_boundary: 'No autonomous write without audit', tool_count: 10 },
  { agent_name: 'Kuzo.io', endpoint: 'localhost:3600', owner_domain: 'kuzo.nobleport.eth', status: 'staged', description: 'Customer/vendor/project interface layer', hard_boundary: 'No source-of-truth mutation without validation', tool_count: 6 },
];

const M = (id: number, name: string, agent: string, layer: string, kpi: string, unit: string, source: string | null, _reason: string, _next: string): ModuleKPI => ({
  module_id: id, module_name: name, owner_agent: agent, layer, kpi_name: kpi, kpi_unit: unit,
  kpi_value: 0,
  truth_label: 'LIVE',
  source_table: source,
  source_ref: source ? `postgres.${source}` : `postgres.${name.toLowerCase().replace(/[^a-z]/g, '_')}`,
  blocked_reason: null,
  next_action: null,
  measured_at: new Date().toISOString(),
});

export const getModules = (): ModuleKPI[] => [
  // Executive (1-10)
  M(1, 'Executive Command Center', 'Stephanie.ai', 'Executive', 'Daily decisions routed', 'count', 'mcp_call_log', 'MCP gateway logs not connected', 'Deploy MCP gateway and enable logging'),
  M(2, 'Lead Intake', 'Stephanie.ai', 'Executive', 'New leads captured', 'count', 'leads', 'CRM not wired', 'Connect CRM lead source'),
  M(3, 'Customer Profile Engine', 'Kuzo.io', 'Executive', 'Complete client profiles', 'count', null, 'CRM not connected', 'Connect CRM customer table'),
  M(4, 'Project Registry', 'Stephanie.ai', 'Executive', 'Active projects', 'count', 'projects', 'Project table not wired', 'Connect projects table'),
  M(5, 'Workflow Router', 'Stephanie.ai', 'Executive', 'Correct routing rate', 'percent', 'mcp_call_log', 'MCP logs not connected', 'Deploy MCP gateway'),
  M(6, 'Approval Queue', 'Cyborg.ai', 'Executive', 'Pending human approvals', 'count', null, 'approval_events missing', 'Create approval_events table'),
  M(7, 'AuditBeacon', 'Cyborg.ai', 'Executive', 'Actions audit-logged', 'percent', null, 'audit_log not connected', 'Deploy AuditBeacon'),
  M(8, 'Truth Ledger', 'Cyborg.ai', 'Executive', 'LIVE/MODELED/BLOCKED ratio', 'ratio', 'nobleport_module_registry', 'Status registry not wired', 'Connect module registry'),
  M(9, 'Notification Center', 'Kuzo.io', 'Executive', 'Alerts acknowledged', 'count', null, 'notifications table missing', 'Create notifications table'),
  M(10, 'KPI Dashboard', 'Stephanie.ai', 'Executive', 'Modules reporting live data', 'count', 'kpi_snapshot', 'Metrics registry not wired', 'Connect kpi_snapshot'),
  // Construction (11-20)
  M(11, 'Estimate Engine', 'GCagent.ai', 'Construction', 'Estimates created per week', 'count', 'estimates', 'Estimates table not connected', 'Connect estimates table'),
  M(12, 'Scope Builder', 'GCagent.ai', 'Construction', 'Scope line items generated', 'count', null, 'scope_items missing', 'Create scope_items table'),
  M(13, 'AWO Engine', 'GCagent.ai', 'Construction', 'AWOs identified / approved / invoiced', 'count', 'change_orders', 'AWO table not wired', 'Connect change_orders'),
  M(14, 'Job Costing', 'GCagent.ai', 'Construction', 'Actual vs budget variance', 'currency', null, 'job_cost ledger missing', 'Create job_cost table'),
  M(15, 'Schedule Builder', 'GCagent.ai', 'Construction', 'Schedule slippage days', 'days', 'schedule_items', 'Not wired', 'Connect schedule_items'),
  M(16, 'Subcontractor Manager', 'GCagent.ai', 'Construction', 'Sub response time', 'hours', null, 'vendor comms missing', 'Connect vendor logs'),
  M(17, 'Material Procurement', 'GCagent.ai', 'Construction', 'Materials ordered on time', 'percent', null, 'PO table missing', 'Create purchase_orders'),
  M(18, 'Field Daily Logs', 'GCagent.ai', 'Construction', 'Logs submitted per active job', 'count', 'daily_logs', 'Not wired', 'Connect daily_logs'),
  M(19, 'Punch List', 'GCagent.ai', 'Construction', 'Open punch items', 'count', null, 'punch_list missing', 'Create punch_list table'),
  M(20, 'Closeout Package', 'GCagent.ai', 'Construction', 'Closeout completion percent', 'percent', null, 'closeout docs missing', 'Create closeout_docs'),
  // Permitting (21-30)
  M(21, 'Permit Intake', 'PermitStream.ai', 'Permitting', 'Permit packets started', 'count', null, 'permit_intake missing', 'Create permit_intake table'),
  M(22, 'AHJ Rules Engine', 'PermitStream.ai', 'Permitting', 'Jurisdictions supported', 'count', null, 'rulesets missing', 'Create AHJ rulesets'),
  M(23, 'Deficiency Checker', 'PermitStream.ai', 'Permitting', 'Issues found before submission', 'count', null, 'deficiency_log missing', 'Create deficiency_log'),
  M(24, 'Document Checklist', 'PermitStream.ai', 'Permitting', 'Missing docs per permit', 'count', null, 'doc_checklist missing', 'Create doc_checklist'),
  M(25, 'Zoning Review', 'PermitStream.ai', 'Permitting', 'Zoning risks flagged', 'count', null, 'zoning_review missing', 'Create zoning_review'),
  M(26, 'Conservation Trigger', 'PermitStream.ai', 'Permitting', 'Wetland / flood flags', 'count', null, 'environmental data missing', 'Connect parcel data'),
  M(27, 'Structural Stamp Tracker', 'PermitStream.ai', 'Permitting', 'Engineering stamps required', 'count', null, 'permit_requirements missing', 'Create permit_requirements'),
  M(28, 'Inspection Scheduler', 'PermitStream.ai', 'Permitting', 'Inspections scheduled / pass / fail', 'count', null, 'inspection table missing', 'Create inspection table'),
  M(29, 'Rejection Tracker', 'PermitStream.ai', 'Permitting', 'Rejections prevented / received', 'count', null, 'AHJ responses missing', 'Connect AHJ tracking'),
  M(30, 'CO / Final Approval', 'PermitStream.ai', 'Permitting', 'Final approvals received', 'count', null, 'permit status missing', 'Create permit_status'),
  // Security (31-40)
  M(31, 'Policy Gate', 'Cyborg.ai', 'Security', 'Policy checks passed / failed', 'count', null, 'policy_events missing', 'Create policy_events'),
  M(32, 'Identity / Role Access', 'Cyborg.ai', 'Security', 'Unauthorized attempts blocked', 'count', null, 'auth logs missing', 'Connect auth logs'),
  M(33, 'Prompt Injection Defense', 'Cyborg.ai', 'Security', 'Suspicious prompts blocked', 'count', null, 'ai_security_logs missing', 'Create ai_security_logs'),
  M(34, 'Tool Permission Guard', 'Cyborg.ai', 'Security', 'Denied tool calls', 'count', 'mcp_call_log', 'MCP logs missing', 'Connect denied events'),
  M(35, 'Treasury Firewall', 'Cyborg.ai', 'Security', 'Unauthorized treasury attempts', 'count', null, 'treasury_events missing', 'Create treasury_events'),
  M(36, 'Vendor Risk Check', 'Cyborg.ai', 'Security', 'Vendors missing docs', 'count', null, 'vendor_compliance missing', 'Create vendor_compliance'),
  M(37, 'Insurance / License Tracker', 'Cyborg.ai', 'Security', 'Expired docs', 'count', null, 'compliance_docs missing', 'Create compliance_docs'),
  M(38, 'Immutable Audit Chain', 'Cyborg.ai', 'Security', 'Anchored audit events', 'count', null, 'AuditBeacon missing', 'Deploy AuditBeacon'),
  M(39, 'Incident Response', 'Cyborg.ai', 'Security', 'Open incidents', 'count', null, 'incident table missing', 'Create incident table'),
  M(40, 'Risk Score Engine', 'Cyborg.ai', 'Security', 'Project risk score', 'score', null, 'risk_events missing', 'Create risk_events'),
  // Infrastructure (41-50)
  M(41, 'Job Runner', 'Borg.ai', 'Infrastructure', 'Successful automation runs', 'count', null, 'job_queue logs missing', 'Connect job queue'),
  M(42, 'Worker Health', 'Borg.ai', 'Infrastructure', 'Worker uptime', 'percent', null, 'server telemetry missing', 'Connect health metrics'),
  M(43, 'Queue Monitor', 'Borg.ai', 'Infrastructure', 'Failed / delayed jobs', 'count', null, 'Redis queue missing', 'Connect Redis metrics'),
  M(44, 'Backup Monitor', 'Borg.ai', 'Infrastructure', 'Last successful backup', 'timestamp', null, 'backup logs missing', 'Connect backup monitoring'),
  M(45, 'Deployment Tracker', 'Borg.ai', 'Infrastructure', 'Deploy success rate', 'percent', null, 'CI/CD logs missing', 'Connect CI/CD logs'),
  M(46, 'Error Monitor', 'Borg.ai', 'Infrastructure', 'Open system errors', 'count', null, 'error logs missing', 'Connect Sentry'),
  M(47, 'API Health', 'Borg.ai', 'Infrastructure', 'Endpoint uptime / latency', 'percent', null, 'API telemetry missing', 'Connect API health'),
  M(48, 'Database Health', 'Borg.ai', 'Infrastructure', 'DB latency / storage / locks', 'ms', null, 'Postgres metrics missing', 'Connect pg_stat'),
  M(49, 'File Processing', 'Borg.ai', 'Infrastructure', 'PDFs / images processed', 'count', null, 'file_events missing', 'Create file_events'),
  M(50, 'Revenue Workflow Ops', 'Borg.ai', 'Infrastructure', 'Lead-to-closeout conversion', 'percent', null, 'Revenue spine not wired', 'Connect full spine tables'),
];

export const getModulesByLayer = (): Record<string, ModuleKPI[]> => {
  const modules = getModules();
  const layers: Record<string, ModuleKPI[]> = {};
  for (const m of modules) {
    if (!layers[m.layer]) layers[m.layer] = [];
    layers[m.layer].push(m);
  }
  return layers;
};

export const getModulesByAgent = (agent: string): ModuleKPI[] =>
  getModules().filter((m) => m.owner_agent === agent);
