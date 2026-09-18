# CLAUDE.md

This file provides guidance for AI assistants working with the Noble Port ETF codebase.

## Project Overview

Noble Port ETF is a blockchain-enabled real estate Exchange-Traded Fund (ETF) platform that bridges traditional finance with decentralized technology. It enables institutional investors to gain exposure to tokenized real estate through familiar ETF structures with blockchain-backed transparency, compliance, and Self-Sovereign Identity (SSI) verification.

The project integrates:
- **Smart contracts** for on-chain governance and permit management
- **ENS-based DID resolution** for decentralized identity
- **AI orchestration** (Stephanie.ai) connecting 12 NoblePort modules to 13 AI platforms via Model Context Protocol (MCP)
- **Next.js dashboards** for SSI infrastructure and AI network management

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Next.js 14, React 18, TypeScript 5, Tailwind CSS 3.4 |
| Blockchain | Solidity 0.8.20, ethers.js 6.10, OpenZeppelin Contracts |
| Identity | did-resolver 4.1, ens-did-resolver 1.0, ENS DIDs (`did:ens:*`) |
| AI Orchestration | Model Context Protocol (MCP), 13 AI providers |
| Dev Tools | ESLint 8, PostCSS 8.4, Autoprefixer 10.4 |

## Project Structure

```
nobleport.etf/
├── CLAUDE.md                  # This file - AI assistant guidance
├── README.md                  # Comprehensive project documentation
├── package.json               # Dependencies and scripts
├── mcp.config.json            # AI orchestration configuration (13 platforms, 12 modules)
├── contracts/                 # Solidity smart contracts
│   ├── HumanApprovalGateway.sol         # Human-in-the-loop governance (~900 lines)
│   └── MassachusettsBuildingPermits.sol  # MA building permit system (~1250 lines)
└── src/
    ├── lib/
    │   ├── ensDidResolver.ts        # ENS DID resolution utilities
    │   └── stephanieAI.ts           # AI orchestration engine (Stephanie.ai)
    └── components/
        ├── NoblePortSSIArchitecture.tsx    # SSI dashboard component
        └── StephanieAINetworkHub.tsx       # AI network hub dashboard
```

## Common Commands

```bash
# Development
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run start        # Start production server

# Code Quality
npm run lint         # ESLint: src --ext .ts,.tsx
npm run type-check   # TypeScript: tsc --noEmit
```

There are no test scripts or test frameworks currently configured.

## Architecture Overview

### Smart Contracts

**HumanApprovalGateway.sol** — Enforces mandatory human approval for all legal, medical, and financial decisions. Core safety invariant: every sensitive decision MUST receive quorum-based human approval with written justification. No bypass mechanism exists.

Key design:
- Role-based access: `GOVERNANCE_ADMIN_ROLE`, `LEGAL_APPROVER_ROLE`, `MEDICAL_APPROVER_ROLE`, `FINANCIAL_APPROVER_ROLE`, `PROPOSER_ROLE`
- Minimum 2-human quorum per decision domain
- 1-hour mandatory cool-down between approval and execution
- 30-day maximum decision lifetime with automatic expiration
- Escalation increases quorum requirements
- Uses OpenZeppelin: AccessControl, ReentrancyGuard, Pausable, Counters

**MassachusettsBuildingPermits.sol** — Implements Massachusetts State Building Code (780 CMR) permit lifecycle on-chain. Supports 22 permit types, 12 inspection types, municipality registration, contractor license verification, fee calculations, and certificate of occupancy issuance.

Key design:
- Roles: `STATE_ADMIN_ROLE`, `MUNICIPALITY_ROLE`, `INSPECTOR_ROLE`, `CONTRACTOR_ROLE`
- IPFS document storage (hash references)
- Configurable fee multipliers per municipality
- Uses OpenZeppelin: AccessControl, ReentrancyGuard, Pausable, Counters

### Library Code

**ensDidResolver.ts** — ENS DID resolution for NoblePort's SSI infrastructure. Provides `resolveEnsDid()`, ENS name/address resolution, text record lookups, and NoblePort-specific helpers for root/ETF identity resolution. Uses Infura/Alchemy RPC providers configured via environment variables.

**stephanieAI.ts** — Central AI orchestration engine connecting 12 NoblePort modules to 13 AI platforms. Implements intelligent task routing (matching capabilities to platforms), automatic fallback chains, load balancing, and health monitoring. Core class: `StephanieAI` with factory function `createStephanieAI()`.

### React Components

**NoblePortSSIArchitecture.tsx** — Interactive dashboard for ENS DID resolution with quick-action buttons for predefined DIDs, custom ENS lookup, DID Document display, and architecture flow visualization.

**StephanieAINetworkHub.tsx** — Management dashboard for AI platform connections and NoblePort module network. Features tabbed navigation (Platforms / Modules / Architecture), platform health monitoring, and network topology visualization.

## Coding Conventions

### Solidity
- Use OpenZeppelin base contracts for security primitives (AccessControl, ReentrancyGuard, Pausable)
- Emit events for all state changes
- Use custom modifiers for validation checks
- Define rich structs and enums for domain modeling
- Use Counters for safe ID generation
- Solidity version: 0.8.20

### TypeScript
- Define interfaces for all configuration objects and API contracts
- Use async/await for all asynchronous operations
- Export factory functions for complex class instantiation (e.g., `createStephanieAI()`)
- Use `Map` collections for dynamic lookups
- Export all types for consumers
- Entry point: `src/index.ts`

### React
- Functional components with hooks (no class components)
- `useCallback` for memoized event handlers
- Controlled inputs with state management
- Conditional rendering for loading, error, and success states
- Tab-based navigation for multi-view components
- Tailwind CSS for styling with dark theme gradients

### General
- Configuration externalized to JSON files (see `mcp.config.json`)
- ENS-based identity (`did:ens:*`) used throughout for decentralized identification
- Clear separation: contracts, libraries, components in distinct directories
- No test framework currently configured

## Key Configuration

### MCP Configuration (`mcp.config.json`)
- **Identity**: `stephanie.nobleport.eth` / `did:ens:stephanie.nobleport.eth`
- **Root identity**: `nobleport.eth`
- **Default AI platform**: Claude (Anthropic)
- **Fallback chain**: Claude → ChatGPT → Gemini → Mistral
- **Load balancing**: Round-robin with priority
- **Health check interval**: 30 seconds
- **Security**: DID-based auth primary, API key fallback, TLS 1.3, AES-256-GCM at rest
- **Rate limits**: 1000 req/min, 1M tokens/min global

### Environment Variables
- `NEXT_PUBLIC_INFURA_ID` / `INFURA_PROJECT_ID` — Infura RPC provider
- `NEXT_PUBLIC_ALCHEMY_KEY` — Alchemy RPC provider
- AI platform API keys (referenced per-provider in `mcp.config.json`)

## Important Domain Concepts

- **ENS DID**: Decentralized Identifier grounded in Ethereum Name Service (`did:ens:name.eth`)
- **SSI**: Self-Sovereign Identity — users control their own credentials
- **MCP**: Model Context Protocol — standardized interface for AI platform communication
- **NoblePort Modules**: 12 independent services (Portfolio Manager, Compliance Engine, Bookkeeper, CPA, etc.), each with an ENS identity
- **Human Approval Gateway**: Critical safety mechanism — no autonomous execution of legal, medical, or financial decisions
- **780 CMR**: Massachusetts State Building Code governing the permit contract
- **NBPT**: NoblePort governance token

## Safety-Critical Invariants

1. **Human-in-the-loop**: The `HumanApprovalGateway` contract enforces that all legal, medical, and financial decisions require human quorum approval. Never modify this contract to allow autonomous execution or bypass mechanisms.
2. **Reentrancy protection**: All state-changing functions in contracts use `ReentrancyGuard`. Maintain this when adding new functions.
3. **Pausable operations**: Both contracts support emergency pause. Preserve this capability.
4. **Role-based access**: All privileged operations require specific roles. Do not add unprotected administrative functions.
5. **Written justification**: Approval votes require written reasoning. Do not remove this requirement.
