"""NoblePort AI guardrails loader and runtime helpers.

Source of truth: `gcagent/config/ai_guardrails.yaml`. Human-readable
canonical policy: `AI_GUARDRAILS.md` at the repository root.

This module provides:

- `Guardrail`, `GuardrailCategory`, `GuardrailRegistry` dataclasses.
- `load_guardrails()` to parse the YAML manifest with contract validation.
- `enforce(guardrail_id, predicate)` and `guard(*guardrail_ids)` helpers
  used by `prompt_engineering`, `tool_integration`, and
  `workflow_automation` skills to mark code paths as policy-bound.
- `GuardrailViolation` raised when a binding guardrail is violated.

The helpers are deliberately lightweight: they do not "magically" enforce
policy. They tag code paths with a stable guardrail ID, record violations
to the standard logger for the audit chain (T26, T30, L64), and surface
human-readable context for downstream review.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Sequence

try:  # pragma: no cover - optional dep
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore


PACKAGE_ROOT = Path(__file__).resolve().parents[2]
GUARDRAILS_PATH = PACKAGE_ROOT / "config" / "ai_guardrails.yaml"

SKILL_ID = "reliability_safety"
LAYER_ID = "architecture"

logger = logging.getLogger("nobleport.guardrails")


VALID_SEVERITIES = frozenset({"must", "must_not", "should"})
VALID_ENFORCEMENT = frozenset({"policy", "prompt", "code", "process"})
_REQUIRED_FIELDS = ("id", "category", "severity", "summary", "enforcement")


@dataclass(frozen=True)
class GuardrailCategory:
    id: str
    code: str
    name: str
    range: tuple[int, int]


@dataclass(frozen=True)
class Guardrail:
    id: str
    category: str
    severity: str
    summary: str
    enforcement: tuple[str, ...]

    @property
    def is_binding(self) -> bool:
        return self.severity in {"must", "must_not"}

    @property
    def is_prohibition(self) -> bool:
        return self.severity == "must_not"


@dataclass
class GuardrailRegistry:
    version: str
    canonical_document: str
    review_cadence_days: int
    policy_owner: str
    technical_owner: str
    ethics_board: str
    applies_to: tuple[str, ...]
    categories: dict[str, GuardrailCategory] = field(default_factory=dict)
    guardrails: dict[str, Guardrail] = field(default_factory=dict)

    def __len__(self) -> int:
        return len(self.guardrails)

    def __contains__(self, guardrail_id: object) -> bool:
        return isinstance(guardrail_id, str) and guardrail_id in self.guardrails

    def __iter__(self):
        return iter(self.guardrails.values())

    def get(self, guardrail_id: str) -> Guardrail:
        try:
            return self.guardrails[guardrail_id]
        except KeyError as exc:
            raise KeyError(
                f"Unknown guardrail '{guardrail_id}'. "
                f"Known IDs: {sorted(self.guardrails)[:5]}..."
            ) from exc

    def by_category(self, category_id: str) -> list[Guardrail]:
        return [g for g in self.guardrails.values() if g.category == category_id]

    def by_enforcement(self, layer: str) -> list[Guardrail]:
        if layer not in VALID_ENFORCEMENT:
            raise ValueError(
                f"Unknown enforcement layer '{layer}'. Valid: {sorted(VALID_ENFORCEMENT)}"
            )
        return [g for g in self.guardrails.values() if layer in g.enforcement]

    def binding(self) -> list[Guardrail]:
        return [g for g in self.guardrails.values() if g.is_binding]


class GuardrailViolation(RuntimeError):
    """Raised when a binding guardrail predicate fails."""

    def __init__(self, guardrail: Guardrail, detail: str):
        self.guardrail = guardrail
        self.detail = detail
        super().__init__(f"{guardrail.id} ({guardrail.summary}) — {detail}")


def _load_yaml(path: Path) -> dict:
    if yaml is None:  # pragma: no cover
        raise RuntimeError(
            "PyYAML is required to load AI guardrails. Install with `pip install pyyaml`."
        )
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _validate_entry(entry: dict) -> None:
    missing = [f for f in _REQUIRED_FIELDS if f not in entry]
    if missing:
        raise ValueError(
            f"Guardrail '{entry.get('id', '<unknown>')}' missing fields: {missing}"
        )
    if entry["severity"] not in VALID_SEVERITIES:
        raise ValueError(
            f"Guardrail '{entry['id']}' has invalid severity '{entry['severity']}'."
        )
    unknown = [e for e in entry["enforcement"] if e not in VALID_ENFORCEMENT]
    if unknown:
        raise ValueError(
            f"Guardrail '{entry['id']}' has invalid enforcement layers: {unknown}"
        )


def load_guardrails(path: Path | str | None = None) -> GuardrailRegistry:
    """Load and validate the AI guardrails manifest."""
    source = Path(path) if path else GUARDRAILS_PATH
    data = _load_yaml(source)

    authority = data.get("authority", {}) or {}
    registry = GuardrailRegistry(
        version=str(data.get("version", "1.0")),
        canonical_document=str(data.get("canonical_document", "AI_GUARDRAILS.md")),
        review_cadence_days=int(data.get("review_cadence_days", 180)),
        policy_owner=str(authority.get("policy_owner", "")),
        technical_owner=str(authority.get("technical_owner", "")),
        ethics_board=str(authority.get("ethics_board", "")),
        applies_to=tuple(str(s) for s in data.get("applies_to", []) or []),
    )

    for cat in data.get("categories", []) or []:
        rng = cat.get("range", [0, 0])
        category = GuardrailCategory(
            id=cat["id"],
            code=cat["code"],
            name=cat["name"],
            range=(int(rng[0]), int(rng[1])),
        )
        registry.categories[category.id] = category

    seen: set[str] = set()
    for entry in data.get("guardrails", []) or []:
        _validate_entry(entry)
        gid = entry["id"]
        if gid in seen:
            raise ValueError(f"Duplicate guardrail id: {gid}")
        seen.add(gid)
        if entry["category"] not in registry.categories:
            raise ValueError(
                f"Guardrail '{gid}' references unknown category '{entry['category']}'."
            )
        registry.guardrails[gid] = Guardrail(
            id=gid,
            category=entry["category"],
            severity=entry["severity"],
            summary=entry["summary"].strip(),
            enforcement=tuple(entry["enforcement"]),
        )

    if len(registry.guardrails) != 100:
        raise ValueError(
            f"Expected 100 NoblePort AI guardrails, found {len(registry.guardrails)}."
        )

    return registry


_DEFAULT_REGISTRY: GuardrailRegistry | None = None


def default_registry() -> GuardrailRegistry:
    """Cached singleton for the guardrail registry."""
    global _DEFAULT_REGISTRY
    if _DEFAULT_REGISTRY is None:
        _DEFAULT_REGISTRY = load_guardrails()
    return _DEFAULT_REGISTRY


def enforce(
    guardrail_id: str,
    predicate: Callable[[], bool] | bool,
    *,
    detail: str = "",
    registry: GuardrailRegistry | None = None,
) -> None:
    """Assert that a guardrail holds for the current code path.

    Binding guardrails (`must` / `must_not`) raise GuardrailViolation when
    the predicate is false. `should` guardrails log a warning instead so
    the team can review the audit trail without breaking traffic.
    """
    reg = registry or default_registry()
    rail = reg.get(guardrail_id)
    holds = predicate() if callable(predicate) else bool(predicate)
    if holds:
        logger.debug("guardrail.ok id=%s severity=%s", rail.id, rail.severity)
        return
    message = detail or "guardrail predicate failed"
    if rail.is_binding:
        logger.error(
            "guardrail.violation id=%s severity=%s detail=%s",
            rail.id,
            rail.severity,
            message,
        )
        raise GuardrailViolation(rail, message)
    logger.warning(
        "guardrail.advisory id=%s severity=%s detail=%s",
        rail.id,
        rail.severity,
        message,
    )


def guard(*guardrail_ids: str, registry: GuardrailRegistry | None = None):
    """Decorator that tags a function with guardrail IDs for the audit chain.

    The decorator does not change behavior; it records which guardrails
    govern the function and logs invocations under the `nobleport.guardrails`
    logger. Violations should be raised explicitly by the function body
    via `enforce()`.

        @guard("T26", "L64")
        def issue_payment(...): ...
    """
    reg = registry or default_registry()
    unknown = [gid for gid in guardrail_ids if gid not in reg]
    if unknown:
        raise KeyError(f"Unknown guardrail IDs on @guard: {unknown}")

    def wrap(fn):
        existing: tuple[str, ...] = getattr(fn, "__nobleport_guardrails__", ())
        fn.__nobleport_guardrails__ = tuple(dict.fromkeys((*existing, *guardrail_ids)))

        def _logged(*args, **kwargs):
            logger.debug(
                "guardrail.invoke fn=%s.%s ids=%s",
                getattr(fn, "__module__", "?"),
                getattr(fn, "__qualname__", fn.__name__),
                fn.__nobleport_guardrails__,
            )
            return fn(*args, **kwargs)

        _logged.__nobleport_guardrails__ = fn.__nobleport_guardrails__  # type: ignore[attr-defined]
        _logged.__wrapped__ = fn  # type: ignore[attr-defined]
        _logged.__name__ = fn.__name__
        _logged.__qualname__ = getattr(fn, "__qualname__", fn.__name__)
        _logged.__doc__ = fn.__doc__
        return _logged

    return wrap


def render_prompt_section(
    registry: GuardrailRegistry | None = None,
    *,
    only_ids: Iterable[str] | None = None,
) -> str:
    """Render the prompt-facing summary appended to agent system prompts.

    Output deliberately lists every binding guardrail by ID so an agent
    can refer to them when refusing, escalating, or disclosing AI use.
    """
    reg = registry or default_registry()
    if only_ids is not None:
        rails: Sequence[Guardrail] = [reg.get(g) for g in only_ids]
    else:
        rails = reg.binding()

    lines = [
        "## Block 5 — NoblePort AI Guardrails (binding)",
        "",
        f"Source: `{reg.canonical_document}` (v{reg.version}). "
        f"Policy owner: {reg.policy_owner or 'unassigned'}. "
        f"Technical owner: {reg.technical_owner or 'unassigned'}.",
        "",
        "Every action this agent takes — generation, tool calls, refusals, "
        "escalations — MUST honor the guardrails below. Cite the relevant "
        "guardrail ID in refusals, disclosures, and audit logs.",
        "",
    ]

    by_cat: dict[str, list[Guardrail]] = {}
    for rail in rails:
        by_cat.setdefault(rail.category, []).append(rail)

    for cat_id, cat in reg.categories.items():
        bucket = by_cat.get(cat_id, [])
        if not bucket:
            continue
        lines.append(f"### {cat.name} ({cat.code}{cat.range[0]}–{cat.code}{cat.range[1]})")
        lines.append("")
        for rail in bucket:
            marker = "MUST NOT" if rail.is_prohibition else "MUST"
            lines.append(f"- **{rail.id}** ({marker}): {rail.summary}")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


if __name__ == "__main__":  # pragma: no cover
    reg = load_guardrails()
    print(
        f"NoblePort AI Guardrails v{reg.version} — "
        f"{len(reg)} guardrails across {len(reg.categories)} categories"
    )
    for cat in reg.categories.values():
        items = reg.by_category(cat.id)
        binding = sum(1 for g in items if g.is_binding)
        print(
            f"  [{cat.code}] {cat.name}: {len(items)} total, {binding} binding"
        )
