"""
Kuzo Platform — IPFS Pinning & Arbitrum Anchoring Worker Tasks

Two-phase persistence:
  1. Pin artefact to IPFS via Pinata
  2. Anchor the CID on Arbitrum

Instruments every step with Prometheus metrics:
  - IPFS_PIN_TOTAL / IPFS_PIN_DURATION / IPFS_PIN_BYTES
  - ANCHOR_TOTAL / ANCHOR_DURATION / ANCHOR_GAS_USED
"""

import logging
import time
from typing import Any

from app.core.metrics import (
    ANCHOR_DURATION,
    ANCHOR_GAS_USED,
    ANCHOR_TOTAL,
    IPFS_PIN_BYTES,
    IPFS_PIN_DURATION,
    IPFS_PIN_TOTAL,
)
from app.core.metrics_worker import job_timer

logger = logging.getLogger("kuzo.worker.anchor")


# ---------------------------------------------------------------------------
# IPFS helpers (Pinata)
# ---------------------------------------------------------------------------

async def _pin_to_ipfs(data: bytes, name: str, pinata_jwt: str) -> dict:
    """Pin a blob to IPFS via the Pinata API.

    Returns ``{"cid": "Qm...", "size": 1234}``.
    In production this would use ``httpx`` to call the Pinata pinning API.
    """
    logger.info("Pinning %d bytes to IPFS as '%s'", len(data), name)
    # placeholder — replace with Pinata HTTP call
    return {
        "cid": "QmPlaceholder" + "0" * 34,
        "size": len(data),
    }


# ---------------------------------------------------------------------------
# Arbitrum helpers
# ---------------------------------------------------------------------------

async def _send_anchor_tx(
    cid: str,
    contract_address: str,
    rpc_url: str,
    signer_key: str,
) -> dict:
    """Call ``anchor(cid)`` on the Arbitrum anchoring contract.

    Returns ``{"tx_hash": "0x...", "gas_used": 123456}``.
    """
    logger.info("Anchoring CID=%s on Arbitrum contract=%s", cid, contract_address)
    # placeholder — replace with web3 / ethers logic
    return {
        "tx_hash": "0x" + "0" * 64,
        "gas_used": 0,
    }


async def _wait_for_anchor_receipt(rpc_url: str, tx_hash: str, timeout: int = 300) -> dict:
    """Poll for Arbitrum transaction receipt."""
    logger.info("Waiting for anchor receipt tx=%s", tx_hash)
    # placeholder
    return {"status": 1, "gasUsed": 0}


# ---------------------------------------------------------------------------
# Main task: pin + anchor
# ---------------------------------------------------------------------------

async def pin_and_anchor(ctx: dict, payload: dict[str, Any]) -> dict[str, Any]:
    """Pin artefact to IPFS then anchor CID on Arbitrum.

    ``payload`` schema::

        {
            "dapp_id": "uuid",
            "artefact": "<base64 or raw bytes reference>",
            "artefact_name": "metadata.json",
            "pinata_jwt": "...",
            "arbitrum_rpc_url": "https://...",
            "anchor_contract": "0x...",
            "signer_key_ref": "vault:anchor-key",
        }
    """
    async with job_timer("pin_and_anchor"):
        dapp_id = payload["dapp_id"]
        artefact = payload.get("artefact", b"")
        if isinstance(artefact, str):
            artefact = artefact.encode("utf-8")
        artefact_name = payload.get("artefact_name", "artefact")
        pinata_jwt = payload.get("pinata_jwt", "")
        arbitrum_rpc = payload.get("arbitrum_rpc_url", "")
        anchor_contract = payload.get("anchor_contract", "")
        signer_key = payload.get("signer_key_ref", "")

        result: dict[str, Any] = {"dapp_id": dapp_id}

        # -- Phase 1: IPFS Pin -----------------------------------------------
        pin_start = time.perf_counter()
        pin_status = "success"
        cid = ""

        try:
            pin_result = await _pin_to_ipfs(artefact, artefact_name, pinata_jwt)
            cid = pin_result["cid"]
            pin_size = pin_result.get("size", len(artefact))

            IPFS_PIN_BYTES.observe(pin_size)

            result["ipfs"] = {
                "cid": cid,
                "size": pin_size,
            }
        except Exception as exc:
            pin_status = "failed"
            logger.exception("IPFS pin failed for dapp_id=%s: %s", dapp_id, exc)
            result["ipfs"] = {"error": str(exc)}
        finally:
            pin_elapsed = time.perf_counter() - pin_start
            IPFS_PIN_TOTAL.labels(status=pin_status).inc()
            IPFS_PIN_DURATION.observe(pin_elapsed)

        # Bail if pinning failed — no point anchoring without a CID
        if pin_status == "failed":
            return result

        # -- Phase 2: Arbitrum Anchor -----------------------------------------
        anchor_start = time.perf_counter()
        anchor_status = "confirmed"
        gas_used = 0

        try:
            tx_result = await _send_anchor_tx(
                cid=cid,
                contract_address=anchor_contract,
                rpc_url=arbitrum_rpc,
                signer_key=signer_key,
            )

            receipt = await _wait_for_anchor_receipt(
                rpc_url=arbitrum_rpc,
                tx_hash=tx_result["tx_hash"],
            )

            if receipt.get("status") != 1:
                anchor_status = "failed"

            gas_used = receipt.get("gasUsed", tx_result.get("gas_used", 0))

            result["anchor"] = {
                "tx_hash": tx_result["tx_hash"],
                "gas_used": gas_used,
                "status": anchor_status,
            }
        except Exception as exc:
            anchor_status = "failed"
            logger.exception("Anchor failed for dapp_id=%s: %s", dapp_id, exc)
            result["anchor"] = {"error": str(exc)}
        finally:
            anchor_elapsed = time.perf_counter() - anchor_start
            ANCHOR_TOTAL.labels(status=anchor_status).inc()
            ANCHOR_DURATION.observe(anchor_elapsed)
            if gas_used > 0:
                ANCHOR_GAS_USED.observe(gas_used)

        return result
