"""
CYBORG.IO — Quantum Threat Intelligence Module
Based on: Top Quantum-Attack Scenarios and Protective Measures (2025)
Source corpus + primary-source citations: docs/quantum-attack-tests-2025.md
(PDF on file at docs/quantum-attack-tests-2025.pdf)
Evaluates the NoblePort/CYBORG.IO platform's cryptographic posture
against 10 documented quantum attack vectors.
"""
from __future__ import annotations
from typing import Any

# Where the underlying research, metrics, and citations live. Served in the
# summary so dashboard consumers can trace every figure to its source.
SOURCE_DOCUMENT = "cyborg/nvapi/docs/quantum-attack-tests-2025.md"

# ─── Threat Matrix ─────────────────────────────────────────────────────────────
# Each entry maps the PDF's attack scenarios to CYBORG.IO platform context.
THREAT_MATRIX: list[dict[str, Any]] = [
    {
        "id": 1,
        "attack": "Shor's Algorithm — RSA-2048 Factoring",
        "risk_score": 7,
        "severity": "HIGH",
        "qubit_estimate": "<1M noisy qubits (Gidney 2025)",
        "time_estimate": "<1 week on fault-tolerant device",
        "platform_exposure": [
            "TLS certificates on API gateway",
            "JWT signing if RSA-based",
            "Any RSA key exchange in NVAPI calls",
        ],
        "mitigation": "Migrate to ML-KEM (Kyber) for key encapsulation. Use 4096-bit RSA during transition. Limit key lifetimes.",
        "nobleport_status": "REVIEW",  # SECURE | REVIEW | VULNERABLE
        "nobleport_action": "Audit all TLS certs and JWT configs — replace RSA with hybrid ECC+PQC",
    },
    {
        "id": 2,
        "attack": "Shor's Algorithm — ECC/ECDSA (secp256k1/P-256)",
        "risk_score": 8,
        "severity": "VERY_HIGH",
        "qubit_estimate": "~370,000 physical qubits",
        "time_estimate": "8–12 hours on fault-tolerant device",
        "platform_exposure": [
            "Ethereum/Arbitrum wallet signatures (secp256k1)",
            "Solana wallet keys (Ed25519 — less vulnerable)",
            "Smart contract ownership keys",
            "NBPT token holder wallets",
            "MetaMask / WalletConnect sessions",
        ],
        "mitigation": "Implement hybrid wallets combining ECDSA + ML-DSA. Monitor Ethereum PQC roadmap. Use multi-sig with threshold schemes.",
        "nobleport_status": "VULNERABLE",
        "nobleport_action": "CRITICAL — All blockchain wallet keys use secp256k1. Begin hybrid signature implementation immediately.",
    },
    {
        "id": 3,
        "attack": "Harvest-Now / Decrypt-Later",
        "risk_score": 9,
        "severity": "CRITICAL",
        "qubit_estimate": "<1M qubits (near-term)",
        "time_estimate": "Q-day estimated 2030–2035",
        "platform_exposure": [
            "Encrypted API payloads in transit today",
            "Stored Stripe/PayPal transaction records",
            "RWA tokenization documents",
            "Construction permit and real estate data archives",
            "NVAPI key traffic logs",
        ],
        "mitigation": "Implement PQC forward secrecy (ML-KEM in TLS). Re-encrypt long-term archives. Shorten certificate lifetimes. Rotate NVAPI keys frequently.",
        "nobleport_status": "REVIEW",
        "nobleport_action": "Enable PQC-hybrid TLS. Audit data archives — anything confidential beyond 2030 must be re-encrypted or destroyed.",
    },
    {
        "id": 4,
        "attack": "Grover's Algorithm — AES Symmetric Key Search",
        "risk_score": 5,
        "severity": "MODERATE",
        "qubit_estimate": "2^64 ops for AES-128 → 64-bit security",
        "time_estimate": "AES-256 remains secure (128-bit PQ security)",
        "platform_exposure": [
            "Database encryption (Supabase at-rest)",
            "Vault KV-v2 encryption",
            "Local .env secret encryption",
        ],
        "mitigation": "Use AES-256 everywhere. Upgrade any AES-128 instances. Rotate keys regularly.",
        "nobleport_status": "SECURE",
        "nobleport_action": "Verify Supabase and Vault use AES-256. Upgrade any AES-128 configs.",
    },
    {
        "id": 5,
        "attack": "Grover's Algorithm — Hash Preimage Attacks",
        "risk_score": 5,
        "severity": "MODERATE",
        "qubit_estimate": "2^(n/2) steps — SHA-256 drops to 128-bit",
        "time_estimate": "SHA-256/SHA-512 remain viable; SHA-224 unacceptable",
        "platform_exposure": [
            "Smart contract keccak256 hashing",
            "API request signing/verification",
            "Password hashing (if bcrypt/PBKDF2 used)",
        ],
        "mitigation": "Use SHA-256 minimum; prefer SHA-512. Combine password hashes with Argon2 + salt. Avoid SHA-224 or MD5 anywhere.",
        "nobleport_status": "REVIEW",
        "nobleport_action": "Audit all hashing — ensure SHA-256+ everywhere. Migrate passwords to Argon2id.",
    },
    {
        "id": 6,
        "attack": "BHT Quantum Collision Attack on Hash Functions",
        "risk_score": 3,
        "severity": "LOW",
        "qubit_estimate": "~2^85 quantum memory elements (impractical)",
        "time_estimate": "Theoretically interesting; not feasible",
        "platform_exposure": [
            "Merkle tree structures in smart contracts",
            "IPFS content addressing",
        ],
        "mitigation": "Use SHA-384 or SHA-512 for collision-sensitive contexts. Avoid truncated hashes. Use HMAC for keyed contexts.",
        "nobleport_status": "SECURE",
        "nobleport_action": "Low priority — monitor. Prefer SHA-512 in new Merkle/IPFS implementations.",
    },
    {
        "id": 7,
        "attack": "Simon's Algorithm — Block Cipher Structures (Even-Mansour / 3-round Feistel)",
        "risk_score": 2,
        "severity": "VERY_LOW",
        "qubit_estimate": "Polynomial time on toy constructions only",
        "time_estimate": "Not applicable to AES / ChaCha20",
        "platform_exposure": [
            "Only relevant if custom cipher modes are used",
        ],
        "mitigation": "Use full-round AES or ChaCha20 — already immune. Avoid custom cipher constructions.",
        "nobleport_status": "SECURE",
        "nobleport_action": "No action required — platform uses AES/ChaCha20.",
    },
    {
        "id": 8,
        "attack": "BV-Based Quantum Differential Cryptanalysis",
        "risk_score": 4,
        "severity": "LOW_MODERATE",
        "qubit_estimate": "Quadratic speedup vs classical differential attacks",
        "time_estimate": "No practical attack on AES yet",
        "platform_exposure": [
            "Custom cryptographic protocols if implemented",
            "Any non-standard cipher modes in smart contracts",
        ],
        "mitigation": "Use ciphers with high round counts and large S-boxes. Avoid custom cipher designs.",
        "nobleport_status": "SECURE",
        "nobleport_action": "Low priority — no custom ciphers in platform. Monitor research.",
    },
    {
        "id": 9,
        "attack": "Variational Quantum Attack (VQAA) on Symmetric Ciphers",
        "risk_score": 5,
        "severity": "MODERATE",
        "qubit_estimate": "Similar to Grover; sometimes faster on toy ciphers",
        "time_estimate": "Unproven for production key sizes; emerging threat",
        "platform_exposure": [
            "AES-256 encrypted data stores",
            "ChaCha20-Poly1305 API transport",
        ],
        "mitigation": "Use AES-256 / ChaCha20 with 256-bit keys. Monitor NIST PQC updates. Plan cryptographic agility.",
        "nobleport_status": "REVIEW",
        "nobleport_action": "Monitor VQAA research. Ensure cryptographic agility — ability to swap ciphers without platform rewrite.",
    },
    {
        "id": 10,
        "attack": "Quantum Side-Channel & Machine-Learning Attacks",
        "risk_score": 7,
        "severity": "HIGH",
        "qubit_estimate": "Implementation-dependent; no fixed estimate",
        "time_estimate": "Risk grows with quantum hardware availability",
        "platform_exposure": [
            "NVAPI key handling in memory",
            "Vault token in process memory",
            "Stripe/PayPal webhook processing",
            "Smart contract execution timing",
        ],
        "mitigation": "Apply constant-time coding. Use HSMs or secure enclaves for key storage. Noise injection. Monitor side-channel research.",
        "nobleport_status": "REVIEW",
        "nobleport_action": "Implement constant-time key comparisons. Evaluate HSM for NVAPI key storage. Harden Docker container isolation.",
    },
]

# ─── Severity ordering ────────────────────────────────────────────────────────
SEVERITY_ORDER = {
    "CRITICAL": 5,
    "VERY_HIGH": 4,
    "HIGH": 3,
    "MODERATE": 2,
    "LOW_MODERATE": 1,
    "LOW": 0,
    "VERY_LOW": 0,
}

STATUS_COLOR = {
    "VULNERABLE": "red",
    "REVIEW": "yellow",
    "SECURE": "green",
}


def get_threat_summary() -> dict[str, Any]:
    """Aggregate threat posture for the dashboard KPI panel."""
    total = len(THREAT_MATRIX)
    vulnerable = sum(1 for t in THREAT_MATRIX if t["nobleport_status"] == "VULNERABLE")
    review = sum(1 for t in THREAT_MATRIX if t["nobleport_status"] == "REVIEW")
    secure = sum(1 for t in THREAT_MATRIX if t["nobleport_status"] == "SECURE")
    avg_risk = round(sum(t["risk_score"] for t in THREAT_MATRIX) / total, 1)
    max_risk = max(t["risk_score"] for t in THREAT_MATRIX)
    critical_threats = [
        t for t in THREAT_MATRIX
        if t["nobleport_status"] in ("VULNERABLE", "REVIEW")
        and t["risk_score"] >= 7
    ]
    overall_status = (
        "CRITICAL" if vulnerable > 0
        else "REVIEW" if review > 0
        else "SECURE"
    )
    return {
        "overall_status": overall_status,
        "total_vectors": total,
        "vulnerable": vulnerable,
        "review_required": review,
        "secure": secure,
        "average_risk_score": avg_risk,
        "max_risk_score": max_risk,
        "critical_action_items": len(critical_threats),
        "top_priority": THREAT_MATRIX[1]["attack"],  # ECC/ECDSA — highest exposure for crypto platform
        "source_document": SOURCE_DOCUMENT,
    }


def get_threat_matrix() -> list[dict[str, Any]]:
    return sorted(THREAT_MATRIX, key=lambda t: -t["risk_score"])


def get_threat_by_id(threat_id: int) -> dict[str, Any] | None:
    return next((t for t in THREAT_MATRIX if t["id"] == threat_id), None)
