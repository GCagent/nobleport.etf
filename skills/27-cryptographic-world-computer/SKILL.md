---
name: cryptographic-world-computer
description: Use to design Stephanie.ai as a cryptographic world computer. Off-chain execution, on-chain verification, human gates. Ethereum/NBPT is the trust and settlement computer, not the NoblePort database. Tags Fusaka as verified Ethereum protocol and keeps Glamsterdam, Hegotá, Lean consensus, and internal validator counts out of verified state.
---

# Cryptographic World Computer — Stephanie.ai

## Purpose
Adopt the architecture pattern now. Do not pretend a future Ethereum
protocol already exists, and do not make Ethereum store the NoblePort
business.

## When to use
- Stephanie Gateway, MCP, agent decomposition, or “world computer” language.
- Any claim about Fusaka, PeerDAS, ePBS, FOCIL, Lean consensus, or
  post-quantum identity.
- Validator counts, node counts, or operations-per-second from deployment PDFs.
- Construction payments that should end in a hash receipt, not a file dump
  on-chain.

## When NOT to use
- Authorizing payment, acquisition, or a filing. Humans do that.
- Marking SITE-236HIGH permitted, or tokenizing the halted 8-unit program.
- Treating this skill as a legal opinion.

## Path
NoblePort applications → Stephanie Gateway → MCP → off-chain execution →
evidence/proof → human authorization → Ethereum settlement/attestation.

Not: request → one giant model → one giant transaction → database or chain.

Doctrine: Stephanie first → policy engine → evidence verification →
human-in-the-loop → execution. An agent may calculate and recommend. It does
not receive authority to move money, sign a contract, or file.

## Six design rules
1. Proof over recomputation. Receipts and hashes, not a full rerun.
2. Parallelize independent work. Permit, cost, schedule, contract, insurance,
   and compliance run together where no dependency forces a sequence.
3. Keep large data off-chain. Plans, photos, contracts, video, telemetry, and
   retrieval documents stay in storage. The chain carries hashes, attestations,
   and final state transitions.
4. Separate execution from authority.
5. Make verification cheap relative to the original computation.
6. Cryptographic agility. Do not hard-code identity to one signature
   algorithm. Ethereum’s post-quantum work is pursuit, not a finished
   NoblePort control.

## Tags
These sit beside v1.0’s VERIFIED / STAGED / PROPOSED / BLOCKED. Do not
collapse them.

| Tag | Meaning here |
|---|---|
| VERIFIED | Fusaka/PeerDAS on Ethereum mainnet, 3 December 2025 (slot 13,164,544). Nodes sample blob availability. Protocol fact. NoblePort does not operate it. Also: Ethereum’s published roadmap pursues DA scaling, statelessness, censorship resistance, account abstraction, simplification, and post-quantum readiness. Pursuit is not completion. |
| STAGED | Proof-oriented receipts, parallel agents, minimum on-chain data, evidence anchoring, Gateway/MCP as the pattern, human approval gates. |
| PROPOSED | ZK proofs of NoblePort workflows, privacy-preserving permit/contract proofs, distributed provers, proof-carrying agent outputs, and any actual payment settlement. |
| RESEARCH | Glamsterdam (ePBS, block-level access lists): in development, not mainnet; ethereum.org lists a Q4 2026 target and dates move. Hegotá (FOCIL): in development, targeted 2027, not mainnet. Lean consensus / few-slot finality: no committed fork. |
| UNVERIFIED | Internal deployment artifacts. Not production proof. |

## Unverified — do not merge
- `steph_avatar_deploy_1B_20250808.pdf`: 3,012 CUDA A100/800 validators, 1.2 TB
  of assets, a canary rollout, 88 ms P95. Documented claim. Not evidence of
  3,012 physical validator machines.
- `Avatar_Deployment_80B_Report.pdf`: 3,212 live nodes and 621.78 billion
  operations/sec. Conflicts with the 3,012 figure. Reconcile against provider
  records and telemetry before either number is cited as fact.

## Payment shape
Invoice + contract + completed scope + inspection → independent checks in
parallel → compact approval package (hashes, amount, payee, exceptions) →
Stephanie policy (advisory) → human authorization → payment → immutable
receipt.

USDC may be discussed as the payment rail. NBPT is governance. Never mixed.
No yield on a payment stablecoin. Nothing in this skill releases funds.
SITE-236HIGH draw stays draft / human approval required. 8-unit tokenization
stays BLOCKED.

## Sources
- https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement
- https://ethereum.org/roadmap/fusaka/
- https://ethereum.org/roadmap/
- https://ethereum.org/roadmap/security/

## Guardrails
- Stephanie does not authorize acquisition.
- Nothing is labeled permitted without source evidence.
- Do not mark token products LIVE.
- Do not invent validator counts.
