/**
 * Fireblocks orchestrator for NBPT distribution operations.
 *
 * API surface:
 *   postRoot(distributionId, params)   — initializeDistributor via Fireblocks
 *   fundVault(distributionId, params)  — token transfer via Fireblocks
 *   getStatus(distributionId)          — distribution status
 *
 * Each operation builds the instruction, wraps it in a VersionedTransaction,
 * routes through Fireblocks raw signing, and broadcasts with confirmation.
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ID,
  getMint,
} from "@solana/spl-token";
import {
  loadFireblocksConfig,
  buildVersionedTransaction,
  signAndBroadcast,
  SigningResult,
} from "./signer";
import idl from "../../../target/idl/noble_distributor.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistributionConfig {
  programId: PublicKey;
  mint: PublicKey;
  rpcUrl: string;
  authority: PublicKey; // Fireblocks vault pubkey
}

export interface PostRootParams {
  merkleRoot: Buffer;
  totalAmount: anchor.BN;
  startTs: anchor.BN;
  endTs: anchor.BN;
}

export interface FundVaultParams {
  amount: bigint;
}

export interface DistributionStatus {
  distributionId: string;
  rootTx: string | null;
  fundTx: string | null;
  totalAmount: string;
  claimedAmount: string;
  claimsCount: number;
  window: {
    start: string;
    end: string;
  };
}

// ---------------------------------------------------------------------------
// Audit log storage (in-memory for now, plug in your DB)
// ---------------------------------------------------------------------------

interface AuditEntry {
  distributionId: string;
  operation: "root" | "fund";
  txid: string;
  signature: string;
  slot: number;
  blockTime: number | null;
  params: Record<string, unknown>;
  timestamp: string;
}

const auditLog: Map<string, AuditEntry[]> = new Map();
const distributionState: Map<
  string,
  { rootTx: string | null; fundTx: string | null }
> = new Map();

function logAudit(entry: AuditEntry): void {
  const entries = auditLog.get(entry.distributionId) || [];
  entries.push(entry);
  auditLog.set(entry.distributionId, entries);
}

// ---------------------------------------------------------------------------
// POST /distributions/:id/root
// ---------------------------------------------------------------------------

/**
 * Build initializeDistributor instruction, sign via Fireblocks, broadcast.
 */
export async function postRoot(
  distributionId: string,
  config: DistributionConfig,
  params: PostRootParams
): Promise<SigningResult> {
  const fbConfig = loadFireblocksConfig();
  const connection = new Connection(config.rpcUrl, "confirmed");

  const program = new anchor.Program(
    idl as any,
    config.programId,
    { connection } as any
  );

  const [distributorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("distributor"), config.mint.toBuffer()],
    config.programId
  );

  // Build the instruction
  const ix: TransactionInstruction = await program.methods
    .initializeDistributor(
      [...params.merkleRoot],
      params.totalAmount,
      params.startTs,
      params.endTs
    )
    .accounts({
      authority: config.authority,
      mint: config.mint,
      distributor: distributorPda,
    })
    .instruction();

  // Wrap in versioned transaction
  const tx = await buildVersionedTransaction({
    connection,
    feePayer: config.authority,
    instructions: [ix],
  });

  // Sign + broadcast via Fireblocks
  const result = await signAndBroadcast({
    connection,
    config: fbConfig,
    transaction: tx,
    note: `NBPT distribution ${distributionId}: post merkle root`,
  });

  // Record state
  const state = distributionState.get(distributionId) || {
    rootTx: null,
    fundTx: null,
  };
  state.rootTx = result.txid;
  distributionState.set(distributionId, state);

  // Audit
  logAudit({
    distributionId,
    operation: "root",
    txid: result.txid,
    signature: result.signature,
    slot: result.slot,
    blockTime: result.blockTime,
    params: {
      merkleRoot: params.merkleRoot.toString("hex"),
      totalAmount: params.totalAmount.toString(),
      startTs: params.startTs.toString(),
      endTs: params.endTs.toString(),
      distributorPda: distributorPda.toBase58(),
    },
    timestamp: new Date().toISOString(),
  });

  console.log(`[Orchestrator] Root posted for ${distributionId}: ${result.txid}`);
  return result;
}

// ---------------------------------------------------------------------------
// POST /distributions/:id/fund
// ---------------------------------------------------------------------------

/**
 * Build token transfer instruction, sign via Fireblocks, broadcast.
 */
export async function fundVault(
  distributionId: string,
  config: DistributionConfig,
  params: FundVaultParams
): Promise<SigningResult> {
  const fbConfig = loadFireblocksConfig();
  const connection = new Connection(config.rpcUrl, "confirmed");

  const [distributorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("distributor"), config.mint.toBuffer()],
    config.programId
  );

  const mintInfo = await getMint(
    connection,
    config.mint,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );

  const treasuryAta = await getAssociatedTokenAddress(
    config.mint,
    config.authority,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const vaultAta = await getAssociatedTokenAddress(
    config.mint,
    distributorPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  // Instructions: create vault ATA (idempotent) + transfer
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    config.authority,
    vaultAta,
    distributorPda,
    config.mint,
    TOKEN_2022_PROGRAM_ID
  );

  const transferIx = createTransferCheckedInstruction(
    treasuryAta,
    config.mint,
    vaultAta,
    config.authority,
    params.amount,
    mintInfo.decimals,
    [],
    TOKEN_2022_PROGRAM_ID
  );

  const tx = await buildVersionedTransaction({
    connection,
    feePayer: config.authority,
    instructions: [createAtaIx, transferIx],
  });

  const result = await signAndBroadcast({
    connection,
    config: fbConfig,
    transaction: tx,
    note: `NBPT distribution ${distributionId}: fund vault ${params.amount}`,
  });

  // Record state
  const state = distributionState.get(distributionId) || {
    rootTx: null,
    fundTx: null,
  };
  state.fundTx = result.txid;
  distributionState.set(distributionId, state);

  // Audit
  logAudit({
    distributionId,
    operation: "fund",
    txid: result.txid,
    signature: result.signature,
    slot: result.slot,
    blockTime: result.blockTime,
    params: {
      amount: params.amount.toString(),
      vaultAta: vaultAta.toBase58(),
      treasuryAta: treasuryAta.toBase58(),
    },
    timestamp: new Date().toISOString(),
  });

  console.log(`[Orchestrator] Vault funded for ${distributionId}: ${result.txid}`);
  return result;
}

// ---------------------------------------------------------------------------
// GET /distributions/:id/status
// ---------------------------------------------------------------------------

/**
 * Fetch current distribution status from on-chain state + local audit log.
 */
export async function getStatus(
  distributionId: string,
  config: DistributionConfig
): Promise<DistributionStatus> {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const state = distributionState.get(distributionId);

  const [distributorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("distributor"), config.mint.toBuffer()],
    config.programId
  );

  // Try to fetch on-chain state
  try {
    const program = new anchor.Program(
      idl as any,
      config.programId,
      { connection } as any
    );

    const distributor = await program.account.distributor.fetch(distributorPda);

    return {
      distributionId,
      rootTx: state?.rootTx || null,
      fundTx: state?.fundTx || null,
      totalAmount: distributor.totalAmount.toString(),
      claimedAmount: distributor.claimedAmount.toString(),
      claimsCount: distributor.claimsCount.toNumber(),
      window: {
        start: new Date(distributor.startTs.toNumber() * 1000).toISOString(),
        end: new Date(distributor.endTs.toNumber() * 1000).toISOString(),
      },
    };
  } catch {
    // Distributor not yet created
    return {
      distributionId,
      rootTx: state?.rootTx || null,
      fundTx: state?.fundTx || null,
      totalAmount: "0",
      claimedAmount: "0",
      claimsCount: 0,
      window: { start: "", end: "" },
    };
  }
}

/**
 * Get the full audit trail for a distribution.
 */
export function getAuditTrail(distributionId: string): AuditEntry[] {
  return auditLog.get(distributionId) || [];
}
