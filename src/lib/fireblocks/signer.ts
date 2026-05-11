/**
 * Fireblocks raw transaction signing for Solana.
 *
 * Pattern: build tx → serialize → Fireblocks signs → attach signature → broadcast.
 * Never let Fireblocks auto-broadcast. You lose deterministic control.
 *
 * Required env vars:
 *   FIREBLOCKS_API_KEY
 *   FIREBLOCKS_API_SECRET_PATH  (path to PEM file)
 *   FIREBLOCKS_VAULT_ACCOUNT_ID
 *   FIREBLOCKS_BASE_URL         (optional, defaults to production)
 */

import {
  Connection,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  PublicKey,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import * as fs from "fs";

// Fireblocks SDK types — imported dynamically to avoid hard dependency in devnet
interface FireblocksConfig {
  apiKey: string;
  apiSecretPath: string;
  vaultAccountId: string;
  baseUrl?: string;
}

interface SigningResult {
  txid: string;
  signature: string;
  slot: number;
  blockTime: number | null;
}

interface FireblocksTransactionResponse {
  id: string;
  status: string;
  signedMessages?: Array<{
    signature: {
      fullSig: string;
    };
  }>;
}

/**
 * Load Fireblocks configuration from environment.
 */
export function loadFireblocksConfig(): FireblocksConfig {
  const apiKey = process.env.FIREBLOCKS_API_KEY;
  const apiSecretPath = process.env.FIREBLOCKS_API_SECRET_PATH;
  const vaultAccountId = process.env.FIREBLOCKS_VAULT_ACCOUNT_ID;

  if (!apiKey || !apiSecretPath || !vaultAccountId) {
    throw new Error(
      "Missing Fireblocks env vars: FIREBLOCKS_API_KEY, FIREBLOCKS_API_SECRET_PATH, FIREBLOCKS_VAULT_ACCOUNT_ID"
    );
  }

  return {
    apiKey,
    apiSecretPath,
    vaultAccountId,
    baseUrl: process.env.FIREBLOCKS_BASE_URL || "https://api.fireblocks.io",
  };
}

/**
 * Build a VersionedTransaction from instructions.
 *
 * Uses v0 message format for address lookup table support.
 */
export async function buildVersionedTransaction(params: {
  connection: Connection;
  feePayer: PublicKey;
  instructions: TransactionInstruction[];
  lookupTables?: AddressLookupTableAccount[];
}): Promise<VersionedTransaction> {
  const { blockhash, lastValidBlockHeight } =
    await params.connection.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: params.feePayer,
    recentBlockhash: blockhash,
    instructions: params.instructions,
  }).compileToV0Message(params.lookupTables);

  return new VersionedTransaction(message);
}

/**
 * Submit a transaction to Fireblocks for raw signing.
 *
 * This does NOT broadcast. You get back the signature to attach manually.
 */
export async function submitToFireblocks(params: {
  config: FireblocksConfig;
  transaction: VersionedTransaction;
  note: string;
}): Promise<string> {
  const { FireblocksSDK } = await import("fireblocks-sdk");

  const apiSecret = fs.readFileSync(params.config.apiSecretPath, "utf-8");
  const fireblocks = new FireblocksSDK(
    apiSecret,
    params.config.apiKey,
    params.config.baseUrl
  );

  const serialized = Buffer.from(
    params.transaction.serialize()
  ).toString("base64");

  // Create a raw signing transaction
  const response = await fireblocks.createTransaction({
    operation: "RAW",
    source: {
      type: "VAULT_ACCOUNT" as any,
      id: params.config.vaultAccountId,
    },
    assetId: "SOL",
    note: params.note,
    extraParameters: {
      rawMessageData: {
        messages: [
          {
            content: serialized,
          },
        ],
      },
    },
  });

  return response.id;
}

/**
 * Poll Fireblocks for transaction completion.
 *
 * Polls every 2 seconds until COMPLETED, FAILED, or CANCELLED.
 * Max 120 seconds (60 polls).
 */
export async function waitForFireblocksCompletion(params: {
  config: FireblocksConfig;
  fireblocksId: string;
  maxPollAttempts?: number;
}): Promise<FireblocksTransactionResponse> {
  const { FireblocksSDK } = await import("fireblocks-sdk");

  const apiSecret = fs.readFileSync(params.config.apiSecretPath, "utf-8");
  const fireblocks = new FireblocksSDK(
    apiSecret,
    params.config.apiKey,
    params.config.baseUrl
  );

  const maxAttempts = params.maxPollAttempts || 60;
  const pollIntervalMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tx = await fireblocks.getTransactionById(params.fireblocksId);

    if (tx.status === "COMPLETED") {
      return tx as FireblocksTransactionResponse;
    }

    if (tx.status === "FAILED" || tx.status === "CANCELLED" || tx.status === "REJECTED") {
      throw new Error(
        `Fireblocks transaction ${params.fireblocksId} ended with status: ${tx.status}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Fireblocks transaction ${params.fireblocksId} timed out after ${maxAttempts * pollIntervalMs / 1000}s`
  );
}

/**
 * Full signing flow: submit → wait → attach signature → broadcast → confirm.
 *
 * This is the production pattern for custody-signed Solana transactions.
 */
export async function signAndBroadcast(params: {
  connection: Connection;
  config: FireblocksConfig;
  transaction: VersionedTransaction;
  note: string;
}): Promise<SigningResult> {
  // 1. Submit to Fireblocks
  console.log("[Fireblocks] Submitting for signing...");
  const fireblocksId = await submitToFireblocks({
    config: params.config,
    transaction: params.transaction,
    note: params.note,
  });
  console.log("[Fireblocks] Transaction ID:", fireblocksId);

  // 2. Wait for completion
  console.log("[Fireblocks] Waiting for signing completion...");
  const result = await waitForFireblocksCompletion({
    config: params.config,
    fireblocksId,
  });

  // 3. Extract signature
  const signedMessages = result.signedMessages;
  if (!signedMessages || signedMessages.length === 0) {
    throw new Error("No signed messages returned from Fireblocks");
  }
  const signatureHex = signedMessages[0].signature.fullSig;
  const signatureBytes = Buffer.from(signatureHex, "hex");

  // 4. Attach signature to transaction
  params.transaction.addSignature(
    params.transaction.message.staticAccountKeys[0], // fee payer
    signatureBytes
  );

  // 5. Broadcast — we control this, not Fireblocks
  console.log("[Fireblocks] Broadcasting transaction...");
  const txid = await params.connection.sendRawTransaction(
    params.transaction.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }
  );

  // 6. Confirm
  console.log("[Fireblocks] Confirming transaction:", txid);
  const confirmation = await params.connection.confirmTransaction(
    txid,
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(
      `Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  const txInfo = await params.connection.getTransaction(txid, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  return {
    txid,
    signature: signatureHex,
    slot: txInfo?.slot || 0,
    blockTime: txInfo?.blockTime || null,
  };
}
