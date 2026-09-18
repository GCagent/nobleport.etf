"""NoblePort Nano Ecosystem — systems intake loader.

Parses `gcagent/config/nobleport_systems.yaml` into typed records.
Cross-validates subsystem references, rail ids, invariants, intake
fields, and revenue-loop gates. Surface intentionally narrow: callers
should treat the loaded `EcosystemIntake` as read-only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

try:  # pragma: no cover - optional dep, same handling as capabilities.py
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore

PACKAGE_ROOT = Path(__file__).parent
CONFIG_DIR = PACKAGE_ROOT / "config"
NOBLEPORT_PATH = CONFIG_DIR / "nobleport_systems.yaml"


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Subsystem:
    id: str
    name: str
    role: str
    purpose: str
    domains: tuple[str, ...] = ()
    capabilities: tuple[str, ...] = ()
    integrations: tuple[str, ...] = ()
    gcagent_module: str = ""
    health_metric: str = ""
    target_threshold: float | None = None
    settlement_layer: str = ""
    standard: str = ""
    compliance_posture: str = ""
    investor_routing: str = ""
    notes: str = ""


@dataclass(frozen=True)
class PaymentRail:
    id: str
    name: str
    surface: str
    purpose: str
    reconciles_into: str
    commingled_with: tuple[str, ...] = ()


@dataclass(frozen=True)
class Invariant:
    id: str
    name: str
    rule: str
    enforcement: str
    applies_to: tuple[str, ...] = ()


@dataclass(frozen=True)
class IntakeField:
    id: str
    label: str
    routed_to: tuple[str, ...]
    required: bool = True


@dataclass(frozen=True)
class Intake:
    endpoint: str
    capture_mode: str
    orchestrator: str
    fields: tuple[IntakeField, ...]

    def required_fields(self) -> tuple[IntakeField, ...]:
        return tuple(f for f in self.fields if f.required)


@dataclass(frozen=True)
class RevenueGate:
    order: int
    id: str
    name: str
    requires: tuple[str, ...]
    owner: str
    emits: str = ""
    rails: tuple[str, ...] = ()
    gates_invariant: str = ""
    note: str = ""


@dataclass(frozen=True)
class RevenueLoop:
    description: str
    gates: tuple[RevenueGate, ...]

    def gate(self, gate_id: str) -> RevenueGate:
        for g in self.gates:
            if g.id == gate_id:
                return g
        raise KeyError(f"Unknown revenue gate: {gate_id}")


@dataclass(frozen=True)
class Stack:
    runtime: tuple[str, ...] = ()
    chain_permanence: tuple[str, ...] = ()
    observability: tuple[str, ...] = ()
    deployment: tuple[str, ...] = ()
    edge_dns: tuple[str, ...] = ()


@dataclass(frozen=True)
class EcosystemMeta:
    name: str
    positioning: str
    reference_job: str
    routing_surface: tuple[str, ...]


@dataclass
class EcosystemIntake:
    version: str
    ecosystem: EcosystemMeta
    subsystems: dict[str, Subsystem] = field(default_factory=dict)
    payment_rails: dict[str, PaymentRail] = field(default_factory=dict)
    invariants: dict[str, Invariant] = field(default_factory=dict)
    intake: Intake | None = None
    revenue_loop: RevenueLoop | None = None
    stack: Stack = field(default_factory=Stack)
    non_priorities: tuple[str, ...] = ()

    # --- helpers ----------------------------------------------------------

    def subsystems_by_role(self, role: str) -> list[Subsystem]:
        return [s for s in self.subsystems.values() if s.role == role]

    def orchestrator(self) -> Subsystem | None:
        results = self.subsystems_by_role("sovereign_orchestrator")
        return results[0] if results else None

    def required_intake_fields(self) -> tuple[IntakeField, ...]:
        return self.intake.required_fields() if self.intake else ()


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


def _tup(value) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(str(v) for v in value)


def _require(entry: dict, fields: tuple[str, ...], kind: str) -> None:
    missing = [f for f in fields if f not in entry]
    if missing:
        raise ValueError(
            f"{kind} '{entry.get('id', '<unknown>')}' missing required fields: {missing}"
        )


_SUBSYSTEM_REQUIRED = ("id", "name", "role", "purpose")
_RAIL_REQUIRED = ("id", "name", "surface", "purpose", "reconciles_into")
_INVARIANT_REQUIRED = ("id", "name", "rule", "enforcement")
_GATE_REQUIRED = ("order", "id", "name", "requires", "owner")


def load_nobleport_intake(path: Path | str | None = None) -> EcosystemIntake:
    """Parse the NoblePort systems intake YAML into typed records."""
    if yaml is None:  # pragma: no cover
        raise RuntimeError(
            "PyYAML is required to load the NoblePort systems intake. "
            "Install with `pip install pyyaml`."
        )

    source = Path(path) if path else NOBLEPORT_PATH
    with source.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)

    eco_raw = data.get("ecosystem", {}) or {}
    eco = EcosystemMeta(
        name=eco_raw.get("name", ""),
        positioning=str(eco_raw.get("positioning", "")).strip(),
        reference_job=eco_raw.get("reference_job", ""),
        routing_surface=_tup(eco_raw.get("routing_surface")),
    )

    intake = EcosystemIntake(
        version=str(data.get("version", "0")),
        ecosystem=eco,
    )

    # Subsystems
    for entry in data.get("subsystems", []) or []:
        _require(entry, _SUBSYSTEM_REQUIRED, "Subsystem")
        sub = Subsystem(
            id=entry["id"],
            name=entry["name"],
            role=entry["role"],
            purpose=str(entry["purpose"]).strip(),
            domains=_tup(entry.get("domains")),
            capabilities=_tup(entry.get("capabilities")),
            integrations=_tup(entry.get("integrations")),
            gcagent_module=entry.get("gcagent_module", ""),
            health_metric=entry.get("health_metric", ""),
            target_threshold=entry.get("target_threshold"),
            settlement_layer=entry.get("settlement_layer", ""),
            standard=entry.get("standard", ""),
            compliance_posture=entry.get("compliance_posture", ""),
            investor_routing=entry.get("investor_routing", ""),
            notes=str(entry.get("notes", "")).strip(),
        )
        intake.subsystems[sub.id] = sub

    # Payment rails
    for entry in data.get("payment_rails", []) or []:
        _require(entry, _RAIL_REQUIRED, "PaymentRail")
        rail = PaymentRail(
            id=entry["id"],
            name=entry["name"],
            surface=entry["surface"],
            purpose=str(entry["purpose"]).strip(),
            reconciles_into=entry["reconciles_into"],
            commingled_with=_tup(entry.get("commingled_with")),
        )
        intake.payment_rails[rail.id] = rail

    # Invariants
    for entry in data.get("invariants", []) or []:
        _require(entry, _INVARIANT_REQUIRED, "Invariant")
        inv = Invariant(
            id=entry["id"],
            name=entry["name"],
            rule=str(entry["rule"]).strip(),
            enforcement=entry["enforcement"],
            applies_to=_tup(entry.get("applies_to")),
        )
        intake.invariants[inv.id] = inv

    # Intake schema
    intake_raw = data.get("intake")
    if intake_raw:
        fields_t = tuple(
            IntakeField(
                id=f["id"],
                label=f["label"],
                routed_to=_tup(f.get("routed_to")),
                required=bool(f.get("required", True)),
            )
            for f in intake_raw.get("fields", []) or []
        )
        intake.intake = Intake(
            endpoint=intake_raw.get("endpoint", ""),
            capture_mode=intake_raw.get("capture_mode", ""),
            orchestrator=intake_raw.get("orchestrator", ""),
            fields=fields_t,
        )

    # Revenue loop
    loop_raw = data.get("revenue_loop")
    if loop_raw:
        gates: list[RevenueGate] = []
        for entry in loop_raw.get("gates", []) or []:
            _require(entry, _GATE_REQUIRED, "RevenueGate")
            gates.append(RevenueGate(
                order=int(entry["order"]),
                id=entry["id"],
                name=entry["name"],
                requires=_tup(entry["requires"]),
                owner=entry["owner"],
                emits=entry.get("emits", ""),
                rails=_tup(entry.get("rails")),
                gates_invariant=entry.get("gates_invariant", ""),
                note=str(entry.get("note", "")).strip(),
            ))
        gates.sort(key=lambda g: g.order)
        if [g.order for g in gates] != list(range(1, len(gates) + 1)):
            raise ValueError("revenue_loop.gates orders must be contiguous starting at 1")
        intake.revenue_loop = RevenueLoop(
            description=str(loop_raw.get("description", "")).strip(),
            gates=tuple(gates),
        )

    # Stack
    stack_raw = data.get("stack") or {}
    intake.stack = Stack(
        runtime=_tup(stack_raw.get("runtime")),
        chain_permanence=_tup(stack_raw.get("chain_permanence")),
        observability=_tup(stack_raw.get("observability")),
        deployment=_tup(stack_raw.get("deployment")),
        edge_dns=_tup(stack_raw.get("edge_dns")),
    )

    intake.non_priorities = _tup(data.get("non_priorities"))

    _cross_validate(intake)
    return intake


def _cross_validate(intake: EcosystemIntake) -> None:
    """Best-effort referential checks across the intake."""
    sub_ids = set(intake.subsystems)
    rail_ids = set(intake.payment_rails)
    inv_ids = set(intake.invariants)
    field_ids = {f.id for f in intake.intake.fields} if intake.intake else set()

    # Subsystem integration targets should resolve where possible.
    for sub in intake.subsystems.values():
        for target in sub.integrations:
            if target not in sub_ids and target not in {"finance", "payments", "compliance_bridge", "audit_log", "crm"}:
                raise ValueError(
                    f"Subsystem '{sub.id}' integrates with unknown target: {target}"
                )

    # Invariant rail references must resolve.
    for inv in intake.invariants.values():
        if inv.id == "rails_do_not_mix":
            unknown = [r for r in inv.applies_to if r not in rail_ids]
            if unknown:
                raise ValueError(
                    f"Invariant 'rails_do_not_mix' references unknown rails: {unknown}"
                )

    # Revenue-loop gate invariants and rails must resolve.
    if intake.revenue_loop:
        for gate in intake.revenue_loop.gates:
            if gate.gates_invariant and gate.gates_invariant not in inv_ids:
                raise ValueError(
                    f"Revenue gate '{gate.id}' refers to unknown invariant: {gate.gates_invariant}"
                )
            unknown_rails = [r for r in gate.rails if r not in rail_ids]
            if unknown_rails:
                raise ValueError(
                    f"Revenue gate '{gate.id}' refers to unknown rails: {unknown_rails}"
                )

    # Intake field routing — soft check: every routed_to is either a subsystem
    # or one of the recognized off-stage destinations.
    recognized_offstage = {
        "payments", "schedule_lock", "compliance_bridge", "finance",
        "audit_log", "crm",
    }
    if intake.intake:
        for f in intake.intake.fields:
            for dest in f.routed_to:
                if dest in sub_ids or dest in recognized_offstage:
                    continue
                raise ValueError(
                    f"Intake field '{f.id}' routes to unknown destination: {dest}"
                )

    # Touch field_ids to ensure they're loaded (silences linters; cheap).
    _ = field_ids


__all__ = [
    "EcosystemIntake",
    "EcosystemMeta",
    "Intake",
    "IntakeField",
    "Invariant",
    "PaymentRail",
    "RevenueGate",
    "RevenueLoop",
    "Stack",
    "Subsystem",
    "load_nobleport_intake",
]
