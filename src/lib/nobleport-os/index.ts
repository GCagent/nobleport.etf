/**
 * NoblePort OS — Core Module
 *
 * Central export for the NoblePort operating system type layer.
 * Provides type-safe contracts for the revenue loop, proof of trust,
 * integration health, ops brief, and top-level OS state.
 */

// ─── Enums ────────────────────────────────────────────────────────────
export { RevenueLoopStage } from './types';

// ─── Master Operating System manifest ─────────────────────────────────
// The canonical NP-OS definition (mirror of backend/core/np_os.py).
export {
  NP_OS_SYSTEM_MAP,
  NP_OS_LAYERS,
  NP_OS_MASTER_TABLES,
  NP_OS_NORTH_STAR_METRICS,
} from './manifest';
export type {
  LayerId,
  LayerAuthority,
  NpOsLayer,
  MasterTable,
  NorthStarMetric,
  NpOsSystemMap,
} from './manifest';

// ─── Type-only re-exports ─────────────────────────────────────────────
export type {
  // Revenue Loop
  RevenueLoopPosition,
  RevenueLoopStageHealth,
  RevenueLoopHealth,
  RevenueLoopState,

  // Proof of Trust
  ProofOfTrust,
  TrustScoreDimensions,
  TrustScore,
  ProofOfTrustState,

  // Integrations
  IntegrationConnectionStatus,
  IntegrationStatus,
  IntegrationHealth,

  // Ops Brief
  OpsBriefItem,
  OpsBrief,

  // Agent Mesh
  AgentMeshState,

  // Top-level state
  NoblePortOSState,
} from './types';
