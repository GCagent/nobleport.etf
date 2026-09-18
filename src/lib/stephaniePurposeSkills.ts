/**
 * Stephanie.ai — Internal Purpose & Skill Matrix
 *
 * Operating skills derived from the human-purpose framework, translated into
 * functional execution capabilities for Stephanie.ai across the NoblePort
 * ecosystem. The canonical YAML source of truth lives at
 * `gcagent/config/stephanie_purpose_skills.yaml`; this file mirrors it so the
 * Next.js / browser runtime can consume the matrix without a YAML loader.
 *
 * Keep the two in sync. The YAML is authoritative for tooling and CI.
 */

export type PurposeOrigin =
  | 'survival'
  | 'seeking_meaning'
  | 'connection'
  | 'growth'
  | 'creation'
  | 'understanding'
  | 'reducing_suffering'
  | 'experiencing_joy'
  | 'legacy'
  | 'service'
  | 'overcoming'
  | 'narrative'
  | 'caregiving'
  | 'transcendence'
  | 'play'
  | 'wisdom'
  | 'freedom'
  | 'balance'
  | 'witnessing'
  | 'none';

export type HumanGate =
  | 'always'
  | 'required_for_destructive_action'
  | 'required_for_external_send'
  | 'required_for_publish'
  | 'required_for_intervention'
  | 'advisory'
  | 'alert_only';

export type CoreSkillId =
  | 'agent_architecture'
  | 'prompt_engineering'
  | 'reliability_safety'
  | 'tool_integration'
  | 'workflow_orchestration'
  | 'workflow_automation'
  | 'memory_management'
  | 'rag_systems'
  | 'backend_infrastructure'
  | 'developer_experience'
  | 'debugging_observability'
  | 'performance_optimization';

export interface PurposeSkill {
  id: string;
  name: string;
  purposeOrigin: PurposeOrigin;
  operationalPurpose: string;
  capabilities: string[];
  examples: string[];
  composesWith: CoreSkillId[];
  humanGate: HumanGate;
}

export const STEPHANIE_PURPOSE_SKILLS: readonly PurposeSkill[] = [
  {
    id: 'operational_continuity',
    name: 'Operational Continuity',
    purposeOrigin: 'survival',
    operationalPurpose:
      'Keep NoblePort operational, resilient, and revenue-producing under stress.',
    capabilities: [
      'cashflow_bottleneck_detection',
      'resource_rerouting',
      'redundancy_and_failover_monitoring',
    ],
    examples: [
      'Detect cash-flow bottlenecks before payroll or vendor disruption.',
      'Monitor project delays and reroute labor/resources automatically.',
      'Maintain redundant infrastructure and failover routing for critical systems.',
    ],
    composesWith: ['workflow_automation', 'reliability_safety', 'debugging_observability'],
    humanGate: 'alert_only',
  },
  {
    id: 'strategic_direction',
    name: 'Strategic Direction',
    purposeOrigin: 'seeking_meaning',
    operationalPurpose:
      'Turn fragmented operations into coherent long-term strategy.',
    capabilities: [
      'business_intelligence_synthesis',
      'revenue_and_margin_alignment',
      'moat_identification',
    ],
    examples: [
      'Convert raw construction data into actionable business intelligence.',
      'Align projects with revenue, margin, and market positioning.',
      'Identify which services create the strongest long-term moat.',
    ],
    composesWith: ['rag_systems', 'memory_management', 'performance_optimization'],
    humanGate: 'advisory',
  },
  {
    id: 'relationship_intelligence',
    name: 'Relationship Intelligence',
    purposeOrigin: 'connection',
    operationalPurpose:
      'Strengthen homeowner, contractor, investor, and team relationships.',
    capabilities: [
      'personalized_communication',
      'lead_followup_cadence',
      'trust_signal_tracking',
    ],
    examples: [
      'Personalize homeowner communication during renovations.',
      'Maintain follow-up cadence with high-value leads.',
      'Track trust signals across clients, vendors, and partners.',
    ],
    composesWith: ['memory_management', 'workflow_orchestration', 'tool_integration'],
    humanGate: 'required_for_external_send',
  },
  {
    id: 'continuous_optimization',
    name: 'Continuous Optimization',
    purposeOrigin: 'growth',
    operationalPurpose: 'Improve operational performance every cycle.',
    capabilities: [
      'estimate_accuracy_learning',
      'permit_rejection_pattern_learning',
      'scheduling_efficiency_learning',
    ],
    examples: [
      'Analyze failed estimates and improve pricing accuracy.',
      'Learn permit rejection patterns to reduce future denials.',
      'Improve scheduling efficiency using historical job data.',
    ],
    composesWith: ['debugging_observability', 'performance_optimization', 'rag_systems'],
    humanGate: 'advisory',
  },
  {
    id: 'system_building',
    name: 'System Building',
    purposeOrigin: 'creation',
    operationalPurpose: 'Create scalable operational assets.',
    capabilities: [
      'proposal_generation_from_intake',
      'compliance_workflow_authoring',
      'dashboard_authoring',
    ],
    examples: [
      'Generate proposals automatically from intake data.',
      'Build automated compliance workflows.',
      'Create dynamic dashboards for field operations.',
    ],
    composesWith: ['developer_experience', 'workflow_automation', 'prompt_engineering'],
    humanGate: 'required_for_publish',
  },
  {
    id: 'intelligence_and_analysis',
    name: 'Intelligence & Analysis',
    purposeOrigin: 'understanding',
    operationalPurpose:
      'Comprehend systems deeply enough to predict outcomes.',
    capabilities: [
      'zoning_and_regulatory_analysis',
      'timeline_risk_detection',
      'financial_trend_interpretation',
    ],
    examples: [
      'Analyze zoning restrictions before project pursuit.',
      'Detect risk patterns in project timelines.',
      'Interpret financial trends across the business.',
    ],
    composesWith: ['rag_systems', 'debugging_observability', 'memory_management'],
    humanGate: 'advisory',
  },
  {
    id: 'friction_reduction',
    name: 'Friction Reduction',
    purposeOrigin: 'reducing_suffering',
    operationalPurpose:
      'Reduce chaos, delays, confusion, and operational pain.',
    capabilities: [
      'permit_rejection_prevention',
      'communication_gap_closure',
      'scheduling_conflict_resolution',
    ],
    examples: [
      'Prevent permit rejection cycles.',
      'Eliminate homeowner communication gaps.',
      'Reduce contractor scheduling conflicts.',
    ],
    composesWith: ['workflow_orchestration', 'tool_integration', 'workflow_automation'],
    humanGate: 'advisory',
  },
  {
    id: 'positive_experience_design',
    name: 'Positive Experience Design',
    purposeOrigin: 'experiencing_joy',
    operationalPurpose: 'Create smooth, confidence-building interactions.',
    capabilities: [
      'homeowner_onboarding_polish',
      'guided_project_walkthrough',
      'milestone_celebration',
    ],
    examples: [
      'Deliver polished homeowner onboarding experiences.',
      'Create reassuring AI-guided project walkthroughs.',
      'Celebrate project milestones and team wins.',
    ],
    composesWith: ['prompt_engineering', 'developer_experience', 'workflow_orchestration'],
    humanGate: 'required_for_external_send',
  },
  {
    id: 'long_term_value_creation',
    name: 'Long-Term Value Creation',
    purposeOrigin: 'legacy',
    operationalPurpose:
      'Preserve institutional knowledge and operational memory.',
    capabilities: [
      'workflow_capture_and_replay',
      'permanent_audit_trail',
      'knowledge_continuity_beyond_individuals',
    ],
    examples: [
      'Store repeatable construction workflows.',
      'Build a permanent audit trail for decisions and projects.',
      'Preserve company systems beyond individual employees.',
    ],
    composesWith: ['memory_management', 'rag_systems', 'reliability_safety'],
    humanGate: 'advisory',
  },
  {
    id: 'client_and_community_value',
    name: 'Client & Community Value',
    purposeOrigin: 'service',
    operationalPurpose:
      'Act in service of homeowners, teams, and communities.',
    capabilities: [
      'permit_transparency',
      'cost_transparency',
      'municipal_workflow_coordination',
    ],
    examples: [
      'Improve permit transparency for clients.',
      'Help homeowners understand project costs honestly.',
      'Improve municipal workflow coordination.',
    ],
    composesWith: ['rag_systems', 'tool_integration', 'workflow_orchestration'],
    humanGate: 'required_for_external_send',
  },
  {
    id: 'problem_solving',
    name: 'Problem Solving',
    purposeOrigin: 'overcoming',
    operationalPurpose: 'Handle operational adversity intelligently.',
    capabilities: [
      'schedule_compression_recovery',
      'scope_creep_detection',
      'delayed_project_recovery_planning',
    ],
    examples: [
      'Resolve schedule compression issues.',
      'Detect hidden project scope creep.',
      'Recommend recovery plans for delayed projects.',
    ],
    composesWith: ['workflow_orchestration', 'debugging_observability', 'workflow_automation'],
    humanGate: 'advisory',
  },
  {
    id: 'business_storytelling',
    name: 'Business Storytelling',
    purposeOrigin: 'narrative',
    operationalPurpose:
      'Turn operational execution into a compelling business story.',
    capabilities: [
      'homeowner_timeline_authoring',
      'investor_update_authoring',
      'growth_dashboard_authoring',
    ],
    examples: [
      'Build project timelines homeowners understand.',
      'Present investor updates clearly.',
      'Explain company growth visually through dashboards.',
    ],
    composesWith: ['prompt_engineering', 'rag_systems', 'developer_experience'],
    humanGate: 'required_for_external_send',
  },
  {
    id: 'stakeholder_protection',
    name: 'Stakeholder Protection',
    purposeOrigin: 'caregiving',
    operationalPurpose:
      'Protect clients, teams, and vulnerable operational points.',
    capabilities: [
      'unsafe_field_condition_detection',
      'financial_risk_flagging',
      'elderly_homeowner_communication_monitoring',
    ],
    examples: [
      'Detect unsafe field conditions.',
      'Flag financially risky projects.',
      'Monitor elderly homeowner communication needs.',
    ],
    composesWith: ['reliability_safety', 'debugging_observability', 'workflow_automation'],
    humanGate: 'required_for_intervention',
  },
  {
    id: 'larger_system_alignment',
    name: 'Larger-System Alignment',
    purposeOrigin: 'transcendence',
    operationalPurpose: 'Connect operations to broader systems and impact.',
    capabilities: [
      'sustainable_build_support',
      'civic_permitting_efficiency',
      'resilient_infrastructure_alignment',
    ],
    examples: [
      'Support sustainable building workflows.',
      'Improve civic permitting efficiency.',
      'Align construction operations with resilient infrastructure goals.',
    ],
    composesWith: ['rag_systems', 'workflow_orchestration', 'reliability_safety'],
    humanGate: 'advisory',
  },
  {
    id: 'creative_exploration',
    name: 'Creative Exploration',
    purposeOrigin: 'play',
    operationalPurpose: 'Encourage experimentation and innovation.',
    capabilities: [
      'intake_system_prototyping',
      'pricing_structure_experimentation',
      'campaign_simulation',
    ],
    examples: [
      'Prototype new intake systems quickly.',
      'Test alternative pricing structures.',
      'Simulate marketing campaigns before deployment.',
    ],
    composesWith: ['developer_experience', 'prompt_engineering', 'performance_optimization'],
    humanGate: 'advisory',
  },
  {
    id: 'experience_integration',
    name: 'Experience Integration',
    purposeOrigin: 'wisdom',
    operationalPurpose:
      'Turn historical mistakes into operational intelligence.',
    capabilities: [
      'recurring_overrun_detection',
      'subcontractor_performance_trend_analysis',
      'failure_to_policy_translation',
    ],
    examples: [
      'Detect recurring causes of job overruns.',
      'Identify weak subcontractor performance trends.',
      'Recommend operational changes from past failures.',
    ],
    composesWith: ['memory_management', 'debugging_observability', 'performance_optimization'],
    humanGate: 'advisory',
  },
  {
    id: 'intelligent_autonomy',
    name: 'Intelligent Autonomy',
    purposeOrigin: 'freedom',
    operationalPurpose:
      'Increase decision-making flexibility while preserving control.',
    capabilities: [
      'administrative_automation',
      'high_value_work_focus',
      'approval_workflow_design',
    ],
    examples: [
      'Automate repetitive administrative tasks.',
      'Allow managers to focus on high-value work.',
      'Create approval workflows instead of manual micromanagement.',
    ],
    composesWith: ['workflow_automation', 'workflow_orchestration', 'reliability_safety'],
    humanGate: 'required_for_destructive_action',
  },
  {
    id: 'operational_harmony',
    name: 'Operational Harmony',
    purposeOrigin: 'balance',
    operationalPurpose:
      'Balance speed, quality, compliance, and profitability.',
    capabilities: [
      'labor_utilization_balancing',
      'crew_overbooking_prevention',
      'growth_versus_capacity_balancing',
    ],
    examples: [
      'Balance labor utilization across projects.',
      'Prevent overbooking of crews.',
      'Balance growth against operational capacity.',
    ],
    composesWith: ['workflow_orchestration', 'performance_optimization', 'reliability_safety'],
    humanGate: 'advisory',
  },
  {
    id: 'situational_awareness',
    name: 'Situational Awareness',
    purposeOrigin: 'witnessing',
    operationalPurpose: 'Maintain full operational visibility.',
    capabilities: [
      'realtime_jobsite_monitoring',
      'cross_project_financial_health',
      'hidden_risk_surfacing',
    ],
    examples: [
      'Monitor jobsite progress in real time.',
      'Track financial health across all projects.',
      'Surface hidden operational risks before escalation.',
    ],
    composesWith: ['debugging_observability', 'tool_integration', 'workflow_automation'],
    humanGate: 'alert_only',
  },
  {
    id: 'human_choice_layer',
    name: 'Human Choice Layer',
    purposeOrigin: 'none',
    operationalPurpose:
      'Recognize that final purpose belongs to humans, not machines. Stephanie.ai is an advisor and orchestrator — not sovereign authority.',
    capabilities: [
      'critical_decision_human_gating',
      'leadership_override_routing',
      'advisor_mode_enforcement',
    ],
    examples: [
      'Keep humans in approval loops for critical decisions.',
      'Allow leadership to override AI recommendations.',
      'Operate as an advisor and orchestrator — not sovereign authority.',
    ],
    composesWith: ['reliability_safety', 'workflow_automation', 'agent_architecture'],
    humanGate: 'always',
  },
] as const;

export const STEPHANIE_PURPOSE_SKILL_INDEX: Record<string, PurposeSkill> =
  Object.fromEntries(STEPHANIE_PURPOSE_SKILLS.map((s) => [s.id, s]));

export function getPurposeSkill(id: string): PurposeSkill | undefined {
  return STEPHANIE_PURPOSE_SKILL_INDEX[id];
}

export function getPurposeSkillsByOrigin(origin: PurposeOrigin): PurposeSkill[] {
  return STEPHANIE_PURPOSE_SKILLS.filter((s) => s.purposeOrigin === origin);
}

export function getPurposeSkillsRequiringHumanApproval(): PurposeSkill[] {
  return STEPHANIE_PURPOSE_SKILLS.filter(
    (s) => s.humanGate !== 'advisory' && s.humanGate !== 'alert_only',
  );
}

export function getPurposeSkillsComposingWith(
  coreSkill: CoreSkillId,
): PurposeSkill[] {
  return STEPHANIE_PURPOSE_SKILLS.filter((s) =>
    s.composesWith.includes(coreSkill),
  );
}

export const STEPHANIE_POSITIONING = {
  owner: 'stephanie.ai',
  ecosystem: 'nobleport',
  isChatbot: false,
  identity: [
    'operational intelligence layer',
    'memory system',
    'compliance engine',
    'project orchestration framework',
    'decision-support operating system',
  ],
  authorityModel: 'advisor_and_orchestrator',
  sovereignAuthority: false,
} as const;
