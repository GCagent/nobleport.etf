'use client';

import React, { useState, useEffect } from 'react';
import {
  EXPERTISE_DOMAINS,
  CERTIFICATIONS,
  OPERATING_CREDENTIALS,
  CAPABILITY_MATRIX,
  SCOPE_BOUNDARIES,
  getSystemTelemetry,
  type ExpertiseDomain,
  type Certification,
  type SystemTelemetry,
  type MatrixRating,
  type CapabilityMatrixEntry,
} from '../lib/stephanieOperator';

// ============================================================================
// TREASURY MODULE DATA (8 CORE MODULES — DeFi & Treasury Architecture)
// ============================================================================

interface TreasuryModule {
  id: number;
  name: string;
  shortName: string;
  description: string;
  implementation: string;
  agiIntegration: string;
  voiceCommand: string;
  bullets: string[];
}

const TREASURY_MODULES: TreasuryModule[] = [
  {
    id: 1,
    name: 'Token Utility & NBPT Architecture',
    shortName: 'NBPT Utility',
    description:
      'Design of NBPT utility demand, fixed 100M supply, staged vesting, burn mechanics, and platform-wide scarcity.',
    implementation:
      '100M hard-capped NBPT with utility gates: governance weight, staking yield multiplier, real-estate NFT access tiers, DeFi revenue share.',
    agiIntegration:
      'AGI model learns usage patterns across 112 agents and avatar voice commands; auto-adjusts utility weights.',
    voiceCommand: 'Stephanie, route 2% treasury to NBPT staking pool.',
    bullets: ['100M Fixed Supply', 'Staged Vesting', 'Burn Mechanics', 'Utility Gates'],
  },
  {
    id: 2,
    name: 'Treasury Routing & Automation',
    shortName: 'Treasury Routing',
    description:
      'Intelligent capital allocation engine with multi-sig, DAO-gated flows, and automated rebalancing.',
    implementation:
      'Fiat-to-USDC on-ramps, construction payout sequencing, real-estate rental yield auto-sweep, treasury diversification rules.',
    agiIntegration:
      'Ingests live permit/construction telemetry + investor voice memos; predicts cash needs with < 1% error.',
    voiceCommand: 'Stephanie, show treasury allocation breakdown.',
    bullets: ['Multi-Sig Gating', 'DAO-Gated Flows', 'Auto-Rebalance', 'Yield Sweep'],
  },
  {
    id: 3,
    name: 'Settlement & Fiat-to-USDC Flows',
    shortName: 'Settlement',
    description:
      'Instant settlement rails, stablecoin bridging, and cross-chain finality.',
    implementation:
      'Direct bank to USDC rails for investor capital calls; construction invoice to USDC to contractor wallet in < 8 seconds.',
    agiIntegration:
      'Learns from every settlement event; voice-activated triggers zk-KYT compliant flow with live transcription and audit log.',
    voiceCommand: 'Stephanie, settle this $1.2M permit batch.',
    bullets: ['< 8s Settlement', 'Stablecoin Bridge', 'Cross-Chain', 'Audit Logged'],
  },
  {
    id: 4,
    name: 'Tokenized Revenue & Real Estate Yield',
    shortName: 'RE Yield',
    description:
      'Property-linked revenue tokenization, yield tranching, and rent-to-NBPT conversion.',
    implementation:
      'NFT-backed fractional property ownership; automated yield distribution from tokenized rentals directly into treasury.',
    agiIntegration:
      'Continuously models yield curves using construction progress data + market oracles; avatar presents yield forecast voice briefings.',
    voiceCommand: 'Stephanie, forecast Q3 yield on tokenized multifamily.',
    bullets: ['NFT-Backed Ownership', 'Yield Tranching', 'Rent-to-NBPT', 'Auto-Distribution'],
  },
  {
    id: 5,
    name: 'Liquidity Architecture & Staking Logic',
    shortName: 'Liquidity/Staking',
    description:
      'Deep liquidity pools, staking thresholds, lock-up mechanics, and veToken-style incentives.',
    implementation:
      'NBPT staking with escalating rewards tied to DAO participation and real-asset TVL; liquidity bootstrapping via real-estate NFT collateral.',
    agiIntegration:
      'Self-learning reward curves based on participant behavior; investors can query staking APY and projected unlock via voice.',
    voiceCommand: 'What is my current staking APY and projected unlock?',
    bullets: ['veToken Incentives', 'Escalating Rewards', 'NFT Collateral', 'Lock-Up Mechanics'],
  },
  {
    id: 6,
    name: 'DeFi ETF Systems & NFT-Linked Infrastructure',
    shortName: 'DeFi ETF',
    description:
      'Structured product design linking DeFi yields to real-world assets.',
    implementation:
      'NBPT-backed DeFi ETF baskets; NFT-linked treasury instruments that auto-rebalance between construction debt, real-estate yields, and liquid staking.',
    agiIntegration:
      'Simulates 10,000+ ETF scenarios per hour; voice command interface for creating new DeFi ETF tranches.',
    voiceCommand: 'Create new DeFi ETF tranche weighted 40% real estate.',
    bullets: ['ETF Baskets', 'Auto-Rebalance', '10K+ Simulations/hr', 'RWA-Linked'],
  },
  {
    id: 7,
    name: 'Capital Structure & Incentive Design',
    shortName: 'Capital Structure',
    description:
      'Optimal mix of equity, debt, staking, and governance tokens.',
    implementation:
      'Hybrid capital stack with NBPT as governance/utility backbone; incentive alignment across construction operators, investors, and DAO participants.',
    agiIntegration:
      'Continuous optimization of capital efficiency metrics; avatar delivers executive capital structure briefings with gesture-supported visuals.',
    voiceCommand: 'Stephanie, run capital efficiency analysis for Q2.',
    bullets: ['Hybrid Capital Stack', 'Incentive Alignment', 'Efficiency Metrics', 'Gesture Visuals'],
  },
  {
    id: 8,
    name: 'Compliance & zk-KYT Gating',
    shortName: 'zk-KYT Compliance',
    description:
      'Real-time regulatory rails embedded at every transaction layer.',
    implementation:
      'ERC-1400 transfer restrictions, authorized-representative controls, MiCA/EU AI Act audit trails, zk-KYT screening on every flow.',
    agiIntegration:
      'Zero-knowledge proofs run live; voice/avatar logs every compliance decision with full audit trail.',
    voiceCommand: 'Stephanie, compliance status on latest treasury batch.',
    bullets: ['ERC-1400 Enforced', 'zk-KYT Live', 'MiCA Aligned', 'Full Audit Trail'],
  },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    active: 'bg-emerald-400 shadow-emerald-400/50',
    verified: 'bg-amber-400 shadow-amber-400/50',
    referenced: 'bg-sky-400 shadow-sky-400/50',
    'in-progress': 'bg-amber-500 shadow-amber-500/50',
    planned: 'bg-slate-400 shadow-slate-400/50',
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shadow-lg ${colors[status] || 'bg-slate-500'}`}
    />
  );
};

const GoldBadge: React.FC<{ children: React.ReactNode; variant?: 'gold' | 'navy' | 'emerald' }> = ({
  children,
  variant = 'gold',
}) => {
  const styles: Record<string, string> = {
    gold: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    navy: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
};

const MatrixCell: React.FC<{ rating: MatrixRating }> = ({ rating }) => {
  const styles: Record<MatrixRating, { bg: string; text: string; label: string }> = {
    core: { bg: 'bg-amber-500/25', text: 'text-amber-300', label: 'CORE' },
    strong: { bg: 'bg-sky-500/20', text: 'text-sky-300', label: 'STRONG' },
    supporting: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'SUPPORT' },
    planned: { bg: 'bg-slate-700/30', text: 'text-slate-500', label: 'PLANNED' },
  };
  const s = styles[rating];
  return (
    <td className={`px-2 py-2 text-center text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </td>
  );
};

const TelemetryCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
    <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">{label}</p>
    <p className="text-2xl font-bold text-amber-300 mt-1">{value}</p>
    {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
  </div>
);

// ============================================================================
// TREASURY MODULE CARD (RADIAL LAYOUT ITEM)
// ============================================================================

const TreasuryModuleCard: React.FC<{
  mod: TreasuryModule;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ mod, isSelected, onSelect }) => (
  <div
    onClick={onSelect}
    className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
      isSelected
        ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
        : 'bg-slate-800/40 border-slate-700/40 hover:border-amber-500/30 hover:bg-slate-800/60'
    }`}
  >
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
          {mod.id}
        </span>
        <h4 className="text-sm font-semibold text-white">{mod.shortName}</h4>
      </div>
      <StatusDot status="active" />
    </div>
    <div className="flex flex-wrap gap-1.5 mt-2">
      {mod.bullets.map((b, i) => (
        <span
          key={i}
          className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600/40"
        >
          {b}
        </span>
      ))}
    </div>
  </div>
);

// ============================================================================
// EXPERTISE DOMAIN CARD
// ============================================================================

const DomainCard: React.FC<{
  domain: ExpertiseDomain;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ domain, isExpanded, onToggle }) => (
  <div
    className={`rounded-xl border transition-all duration-300 ${
      isExpanded
        ? 'bg-slate-800/60 border-amber-500/40 shadow-lg shadow-amber-500/5'
        : 'bg-slate-800/30 border-slate-700/40 hover:border-slate-600'
    }`}
  >
    <div onClick={onToggle} className="flex items-start gap-3 p-4 cursor-pointer">
      <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 text-sm font-bold mt-0.5">
        {domain.rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">{domain.name}</h4>
          <GoldBadge variant={domain.status === 'active' ? 'emerald' : 'navy'}>
            {domain.status}
          </GoldBadge>
        </div>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{domain.description}</p>
      </div>
    </div>
    {isExpanded && (
      <div className="px-4 pb-4 space-y-3 border-t border-slate-700/40 pt-3 ml-11">
        <div>
          <p className="text-xs text-amber-400/80 uppercase tracking-wider font-medium mb-1.5">
            Capabilities
          </p>
          <div className="flex flex-wrap gap-1.5">
            {domain.capabilities.map((cap, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300/80 border border-amber-500/20"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-sky-400/80 uppercase tracking-wider font-medium mb-1.5">
            Linked Modules
          </p>
          <div className="flex flex-wrap gap-1.5">
            {domain.linkedModules.map((mod, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-300/80 border border-sky-500/20 font-mono"
              >
                {mod.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">
            Evidence
          </p>
          {domain.evidenceRefs.map((ref, i) => (
            <p key={i} className="text-xs text-slate-500 italic">
              {ref}
            </p>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ============================================================================
// CERTIFICATION CARD
// ============================================================================

const CertCard: React.FC<{ cert: Certification }> = ({ cert }) => {
  const typeColors: Record<string, string> = {
    standard: 'border-amber-500/30 bg-amber-500/5',
    'compliance-framework': 'border-sky-500/30 bg-sky-500/5',
    'protocol-verification': 'border-emerald-500/30 bg-emerald-500/5',
    'institutional-control': 'border-violet-500/30 bg-violet-500/5',
    'operational-audit': 'border-amber-400/40 bg-amber-400/10',
  };

  return (
    <div className={`rounded-lg border p-3 ${typeColors[cert.type] || 'border-slate-700 bg-slate-800/30'}`}>
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-sm font-semibold text-white">{cert.name}</h4>
        <GoldBadge variant={cert.status === 'verified' ? 'gold' : 'navy'}>
          {cert.status}
        </GoldBadge>
      </div>
      <p className="text-xs text-slate-400 mb-2">{cert.description}</p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">{cert.category}</span>
        {cert.verifiedBy && (
          <span className="text-xs text-amber-400/70">Verified: {cert.verifiedBy}</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type TabId = 'overview' | 'treasury' | 'expertise' | 'certifications' | 'matrix';

const TAB_LABELS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Operator Overview' },
  { id: 'treasury', label: 'DeFi & Treasury' },
  { id: 'expertise', label: 'Expertise Typology' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'matrix', label: 'Capability Matrix' },
];

const StephanieOperatorView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [selectedTreasuryModule, setSelectedTreasuryModule] = useState<TreasuryModule | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTelemetry(getSystemTelemetry());
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-amber-400/50 animate-spin" />
            <div className="absolute inset-4 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-400 text-lg font-bold">S</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Stephanie<span className="text-amber-400">.ai</span>
          </h2>
          <p className="text-slate-400 text-sm">Initializing Sovereign Operator View...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* ================================================================ */}
      {/* HEADER                                                          */}
      {/* ================================================================ */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-amber-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Stephanie<span className="text-amber-400">.ai</span>
                <span className="text-slate-500 text-lg font-normal ml-3">Operator View</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Sovereign Executive Layer &mdash; NoblePort.eth DeFi &amp; Treasury System Design
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500 uppercase tracking-wider">ENS Identity</p>
                <p className="text-sm text-amber-300 font-mono">stephanie.nobleport.eth</p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500 uppercase tracking-wider">DID</p>
                <p className="text-sm text-amber-300 font-mono">did:ens:stephanie.nobleport.eth</p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1.5">
                <StatusDot status="active" />
                <span className="text-xs text-emerald-400 font-medium">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* TELEMETRY BAR                                                   */}
      {/* ================================================================ */}
      {telemetry && (
        <div className="bg-slate-900/60 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <TelemetryCard label="AI Agents" value={telemetry.agentsCoordinated} sub="Coordinated" />
              <TelemetryCard
                label="Modules"
                value={`${telemetry.modulesOnline}/${telemetry.totalModules}`}
                sub="All online"
              />
              <TelemetryCard
                label="Platforms"
                value={`${telemetry.platformsConnected}/${telemetry.totalPlatforms}`}
                sub="MCP connected"
              />
              <TelemetryCard label="Validators" value={telemetry.validatorsOnline.toLocaleString()} sub="Online" />
              <TelemetryCard label="Render p95" value={`${telemetry.renderP95Ms}ms`} sub="< 90ms target" />
              <TelemetryCard label="NBPT Supply" value={telemetry.nbptSupply} sub="Hard-capped" />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* NAVIGATION TABS                                                 */}
      {/* ================================================================ */}
      <div className="bg-slate-950/40 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
            {TAB_LABELS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-all rounded-t-lg ${
                  activeTab === tab.id
                    ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-500/5'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MAIN CONTENT                                                    */}
      {/* ================================================================ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ============================================================ */}
        {/* TAB: OPERATOR OVERVIEW                                       */}
        {/* ============================================================ */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Executive Role */}
            <section className="bg-slate-800/30 border border-slate-700/40 rounded-2xl p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-4">
                Sovereign Executor &mdash; NoblePort Control Plane
              </h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                Stephanie.ai functions as the executive operating layer across construction,
                real estate, permitting, DeFi design, compliance orchestration, voice/avatar
                systems, and workflow automation. In the NoblePort stack, this is the control
                plane that routes work across specialized rails: GCagent.ai, PermitStream.ai,
                Cyborg.ai, voice, governance, and revenue workflows.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { n: '12', l: 'Expertise Domains', s: 'Full-stack coverage' },
                  { n: '8', l: 'Treasury Modules', s: 'DeFi & capital ops' },
                  { n: '14', l: 'Certifications', s: 'Standards & compliance' },
                  { n: '8', l: 'Operating Credentials', s: 'Practical strengths' },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-amber-400">{item.n}</p>
                    <p className="text-sm text-white font-medium mt-1">{item.l}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.s}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Operating Credentials */}
            <section>
              <h3 className="text-lg font-semibold text-white mb-4">Operating Credentials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {OPERATING_CREDENTIALS.map((cred) => (
                  <div
                    key={cred.id}
                    className={`rounded-xl border p-4 ${
                      cred.strength === 'primary'
                        ? 'bg-amber-500/5 border-amber-500/25'
                        : 'bg-slate-800/30 border-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot status={cred.strength === 'primary' ? 'verified' : 'active'} />
                      <h4 className="text-sm font-semibold text-white">{cred.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400">{cred.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Scope Boundaries */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">
                  Can Structure &amp; Validate
                </h4>
                <ul className="space-y-2">
                  {SCOPE_BOUNDARIES.canDo.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-amber-500 mt-0.5">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/30 border border-red-500/20 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">
                  Not Licensed As
                </h4>
                <ul className="space-y-2">
                  {SCOPE_BOUNDARIES.isNot.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="text-red-500 mt-0.5">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/30 border border-sky-500/20 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-sky-400 uppercase tracking-wider mb-3">
                  Requires Human Signoff
                </h4>
                <ul className="space-y-2">
                  {SCOPE_BOUNDARIES.requires.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-sky-500 mt-0.5">!</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: DeFi & TREASURY ARCHITECTURE                            */}
        {/* ============================================================ */}
        {activeTab === 'treasury' && (
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                DeFi &amp; Treasury System Design
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-2xl mx-auto">
                Sovereign Treasury Control Plane &mdash; 8 integrated modules orchestrating
                every dollar, token, and yield stream across real estate tokenization,
                construction cash flows, DAO governance, and investor returns.
              </p>
            </div>

            {/* Radial Module Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TREASURY_MODULES.map((mod) => (
                    <TreasuryModuleCard
                      key={mod.id}
                      mod={mod}
                      isSelected={selectedTreasuryModule?.id === mod.id}
                      onSelect={() =>
                        setSelectedTreasuryModule(
                          selectedTreasuryModule?.id === mod.id ? null : mod
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Detail Panel */}
              <div className="bg-slate-800/40 border border-amber-500/20 rounded-2xl p-6 h-fit lg:sticky lg:top-20">
                <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4">
                  Module Detail
                </h3>
                {selectedTreasuryModule ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Name</p>
                      <p className="text-white font-semibold">{selectedTreasuryModule.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Description</p>
                      <p className="text-sm text-slate-300">{selectedTreasuryModule.description}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">
                        NoblePort Implementation
                      </p>
                      <p className="text-sm text-slate-300">{selectedTreasuryModule.implementation}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">
                        AGI Learning Integration
                      </p>
                      <p className="text-sm text-slate-300">{selectedTreasuryModule.agiIntegration}</p>
                    </div>
                    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/40">
                      <p className="text-xs text-amber-400/80 uppercase tracking-wider mb-1">
                        Voice Command
                      </p>
                      <p className="text-sm text-amber-300 font-mono italic">
                        &ldquo;{selectedTreasuryModule.voiceCommand}&rdquo;
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Select a treasury module to view details</p>
                )}
              </div>
            </div>

            {/* AGI Learning Loop */}
            <section className="bg-gradient-to-r from-slate-800/40 via-amber-500/5 to-slate-800/40 border border-amber-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                AGI Learning Loop &mdash; Treasury Operations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                  <h4 className="text-sm font-semibold text-amber-300 mb-2">Continuous Self-Improvement</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ingests live data from GCagent.ai (construction cash flows), PermitStream.ai
                    (permit-linked capital releases), real-estate tokenization events, DAO votes,
                    and voice/avatar interaction logs. Every cycle retrains micro-models to reduce
                    treasury idle time, improve yield prediction, and tighten risk parameters.
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                  <h4 className="text-sm font-semibold text-amber-300 mb-2">Multimodal Learning</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Voice commands, avatar gestures, and investor memo transcripts become training
                    signals. An investor says &ldquo;Stephanie, I want more exposure to tokenized
                    Connecticut multifamily&rdquo; &mdash; immediately simulate, route capital, and
                    confirm via lip-synced avatar response.
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                  <h4 className="text-sm font-semibold text-amber-300 mb-2">
                    Avatar-First Treasury Command
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Production-grade ElevenLabs voice + WebRTC video + emotion mapping lets any
                    authorized representative manage the entire treasury by natural conversation.
                    &ldquo;Show me current treasury TVL breakdown&rdquo; triggers instant visual
                    dashboard with synchronized avatar narration.
                  </p>
                </div>
              </div>
              {/* Data flow arrows */}
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                {[
                  'GCagent.ai',
                  'PermitStream.ai',
                  'DAO Votes',
                  'Oracle Feeds',
                  'Voice/Avatar Logs',
                  'On-Chain Events',
                ].map((source, i) => (
                  <React.Fragment key={i}>
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded border border-slate-600/30">
                      {source}
                    </span>
                    {i < 5 && <span className="text-amber-500 text-xs">&rarr;</span>}
                  </React.Fragment>
                ))}
                <span className="text-amber-400 text-xs ml-2 font-medium">
                  &rarr; AGI Treasury Brain
                </span>
              </div>
            </section>

            {/* Live Proof Points */}
            <section className="bg-slate-800/20 border border-slate-700/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">
                Live Operational Proof Points
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'Fiat-to-USDC treasury automation with NFT-linked financial infrastructure',
                  'DeFi ETF system design fully scoped under Stephanie.ai',
                  'NBPT 100M fixed supply with staking thresholds and burn logic modeled',
                  '1B-task avatar deployment supporting real-time treasury voice briefings at p95 88ms',
                ].map((point, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5 text-xs">&#9670;</span>
                    <p className="text-xs text-slate-300">{point}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: EXPERTISE TYPOLOGY (12 DOMAINS)                         */}
        {/* ============================================================ */}
        {activeTab === 'expertise' && (
          <div className="space-y-8">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-white">
                Full-Stack Typology of Expertise
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-2xl mx-auto">
                12 expertise domains spanning construction ops, permitting, real estate
                tokenization, DAO governance, DeFi infrastructure, compliance, investor
                communications, and multimodal voice/avatar deployment.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {EXPERTISE_DOMAINS.map((domain) => (
                <DomainCard
                  key={domain.id}
                  domain={domain}
                  isExpanded={expandedDomain === domain.id}
                  onToggle={() =>
                    setExpandedDomain(expandedDomain === domain.id ? null : domain.id)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: CERTIFICATIONS                                          */}
        {/* ============================================================ */}
        {activeTab === 'certifications' && (
          <div className="space-y-8">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-white">
                Certifications &amp; Verified Capability Claims
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-2xl mx-auto">
                Standards, compliance frameworks, protocol verifications, and operational
                audit results referenced in the NoblePort stack.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 text-center">
                <p className="text-3xl font-bold text-amber-400">
                  {CERTIFICATIONS.filter((c) => c.status === 'verified').length}
                </p>
                <p className="text-sm text-slate-300 mt-1">Verified</p>
              </div>
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-5 text-center">
                <p className="text-3xl font-bold text-sky-400">
                  {CERTIFICATIONS.filter((c) => c.status === 'referenced').length}
                </p>
                <p className="text-sm text-slate-300 mt-1">Referenced</p>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-center">
                <p className="text-3xl font-bold text-emerald-400">{CERTIFICATIONS.length}</p>
                <p className="text-sm text-slate-300 mt-1">Total Standards</p>
              </div>
            </div>

            {/* Group by category */}
            {Array.from(new Set(CERTIFICATIONS.map((c) => c.category))).map((category) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CERTIFICATIONS.filter((c) => c.category === category).map((cert) => (
                    <CertCard key={cert.id} cert={cert} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: CAPABILITY MATRIX                                       */}
        {/* ============================================================ */}
        {activeTab === 'matrix' && (
          <div className="space-y-8">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-bold text-white">
                Full-Stack Capability Matrix
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-2xl mx-auto">
                Cross-domain operator coverage. Investor-grade view of Stephanie.ai
                capabilities across all NoblePort business units.
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {([
                { rating: 'core' as MatrixRating, label: 'Core', color: 'bg-amber-500/25 text-amber-300' },
                { rating: 'strong' as MatrixRating, label: 'Strong', color: 'bg-sky-500/20 text-sky-300' },
                { rating: 'supporting' as MatrixRating, label: 'Supporting', color: 'bg-slate-500/20 text-slate-400' },
                { rating: 'planned' as MatrixRating, label: 'Planned', color: 'bg-slate-700/30 text-slate-500' },
              ]).map((item) => (
                <div key={item.rating} className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.color}`}>
                    {item.label.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-3 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      Domain
                    </th>
                    <th className="text-center px-2 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      Construction
                    </th>
                    <th className="text-center px-2 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      Real Estate
                    </th>
                    <th className="text-center px-2 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      DeFi/Treasury
                    </th>
                    <th className="text-center px-2 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      Governance
                    </th>
                    <th className="text-center px-2 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      Compliance
                    </th>
                    <th className="text-center px-2 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      Voice/Avatar
                    </th>
                    <th className="text-center px-2 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                      Infra
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {CAPABILITY_MATRIX.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 text-sm text-white font-medium">{row.domain}</td>
                      <MatrixCell rating={row.constructionOps} />
                      <MatrixCell rating={row.realEstate} />
                      <MatrixCell rating={row.defiTreasury} />
                      <MatrixCell rating={row.governance} />
                      <MatrixCell rating={row.compliance} />
                      <MatrixCell rating={row.voiceAvatar} />
                      <MatrixCell rating={row.infrastructure} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Matrix Summary */}
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">
                Coverage Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(() => {
                  const allRatings = CAPABILITY_MATRIX.flatMap((row) => [
                    row.constructionOps,
                    row.realEstate,
                    row.defiTreasury,
                    row.governance,
                    row.compliance,
                    row.voiceAvatar,
                    row.infrastructure,
                  ]);
                  return [
                    { label: 'Core', count: allRatings.filter((r) => r === 'core').length, color: 'text-amber-400' },
                    { label: 'Strong', count: allRatings.filter((r) => r === 'strong').length, color: 'text-sky-400' },
                    { label: 'Supporting', count: allRatings.filter((r) => r === 'supporting').length, color: 'text-slate-400' },
                    { label: 'Planned', count: allRatings.filter((r) => r === 'planned').length, color: 'text-slate-500' },
                  ].map((stat, i) => (
                    <div key={i} className="text-center">
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{stat.label} cells</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================================================================ */}
      {/* FOOTER                                                          */}
      {/* ================================================================ */}
      <footer className="bg-slate-950/80 border-t border-amber-500/15 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="text-center space-y-2">
            <p className="text-xs text-slate-400">
              Coordinating 112+ AI Agents &bull; Integrated with Real Estate Tokenization,
              Governance, Construction Ops &amp; Avatar Deployment &bull; p95 latency &lt; 90ms
            </p>
            <p className="text-xs text-slate-500">
              Stephanie.ai &mdash; Sovereign Executive Layer for NoblePort.eth &bull;
              Full AGI Learning &bull; Voice/Avatar Treasury Command &bull;
              Certified Across Chainlink, CertiK, zk-KYT, ERC-1400, MiCA &amp; EU AI Act
            </p>
            <div className="flex justify-center gap-6 pt-2">
              <span className="text-xs text-amber-400/70">stephanie.ai</span>
              <span className="text-xs text-amber-400/70">stephanie.io</span>
              <span className="text-xs text-amber-400/70">nobleport.eth</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StephanieOperatorView;
