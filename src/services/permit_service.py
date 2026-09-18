"""
NoblePort ETF — Permit Service Function

Reusable service module for the PermitStream → Dashboard → Blockchain Anchor flow.
Designed for integration with:
    - permit_monitor_live.py (live monitoring loop)
    - Dashboard API endpoints
    - Blockchain anchor worker
    - Notification / alert system
    - Audit logger

All functions are fail-closed: missing data raises, never silently passes.
"""

import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PERMIT_PATH = Path(__file__).resolve().parent.parent.parent / "permits" / "permits_output.json"

REQUIRED_DIGEST_FIELDS = {"type", "municipality", "body"}

RISK_THRESHOLD = 7  # risk_score above this triggers alert


# ---------------------------------------------------------------------------
# Core Service Functions
# ---------------------------------------------------------------------------

def load_permit(path: Path | None = None) -> dict[str, Any]:
    """
    Load, validate, extract KPIs, compute hash, and flag anomalies.

    Returns a structured object ready for dashboard, anchor worker,
    notifier, or audit logger consumption.

    Raises
    ------
    FileNotFoundError  – permit file missing
    ValueError         – JSON parse failure or invalid structure
    """
    permit_path = path or PERMIT_PATH

    if not permit_path.exists():
        raise FileNotFoundError(f"Permit file missing: {permit_path}")

    raw = permit_path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Permit file is not valid JSON: {exc}") from exc

    _validate_structure(data)

    digest = data["digest"]
    body = digest.get("body", "")
    sha = hashlib.sha256(body.encode("utf-8")).hexdigest()

    kpis = extract_kpis(data)
    anomalies = detect_anomalies(data, kpis)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "permit_id": data.get("permit_id", "unknown"),
        "body": body,
        "hash": sha,
        "blockchain_status": data.get("blockchain_status", "not_anchored"),
        "kpis": kpis,
        "anomalies": anomalies,
    }


def extract_kpis(data: dict[str, Any]) -> dict[str, Any]:
    """
    Pull operational intelligence from the permit digest.

    Returns compliance signals, financial value, risk rating,
    and oracle confirmation status — dashboard-grade data.
    """
    digest = data.get("digest", {})
    return {
        "permit_type": digest.get("type"),
        "municipality": digest.get("municipality"),
        "project_value": digest.get("value"),
        "contractor_verified": digest.get("contractor_verified", False),
        "oracle_confirmed": digest.get("oracle_confirmed", False),
        "risk_score": digest.get("risk_score", 0),
        "issue_date": digest.get("issue_date"),
        "expiry_date": digest.get("expiry_date"),
    }


def compute_permit_hash(body: str) -> str:
    """
    SHA-256 of the permit body. Never anchor raw body — always anchor hash.
    """
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Blockchain Anchor Support
# ---------------------------------------------------------------------------

def has_changed(new_hash: str, previous_hash: str | None) -> bool:
    """
    Only anchor when the permit body has actually changed.
    Returns True if new_hash differs from previous_hash.
    """
    if previous_hash is None:
        return True
    return new_hash != previous_hash


def build_anchor_record(permit_result: dict[str, Any]) -> dict[str, Any]:
    """
    Build the minimal record suitable for blockchain anchoring.
    Raw body stays in Postgres/IPFS; only the hash goes on-chain.
    """
    return {
        "permit_id": permit_result["permit_id"],
        "hash": permit_result["hash"],
        "timestamp": permit_result["timestamp"],
        "kpis_snapshot": {
            "permit_type": permit_result["kpis"]["permit_type"],
            "municipality": permit_result["kpis"]["municipality"],
            "risk_score": permit_result["kpis"]["risk_score"],
        },
    }


# ---------------------------------------------------------------------------
# Anomaly Detection
# ---------------------------------------------------------------------------

def detect_anomalies(data: dict[str, Any], kpis: dict[str, Any]) -> list[str]:
    """
    Flag operational anomalies. Fail-closed: unknown states are flagged.
    """
    anomalies: list[str] = []

    risk_score = kpis.get("risk_score", 0)
    if isinstance(risk_score, (int, float)) and risk_score > RISK_THRESHOLD:
        anomalies.append(f"HIGH_RISK: risk_score={risk_score} exceeds threshold={RISK_THRESHOLD}")

    if not kpis.get("contractor_verified"):
        anomalies.append("UNVERIFIED_CONTRACTOR: contractor_verified is false or missing")

    if not kpis.get("oracle_confirmed"):
        anomalies.append("ORACLE_NOT_CONFIRMED: oracle_confirmed is false or missing")

    blockchain_status = data.get("blockchain_status", "not_anchored")
    if blockchain_status not in ("anchored", "pending", "not_anchored"):
        anomalies.append(f"UNKNOWN_BLOCKCHAIN_STATUS: '{blockchain_status}'")

    return anomalies


# ---------------------------------------------------------------------------
# Notification Support
# ---------------------------------------------------------------------------

def should_alert(kpis: dict[str, Any]) -> bool:
    """
    Returns True if the permit warrants an immediate alert.
    """
    risk_score = kpis.get("risk_score", 0)
    return isinstance(risk_score, (int, float)) and risk_score > RISK_THRESHOLD


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_structure(data: dict[str, Any]) -> None:
    """
    Validate that the permit JSON has the required structure.
    Raises ValueError on any structural problem.
    """
    if not isinstance(data, dict):
        raise ValueError("Permit data must be a JSON object")

    if "digest" not in data:
        raise ValueError("Invalid permit structure: missing 'digest' key")

    digest = data["digest"]
    if not isinstance(digest, dict):
        raise ValueError("Invalid permit structure: 'digest' must be an object")

    missing = REQUIRED_DIGEST_FIELDS - set(digest.keys())
    if missing:
        raise ValueError(f"Invalid permit structure: digest missing fields: {sorted(missing)}")


# ---------------------------------------------------------------------------
# CLI / Direct Execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    try:
        path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
        result = load_permit(path)
        print(json.dumps(result, indent=2))
    except (FileNotFoundError, ValueError) as exc:
        logger.error("Permit load failed: %s", exc)
        sys.exit(1)
