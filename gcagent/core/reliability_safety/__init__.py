"""Runtime scaffold for the `reliability_safety` skill.

Contract: see `gcagent/config/skill_registry.yaml` (id: reliability_safety).
Layer: architecture.

Also hosts the NoblePort AI guardrails loader; see `ai_guardrails.py`.
"""

from .ai_guardrails import (
    Guardrail,
    GuardrailCategory,
    GuardrailRegistry,
    GuardrailViolation,
    default_registry,
    enforce,
    guard,
    load_guardrails,
    render_prompt_section,
)

SKILL_ID = "reliability_safety"
LAYER_ID = "architecture"

__all__ = [
    "SKILL_ID",
    "LAYER_ID",
    "Guardrail",
    "GuardrailCategory",
    "GuardrailRegistry",
    "GuardrailViolation",
    "default_registry",
    "enforce",
    "guard",
    "load_guardrails",
    "render_prompt_section",
]
