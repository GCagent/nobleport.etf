"""
NoblePort ETF — Live Permit Monitor

Continuously monitors the permit file for changes and feeds structured data
into the dashboard, blockchain anchor worker, and notification pipeline.

Usage:
    python permit_monitor_live.py                     # default path, 30s interval
    python permit_monitor_live.py /path/to/permits.json --interval 10
"""

import argparse
import json
import logging
import time
import sys
from pathlib import Path

from permit_service import (
    load_permit,
    has_changed,
    build_anchor_record,
    should_alert,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Monitor Loop
# ---------------------------------------------------------------------------

def monitor(permit_path: Path | None = None, interval: int = 30) -> None:
    """
    Poll-based live monitor.

    Each cycle:
        1. Load and validate permit
        2. Extract KPIs + compute hash
        3. Compare hash to previous cycle
        4. If changed → queue anchor record, push dashboard update
        5. If anomalies → fire alerts
        6. Sleep
    """
    previous_hash: str | None = None

    logger.info("Permit monitor started — polling every %ds", interval)
    if permit_path:
        logger.info("Permit path override: %s", permit_path)

    while True:
        try:
            result = load_permit(permit_path)

            # --- Dashboard output (always) ---
            logger.info(
                "permit_id=%s  hash=%s…  blockchain=%s  anomalies=%d",
                result["permit_id"],
                result["hash"][:12],
                result["blockchain_status"],
                len(result["anomalies"]),
            )

            # --- Blockchain anchor (only on change) ---
            if has_changed(result["hash"], previous_hash):
                anchor = build_anchor_record(result)
                _queue_anchor(anchor)
                previous_hash = result["hash"]

            # --- Notifications (on anomaly) ---
            if should_alert(result["kpis"]):
                _send_alert(result)

            for anomaly in result["anomalies"]:
                logger.warning("ANOMALY: %s", anomaly)

        except FileNotFoundError:
            logger.warning("Permit file not found — waiting for next cycle")
        except ValueError as exc:
            logger.error("Permit validation failed: %s", exc)
        except Exception:
            logger.exception("Unexpected error in monitor cycle")

        time.sleep(interval)


# ---------------------------------------------------------------------------
# Integration Stubs — Replace With Real Implementations
# ---------------------------------------------------------------------------

def _queue_anchor(anchor_record: dict) -> None:
    """
    Enqueue an anchor record for the blockchain worker.

    In production, replace with:
        - Redis queue push
        - Celery task dispatch
        - Direct web3 contract call via MassachusettsBuildingPermits.sol
    """
    logger.info(
        "ANCHOR_QUEUED: permit_id=%s  hash=%s",
        anchor_record["permit_id"],
        anchor_record["hash"][:12],
    )


def _send_alert(result: dict) -> None:
    """
    Fire an alert for high-risk or anomalous permits.

    In production, replace with:
        - Slack webhook
        - PagerDuty event
        - Email via SES
        - Dashboard push notification
    """
    logger.warning(
        "ALERT: High-risk permit detected — permit_id=%s  risk_score=%s",
        result["permit_id"],
        result["kpis"].get("risk_score"),
    )


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="NoblePort Live Permit Monitor")
    parser.add_argument(
        "permit_path",
        nargs="?",
        default=None,
        help="Path to permits_output.json (default: project permits/ directory)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Polling interval in seconds (default: 30)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    path = Path(args.permit_path) if args.permit_path else None
    monitor(permit_path=path, interval=args.interval)


if __name__ == "__main__":
    main()
