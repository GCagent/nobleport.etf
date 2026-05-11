/**
 * Audit pack generator for NBPT distributions.
 *
 * Produces the institutional-grade artifact schema that Trail of Bits
 * and compliance auditors expect to see per distribution epoch.
 *
 * Schema:
 * {
 *   distribution_id, network, mint, merkle_root,
 *   total_amount, root_txid, fund_txid, block_height,
 *   rpc_commitment, claims[]
 * }
 */

import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import idl from "../../../target/idl/noble_distributor.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaimAuditEntry {
  index: number;
  wallet: string;
  amount: string;
  receipt_pda: string;
  claim_txid: string;
  claimed_at: string;
}

export interface AuditPack {
  distribution_id: string;
  network: "devnet" | "mainnet-beta";
  mint: string;
  mint_program: string;
  merkle_root: string;
  total_amount: string;
  claimed_amount: string;
  unclaimed_amount: string;
  root_txid: string;
  fund_txid: string;
  block_height: number;
  rpc_commitment: string;
  authority: string;
  distributor_pda: string;
  window: {
    start_ts: number;
    start_iso: string;
    end_ts: number;
    end_iso: string;
  };
  claims: ClaimAuditEntry[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a complete audit pack for a distribution epoch.
 *
 * Fetches all on-chain state and reconstructs the full claim history.
 */
export async function generateAuditPack(params: {
  distributionId: string;
  network: "devnet" | "mainnet-beta";
  programId: PublicKey;
  mint: PublicKey;
  rpcUrl: string;
  rootTxid: string;
  fundTxid: string;
}): Promise<AuditPack> {
  const connection = new Connection(params.rpcUrl, "confirmed");

  const program = new anchor.Program(
    idl as any,
    params.programId,
    { connection } as any
  );

  const [distributorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("distributor"), params.mint.toBuffer()],
    params.programId
  );

  // Fetch distributor state
  const distributor = await program.account.distributor.fetch(distributorPda);

  // Fetch the root tx for block height
  const rootTxInfo = await connection.getTransaction(params.rootTxid, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  // Fetch all ClaimReceipt accounts for this distributor
  const receiptAccounts = await program.account.claimReceipt.all([
    {
      memcmp: {
        offset: 8, // after discriminator
        bytes: distributorPda.toBase58(),
      },
    },
  ]);

  // Build claim entries with transaction IDs
  const claims: ClaimAuditEntry[] = [];

  for (const account of receiptAccounts) {
    const receipt = account.account;

    // Find the claim transaction by searching receipt PDA creation
    const signatures = await connection.getSignaturesForAddress(
      account.publicKey,
      { limit: 1 }
    );

    claims.push({
      index: (receipt.index as anchor.BN).toNumber(),
      wallet: (receipt.claimant as PublicKey).toBase58(),
      amount: (receipt.amount as anchor.BN).toString(),
      receipt_pda: account.publicKey.toBase58(),
      claim_txid: signatures.length > 0 ? signatures[0].signature : "unknown",
      claimed_at: new Date(
        (receipt.claimedAt as anchor.BN).toNumber() * 1000
      ).toISOString(),
    });
  }

  // Sort by index
  claims.sort((a, b) => a.index - b.index);

  const totalAmount = (distributor.totalAmount as anchor.BN).toString();
  const claimedAmount = (distributor.claimedAmount as anchor.BN).toString();
  const unclaimed = (
    (distributor.totalAmount as anchor.BN).sub(
      distributor.claimedAmount as anchor.BN
    )
  ).toString();

  const startTs = (distributor.startTs as anchor.BN).toNumber();
  const endTs = (distributor.endTs as anchor.BN).toNumber();

  return {
    distribution_id: params.distributionId,
    network: params.network,
    mint: params.mint.toBase58(),
    mint_program: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
    merkle_root: "0x" + Buffer.from(distributor.merkleRoot as number[]).toString("hex"),
    total_amount: totalAmount,
    claimed_amount: claimedAmount,
    unclaimed_amount: unclaimed,
    root_txid: params.rootTxid,
    fund_txid: params.fundTxid,
    block_height: rootTxInfo?.slot || 0,
    rpc_commitment: "confirmed",
    authority: (distributor.authority as PublicKey).toBase58(),
    distributor_pda: distributorPda.toBase58(),
    window: {
      start_ts: startTs,
      start_iso: new Date(startTs * 1000).toISOString(),
      end_ts: endTs,
      end_iso: new Date(endTs * 1000).toISOString(),
    },
    claims,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Validate an audit pack for internal consistency.
 */
export function validateAuditPack(pack: AuditPack): string[] {
  const errors: string[] = [];

  // Check amounts sum
  const claimed = BigInt(pack.claimed_amount);
  const unclaimed = BigInt(pack.unclaimed_amount);
  const total = BigInt(pack.total_amount);

  if (claimed + unclaimed !== total) {
    errors.push(
      `Amount mismatch: claimed(${claimed}) + unclaimed(${unclaimed}) != total(${total})`
    );
  }

  // Check claim count matches
  const claimSum = pack.claims.reduce((s, c) => s + BigInt(c.amount), 0n);
  if (claimSum !== claimed) {
    errors.push(
      `Claim sum mismatch: sum of claims(${claimSum}) != claimed_amount(${claimed})`
    );
  }

  // Check for duplicate indices
  const indices = new Set<number>();
  for (const claim of pack.claims) {
    if (indices.has(claim.index)) {
      errors.push(`Duplicate claim index: ${claim.index}`);
    }
    indices.add(claim.index);
  }

  // Check time window
  if (pack.window.end_ts <= pack.window.start_ts) {
    errors.push("Invalid time window: end <= start");
  }

  return errors;
}

/**
 * Export audit pack as formatted JSON string.
 */
export function serializeAuditPack(pack: AuditPack): string {
  return JSON.stringify(pack, null, 2);
}
