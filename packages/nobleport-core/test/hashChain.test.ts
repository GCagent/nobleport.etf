import { strict as assert } from "assert";
import test from "node:test";
import { CryptographicCore } from "../src/crypto/verify";
import {
  appendEntry,
  GENESIS_HASH,
  verifyChain,
} from "../src/ledger/hashChain";
import { TruthTier, TruthPayload } from "../src/types/authority";

async function buildChain(privateKey: Uint8Array, length: number) {
  const entries: TruthPayload[] = [];
  let previousHash = GENESIS_HASH;
  for (let i = 0; i < length; i++) {
    const { entry, currentHash } = await appendEntry(
      {
        entityId: "9c1f1c4e-0000-4000-8000-000000000001",
        entityType: "job",
        payload: { step: i, note: `update ${i}` },
        previousHash,
        tier: TruthTier.T3_AGENT_PROPOSED,
        timestamp: 1_750_000_000_000 + i,
      },
      privateKey
    );
    entries.push(entry);
    previousHash = currentHash;
  }
  return entries;
}

test("a well-formed chain verifies end to end", async () => {
  const { privateKey, publicKey } = CryptographicCore.generateKeyPair();
  const entries = await buildChain(privateKey, 4);
  const result = await verifyChain(entries, publicKey);
  assert.deepEqual(result, { valid: true });
});

test("tampering with a payload hash breaks verification at that index", async () => {
  const { privateKey, publicKey } = CryptographicCore.generateKeyPair();
  const entries = await buildChain(privateKey, 4);
  entries[2] = { ...entries[2], payloadHash: "f".repeat(64) };
  const result = await verifyChain(entries, publicKey);
  assert.equal(result.valid, false);
  assert.equal(result.failureIndex, 2);
});

test("reordering entries breaks hash linkage", async () => {
  const { privateKey, publicKey } = CryptographicCore.generateKeyPair();
  const entries = await buildChain(privateKey, 3);
  const swapped = [entries[0], entries[2], entries[1]];
  const result = await verifyChain(swapped, publicKey);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "broken hash linkage");
});

test("empty chain is trivially valid", async () => {
  const { publicKey } = CryptographicCore.generateKeyPair();
  assert.deepEqual(await verifyChain([], publicKey), { valid: true });
});
