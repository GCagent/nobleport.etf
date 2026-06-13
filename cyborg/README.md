# Cyborg.ai — Security, Inference & Voice Infrastructure

The Cyborg.ai surface of the NoblePort Systems ecosystem. Until this directory
landed, "Cyborg.ai" existed in the dashboard (compliance page, kill-switch
panels, audit-chain copy) as narrative only — the Operational Truth Matrix
classifies the compliance engine as MODELED. This directory adds the first
runnable Cyborg code: two deployable services, shipped as standalone Docker
stacks.

## Components

### `nvapi/` — CYBORG.IO NVAPI Gateway
FastAPI gateway in front of NVIDIA NIM (`integrate.api.nvidia.com`):

- **Inference:** `/nv/chat`, `/nv/stream`, and `/nv/stephanie(/stream)` —
  the Stephanie endpoints inject a NoblePort system prompt and stream via SSE.
- **Key custody:** NVAPI key held in HashiCorp Vault KV-v2
  (`secret/nobleport/nvapi/keys`) with zero-downtime rotation
  (`/admin/rotate-key`); env-var fallback for dev.
- **Kill switch:** `/admin/kill-switch` halts all upstream calls — the real
  counterpart to the dashboard's "Cyborg · kill switches" panel.
- **Telemetry:** per-call log, token counts, success rate (`/telemetry/*`).
- **Quantum threat intel:** `/quantum/*` serves a static 10-vector attack
  matrix (Shor's, Grover's, harvest-now/decrypt-later, …) built from 2025
  NIST/IETF/Gidney research, with per-vector NoblePort exposure notes.
  Source corpus and primary citations:
  [`nvapi/docs/quantum-attack-tests-2025.md`](./nvapi/docs/quantum-attack-tests-2025.md).

See [`nvapi/README.md`](./nvapi/README.md) for quick start, the full endpoint
table, and production notes (AppRole auth, TLS, rate limiting).

### `asr/` — Nemotron ASR Streaming Proxy
HTTP/WebSocket → Riva gRPC bridge for NVIDIA Nemotron ASR:

- OpenAI-compatible `POST /v1/audio/transcriptions` (file upload, any format
  via ffmpeg).
- `WS /ws/transcribe` for real-time mic streaming (16 kHz mono PCM).
- Runs alongside the Riva ASR NIM container (`docker compose up`).

### `site/` — cyborg.io internal status site
Static site (no build step) for the Cyborg.ai security surface. Notably it
already follows the repo's truth discipline in its copy: hero and KPI
sections are labeled "in active development, not yet in production,"
validator-mesh numbers are marked "placeholder targets, not measurements,"
and uptime/incident stats say "no production telemetry." An injected
third-party preview-harness script (screenshot capture + postMessage to the
site builder's origins) was stripped before committing. Open
`site/index.html` directly or serve the directory statically.

## How this maps to the ecosystem

| This code | Ecosystem touchpoint |
|-----------|----------------------|
| `/nv/stephanie` endpoints | An inference backend option for Stephanie.ai. Anything Stephanie *executes* (vs. answers) must still pass the governance gate (`backend/governance/stephanie_gate.py`) — this gateway does not bypass HITL. |
| Kill switch + telemetry | The real implementation behind the dashboard's Cyborg.ai compliance/kill-switch UI (`src/app/dashboard/compliance/`), which currently renders mock data. Wiring the UI to these endpoints is the natural next step. |
| ASR proxy | A self-hosted speech-to-text candidate for the voice intake path (currently LIVE on LiveKit + ElevenLabs per the Operational Truth Matrix). |
| Quantum threat matrix | MODELED research data — a static assessment dataset, **not** a live scanner. Its secp256k1 finding is real context for the wallet/zk roadmap in the [Attestation Registry](../docs/governance/attestation-registry-v1.md). |

## Honest status

Per `backend/config/operational_truth.py`:

| Feature | Status |
|---------|--------|
| `nvapi_gateway` | **STAGED** — built and runnable (`docker compose up`), needs an NVAPI key; not deployed to production |
| `asr_streaming_proxy` | **STAGED** — built and runnable; requires the Riva NIM container and an NGC key |
| `quantum_threat_matrix` | **MODELED** — static dataset, not live telemetry |

Secrets: both services read keys from `.env` (templates provided, gitignored)
or Vault. Nothing in this directory contains a real credential; the Vault
token in compose files is the documented dev-mode default and must be replaced
with AppRole/AWS auth before production.
