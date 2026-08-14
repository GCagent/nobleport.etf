# CLAUDE.md

This file provides guidance for AI assistants working with the NoblePort ETF codebase.

## Project Overview

NoblePort ETF is a blockchain-enabled real estate ETF integration platform with Self-Sovereign Identity (SSI) support. It bridges traditional Exchange-Traded Funds with tokenized real estate assets, combining on-chain governance (Solidity smart contracts) with a Next.js/React frontend and multi-AI orchestration via MCP (Model Context Protocol).

**Author:** Noble Port Realty
**License:** UNLICENSED (private)

## Tech Stack

- **Framework:** Next.js 14 (React 18, TypeScript 5)
- **Styling:** Tailwind CSS 3.4, PostCSS, Autoprefixer
- **Blockchain:** ethers.js 6.10, Solidity ^0.8.20 (OpenZeppelin contracts)
- **Identity:** did-resolver 4.1, ens-did-resolver 1.0
- **Linting:** ESLint 8 with eslint-config-next

## Commands

```bash
npm run dev          # Start Next.js development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Lint TypeScript/TSX files in src/
npm run type-check   # Run TypeScript type checking (tsc --noEmit)
```

There is no test framework configured. No CI/CD pipeline exists.

## Repository Structure

```
/
├── contracts/                         # Solidity smart contracts
│   ├── HumanApprovalGateway.sol       # Mandatory human-in-the-loop governance
│   └── MassachusettsBuildingPermits.sol  # MA building permit tracking (780 CMR)
├── src/
│   ├── components/
│   │   ├── StephanieAINetworkHub.tsx  # AI platform dashboard (MCP connections)
│   │   └── NoblePortSSIArchitecture.tsx  # SSI/ENS DID resolver UI
│   ├── lib/
│   │   ├── stephanieAI.ts             # AI orchestration engine (Stephanie.ai)
│   │   └── ensDidResolver.ts          # ENS-based DID resolution library
│   └── index.ts                       # Application entry point
├── mcp.config.json                    # MCP server config (13 AI platforms, 12 modules)
├── package.json
└── README.md
```

## Architecture

### Core Layers

1. **Smart Contracts (`contracts/`)** - On-chain governance and permit tracking. Both contracts use OpenZeppelin's AccessControl, ReentrancyGuard, and Pausable patterns. The HumanApprovalGateway enforces that all legal, medical, and financial decisions require explicit human sign-off with no bypass mechanism.

2. **Core Libraries (`src/lib/`)** - Two key modules:
   - `stephanieAI.ts`: Central AI orchestration hub connecting 13 AI platforms (Claude, ChatGPT, Grok, Gemini, Llama, Replit, Mistral, Cohere, Perplexity, Hugging Face, Together AI, Groq, DeepSeek) and 12 NoblePort modules via MCP protocol. Exports `StephanieAI` class and `createStephanieAI()` factory.
   - `ensDidResolver.ts`: ENS-to-DID resolution for SSI. Exports `didResolver`, `resolveEnsDid()`, `resolveEnsAddress()`, `getEnsTextRecords()`, and `NOBLEPORT_ENS` constants.

3. **UI Components (`src/components/`)** - React client components (`'use client'`) using hooks (`useState`, `useEffect`, `useCallback`). Styled with Tailwind CSS utility classes.

### Module Network (ENS Domains)

The platform operates 12 on-chain modules, each with an ENS subdomain under `nobleport.eth`:

| Module | ENS Domain | Purpose |
|--------|-----------|---------|
| Portfolio Manager | portfolio.nobleport.eth | Asset valuation, rebalancing |
| Operations Monitor | operations.nobleport.eth | Health monitoring, anomaly detection |
| Compliance Engine | compliance.nobleport.eth | Regulatory filing, KYC/AML |
| NBPT Governance | governance.nobleport.eth | Voting, staking, fee management |
| Investor Portal | investors.nobleport.eth | Account management, reporting |
| Authorized Participants | ap.nobleport.eth | Basket creation/redemption |
| Holdings Dashboard | holdings.nobleport.eth | Transparency, NAV display |
| Oracle Network | oracle.nobleport.eth | Price feeds, valuation updates |
| Custodian Bridge | custodian.nobleport.eth | Key management, multi-sig |
| Bookkeeper Ops | bookkeeper.nobleport.eth | Transaction recording, reconciliation |
| CPA Operations | cpa.nobleport.eth | Tax, auditing, financials |
| SSI Identity | identity.nobleport.eth | DID resolution, credential verification |

## Code Conventions

### Naming

- **Files:** camelCase (`stephanieAI.ts`, `ensDidResolver.ts`)
- **Components:** PascalCase (`StephanieAINetworkHub`, `NoblePortSSIArchitecture`)
- **Constants:** UPPER_SNAKE_CASE (`NOBLEPORT_MODULES`, `AI_PLATFORM_CONNECTIONS`)
- **Interfaces:** PascalCase, descriptive (`MCPConnection`, `ModuleConnection`, `AITaskRequest`, `AITaskResponse`)

### Patterns

- Factory pattern for class instantiation (`createStephanieAI()`)
- Interface-based design with TypeScript for type safety
- JSDoc comments with `@param`, `@returns`, `@example` on public APIs
- React functional components with hooks (no class components)
- Smart contracts use OpenZeppelin RBAC, reentrancy guards, and pausability

### React Conventions

- All interactive components marked with `'use client'` directive
- State management via React hooks (`useState`, `useEffect`, `useCallback`)
- Component prop interfaces defined (e.g., `PlatformCardProps`, `ModuleCardProps`)
- Tailwind CSS utility classes for styling (no CSS modules or styled-components)

### Solidity Conventions

- SPDX license identifiers on all contracts
- Pragma `solidity ^0.8.20`
- OpenZeppelin imports for access control, security, and pausability
- Enum-based state management
- Struct-based data organization
- Role-based access control (RBAC) with granular roles

## Environment Variables

Required environment variables (set in `.env.local` or equivalent):

```bash
# Ethereum Provider (at least one required)
NEXT_PUBLIC_INFURA_ID=        # Infura project ID
NEXT_PUBLIC_ALCHEMY_KEY=      # Alchemy API key (alternative)

# AI Platform API Keys (for MCP connections)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
XAI_API_KEY=
GOOGLE_AI_API_KEY=
META_AI_API_KEY=
REPLIT_API_KEY=
MISTRAL_API_KEY=
COHERE_API_KEY=
PERPLEXITY_API_KEY=
HUGGINGFACE_API_KEY=
TOGETHER_API_KEY=
GROQ_API_KEY=
DEEPSEEK_API_KEY=
```

## Key Considerations for AI Assistants

- This is a **financial/regulatory application** (SEC-registered ETF under the Investment Company Act of 1940). Changes to compliance, governance, or approval logic require extra care.
- The `HumanApprovalGateway` contract enforces a **no-bypass invariant** for human approval of critical decisions. Never introduce code paths that circumvent this.
- The MCP configuration in `mcp.config.json` defines task routing rules (e.g., code generation routes to Claude/ChatGPT/Replit/DeepSeek; compliance review routes to Claude/Mistral). Respect these routing conventions when modifying AI integration code.
- Security config specifies DID-based auth, TLS 1.3 transport, and AES-256-GCM at rest. Maintain these standards in any new infrastructure code.
- No test suite exists. When adding new functionality, consider whether tests should accompany the change.
