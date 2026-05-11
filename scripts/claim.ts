/**
 * Execute a claim against the distributor.
 *
 * Two modes:
 *   - CLI mode: claim with a local keypair (devnet testing)
 *   - Library export: buildClaimInstruction() for frontend wallet integration
 *
 * Required env vars (CLI mode):
 *   DISTRIBUTOR_PROGRAM_ID
 *   DISTRIBUTION_MINT
 *   DISTRIBUTOR_PDA
 *   CLAIM_INDEX
 *   CLAIM_AMOUNT
 *   CLAIM_PROOF            (JSON array of hex strings)
 *   SOLANA_RPC_URL_DEVNET
 *   ANCHOR_WALLET
 */

import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
  TransactionInstruction,
} from "@solana/web3.js";
import idl from "../target/idl/noble_distributor.json";

const PROGRAM_ID = new PublicKey(
  process.env.DISTRIBUTOR_PROGRAM_ID || "Dist1111111111111111111111111111111111111"
);

/**
 * Build a claim instruction for use in frontend or CLI.
 *
 * This is the function retail users call from the browser wallet context.
 * The returned instruction can be added to a VersionedTransaction.
 */
export async function buildClaimInstruction(params: {
  programId: PublicKey;
  rpcUrl: string;
  claimant: PublicKey;
  mint: PublicKey;
  distributorPda: PublicKey;
  index: number;
  amount: anchor.BN;
  proof: number[][];
}): Promise<TransactionInstruction> {
  const connection = new Connection(params.rpcUrl, "confirmed");
  const dummyProvider = new anchor.AnchorProvider(
    connection,
    {
      publicKey: params.claimant,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any) => txs,
    } as any,
    { commitment: "confirmed" }
  );

  const program = new anchor.Program(idl as any, params.programId, dummyProvider);

  const [receiptPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("receipt"),
      params.distributorPda.toBuffer(),
      Buffer.from(new anchor.BN(params.index).toArray("le", 8)),
    ],
    params.programId
  );

  const ix = await program.methods
    .claim(
      new anchor.BN(params.index),
      params.amount,
      params.proof
    )
    .accounts({
      claimant: params.claimant,
      distributor: params.distributorPda,
      claimReceipt: receiptPda,
    })
    .instruction();

  return ix;
}

/**
 * CLI entry point — claim with local keypair for devnet testing.
 */
async function main() {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL_DEVNET!,
    "confirmed"
  );

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new anchor.Program(idl as any, PROGRAM_ID, provider);

  const mint = new PublicKey(process.env.DISTRIBUTION_MINT!);
  const distributorPda = new PublicKey(process.env.DISTRIBUTOR_PDA!);
  const index = parseInt(process.env.CLAIM_INDEX!);
  const amount = new anchor.BN(process.env.CLAIM_AMOUNT!);

  const proofHex: string[] = JSON.parse(process.env.CLAIM_PROOF!);
  const proof = proofHex.map((hex) => [...Buffer.from(hex, "hex")]);

  const [receiptPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("receipt"),
      distributorPda.toBuffer(),
      Buffer.from(new anchor.BN(index).toArray("le", 8)),
    ],
    PROGRAM_ID
  );

  console.log("Claiming from distributor...");
  console.log("  Claimant:   ", provider.wallet.publicKey.toBase58());
  console.log("  Distributor:", distributorPda.toBase58());
  console.log("  Index:      ", index);
  console.log("  Amount:     ", amount.toString());
  console.log("  Receipt PDA:", receiptPda.toBase58());

  const txid = await program.methods
    .claim(new anchor.BN(index), amount, proof)
    .accounts({
      claimant: provider.wallet.publicKey,
      distributor: distributorPda,
      claimReceipt: receiptPda,
    })
    .rpc({ commitment: "confirmed" });

  console.log("\nClaim successful.");
  console.log("  TxID:", txid);

  // Verify receipt was created
  const receipt = await program.account.claimReceipt.fetch(receiptPda);
  console.log("\nReceipt:");
  console.log("  Claimant:  ", receipt.claimant.toBase58());
  console.log("  Amount:    ", receipt.amount.toString());
  console.log("  Claimed at:", new Date(receipt.claimedAt.toNumber() * 1000).toISOString());
}

// Run CLI if executed directly
const isMainModule = require.main === module;
if (isMainModule) {
  main().catch((err) => {
    console.error("Claim failed:", err);
    process.exit(1);
  });
}
