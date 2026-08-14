"""
Kuzo Platform — Contract Verification Worker Tasks

Submits deployed contracts to block-explorer verification APIs
(Etherscan, Arbiscan, etc.) and polls until a terminal status.

Instruments every step with Prometheus metrics:
  - VERIFY_JOB_TOTAL         jobs enqueued by chain
  - VERIFY_STATUS_TOTAL      final status by chain
  - VERIFY_POLL_ATTEMPTS     explorer poll rounds histogram
"""

import asyncio
import logging
import time
from typing import Any

from app.core.metrics import (
    VERIFY_JOB_TOTAL,
    VERIFY_POLL_ATTEMPTS,
    VERIFY_STATUS_TOTAL,
)
from app.core.metrics_worker import job_timer

logger = logging.getLogger("kuzo.worker.verify")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_POLL_ROUNDS = 40
POLL_INTERVAL = 5.0  # seconds between explorer API polls


# ---------------------------------------------------------------------------
# Explorer API helpers
# ---------------------------------------------------------------------------

async def _submit_verification(
    chain: str,
    explorer_url: str,
    explorer_api_key: str,
    contract_address: str,
    source: str,
    compiler_version: str,
    constructor_args: str,
) -> str:
    """Submit source for verification to a block explorer.

    Returns a ``guid`` (verification request ID) that can be polled.
    """
    logger.info(
        "Submitting verification chain=%s address=%s explorer=%s",
        chain, contract_address, explorer_url,
    )
    # placeholder — replace with actual HTTP call to explorer API
    return "guid-placeholder-0000"


async def _check_verification_status(
    explorer_url: str,
    explorer_api_key: str,
    guid: str,
) -> dict:
    """Poll the explorer for verification status.

    Returns ``{"status": "pending"|"verified"|"failed", "message": "..."}``
    """
    # placeholder
    return {"status": "verified", "message": "OK"}


# ---------------------------------------------------------------------------
# Main task
# ---------------------------------------------------------------------------

async def verify_contract(ctx: dict, payload: dict[str, Any]) -> dict[str, Any]:
    """Verify a deployed contract on its chain's block explorer.

    ``payload`` schema::

        {
            "dapp_id": "uuid",
            "chain": "ethereum",
            "contract_address": "0x...",
            "source": "pragma solidity ...",
            "compiler_version": "0.8.20",
            "constructor_args": "",
            "explorer_url": "https://api.etherscan.io/api",
            "explorer_api_key": "..."
        }
    """
    async with job_timer("verify_contract"):
        dapp_id = payload["dapp_id"]
        chain = payload["chain"]
        contract_address = payload["contract_address"]
        source = payload["source"]
        compiler_version = payload.get("compiler_version", "0.8.20")
        constructor_args = payload.get("constructor_args", "")
        explorer_url = payload["explorer_url"]
        explorer_api_key = payload.get("explorer_api_key", "")

        # Record that a verification job started for this chain
        VERIFY_JOB_TOTAL.labels(chain=chain).inc()

        logger.info(
            "verify_contract dapp_id=%s chain=%s address=%s",
            dapp_id, chain, contract_address,
        )

        # -- Submit -----------------------------------------------------------
        try:
            guid = await _submit_verification(
                chain=chain,
                explorer_url=explorer_url,
                explorer_api_key=explorer_api_key,
                contract_address=contract_address,
                source=source,
                compiler_version=compiler_version,
                constructor_args=constructor_args,
            )
        except Exception as exc:
            logger.exception("Verification submission failed: %s", exc)
            VERIFY_STATUS_TOTAL.labels(chain=chain, status="failed").inc()
            VERIFY_POLL_ATTEMPTS.observe(0)
            return {
                "dapp_id": dapp_id,
                "chain": chain,
                "status": "failed",
                "error": str(exc),
            }

        # -- Poll until terminal status --------------------------------------
        poll_count = 0
        final_status = "timeout"

        for attempt in range(1, MAX_POLL_ROUNDS + 1):
            poll_count = attempt
            await asyncio.sleep(POLL_INTERVAL)

            try:
                result = await _check_verification_status(
                    explorer_url=explorer_url,
                    explorer_api_key=explorer_api_key,
                    guid=guid,
                )
            except Exception as exc:
                logger.warning(
                    "Poll %d failed for guid=%s: %s", attempt, guid, exc
                )
                continue

            explorer_status = result.get("status", "pending")

            if explorer_status == "verified":
                final_status = "verified"
                break
            elif explorer_status == "failed":
                final_status = "failed"
                break
            # else: still pending — keep polling

        # -- Record metrics ---------------------------------------------------
        VERIFY_STATUS_TOTAL.labels(chain=chain, status=final_status).inc()
        VERIFY_POLL_ATTEMPTS.observe(poll_count)

        logger.info(
            "Verification complete dapp_id=%s chain=%s status=%s polls=%d",
            dapp_id, chain, final_status, poll_count,
        )

        return {
            "dapp_id": dapp_id,
            "chain": chain,
            "contract_address": contract_address,
            "status": final_status,
            "poll_attempts": poll_count,
        }
