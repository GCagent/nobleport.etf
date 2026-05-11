/**
 * Fund the distributor vault with NBPT tokens.
 *
 * Builds the transfer instruction and either:
 *   - Sends directly (devnet with local keypair)
 *   - Outputs base64 for Fireblocks signing (mainnet)
 *
 * Required env vars:
 *   DISTRIBUTION_MINT
 *   DISTRIBUTOR_PDA
 *   TREASURY_PUBKEY
 *   FUND_AMOUNT           (base units)
 *   SOLANA_RPC_URL_DEVNET
 *   SIGNING_MODE           ("local" | "fireblocks")
 *   ANCHOR_WALLET          (only for local mode)
 */

import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ID,
  getMint,
} from "@solana/spl-token";
import * as fs from "fs";

async function main() {
  const rpc = process.env.SOLANA_RPC_URL_DEVNET!;
  const connection = new Connection(rpc, "confirmed");
  const signingMode = process.env.SIGNING_MODE || "local";

  const mint = new PublicKey(process.env.DISTRIBUTION_MINT!);
  const distributor = new PublicKey(process.env.DISTRIBUTOR_PDA!);
  const treasury = new PublicKey(process.env.TREASURY_PUBKEY!);
  const fundAmount = BigInt(process.env.FUND_AMOUNT!);

  // Fetch mint info for decimals
  const mintInfo = await getMint(
    connection,
    mint,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );

  const treasuryAta = await getAssociatedTokenAddress(
    mint,
    treasury,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const vaultAta = await getAssociatedTokenAddress(
    mint,
    distributor,
    true, // allowOwnerOffCurve — PDA-owned
    TOKEN_2022_PROGRAM_ID
  );

  console.log("Funding distributor vault...");
  console.log("  Mint:        ", mint.toBase58());
  console.log("  Distributor: ", distributor.toBase58());
  console.log("  Treasury:    ", treasury.toBase58());
  console.log("  Treasury ATA:", treasuryAta.toBase58());
  console.log("  Vault ATA:   ", vaultAta.toBase58());
  console.log("  Amount:      ", fundAmount.toString());
  console.log("  Decimals:    ", mintInfo.decimals);
  console.log("  Mode:        ", signingMode);

  // Create vault ATA if it doesn't exist
  const createVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    treasury, // payer
    vaultAta,
    distributor,
    mint,
    TOKEN_2022_PROGRAM_ID
  );

  // Build transfer instruction
  const transferIx = createTransferCheckedInstruction(
    treasuryAta,
    mint,
    vaultAta,
    treasury,
    fundAmount,
    mintInfo.decimals,
    [],
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new Transaction().add(createVaultAtaIx, transferIx);

  if (signingMode === "local") {
    // Devnet: sign with local keypair
    const walletPath = process.env.ANCHOR_WALLET!;
    const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const txid = await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: "confirmed",
    });

    console.log("\nVault funded.");
    console.log("  TxID:", txid);

    // Verify balance
    const balance = await connection.getTokenAccountBalance(vaultAta);
    console.log("  Vault balance:", balance.value.uiAmountString);
  } else {
    // Fireblocks: serialize for external signing
    tx.feePayer = treasury;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const serialized = tx
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    console.log("\nTransaction serialized for Fireblocks signing:");
    console.log(serialized);
    console.log(
      "\nSend this to Fireblocks raw signing endpoint. Do NOT auto-broadcast."
    );
  }
}

main().catch((err) => {
  console.error("Failed to fund vault:", err);
  process.exit(1);
});
