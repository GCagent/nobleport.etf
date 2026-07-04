import { CryptographicCore } from "../crypto/verify";
import { TruthPayload, TruthTier } from "../types/authority";

/** previousHash of the first entry in every entity's chain. */
export const GENESIS_HASH = "0".repeat(64);

/** The chain hash commits to every field of the entry except the signature. */
export function computeChainHash(entry: Omit<TruthPayload, "signature">): string {
  return CryptographicCore.calculateSHA256({
    entityId: entry.entityId,
    entityType: entry.entityType,
    payloadHash: entry.payloadHash,
    previousHash: entry.previousHash,
    timestamp: entry.timestamp,
    tier: entry.tier,
  });
}

export interface AppendInput {
  entityId: string;
  entityType: string;
  payload: object;
  previousHash: string;
  tier: TruthTier;
  timestamp?: number;
}

/** Build and sign the next TruthPayload in an entity's hash chain. */
export async function appendEntry(
  input: AppendInput,
  privateKey: Uint8Array
): Promise<{ entry: TruthPayload; currentHash: string }> {
  const unsigned: Omit<TruthPayload, "signature"> = {
    entityId: input.entityId,
    entityType: input.entityType,
    payloadHash: CryptographicCore.calculateSHA256(input.payload),
    previousHash: input.previousHash,
    timestamp: input.timestamp ?? Date.now(),
    tier: input.tier,
  };
  const currentHash = computeChainHash(unsigned);
  const signature = await CryptographicCore.signPayload(currentHash, privateKey);
  return { entry: { ...unsigned, signature }, currentHash };
}

export interface ChainVerificationResult {
  valid: boolean;
  failureIndex?: number;
  reason?: string;
}

/**
 * Verify linkage and signatures over an ordered chain of entries.
 * Entries must all belong to the same entity and start from GENESIS_HASH.
 */
export async function verifyChain(
  entries: TruthPayload[],
  publicKey: Uint8Array
): Promise<ChainVerificationResult> {
  let expectedPrevious = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.previousHash !== expectedPrevious) {
      return { valid: false, failureIndex: i, reason: "broken hash linkage" };
    }
    const currentHash = computeChainHash(entry);
    const ok = await CryptographicCore.verifySignature(
      currentHash,
      entry.signature,
      publicKey
    );
    if (!ok) {
      return { valid: false, failureIndex: i, reason: "invalid signature" };
    }
    expectedPrevious = currentHash;
  }
  return { valid: true };
}
