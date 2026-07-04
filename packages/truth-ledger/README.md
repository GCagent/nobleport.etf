# @nobleport/truth-ledger

Canonical PostgreSQL schema for the NoblePort six-tier truth standard.

## Contents

- `prisma/schema.prisma` — jobs, permits, agent sessions, HITL approvals, and
  the polymorphic `truth_ledger` hash chain.
- `prisma/migrations/0001_memory_embeddings/` — pgvector extension setup and
  the `memory_embeddings` table (1536-dim, HNSW cosine index) used by the
  RAG memory router.

## Usage

```bash
npm install
npm run validate            # prisma validate (no database required)
DATABASE_URL=... npm run migrate:deploy
```

## Design notes

- `truth_ledger.entity_id` is polymorphic across entity types, so there is no
  relational FK to `jobs`; chain integrity is enforced by
  `previous_hash` / `current_hash` / `signature` (see
  `@nobleport/core` `verifyChain`).
- `current_hash` is unique: two ledger rows can never claim the same chain
  position.
- Truth tiers are stored as strings matching the `TruthTier` enum in
  `@nobleport/core` — the TypeScript enum is the source of truth.
