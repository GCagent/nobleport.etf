# CYBORG.IO — NVAPI Gateway

FastAPI backend + HashiCorp Vault integration powering the **CYBORG.IO NVAPI Sandbox Control** dashboard, with live Quantum Threat Intelligence built from the 2025 NIST/IETF/Gidney research.

---

## Quick Start

```bash
# 1. Clone / copy this directory
cp .env.template .env

# 2. Add your NVIDIA API key
#    Get one at: https://integrate.api.nvidia.com
nano .env   # set NVAPI_KEY=nvapi-...

# 3. Launch everything (gateway + vault + vault-seeder)
docker compose up --build

# 4. Open dashboard
open dashboard.html   # point apiUrl to http://localhost:8080

# 5. Run /health endpoint from dashboard → all green
```

---

## Endpoints

### Core
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Gateway status, key source, env, kill switch state |
| GET | `/nv/health` | Ping NVIDIA API with latency |
| GET | `/nv/models` | List available NVIDIA NIM models |
| POST | `/nv/chat` | Raw chat inference via NVIDIA NIM |
| POST | `/nv/stephanie` | Stephanie.ai inference (NoblePort system prompt) |

### Telemetry
| Method | Path | Description |
|--------|------|-------------|
| GET | `/telemetry/stats` | Cumulative call stats, tokens, success rate |
| GET | `/telemetry/log` | Live call log stream (up to 500 entries) |
| DELETE | `/telemetry/reset` | Reset all counters |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/kill-switch` | Halt or resume all NVAPI calls |
| POST | `/admin/rotate-key` | Zero-downtime key rotation from Vault KV-v2 |

### Quantum Threat Intelligence
| Method | Path | Description |
|--------|------|-------------|
| GET | `/quantum/threat-level` | Aggregate threat posture summary |
| GET | `/quantum/matrix` | Full 10-vector attack matrix with NoblePort exposure |
| GET | `/quantum/threat/{id}` | Detail for a specific threat vector (1–10) |

---

## Architecture

```
dashboard.html          ← Browser UI (no build step)
       │
       │ HTTP (localhost:8080)
       ▼
 FastAPI Gateway  ──── Vault KV-v2 ──── NVAPI key
   app/main.py          :8200
   app/vault.py
   app/telemetry.py
   app/quantum.py       ← Quantum threat matrix (10 vectors)
   app/config.py
       │
       │ HTTPS
       ▼
 NVIDIA NIM API
 integrate.api.nvidia.com
```

---

## Quantum Threat Vectors (from PDF)

| # | Attack | Risk | NoblePort Status |
|---|--------|------|-----------------|
| 1 | Shor's — RSA-2048 | 7/10 | REVIEW |
| 2 | Shor's — ECC/ECDSA (secp256k1) | **8/10** | **VULNERABLE** |
| 3 | Harvest-Now / Decrypt-Later | **9/10** | REVIEW |
| 4 | Grover's — AES symmetric | 5/10 | SECURE |
| 5 | Grover's — Hash preimage | 5/10 | REVIEW |
| 6 | BHT — Hash collision | 3/10 | SECURE |
| 7 | Simon's — Block cipher structures | 2/10 | SECURE |
| 8 | BV-based differential cryptanalysis | 4/10 | SECURE |
| 9 | VQAA — Symmetric cipher attack | 5/10 | REVIEW |
| 10 | Quantum side-channel + ML attacks | 7/10 | REVIEW |

**Critical priority:** Attack #2 — all Ethereum/Arbitrum wallet keys use secp256k1, which requires ~370,000 qubits to break. Begin hybrid ECDSA+ML-DSA migration planning now.

---

## Production Notes

- Swap Vault dev token for **AppRole** or **AWS IAM** auth
- Run Vault in HA mode with Raft storage for production
- Enable TLS on the gateway (nginx reverse proxy included placeholder)
- Set `ENV=production` in .env
- Add rate limiting middleware for NVIDIA API quota protection
