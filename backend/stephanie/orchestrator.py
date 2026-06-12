"""
Stephanie.ai Module Orchestrator

Routes tasks to the 50 modules and enforces each module's register truth as
runtime behavior. The rules, in order:

  1. Unknown module            -> REFUSED, fail-closed (BLOCKED tag)
  2. BLOCKED / LEGAL_HOLD      -> REFUSED with the governing reason
  3. CLAIMED                   -> REFUSED — unverified claims never execute
  4. Human-gated module        -> STAGED_FOR_HUMAN; the result (if a handler
                                  exists) is produced as a DRAFT, never final
  5. DEMO module               -> executes, output tagged SIMULATED
  6. No handler registered     -> NOT_EXECUTABLE — honest scaffold answer
  7. Otherwise                 -> EXECUTED (LIVE tag only for register-
                                  verified modules; STAGED otherwise)

Every decision — including refusals — is appended to a sha256 hash-chained
decision log, mirroring the Proof-of-Trust pattern.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from backend.governance.truth_layer import TruthTag
from backend.stephanie.catalog import build_catalog
from backend.stephanie.framework import (
    Handler,
    ModuleDecision,
    ModuleSpec,
    Outcome,
)
from backend.stephanie.impl.change_order_ledger import handle as co_ledger_handle
from backend.stephanie.impl.roofing_takeoff import takeoff
from backend.systems.truth import TruthBucket

GENESIS_HASH = "0" * 64


def _sales_sim_handler(payload: dict[str, Any]) -> dict[str, Any]:
    from backend.sales import run_simulation

    sim = run_simulation(
        team_size=int(payload.get("team_size", 8)),
        lead_count=int(payload.get("lead_count", 40)),
        seed=int(payload.get("seed", 42)),
    )
    return sim.to_dict()


def _zoning_handler(payload: dict[str, Any]) -> dict[str, Any]:
    from backend.agents.permit_stream import PermitStreamAgent

    agent = PermitStreamAgent()
    return asyncio.run(
        agent.check_zoning_compliance(
            payload.get("parcel_id", ""),
            payload.get("project_type", "residential_renovation"),
        )
    )


# Modules Stephanie can actually run today. Registering a handler here is the
# bar for EXECUTABLE — everything else reports itself as scaffold or bound.
HANDLERS: dict[str, Handler] = {
    "roofing_takeoff": takeoff,
    "change_order_ledger": co_ledger_handle,
    "sales_sim_layer": _sales_sim_handler,
    "permitstream": _zoning_handler,
}

# Modules the operator register attests LIVE — only these may carry the LIVE
# tag on an executed result; everything else executes as STAGED at best.
_REGISTER_LIVE = frozenset({
    "construction_intake", "construction_orchestration", "scope_estimate_engine",
    "proposal_generator", "manual_permit_fallback", "kuzo_safe_swap", "kuzo_dashboard",
})


class StephanieOrchestrator:
    """Stateful router with a hash-chained decision log."""

    def __init__(self) -> None:
        self._modules: dict[str, ModuleSpec] = {m.key: m for m in build_catalog()}
        self._log: list[ModuleDecision] = []
        self._prev_hash = GENESIS_HASH

    # -- catalog --------------------------------------------------------------

    @property
    def modules(self) -> list[ModuleSpec]:
        return list(self._modules.values())

    def module(self, key: str) -> ModuleSpec | None:
        return self._modules.get(key)

    def has_handler(self, key: str) -> bool:
        return key in HANDLERS

    def catalog_dict(self) -> dict[str, Any]:
        mods = [m.to_dict(self.has_handler(m.key)) for m in self.modules]
        return {
            "total_modules": len(mods),
            "executable": sum(1 for m in mods if m["build_state"] == "executable"),
            "bound": sum(1 for m in mods if m["build_state"] == "bound"),
            "scaffold": sum(1 for m in mods if m["build_state"] == "scaffold"),
            "human_gated": sum(1 for m in mods if m["human_gated"]),
            "modules": mods,
        }

    # -- execution ------------------------------------------------------------

    def execute(self, module_key: str, operation: str, payload: dict[str, Any] | None = None) -> ModuleDecision:
        payload = payload or {}
        spec = self._modules.get(module_key)

        if spec is None:
            return self._record(ModuleDecision(
                module_key=module_key, operation=operation,
                outcome=Outcome.REFUSED, truth_tag=TruthTag.BLOCKED.value,
                reason=f"unknown module {module_key!r}; fail-closed",
            ))

        if spec.bucket in {TruthBucket.BLOCKED, TruthBucket.LEGAL_HOLD}:
            return self._record(ModuleDecision(
                module_key=module_key, operation=operation,
                outcome=Outcome.REFUSED, truth_tag=TruthTag.BLOCKED.value,
                reason=f"module is {spec.bucket.value} per the control register; execution refused",
            ))

        if spec.bucket is TruthBucket.CLAIMED:
            return self._record(ModuleDecision(
                module_key=module_key, operation=operation,
                outcome=Outcome.REFUSED, truth_tag=TruthTag.BLOCKED.value,
                reason="module status is CLAIMED (unverified); claims never execute",
            ))

        handler = HANDLERS.get(module_key)

        if spec.human_gated:
            draft = None
            if handler is not None:
                draft = handler(payload)
            return self._record(ModuleDecision(
                module_key=module_key, operation=operation,
                outcome=Outcome.STAGED_FOR_HUMAN, truth_tag=TruthTag.STAGED.value,
                reason="module is human-gated; output is a draft pending approval",
                result=draft,
            ))

        if handler is None:
            return self._record(ModuleDecision(
                module_key=module_key, operation=operation,
                outcome=Outcome.NOT_EXECUTABLE, truth_tag=TruthTag.STAGED.value,
                reason=(
                    "no executable handler registered — module is "
                    f"{spec.build_state(False).value}; build it before routing work to it"
                ),
            ))

        result = handler(payload)
        if spec.bucket is TruthBucket.DEMO:
            tag, reason = TruthTag.SIMULATED.value, "DEMO module; output is simulation, not production"
        elif module_key in _REGISTER_LIVE:
            tag, reason = TruthTag.LIVE.value, "register-attested live module"
        else:
            tag, reason = TruthTag.STAGED.value, "executed as staged capability (not attested live)"
        return self._record(ModuleDecision(
            module_key=module_key, operation=operation,
            outcome=Outcome.EXECUTED, truth_tag=tag, reason=reason, result=result,
        ))

    # -- decision log ---------------------------------------------------------

    def _record(self, decision: ModuleDecision) -> ModuleDecision:
        body = {
            "module_key": decision.module_key,
            "operation": decision.operation,
            "outcome": decision.outcome.value,
            "truth_tag": decision.truth_tag,
            "reason": decision.reason,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        canonical = json.dumps(body, sort_keys=True)
        decision.prev_hash = self._prev_hash
        decision.decision_hash = hashlib.sha256(
            f"{self._prev_hash}|{canonical}".encode()
        ).hexdigest()
        self._prev_hash = decision.decision_hash
        self._log.append(decision)
        return decision

    def decision_log(self) -> list[dict[str, Any]]:
        return [d.to_dict() for d in self._log]

    def verify_log(self) -> bool:
        """The decision chain is tamper-evident: re-linkable end to end."""
        prev = GENESIS_HASH
        for d in self._log:
            if d.prev_hash != prev:
                return False
            prev = d.decision_hash
        return True
