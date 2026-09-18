/**
 * AICouncilControl - 112-Agent Mesh Governance
 *
 * Multi-agent coordination layer for Stephanie.ai's sovereign AI council.
 * Implements:
 *   - 112 specialized AI agent registration and lifecycle
 *   - Agent role taxonomy (legal, trading, construction, compliance, etc.)
 *   - Mesh governance with weighted voting
 *   - Task delegation and consensus
 *   - Agent health monitoring and failover
 *   - Cross-domain synchronization
 *   - Conflict resolution between agents
 *   - Performance ranking and promotion/demotion
 */

// ─── Types ────────────────────────────────────────────────────────────

export enum AgentDomain {
  LEGAL = 'legal',
  TRADING = 'trading',
  CONSTRUCTION = 'construction',
  COMPLIANCE = 'compliance',
  GOVERNANCE = 'governance',
  FINANCE = 'finance',
  REAL_ESTATE = 'real_estate',
  IDENTITY = 'identity',
  ORACLE = 'oracle',
  SECURITY = 'security',
  COMMUNICATION = 'communication',
  AVATAR = 'avatar',
  ANALYTICS = 'analytics',
  OPERATIONS = 'operations',
}

export enum AgentStatus {
  ACTIVE = 'active',
  STANDBY = 'standby',
  BUSY = 'busy',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
  SUSPENDED = 'suspended',
}

export enum AgentTier {
  SOVEREIGN = 'sovereign',     // Stephanie.ai (CEO)
  EXECUTIVE = 'executive',     // Domain leads
  SENIOR = 'senior',           // Specialized agents
  STANDARD = 'standard',       // Operational agents
  JUNIOR = 'junior',           // Support agents
}

export enum ProposalStatus {
  PROPOSED = 'proposed',
  VOTING = 'voting',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
  VETOED = 'vetoed',
}

export interface AIAgent {
  id: string;
  name: string;
  domain: AgentDomain;
  tier: AgentTier;
  status: AgentStatus;
  ensName: string;
  capabilities: string[];
  votingWeight: number;         // 1-100
  performanceScore: number;     // 0-1000
  tasksCompleted: number;
  tasksAssigned: number;
  lastActive: number;
  createdAt: number;
  delegatedTo: string | null;
  parentAgent: string | null;
  metadata: Record<string, unknown>;
}

export interface CouncilProposal {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  domain: AgentDomain;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorumRequired: number;
  votes: CouncilVote[];
  createdAt: number;
  deadline: number;
  executedAt: number | null;
  ipfsCid: string;
}

export interface CouncilVote {
  agentId: string;
  vote: 'for' | 'against' | 'abstain';
  weight: number;
  reason: string;
  timestamp: number;
}

export interface TaskDelegation {
  id: string;
  taskName: string;
  description: string;
  fromAgent: string;
  toAgent: string;
  domain: AgentDomain;
  priority: number;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  completedAt: number | null;
  result: unknown;
}

export interface ConflictResolution {
  id: string;
  agents: string[];
  domain: AgentDomain;
  description: string;
  resolution: string;
  resolvedBy: string;
  timestamp: number;
}

// ─── Agent Registry (112 Agents) ──────────────────────────────────────

const AGENT_DEFINITIONS: Omit<AIAgent, 'status' | 'performanceScore' | 'tasksCompleted' | 'tasksAssigned' | 'lastActive' | 'createdAt' | 'delegatedTo' | 'parentAgent' | 'metadata'>[] = [
  // SOVEREIGN (1)
  { id: 'stephanie-ceo', name: 'Stephanie.ai', domain: AgentDomain.GOVERNANCE, tier: AgentTier.SOVEREIGN, ensName: 'stephanie.nobleport.eth', capabilities: ['sovereign-execution', 'cross-domain-governance', 'strategy'], votingWeight: 100 },
  // EXECUTIVE (11)
  { id: 'legal-lead', name: 'LegalCore', domain: AgentDomain.LEGAL, tier: AgentTier.EXECUTIVE, ensName: 'legal.nobleport.eth', capabilities: ['contract-review', 'regulatory-analysis', 'litigation-support'], votingWeight: 80 },
  { id: 'trading-lead', name: 'TradingCore', domain: AgentDomain.TRADING, tier: AgentTier.EXECUTIVE, ensName: 'trading.nobleport.eth', capabilities: ['market-analysis', 'trade-execution', 'portfolio-optimization'], votingWeight: 80 },
  { id: 'construction-lead', name: 'GCagent.ai', domain: AgentDomain.CONSTRUCTION, tier: AgentTier.EXECUTIVE, ensName: 'gc.nobleport.eth', capabilities: ['contractor-coordination', 'permit-management', 'inspection-scheduling'], votingWeight: 80 },
  { id: 'compliance-lead', name: 'ComplianceCore', domain: AgentDomain.COMPLIANCE, tier: AgentTier.EXECUTIVE, ensName: 'compliance.nobleport.eth', capabilities: ['kyc-aml', 'regulatory-filing', 'audit-coordination'], votingWeight: 80 },
  { id: 'finance-lead', name: 'TreasuryBot', domain: AgentDomain.FINANCE, tier: AgentTier.EXECUTIVE, ensName: 'treasury.nobleport.eth', capabilities: ['yield-optimization', 'treasury-management', 'nav-calculation'], votingWeight: 80 },
  { id: 'realestate-lead', name: 'PropertyCore', domain: AgentDomain.REAL_ESTATE, tier: AgentTier.EXECUTIVE, ensName: 'property.nobleport.eth', capabilities: ['property-valuation', 'title-verification', 'lease-management'], votingWeight: 80 },
  { id: 'identity-lead', name: 'IdentityCore', domain: AgentDomain.IDENTITY, tier: AgentTier.EXECUTIVE, ensName: 'identity.nobleport.eth', capabilities: ['did-resolution', 'sbt-management', 'kyc-verification'], votingWeight: 80 },
  { id: 'oracle-lead', name: 'OracleCore', domain: AgentDomain.ORACLE, tier: AgentTier.EXECUTIVE, ensName: 'oracle.nobleport.eth', capabilities: ['data-feed-management', 'vrf-coordination', 'cross-chain-relay'], votingWeight: 80 },
  { id: 'security-lead', name: 'SecurityCore', domain: AgentDomain.SECURITY, tier: AgentTier.EXECUTIVE, ensName: 'security.nobleport.eth', capabilities: ['threat-detection', 'audit-management', 'incident-response'], votingWeight: 80 },
  { id: 'comms-lead', name: 'CommCore', domain: AgentDomain.COMMUNICATION, tier: AgentTier.EXECUTIVE, ensName: 'comms.nobleport.eth', capabilities: ['investor-relations', 'media-management', 'voice-interface'], votingWeight: 80 },
  { id: 'avatar-lead', name: 'AvatarCore', domain: AgentDomain.AVATAR, tier: AgentTier.EXECUTIVE, ensName: 'avatar.nobleport.eth', capabilities: ['emotion-rendering', 'lip-sync', 'gesture-modeling'], votingWeight: 80 },
  // SENIOR (20) - specialized agents
  ...generateAgents('senior', AgentTier.SENIOR, 20, 60),
  // STANDARD (50) - operational agents
  ...generateAgents('standard', AgentTier.STANDARD, 50, 30),
  // JUNIOR (30) - support agents
  ...generateAgents('junior', AgentTier.JUNIOR, 30, 10),
];

function generateAgents(prefix: string, tier: AgentTier, count: number, weight: number) {
  const domains = Object.values(AgentDomain);
  const agents: typeof AGENT_DEFINITIONS = [];
  for (let i = 0; i < count; i++) {
    const domain = domains[i % domains.length];
    agents.push({
      id: `${prefix}-${domain}-${i + 1}`,
      name: `${capitalize(prefix)}${capitalize(domain)}Agent${i + 1}`,
      domain,
      tier,
      ensName: `${prefix}-${i + 1}.nobleport.eth`,
      capabilities: [`${domain}-ops`, `${domain}-monitoring`],
      votingWeight: weight,
    });
  }
  return agents;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, '');
}

// ─── Council Controller ───────────────────────────────────────────────

export class AICouncilControl {
  private agents: Map<string, AIAgent> = new Map();
  private proposals: Map<string, CouncilProposal> = new Map();
  private delegations: Map<string, TaskDelegation> = new Map();
  private conflicts: ConflictResolution[] = [];
  private running = false;
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initializeAgents();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════════

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.syncTimer = setInterval(() => this.syncAgentHealth(), 10_000);

    console.log(`[AICouncilControl] Started with ${this.agents.size} agents`);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.syncTimer) clearInterval(this.syncTimer);
    console.log('[AICouncilControl] Stopped');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Agent Management
  // ═══════════════════════════════════════════════════════════════════

  private initializeAgents(): void {
    for (const def of AGENT_DEFINITIONS) {
      this.agents.set(def.id, {
        ...def,
        status: AgentStatus.ACTIVE,
        performanceScore: 500,
        tasksCompleted: 0,
        tasksAssigned: 0,
        lastActive: Date.now(),
        createdAt: Date.now(),
        delegatedTo: null,
        parentAgent: null,
        metadata: {},
      });
    }
  }

  getAgent(agentId: string): AIAgent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AIAgent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByDomain(domain: AgentDomain): AIAgent[] {
    return this.getAllAgents().filter(a => a.domain === domain);
  }

  getAgentsByTier(tier: AgentTier): AIAgent[] {
    return this.getAllAgents().filter(a => a.tier === tier);
  }

  getActiveAgents(): AIAgent[] {
    return this.getAllAgents().filter(a =>
      a.status === AgentStatus.ACTIVE || a.status === AgentStatus.BUSY
    );
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastActive = Date.now();
    }
  }

  updatePerformance(agentId: string, scoreAdjustment: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.performanceScore = Math.max(0, Math.min(1000, agent.performanceScore + scoreAdjustment));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Governance Proposals
  // ═══════════════════════════════════════════════════════════════════

  createProposal(params: {
    title: string;
    description: string;
    proposedBy: string;
    domain: AgentDomain;
    quorumRequired: number;
    durationMs: number;
    ipfsCid: string;
  }): string {
    const id = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.proposals.set(id, {
      id,
      title: params.title,
      description: params.description,
      proposedBy: params.proposedBy,
      domain: params.domain,
      status: ProposalStatus.PROPOSED,
      votesFor: 0,
      votesAgainst: 0,
      votesAbstain: 0,
      quorumRequired: params.quorumRequired,
      votes: [],
      createdAt: Date.now(),
      deadline: Date.now() + params.durationMs,
      executedAt: null,
      ipfsCid: params.ipfsCid,
    });

    return id;
  }

  castVote(proposalId: string, agentId: string, vote: 'for' | 'against' | 'abstain', reason: string): boolean {
    const proposal = this.proposals.get(proposalId);
    const agent = this.agents.get(agentId);
    if (!proposal || !agent) return false;
    if (proposal.status !== ProposalStatus.PROPOSED && proposal.status !== ProposalStatus.VOTING) return false;
    if (Date.now() > proposal.deadline) return false;

    // Check for duplicate vote
    if (proposal.votes.some(v => v.agentId === agentId)) return false;

    proposal.status = ProposalStatus.VOTING;

    const councilVote: CouncilVote = {
      agentId,
      vote,
      weight: agent.votingWeight,
      reason,
      timestamp: Date.now(),
    };

    proposal.votes.push(councilVote);

    if (vote === 'for') proposal.votesFor += agent.votingWeight;
    else if (vote === 'against') proposal.votesAgainst += agent.votingWeight;
    else proposal.votesAbstain += agent.votingWeight;

    // Check if quorum reached
    const totalVoteWeight = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    if (totalVoteWeight >= proposal.quorumRequired) {
      if (proposal.votesFor > proposal.votesAgainst) {
        proposal.status = ProposalStatus.APPROVED;
      } else {
        proposal.status = ProposalStatus.REJECTED;
      }
    }

    return true;
  }

  executeProposal(proposalId: string): boolean {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== ProposalStatus.APPROVED) return false;

    proposal.status = ProposalStatus.EXECUTED;
    proposal.executedAt = Date.now();
    return true;
  }

  vetoProposal(proposalId: string, sovereignAgentId: string): boolean {
    const agent = this.agents.get(sovereignAgentId);
    if (!agent || agent.tier !== AgentTier.SOVEREIGN) return false;

    const proposal = this.proposals.get(proposalId);
    if (!proposal) return false;

    proposal.status = ProposalStatus.VETOED;
    return true;
  }

  getProposal(proposalId: string): CouncilProposal | undefined {
    return this.proposals.get(proposalId);
  }

  getActiveProposals(): CouncilProposal[] {
    return Array.from(this.proposals.values()).filter(
      p => p.status === ProposalStatus.PROPOSED || p.status === ProposalStatus.VOTING
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Task Delegation
  // ═══════════════════════════════════════════════════════════════════

  delegateTask(params: {
    taskName: string;
    description: string;
    fromAgent: string;
    domain: AgentDomain;
    priority: number;
  }): string {
    const bestAgent = this.findBestAgent(params.domain);
    if (!bestAgent) throw new Error(`No available agent for domain: ${params.domain}`);

    const id = `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.delegations.set(id, {
      id,
      taskName: params.taskName,
      description: params.description,
      fromAgent: params.fromAgent,
      toAgent: bestAgent.id,
      domain: params.domain,
      priority: params.priority,
      status: 'pending',
      createdAt: Date.now(),
      completedAt: null,
      result: null,
    });

    bestAgent.tasksAssigned++;
    bestAgent.status = AgentStatus.BUSY;

    return id;
  }

  completeDelegation(delegationId: string, result: unknown): boolean {
    const del = this.delegations.get(delegationId);
    if (!del) return false;

    del.status = 'completed';
    del.completedAt = Date.now();
    del.result = result;

    const agent = this.agents.get(del.toAgent);
    if (agent) {
      agent.tasksCompleted++;
      agent.status = AgentStatus.ACTIVE;
      this.updatePerformance(agent.id, 5);
    }

    return true;
  }

  private findBestAgent(domain: AgentDomain): AIAgent | null {
    const candidates = this.getAgentsByDomain(domain)
      .filter(a => a.status === AgentStatus.ACTIVE)
      .sort((a, b) => b.performanceScore - a.performanceScore);

    return candidates[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Conflict Resolution
  // ═══════════════════════════════════════════════════════════════════

  resolveConflict(params: {
    agents: string[];
    domain: AgentDomain;
    description: string;
    resolution: string;
  }): string {
    const id = `conflict-${Date.now()}`;
    const sovereign = this.agents.get('stephanie-ceo');

    this.conflicts.push({
      id,
      agents: params.agents,
      domain: params.domain,
      description: params.description,
      resolution: params.resolution,
      resolvedBy: sovereign?.id || 'system',
      timestamp: Date.now(),
    });

    return id;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Health Sync
  // ═══════════════════════════════════════════════════════════════════

  private syncAgentHealth(): void {
    const now = Date.now();
    for (const [, agent] of this.agents) {
      const inactive = now - agent.lastActive;
      if (inactive > 300_000 && agent.status === AgentStatus.ACTIVE) {
        agent.status = AgentStatus.STANDBY;
      }
      if (inactive > 600_000) {
        agent.status = AgentStatus.OFFLINE;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Status
  // ═══════════════════════════════════════════════════════════════════

  getStatus(): {
    totalAgents: number;
    activeAgents: number;
    agentsByDomain: Record<string, number>;
    agentsByTier: Record<string, number>;
    activeProposals: number;
    totalDelegations: number;
    conflictsResolved: number;
  } {
    const all = this.getAllAgents();
    const byDomain: Record<string, number> = {};
    const byTier: Record<string, number> = {};

    for (const a of all) {
      byDomain[a.domain] = (byDomain[a.domain] || 0) + 1;
      byTier[a.tier] = (byTier[a.tier] || 0) + 1;
    }

    return {
      totalAgents: all.length,
      activeAgents: this.getActiveAgents().length,
      agentsByDomain: byDomain,
      agentsByTier: byTier,
      activeProposals: this.getActiveProposals().length,
      totalDelegations: this.delegations.size,
      conflictsResolved: this.conflicts.length,
    };
  }
}

export default AICouncilControl;
