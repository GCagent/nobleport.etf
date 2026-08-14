/**
 * Stephanie.ai Module Index
 *
 * Central export for all 12 architecture layers:
 *
 *  1. IQCoreModule          — AI Intelligence Quantification
 *  2. CUDAOrchestrator      — GPU Task Execution Engine
 *  3. ChainlinkOracleGrid   — 29+ Oracle Integration Mesh
 *  4. AICouncilControl      — 112-Agent Mesh Governance
 *  5. zkKYTComplianceLayer  — Zero-Knowledge Compliance Engine
 *  6. GCagent               — Contractor Coordination & Payment
 *  7. PermitStream          — Real-Time Permit Forecasting
 *  8. VoiceAvatarEngine     — Voice, Video & Emotion Stack
 *  9. CrossChainConnectivity — CCIP Multi-Chain Grid
 * 10. BandProtocolZoningFeed — Cross-Continent Zoning Data
 * 11. SnapshotSyncModule    — DAO Vote Enforcement
 * 12. StephanieCore         — Sovereign AI CEO Orchestrator
 */

export { IQCoreModule, IntelligenceDimension } from './IQCoreModule';
export type { IQScore, PerformanceBenchmark, IQSnapshot, IQCoreConfig } from './IQCoreModule';

export { CUDAOrchestrator, TaskPriority, TaskStatus, NodeRole, GPUTier } from './CUDAOrchestrator';
export type { CUDATask, ComputeNode, CanaryDeployment, OrchestratorMetrics } from './CUDAOrchestrator';

export { ChainlinkOracleGrid, OracleProvider, FeedCategory, FeedStatus } from './ChainlinkOracleGrid';
export type { OracleFeed, VRFRequest, AutomationUpkeep, ProofOfReserve } from './ChainlinkOracleGrid';

export { AICouncilControl, AgentDomain, AgentStatus, AgentTier } from './AICouncilControl';
export type { AIAgent, CouncilProposal, TaskDelegation } from './AICouncilControl';

export { zkKYTComplianceLayer, ComplianceFramework, RiskLevel, TransactionVerdict } from './zkKYTComplianceLayer';
export type { ComplianceCheck, ComplianceFinding, ComplianceReport } from './zkKYTComplianceLayer';

export { GCagent, ProjectStatus, ContractorTrade } from './GCagent';
export type { Contractor, Project, Milestone, PaymentAutomation } from './GCagent';

export { PermitStream, PermitType, PermitStatus, ZoningDistrict } from './PermitStream';
export type { Permit, ZoningValidation, PermitForecast } from './PermitStream';

export { VoiceAvatarEngine, EmotionState, VoiceCapability, Language } from './VoiceAvatarEngine';
export type { VoiceSession, TTSRequest, AvatarConfig, CallRecord, AMASession } from './VoiceAvatarEngine';

export { CrossChainConnectivity, Chain, MessageStatus } from './CrossChainConnectivity';
export type { CrossChainMessage, IdentityBridge, StorageAnchor, GovernanceRelay } from './CrossChainConnectivity';

export { BandProtocolZoningFeed, Continent, LandUse } from './BandProtocolZoningFeed';
export type { ZoningFeed, ZoningChangeAlert, LandUseCompatibility } from './BandProtocolZoningFeed';

export { SnapshotSyncModule, GovernanceSystem, ProposalType, ProposalState, VotingStrategy } from './SnapshotSyncModule';
export type { SnapshotSpace, DAOProposal, DAOVote, Epoch, RatificationEvent } from './SnapshotSyncModule';

export { StephanieCore } from './StephanieCore';
export type { StephanieIdentity, SystemHealth, PerformanceReport, EcosystemMetrics } from './StephanieCore';
