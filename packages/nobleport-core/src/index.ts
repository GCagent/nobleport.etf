export {
  TruthTier,
  AgentCapability,
  AUTHORITY_MATRIX,
  EXECUTION_SAFE_TIERS,
  requiresHitl,
  defaultTierFor,
} from "./types/authority";
export type { CertificationContext, TruthPayload } from "./types/authority";
export { canonicalize } from "./crypto/canonical";
export { CryptographicCore } from "./crypto/verify";
export type { KeyPair } from "./crypto/verify";
export {
  GENESIS_HASH,
  computeChainHash,
  appendEntry,
  verifyChain,
} from "./ledger/hashChain";
export type { AppendInput, ChainVerificationResult } from "./ledger/hashChain";
