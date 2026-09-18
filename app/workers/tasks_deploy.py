"""
Kuzo Platform — Deployment Worker Tasks

Handles smart-contract deployment jobs dispatched through the ARQ queue.
Instruments every step with Prometheus metrics:
  - DEPLOY_CHAIN_TOTAL          per-chain success / failed
  - DEPLOY_CHAIN_DURATION       per-chain deploy latency
  - DEPLOY_GAS_USED             gas distribution per chain
"""

import asyncio
import logging
import time
from typing import Any

from app.core.metrics import (
    DEPLOY_CHAIN_DURATION,
    DEPLOY_CHAIN_TOTAL,
    DEPLOY_GAS_USED,
)
from app.core.metrics_worker import job_timer

logger = logging.getLogger("kuzo.worker.deploy")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _compile_contract(source: str, compiler_version: str) -> dict:
    """Compile a Solidity source string.

    In a real implementation this would shell out to ``solc`` or call
    a compilation service.  Stubbed here for metric wiring.
    """
    logger.info("Compiling contract (solc %s)", compiler_version)
    # placeholder — replace with actual compilation logic
    return {"abi": [], "bytecode": "0x"}


async def _send_deploy_tx(
    chain: str,
    rpc_url: str,
    bytecode: str,
    constructor_args: list,
    deployer_key: str,
) -> dict:
    """Sign and broadcast a deployment transaction.

    Returns a dict with ``tx_hash``, ``contract_address``, ``gas_used``.
    """
    logger.info("Deploying to chain=%s via %s", chain, rpc_url)
    # placeholder — replace with web3 / ethers logic
    return {
        "tx_hash": "0x" + "0" * 64,
        "contract_address": "0x" + "0" * 40,
        "gas_used": 0,
    }


async def _wait_for_receipt(chain: str, rpc_url: str, tx_hash: str, timeout: int = 300) -> dict:
    """Poll for a transaction receipt until confirmed or timeout."""
    logger.info("Waiting for receipt chain=%s tx=%s", chain, tx_hash)
    # placeholder
    return {"status": 1, "gasUsed": 0}


# ---------------------------------------------------------------------------
# Main task
# ---------------------------------------------------------------------------

async def deploy_contract(ctx: dict, payload: dict[str, Any]) -> dict[str, Any]:
    """Deploy a compiled smart contract to one or more chains.

    ``payload`` schema::

        {
            "dapp_id": "uuid",
            "source": "pragma solidity ...",
            "compiler_version": "0.8.20",
            "chains": [
                {
                    "name": "ethereum",
                    "rpc_url": "https://...",
                    "constructor_args": [],
                }
            ],
            "deployer_key_ref": "vault:deployer-key",
        }
    """
    async with job_timer("deploy_contract"):
        dapp_id = payload["dapp_id"]
        source = payload["source"]
        compiler_version = payload.get("compiler_version", "0.8.20")
        chains = payload["chains"]
        deployer_key = payload.get("deployer_key_ref", "")

        logger.info("deploy_contract dapp_id=%s chains=%s", dapp_id, [c["name"] for c in chains])

        # -- 1. Compile -------------------------------------------------------
        compiled = await _compile_contract(source, compiler_version)
        bytecode = compiled["bytecode"]

        # -- 2. Deploy to each chain -----------------------------------------
        results: list[dict[str, Any]] = []

        for chain_cfg in chains:
            chain = chain_cfg["name"]
            rpc_url = chain_cfg["rpc_url"]
            constructor_args = chain_cfg.get("constructor_args", [])

            start = time.perf_counter()
            status = "success"
            gas_used = 0

            try:
                tx_result = await _send_deploy_tx(
                    chain=chain,
                    rpc_url=rpc_url,
                    bytecode=bytecode,
                    constructor_args=constructor_args,
                    deployer_key=deployer_key,
                )

                receipt = await _wait_for_receipt(
                    chain=chain,
                    rpc_url=rpc_url,
                    tx_hash=tx_result["tx_hash"],
                )

                if receipt.get("status") != 1:
                    status = "failed"

                gas_used = receipt.get("gasUsed", tx_result.get("gas_used", 0))

                results.append({
                    "chain": chain,
                    "status": status,
                    "tx_hash": tx_result["tx_hash"],
                    "contract_address": tx_result["contract_address"],
                    "gas_used": gas_used,
                })

            except Exception as exc:
                status = "failed"
                logger.exception("Deploy failed on chain=%s: %s", chain, exc)
                results.append({
                    "chain": chain,
                    "status": "failed",
                    "error": str(exc),
                })

            finally:
                elapsed = time.perf_counter() - start

                # -- Prometheus counters & histograms -------------------------
                DEPLOY_CHAIN_TOTAL.labels(chain=chain, status=status).inc()
                DEPLOY_CHAIN_DURATION.labels(chain=chain).observe(elapsed)
                if gas_used > 0:
                    DEPLOY_GAS_USED.labels(chain=chain).observe(gas_used)

        return {
            "dapp_id": dapp_id,
            "deployments": results,
        }


async def deploy_contract_single(ctx: dict, payload: dict[str, Any]) -> dict[str, Any]:
    """Convenience wrapper — deploy to a single chain.

    Normalises the payload so ``deploy_contract`` can handle it uniformly.
    """
    if "chains" not in payload and "chain" in payload:
        payload["chains"] = [
            {
                "name": payload.pop("chain"),
                "rpc_url": payload.pop("rpc_url"),
                "constructor_args": payload.pop("constructor_args", []),
            }
        ]
    return await deploy_contract(ctx, payload)
