import { strict as assert } from "assert";
import test from "node:test";
import {
  AgentCapability,
  AUTHORITY_MATRIX,
  defaultTierFor,
  EXECUTION_SAFE_TIERS,
  requiresHitl,
  TruthTier,
} from "../src/types/authority";

test("every capability has an authority matrix entry", () => {
  for (const cap of Object.values(AgentCapability)) {
    assert.ok(AUTHORITY_MATRIX[cap], `missing matrix entry for ${cap}`);
  }
});

test("recommendation and financial execution always require HITL", () => {
  assert.equal(requiresHitl(AgentCapability.L3_RECOMMEND_ACTION), true);
  assert.equal(requiresHitl(AgentCapability.L4_EXECUTE_FINANCIAL), true);
  assert.equal(requiresHitl(AgentCapability.L1_READ_ONLY), false);
  assert.equal(requiresHitl(AgentCapability.L2_DRAFT_PROPOSAL), false);
});

test("no capability may claim an execution-safe tier without HITL", () => {
  for (const cap of Object.values(AgentCapability)) {
    const { reqHitl, defaultTier } = AUTHORITY_MATRIX[cap];
    if (EXECUTION_SAFE_TIERS.has(defaultTier)) {
      assert.equal(
        reqHitl,
        true,
        `${cap} defaults to ${defaultTier} but does not require HITL`
      );
    }
  }
});

test("defaultTierFor matches the matrix", () => {
  assert.equal(
    defaultTierFor(AgentCapability.L2_DRAFT_PROPOSAL),
    TruthTier.T3_AGENT_PROPOSED
  );
});
