"""Cross-agent Skills Layer registry for Noble Port (v1.0).

Loads the declarative skills layer under `skills/config/`:

- `skill_registry.yaml`     — domain skills with full contracts + rubric refs.
- `evaluation_rubrics.yaml` — weighted, anchored rubric per skill (Tier 3).
- `expert_lanes.yaml`       — per-agent skill assignments (Tier 2).
- `feedback_loop.yaml`      — the data -> eval -> review -> retrain loop.

This mirrors the house pattern established in `gcagent/capabilities.py`:
YAML is the source of truth, Python types mirror it, and `load_registry()`
validates every contract on load so a broken registry fails loudly instead of
silently shipping a feature-before-skills regression.

Validation enforced on load:
  * Every skill satisfies `skill_contract.required_fields`.
  * Every skill's `rubric` resolves in evaluation_rubrics.yaml.
  * Every skill's `domain` is a declared domain.
  * `build_order` values are unique (the prioritized "first ten").
  * Every rubric's criterion weights sum to 1.0 (+/- tolerance).
  * Every lane references known skill ids.
  * The feedback loop is closed (last stage feeds the first).

Dependency-light: requires only PyYAML.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

try:  # pragma: no cover - optional dep
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore


PACKAGE_ROOT = Path(__file__).parent
CONFIG_DIR = PACKAGE_ROOT / "config"

SKILLS_PATH = CONFIG_DIR / "skill_registry.yaml"
RUBRICS_PATH = CONFIG_DIR / "evaluation_rubrics.yaml"
LANES_PATH = CONFIG_DIR / "expert_lanes.yaml"
FEEDBACK_PATH = CONFIG_DIR / "feedback_loop.yaml"

WEIGHT_TOLERANCE = 1e-6


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Domain:
    id: str
    name: str
    description: str


@dataclass(frozen=True)
class Skill:
    """Domain skill contract. Mirrors `skill_contract.required_fields`."""

    id: str
    name: str
    domain: str
    tier: int
    purpose: str
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    expert_signals: tuple[str, ...]
    rubric: str
    safety_rules: tuple[str, ...]
    success_criteria: tuple[str, ...]
    failure_modes: tuple[str, ...]
    build_order: int | None = None
    dependencies: tuple[str, ...] = ()


@dataclass(frozen=True)
class Criterion:
    id: str
    description: str
    weight: float
    must_pass: bool = False
    floor: int = 0


@dataclass(frozen=True)
class Rubric:
    id: str
    name: str
    applies_to: tuple[str, ...]
    pass_threshold: float
    criteria: tuple[Criterion, ...]
    review_policy: dict
    variance_band: float | None = None

    def weight_sum(self) -> float:
        return sum(c.weight for c in self.criteria)


@dataclass(frozen=True)
class Lane:
    id: str
    agent: str
    name: str
    mandate: str
    skills: tuple[str, ...]
    golden_set: str
    owner: str


@dataclass(frozen=True)
class FeedbackStage:
    id: str
    name: str
    purpose: str
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    owner: str
    gate: str
    artifacts: tuple[str, ...]
    feeds: str = ""


@dataclass
class SkillsLayer:
    version: str
    domains: dict[str, Domain] = field(default_factory=dict)
    skills: dict[str, Skill] = field(default_factory=dict)
    rubrics: dict[str, Rubric] = field(default_factory=dict)
    lanes: dict[str, Lane] = field(default_factory=dict)
    stages: dict[str, FeedbackStage] = field(default_factory=dict)
    shared_foundations: tuple[str, ...] = ()

    # --- lookups ----------------------------------------------------------

    def has_skill(self, skill_id: str) -> bool:
        return skill_id in self.skills

    def skills_in_domain(self, domain_id: str) -> list[Skill]:
        return [s for s in self.skills.values() if s.domain == domain_id]

    def skills_in_tier(self, tier: int) -> list[Skill]:
        return [s for s in self.skills.values() if s.tier == tier]

    def first_ten(self) -> list[Skill]:
        """The prioritized build slice, ordered by `build_order` 1..10."""
        ranked = [s for s in self.skills.values() if s.build_order is not None]
        return sorted(ranked, key=lambda s: s.build_order)  # type: ignore[arg-type]

    def rubric_for(self, skill_id: str) -> Rubric:
        return self.rubrics[self.skills[skill_id].rubric]

    def lane_for_agent(self, agent: str) -> Lane | None:
        for lane in self.lanes.values():
            if lane.agent.lower() == agent.lower():
                return lane
        return None

    def skills_for_lane(self, lane_id: str) -> list[Skill]:
        lane = self.lanes[lane_id]
        return [self.skills[s] for s in lane.skills]


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


_SKILL_REQUIRED = (
    "id", "name", "domain", "tier", "purpose", "inputs", "outputs",
    "expert_signals", "rubric", "safety_rules", "success_criteria",
    "failure_modes",
)

_RUBRIC_REQUIRED = (
    "id", "name", "applies_to", "scale", "criteria", "pass_threshold",
    "review_policy",
)

_LANE_REQUIRED = (
    "id", "agent", "name", "mandate", "skills", "golden_set", "owner",
)

_STAGE_REQUIRED = (
    "id", "name", "purpose", "inputs", "outputs", "owner", "gate", "artifacts",
)


def _load_yaml(path: Path) -> dict:
    if yaml is None:  # pragma: no cover
        raise RuntimeError(
            "PyYAML is required to load the Noble Port skills layer. "
            "Install with `pip install pyyaml`."
        )
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _as_tuple(value) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(str(v) for v in value)


def _validate_contract(entry: dict, required: tuple[str, ...], kind: str) -> None:
    missing = [f for f in required if f not in entry]
    if missing:
        raise ValueError(
            f"{kind} '{entry.get('id', '<unknown>')}' missing required fields: {missing}"
        )


def load_registry(config_dir: Path | str | None = None) -> SkillsLayer:
    """Parse and validate the four-file skills layer into a typed SkillsLayer."""
    base = Path(config_dir) if config_dir else CONFIG_DIR
    skills_data = _load_yaml(base / "skill_registry.yaml")
    rubrics_data = _load_yaml(base / "evaluation_rubrics.yaml")
    lanes_data = _load_yaml(base / "expert_lanes.yaml")
    feedback_data = _load_yaml(base / "feedback_loop.yaml")

    layer = SkillsLayer(version=str(skills_data.get("version", "1.0")))

    # Domains
    for entry in skills_data.get("domains", []) or []:
        domain = Domain(
            id=entry["id"],
            name=entry["name"],
            description=entry.get("description", "").strip(),
        )
        layer.domains[domain.id] = domain

    # Rubrics (validate weight sums before skills reference them)
    for entry in rubrics_data.get("rubrics", []) or []:
        _validate_contract(entry, _RUBRIC_REQUIRED, "Rubric")
        criteria = tuple(
            Criterion(
                id=c["id"],
                description=c.get("description", "").strip(),
                weight=float(c["weight"]),
                must_pass=bool(c.get("must_pass", False)),
                floor=int(c.get("floor", 0)),
            )
            for c in entry["criteria"]
        )
        rubric = Rubric(
            id=entry["id"],
            name=entry["name"],
            applies_to=_as_tuple(entry["applies_to"]),
            pass_threshold=float(entry["pass_threshold"]),
            criteria=criteria,
            review_policy=entry.get("review_policy", {}) or {},
            variance_band=(
                float(entry["variance_band"]) if "variance_band" in entry else None
            ),
        )
        wsum = rubric.weight_sum()
        if abs(wsum - 1.0) > WEIGHT_TOLERANCE:
            raise ValueError(
                f"Rubric '{rubric.id}' criterion weights sum to {wsum:.6f}, "
                f"expected 1.0."
            )
        layer.rubrics[rubric.id] = rubric

    # Skills (contract-validated; domain + rubric refs checked)
    seen_build_orders: dict[int, str] = {}
    for entry in skills_data.get("skills", []) or []:
        _validate_contract(entry, _SKILL_REQUIRED, "Skill")
        skill = Skill(
            id=entry["id"],
            name=entry["name"],
            domain=entry["domain"],
            tier=int(entry["tier"]),
            purpose=entry["purpose"].strip(),
            inputs=_as_tuple(entry["inputs"]),
            outputs=_as_tuple(entry["outputs"]),
            expert_signals=_as_tuple(entry["expert_signals"]),
            rubric=entry["rubric"],
            safety_rules=_as_tuple(entry["safety_rules"]),
            success_criteria=_as_tuple(entry["success_criteria"]),
            failure_modes=_as_tuple(entry["failure_modes"]),
            build_order=(
                int(entry["build_order"]) if entry.get("build_order") is not None else None
            ),
            dependencies=_as_tuple(entry.get("dependencies")),
        )
        if skill.domain not in layer.domains:
            raise ValueError(
                f"Skill '{skill.id}' references unknown domain: {skill.domain}"
            )
        if skill.rubric not in layer.rubrics:
            raise ValueError(
                f"Skill '{skill.id}' references unknown rubric: {skill.rubric}"
            )
        if skill.build_order is not None:
            clash = seen_build_orders.get(skill.build_order)
            if clash:
                raise ValueError(
                    f"build_order {skill.build_order} used by both '{clash}' "
                    f"and '{skill.id}'."
                )
            seen_build_orders[skill.build_order] = skill.id
        layer.skills[skill.id] = skill

    # Cross-check skill dependencies resolve.
    for skill in layer.skills.values():
        unknown = [d for d in skill.dependencies if d not in layer.skills]
        if unknown:
            raise ValueError(
                f"Skill '{skill.id}' depends on unknown skills: {unknown}"
            )

    # Lanes (skill ids checked).
    for entry in lanes_data.get("lanes", []) or []:
        _validate_contract(entry, _LANE_REQUIRED, "Lane")
        lane = Lane(
            id=entry["id"],
            agent=entry["agent"],
            name=entry["name"],
            mandate=entry["mandate"].strip(),
            skills=_as_tuple(entry["skills"]),
            golden_set=entry["golden_set"],
            owner=entry["owner"],
        )
        unknown = [s for s in lane.skills if s not in layer.skills]
        if unknown:
            raise ValueError(
                f"Lane '{lane.id}' references unknown skills: {unknown}"
            )
        layer.lanes[lane.id] = lane

    foundations = (lanes_data.get("shared_foundations", {}) or {}).get(
        "inherited_by_all_agents", []
    )
    unknown = [s for s in foundations if s not in layer.skills]
    if unknown:
        raise ValueError(f"shared_foundations reference unknown skills: {unknown}")
    layer.shared_foundations = _as_tuple(foundations)

    # Feedback loop stages (validate closure).
    stage_ids: list[str] = []
    for entry in feedback_data.get("stages", []) or []:
        _validate_contract(entry, _STAGE_REQUIRED, "Stage")
        stage = FeedbackStage(
            id=entry["id"],
            name=entry["name"],
            purpose=entry["purpose"].strip(),
            inputs=_as_tuple(entry["inputs"]),
            outputs=_as_tuple(entry["outputs"]),
            owner=entry["owner"],
            gate=entry["gate"],
            artifacts=_as_tuple(entry["artifacts"]),
            feeds=str(entry.get("feeds", "")),
        )
        layer.stages[stage.id] = stage
        stage_ids.append(stage.id)

    # `feeds` targets must be real stages; the loop must close back to the first.
    for stage in layer.stages.values():
        if stage.feeds and stage.feeds not in layer.stages:
            raise ValueError(
                f"Stage '{stage.id}' feeds unknown stage: {stage.feeds}"
            )
    if stage_ids:
        last = layer.stages[stage_ids[-1]]
        if last.feeds != stage_ids[0]:
            raise ValueError(
                f"Feedback loop is not closed: last stage '{last.id}' feeds "
                f"'{last.feeds}', expected '{stage_ids[0]}'."
            )

    return layer


# ---------------------------------------------------------------------------
# CLI sanity check
# ---------------------------------------------------------------------------


if __name__ == "__main__":  # pragma: no cover
    layer = load_registry()
    print(f"Noble Port Skills Layer v{layer.version}")
    print(f"Domains:      {len(layer.domains)}")
    print(f"Skills:       {len(layer.skills)}")
    print(f"Rubrics:      {len(layer.rubrics)}")
    print(f"Lanes:        {len(layer.lanes)}")
    print(f"Loop stages:  {len(layer.stages)}")
    print()
    print("First ten skills to build:")
    for skill in layer.first_ten():
        print(f"  {skill.build_order:>2}. {skill.name} ({skill.domain}) -> rubric:{skill.rubric}")
    print()
    for domain in layer.domains.values():
        members = layer.skills_in_domain(domain.id)
        print(f"  [{domain.id}] {domain.name} — {len(members)} skills")
    print()
    for lane in layer.lanes.values():
        print(f"  {lane.agent}: {len(lane.skills)} skills (+{len(layer.shared_foundations)} shared)")
