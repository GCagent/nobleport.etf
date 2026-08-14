/**
 * NoblePort Ecosystem — Module Exports
 * All 50 modules organized by layer
 */

// ═══════════════════════════════════════════════════════════
// BLOCKCHAIN CORE (1–8) — Solidity contracts in /contracts
// ═══════════════════════════════════════════════════════════
// 1. NBPTToken.sol
// 2. PermitNFTEngine.sol
// 3. Escrow.sol
// 4. MerkleRootAnchorer.sol
// 5. ZkSBTCredentialRegistry.sol
// 6. RevocationRootManager.sol
// 7. SnapshotGovernanceBridge.sol
// 8. CrossChainBridgeRouter.sol

// ═══════════════════════════════════════════════════════════
// IoT & ORACLE LAYER (9–15)
// ═══════════════════════════════════════════════════════════
export { DeviceIdentityService } from './iot-oracle/DeviceIdentityService';
export { MTLSGateway } from './iot-oracle/mTLSGateway';
export { TEEAttestationVerifier } from './iot-oracle/TEEAttestationVerifier';
export { CompositeAttestationAggregator } from './iot-oracle/CompositeAttestationAggregator';
export { AnomalyDetectionEngine } from './iot-oracle/AnomalyDetectionEngine';
export { SensorFleetManager } from './iot-oracle/SensorFleetManager';
export { IoTDataPipeline } from './iot-oracle/IoTDataPipeline';

// ═══════════════════════════════════════════════════════════
// STORAGE & DATA (16–21)
// ═══════════════════════════════════════════════════════════
export { IPFSArweavePinningService } from './storage-data/IPFSArweavePinningService';
export { CIDRegistry } from './storage-data/CIDRegistry';
export { DocumentVault } from './storage-data/DocumentVault';
export { CorrectionEventLogger } from './storage-data/CorrectionEventLogger';
export { AuditBundleGenerator } from './storage-data/AuditBundleGenerator';
export { PIITombstoneManager } from './storage-data/PIITombstoneManager';

// ═══════════════════════════════════════════════════════════
// MUNICIPAL PERMITTING (22–28)
// ═══════════════════════════════════════════════════════════
export { LegacySystemAdapter } from './municipal-permitting/LegacySystemAdapter';
export { ReadOnlyMirror } from './municipal-permitting/ReadOnlyMirror';
export { WriteThroughSubmitter } from './municipal-permitting/WriteThroughSubmitter';
export { SmartReviewRouter } from './municipal-permitting/SmartReviewRouter';
export { PermitStatusTracker } from './municipal-permitting/PermitStatusTracker';
export { InspectorCredentialVerifier } from './municipal-permitting/InspectorCredentialVerifier';
export { MunicipalTransparencyPortal } from './municipal-permitting/MunicipalTransparencyPortal';

// ═══════════════════════════════════════════════════════════
// CONSTRUCTION OPERATIONS (29–35)
// ═══════════════════════════════════════════════════════════
export { ConstructionCalculator } from './construction-ops/ConstructionCalculator';
export { MilestoneTemplateLibrary } from './construction-ops/MilestoneTemplateLibrary';
export { DailyLogHasher } from './construction-ops/DailyLogHasher';
export { RFIChangeOrderTracker } from './construction-ops/RFIChangeOrderTracker';
export { SubcontractorRegistry } from './construction-ops/SubcontractorRegistry';
export { SafetyComplianceModule } from './construction-ops/SafetyComplianceModule';
export { SchedulePredictionEngine } from './construction-ops/SchedulePredictionEngine';

// ═══════════════════════════════════════════════════════════
// REAL ESTATE & TOKENIZATION (36–41)
// ═══════════════════════════════════════════════════════════
export { FractionalOwnershipEngine } from './real-estate-tokenization/FractionalOwnershipEngine';
export { USDCDistributionAutomator } from './real-estate-tokenization/USDCDistributionAutomator';
export { PropertyNFTRegistry } from './real-estate-tokenization/PropertyNFTRegistry';
export { InvestorKYCAMLGateway } from './real-estate-tokenization/InvestorKYCAMLGateway';
export { PropertyDashboard } from './real-estate-tokenization/PropertyDashboard';
export { SecondaryMarketModule } from './real-estate-tokenization/SecondaryMarketModule';

// ═══════════════════════════════════════════════════════════
// AI GOVERNANCE (42–46)
// ═══════════════════════════════════════════════════════════
export { StephanieAIOrchestrator } from './ai-governance/StephanieAIOrchestrator';
export { GCagentComplianceEngine } from './ai-governance/GCagentComplianceEngine';
export { HarveyLegalConnector } from './ai-governance/HarveyLegalConnector';
export { AIDecisionAuditLogger } from './ai-governance/AIDecisionAuditLogger';
export { AICertificationFramework } from './ai-governance/AICertificationFramework';

// ═══════════════════════════════════════════════════════════
// PLATFORM INFRASTRUCTURE (47–50)
// ═══════════════════════════════════════════════════════════
export { ValidatorMeshNetwork } from './platform-infrastructure/ValidatorMeshNetwork';
export { MonitoringAlertingStack } from './platform-infrastructure/MonitoringAlertingStack';
export { AuthenticationRBAC } from './platform-infrastructure/AuthenticationRBAC';
export { PaymentRailsAggregator } from './platform-infrastructure/PaymentRailsAggregator';

// ═══════════════════════════════════════════════════════════
// Ecosystem Config
// ═══════════════════════════════════════════════════════════
export {
  ECOSYSTEM_MODULES,
  LAYERS,
  getModulesByLayer,
  getModuleById,
  getDependencyGraph,
  getModulesByStatus,
} from '../ecosystem.config';
export type { ModuleDefinition, ModuleLayer, ModuleStatus } from '../ecosystem.config';
