/**
 * Initialize a distribution epoch on-chain.
 *
 * Reads the IDL, derives the distributor PDA, and posts the Merkle root.
 * Intended for execution via: npx ts-node scripts/init_distributor.ts
 *
 * Required env vars:
 *   DISTRIBUTOR_PROGRAM_ID
 *   DISTRIBUTION_MINT
 *   MERKLE_ROOT          (hex string, 64 chars)
 *   TOTAL_AMOUNT          (base units)
 *   START_TS              (unix timestamp)
 *   END_TS                (unix timestamp)
 *   ANCHOR_WALLET         (keypair path)
 *   SOLANA_RPC_URL_DEVNET (RPC endpoint)
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import idl from "../target/idl/noble_distributor.json";

const PROGRAM_ID = new PublicKey(process.env.DISTRIBUTOR_PROGRAM_ID!);

async function main() {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL_DEVNET!,
    "confirmed"
  );

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new anchor.Program(idl as any, PROGRAM_ID, provider);

  const mint = new PublicKey(process.env.DISTRIBUTION_MINT!);

  const [distributorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("distributor"), mint.toBuffer()],
    PROGRAM_ID
  );

  const merkleRoot = Buffer.from(process.env.MERKLE_ROOT!, "hex");
  if (merkleRoot.length !== 32) {
    throw new Error("MERKLE_ROOT must be 64 hex characters (32 bytes)");
  }

  const totalAmount = new anchor.BN(process.env.TOTAL_AMOUNT!);
  const startTs = new anchor.BN(process.env.START_TS!);
  const endTs = new anchor.BN(process.env.END_TS!);

  console.log("Initializing distributor...");
  console.log("  Program:     ", PROGRAM_ID.toBase58());
  console.log("  Mint:        ", mint.toBase58());
  console.log("  Distributor: ", distributorPda.toBase58());
  console.log("  Merkle root: ", process.env.MERKLE_ROOT!);
  console.log("  Total:       ", totalAmount.toString());
  console.log("  Window:      ", startTs.toString(), "→", endTs.toString());

  const txid = await program.methods
    .initializeDistributor(
      [...merkleRoot],
      totalAmount,
      startTs,
      endTs
    )
    .accounts({
      authority: provider.wallet.publicKey,
      mint,
      distributor: distributorPda,
    })
    .rpc({ commitment: "confirmed" });

  console.log("\nDistributor initialized.");
  console.log("  PDA:  ", distributorPda.toBase58());
  console.log("  TxID: ", txid);

  // Fetch and display on-chain state for verification
  const state = await program.account.distributor.fetch(distributorPda);
  console.log("\nOn-chain state:");
  console.log("  Authority:   ", state.authority.toBase58());
  console.log("  Total amount:", state.totalAmount.toString());
  console.log("  Claims:      ", state.claimsCount.toString());
}

main().catch((err) => {
  console.error("Failed to initialize distributor:", err);
  process.exit(1);
});
