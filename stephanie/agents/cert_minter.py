"""
Credential Minting Agent

Mints verifiable credentials (badges, diplomas, certificates) when
a learning topic reaches mastery threshold.

Flow:
  1. Check mastery score against threshold (0.85)
  2. Generate Manus proof (on-chain attestation reference)
  3. Build credential JSON (W3C Verifiable Credential schema)
  4. Mint via Agent Framework Foundry agent (durable, checkpointed)
  5. Return credential for wallet storage

Credentials follow the W3C VC Data Model 2.0 and are anchored
on-chain via the SSI Identity module (identity.nobleport.eth).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from langchain_core.messages import BaseMessage


# Mastery threshold for credential issuance
MASTERY_THRESHOLD = 0.85

# Credential types mapped to mastery levels
CREDENTIAL_LEVELS = {
    0.85: {"type": "Certificate", "level": "Proficient"},
    0.90: {"type": "Badge", "level": "Advanced"},
    0.95: {"type": "Diploma", "level": "Expert"},
    0.98: {"type": "Degree", "level": "Master"},
}


async def mint_credential(
    messages: list[BaseMessage],
    learning_state: dict[str, Any],
) -> dict[str, Any]:
    """
    Evaluate learning state and mint credentials for qualifying topics.

    Returns:
        response:    Human-readable summary
        credential:  W3C VC JSON if minted, empty dict if not eligible
        audit_entry: Audit trail entry
    """
    mastery_scores = learning_state.get("mastery_scores", {})
    last_topic = learning_state.get("last_topic", "")
    last_score = learning_state.get("last_score", 0)

    # Find all topics that qualify
    qualifying = {
        topic: score
        for topic, score in mastery_scores.items()
        if score >= MASTERY_THRESHOLD
    }

    if not qualifying:
        return {
            "response": f"No topics at mastery threshold ({MASTERY_THRESHOLD:.0%}). "
            f"Highest: {last_topic} at {last_score:.0%}.",
            "credential": {},
            "audit_entry": {
                "type": "cert_mint_attempt",
                "result": "below_threshold",
                "highest_topic": last_topic,
                "highest_score": last_score,
            },
        }

    # Mint for the highest-scoring topic
    best_topic = max(qualifying, key=qualifying.get)
    best_score = qualifying[best_topic]

    # Determine credential level
    cred_level = {"type": "Certificate", "level": "Proficient"}
    for threshold, level_info in sorted(CREDENTIAL_LEVELS.items()):
        if best_score >= threshold:
            cred_level = level_info

    # Build W3C Verifiable Credential
    credential = _build_verifiable_credential(
        topic=best_topic,
        score=best_score,
        cred_type=cred_level["type"],
        level=cred_level["level"],
    )

    return {
        "response": (
            f"Credential minted: {cred_level['type']} in {best_topic} "
            f"({cred_level['level']}, {best_score:.0%} mastery).\n"
            f"Credential ID: {credential['id']}"
        ),
        "credential": credential,
        "audit_entry": {
            "type": "cert_minted",
            "credential_id": credential["id"],
            "topic": best_topic,
            "score": best_score,
            "cred_type": cred_level["type"],
            "level": cred_level["level"],
        },
    }


def _build_verifiable_credential(
    topic: str,
    score: float,
    cred_type: str,
    level: str,
) -> dict[str, Any]:
    """
    Build a W3C Verifiable Credential JSON.

    In production, this is signed by the SSI Identity module
    and anchored on-chain via identity.nobleport.eth.
    """
    now = datetime.now(timezone.utc)
    cred_hash = hashlib.sha256(
        f"{topic}{score}{now.isoformat()}".encode()
    ).hexdigest()[:16]

    return {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://nobleport.eth/credentials/v1",
        ],
        "id": f"urn:uuid:nbpt-cred-{cred_hash}",
        "type": ["VerifiableCredential", f"NoblePort{cred_type}"],
        "issuer": {
            "id": "did:ens:stephanie.nobleport.eth",
            "name": "Stephanie.ai",
        },
        "issuanceDate": now.isoformat(),
        "credentialSubject": {
            "id": "did:ens:stephanie.nobleport.eth",
            "achievement": {
                "type": cred_type,
                "name": f"{cred_type} in {topic}",
                "description": f"{level}-level mastery of {topic}",
                "criteria": {
                    "narrative": f"Achieved {score:.0%} mastery through AGI learning cycles",
                },
                "level": level,
                "masteryScore": score,
                "topic": topic,
            },
        },
        "proof": {
            "type": "EnsLinkedDataSignature2024",
            "created": now.isoformat(),
            "verificationMethod": "did:ens:identity.nobleport.eth#key-1",
            "proofPurpose": "assertionMethod",
            "proofValue": f"0x{cred_hash}",  # Placeholder — real sig from SSI module
        },
    }
