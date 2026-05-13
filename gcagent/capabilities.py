"""Skill registry for GCagent.ai (v1.1).

Loads the three-file declarative registry under `gcagent/config/`:

- `capability_layers.yaml` — six-layer taxonomy (architecture, execution,
  knowledge, platform, quality, domain).
- `skill_registry.yaml`    — twelve core skills with full contracts.
- `module_registry.yaml`   — domain modules composing core skills.

Exposes typed accessors, contract validation, and a system-prompt renderer.
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
SYSTEM_PROMPT_PATH = PACKAGE_ROOT / "system_prompt.md"

LAYERS_PATH = CONFIG_DIR / "capability_layers.yaml"
SKILLS_PATH = CONFIG_DIR / "skill_registry.yaml"
MODULES_PATH = CONFIG_DIR / "module_registry.yaml"
OUTPUT_MODES_PATH = CONFIG_DIR / "output_modes.yaml"


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CapabilityLayer:
    id: str
    name: str
    description: str
    skills: tuple[str, ...] = ()
    modules: tuple[str, ...] = ()


@dataclass(frozen=True)
class Skill:
    """Core skill contract. Mirrors `skill_contract.required_fields`."""

    id: str
    name: str
    purpose: str
    capabilities: tuple[str, ...]
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    dependencies: tuple[str, ...]
    safety_rules: tuple[str, ...]
    success_criteria: tuple[str, ...]
    failure_modes: tuple[str, ...]
    layer: str = ""  # populated from capability_layers.yaml


@dataclass(frozen=True)
class DomainModule:
    """Domain module contract. Mirrors `module_contract.required_fields`."""

    id: str
    name: str
    purpose: str
    capabilities: tuple[str, ...]
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    required_skills: tuple[str, ...]
    dependencies: tuple[str, ...]
    safety_rules: tuple[str, ...]
    success_criteria: tuple[str, ...]
    failure_modes: tuple[str, ...]


@dataclass(frozen=True)
class OutputMode:
    id: str
    name: str
    description: str
    produced_by: tuple[str, ...]


@dataclass
class SkillRegistry:
    agent_name: str
    agent_version: str
    agent_role: str
    layers: dict[str, CapabilityLayer] = field(default_factory=dict)
    skills: dict[str, Skill] = field(default_factory=dict)
    modules: dict[str, DomainModule] = field(default_factory=dict)
    output_modes: dict[str, OutputMode] = field(default_factory=dict)

    # --- lookups ----------------------------------------------------------

    def has_skill(self, skill_id: str) -> bool:
        return skill_id in self.skills

    def has_module(self, module_id: str) -> bool:
        return module_id in self.modules

    def skills_in_layer(self, layer_id: str) -> list[Skill]:
        layer = self.layers[layer_id]
        return [self.skills[sid] for sid in layer.skills if sid in self.skills]

    def resolve_module(self, module_id: str) -> list[Skill]:
        """Return the core skills a domain module requires, in declared order."""
        module = self.modules[module_id]
        missing = [s for s in module.required_skills if s not in self.skills]
        if missing:
            raise ValueError(
                f"Module '{module_id}' requires unknown skills: {missing}"
            )
        return [self.skills[s] for s in module.required_skills]

    def capability_tags(self) -> tuple[str, ...]:
        """Flat list of skill IDs — back-compat with the v1.0 capability list."""
        return tuple(self.skills.keys())


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------


_SKILL_REQUIRED = (
    "id", "name", "purpose", "capabilities", "inputs", "outputs",
    "dependencies", "safety_rules", "success_criteria", "failure_modes",
)

_MODULE_REQUIRED = (
    "id", "name", "purpose", "capabilities", "inputs", "outputs",
    "required_skills", "dependencies", "safety_rules", "success_criteria",
    "failure_modes",
)


def _load_yaml(path: Path) -> dict:
    if yaml is None:  # pragma: no cover
        raise RuntimeError(
            "PyYAML is required to load the GCagent skill registry. "
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


def load_registry(config_dir: Path | str | None = None) -> SkillRegistry:
    """Parse the three-file registry into a typed SkillRegistry."""
    base = Path(config_dir) if config_dir else CONFIG_DIR
    layers_data = _load_yaml(base / "capability_layers.yaml")
    skills_data = _load_yaml(base / "skill_registry.yaml")
    modules_data = _load_yaml(base / "module_registry.yaml")
    output_modes_data = _load_yaml(base / "output_modes.yaml")

    registry = SkillRegistry(
        agent_name="GCagent.ai",
        agent_version=str(layers_data.get("version", "1.1")),
        agent_role=(
            "Technical collaborator for agentic systems and operational workflows."
        ),
    )

    # Layers
    for entry in layers_data.get("layers", []) or []:
        layer = CapabilityLayer(
            id=entry["id"],
            name=entry["name"],
            description=entry.get("description", "").strip(),
            skills=_as_tuple(entry.get("skills")),
            modules=_as_tuple(entry.get("modules")),
        )
        registry.layers[layer.id] = layer

    # Skills (contract-validated)
    skill_layer_index = {
        sid: layer.id
        for layer in registry.layers.values()
        for sid in layer.skills
    }
    for entry in skills_data.get("skills", []) or []:
        _validate_contract(entry, _SKILL_REQUIRED, "Skill")
        skill = Skill(
            id=entry["id"],
            name=entry["name"],
            purpose=entry["purpose"].strip(),
            capabilities=_as_tuple(entry["capabilities"]),
            inputs=_as_tuple(entry["inputs"]),
            outputs=_as_tuple(entry["outputs"]),
            dependencies=_as_tuple(entry["dependencies"]),
            safety_rules=_as_tuple(entry["safety_rules"]),
            success_criteria=_as_tuple(entry["success_criteria"]),
            failure_modes=_as_tuple(entry["failure_modes"]),
            layer=skill_layer_index.get(entry["id"], ""),
        )
        registry.skills[skill.id] = skill

    # Modules (contract-validated; skills checked)
    for entry in modules_data.get("modules", []) or []:
        _validate_contract(entry, _MODULE_REQUIRED, "Module")
        module = DomainModule(
            id=entry["id"],
            name=entry["name"],
            purpose=entry["purpose"].strip(),
            capabilities=_as_tuple(entry["capabilities"]),
            inputs=_as_tuple(entry["inputs"]),
            outputs=_as_tuple(entry["outputs"]),
            required_skills=_as_tuple(entry["required_skills"]),
            dependencies=_as_tuple(entry["dependencies"]),
            safety_rules=_as_tuple(entry["safety_rules"]),
            success_criteria=_as_tuple(entry["success_criteria"]),
            failure_modes=_as_tuple(entry["failure_modes"]),
        )
        unknown = [s for s in module.required_skills if s not in registry.skills]
        if unknown:
            raise ValueError(
                f"Module '{module.id}' references unknown skills: {unknown}"
            )
        registry.modules[module.id] = module

    # Cross-check: layers reference known skills/modules
    for layer in registry.layers.values():
        for sid in layer.skills:
            if sid not in registry.skills:
                raise ValueError(
                    f"Layer '{layer.id}' references unknown skill: {sid}"
                )
        for mid in layer.modules:
            if mid not in registry.modules:
                raise ValueError(
                    f"Layer '{layer.id}' references unknown module: {mid}"
                )

    # Output modes
    for entry in output_modes_data.get("output_modes", []) or []:
        mode = OutputMode(
            id=entry["id"],
            name=entry["name"],
            description=entry.get("description", "").strip(),
            produced_by=_as_tuple(entry.get("produced_by")),
        )
        registry.output_modes[mode.id] = mode

    return registry


# ---------------------------------------------------------------------------
# Prompt rendering
# ---------------------------------------------------------------------------


def render_system_prompt(
    registry: SkillRegistry | None = None,
    *,
    include_modules: Iterable[str] = (),
    include_guardrails: bool = True,
) -> str:
    """Render the GCagent system prompt.

    The base prompt lives in `system_prompt.md`. When ``include_guardrails``
    is true (default) the NoblePort AI Guardrails registry is appended as
    Block 5's enumerated rules. Requested domain modules are resolved and
    appended as a "Loaded modules" section.
    """
    registry = registry or load_registry()
    base = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    parts: list[str] = [base.rstrip()]

    if include_guardrails:
        # Local import keeps the capabilities module dependency-light.
        from .core.reliability_safety import render_prompt_section

        parts.append(render_prompt_section().rstrip())

    modules = list(include_modules)
    if modules:
        unknown = [m for m in modules if m not in registry.modules]
        if unknown:
            raise ValueError(f"Unknown domain modules: {unknown}")
        lines = ["## Loaded modules", ""]
        for module_id in modules:
            module = registry.modules[module_id]
            required = ", ".join(f"`{r}`" for r in module.required_skills)
            lines.append(f"### {module.name} (`{module.id}`)")
            lines.append("")
            lines.append(module.purpose)
            lines.append("")
            lines.append(f"**Requires:** {required}")
            lines.append("")
        parts.append("\n".join(lines).rstrip())

    return "\n\n".join(parts) + "\n"


# ---------------------------------------------------------------------------
# CLI sanity check
# ---------------------------------------------------------------------------


if __name__ == "__main__":  # pragma: no cover
    reg = load_registry()
    print(f"{reg.agent_name} v{reg.agent_version}")
    print(f"Layers:       {len(reg.layers)}")
    print(f"Core skills:  {len(reg.skills)}")
    print(f"Domain modules: {len(reg.modules)}")
    print(f"Output modes: {len(reg.output_modes)}")
    print()
    for layer in reg.layers.values():
        members = layer.skills or layer.modules
        kind = "skills" if layer.skills else "modules"
        print(f"  [{layer.id}] {layer.name} — {len(members)} {kind}")
        for m in members:
            print(f"      - {m}")
