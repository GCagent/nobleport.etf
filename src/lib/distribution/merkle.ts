/**
 * Merkle tree construction and proof generation for NBPT distributions.
 *
 * Leaf format: keccak256(index || wallet || amount)
 * Matches the on-chain verification in noble_distributor::claim.
 */

import { PublicKey } from "@solana/web3.js";
import { keccak_256 } from "@noble/hashes/sha3";

export interface ClaimEntry {
  index: number;
  wallet: PublicKey;
  amount: bigint;
}

export interface MerkleDistribution {
  root: Buffer;
  entries: ClaimEntry[];
  proofs: Map<number, Buffer[]>;
  totalAmount: bigint;
}

/**
 * Hash a leaf node: keccak256(index_le_bytes || wallet_bytes || amount_le_bytes)
 */
function hashLeaf(entry: ClaimEntry): Buffer {
  const indexBuf = Buffer.alloc(8);
  indexBuf.writeBigUInt64LE(BigInt(entry.index));

  const walletBuf = entry.wallet.toBuffer();

  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(entry.amount);

  const data = Buffer.concat([indexBuf, walletBuf, amountBuf]);
  return Buffer.from(keccak_256(data));
}

/**
 * Hash two sibling nodes: keccak256(min || max) — sorted for determinism.
 */
function hashPair(left: Buffer, right: Buffer): Buffer {
  const [first, second] = Buffer.compare(left, right) <= 0
    ? [left, right]
    : [right, left];
  return Buffer.from(keccak_256(Buffer.concat([first, second])));
}

/**
 * Build a Merkle tree from claim entries.
 *
 * Returns the root, all entries, and a proof map keyed by leaf index.
 * Tree is padded to the next power of two with zero hashes.
 */
export function buildMerkleTree(entries: ClaimEntry[]): MerkleDistribution {
  if (entries.length === 0) {
    throw new Error("Cannot build tree with zero entries");
  }

  // Hash all leaves
  const leaves = entries.map(hashLeaf);

  // Pad to next power of 2
  const depth = Math.ceil(Math.log2(Math.max(leaves.length, 2)));
  const paddedSize = Math.pow(2, depth);
  const zeroHash = Buffer.alloc(32);

  while (leaves.length < paddedSize) {
    leaves.push(zeroHash);
  }

  // Build tree layers bottom-up
  const layers: Buffer[][] = [leaves];

  let currentLayer = leaves;
  while (currentLayer.length > 1) {
    const nextLayer: Buffer[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = currentLayer[0];

  // Generate proofs for each original entry
  const proofs = new Map<number, Buffer[]>();

  for (let i = 0; i < entries.length; i++) {
    const proof: Buffer[] = [];
    let idx = i;

    for (let layer = 0; layer < layers.length - 1; layer++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      proof.push(layers[layer][siblingIdx]);
      idx = Math.floor(idx / 2);
    }

    proofs.set(entries[i].index, proof);
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0n);

  return { root, entries, proofs, totalAmount };
}

/**
 * Verify a Merkle proof against a root.
 */
export function verifyProof(
  root: Buffer,
  entry: ClaimEntry,
  proof: Buffer[]
): boolean {
  let computed = hashLeaf(entry);

  for (const sibling of proof) {
    computed = hashPair(computed, sibling);
  }

  return computed.equals(root);
}

/**
 * Serialize a distribution to JSON for storage/audit.
 */
export function serializeDistribution(dist: MerkleDistribution): string {
  const serializable = {
    root: dist.root.toString("hex"),
    totalAmount: dist.totalAmount.toString(),
    entries: dist.entries.map((e) => ({
      index: e.index,
      wallet: e.wallet.toBase58(),
      amount: e.amount.toString(),
    })),
    proofs: Object.fromEntries(
      Array.from(dist.proofs.entries()).map(([idx, proof]) => [
        idx.toString(),
        proof.map((p) => p.toString("hex")),
      ])
    ),
  };
  return JSON.stringify(serializable, null, 2);
}

/**
 * Deserialize a distribution from JSON.
 */
export function deserializeDistribution(json: string): MerkleDistribution {
  const data = JSON.parse(json);
  const entries: ClaimEntry[] = data.entries.map((e: any) => ({
    index: e.index,
    wallet: new PublicKey(e.wallet),
    amount: BigInt(e.amount),
  }));

  const proofs = new Map<number, Buffer[]>();
  for (const [idx, proof] of Object.entries(data.proofs)) {
    proofs.set(
      parseInt(idx),
      (proof as string[]).map((p) => Buffer.from(p, "hex"))
    );
  }

  return {
    root: Buffer.from(data.root, "hex"),
    entries,
    proofs,
    totalAmount: BigInt(data.totalAmount),
  };
}
