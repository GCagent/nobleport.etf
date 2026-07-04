"""GCagent.ai skill framework (v1.1).

Six-layer capability taxonomy, twelve canonical core skills with full
contracts, and five first-class domain modules. Sources of truth live in
`gcagent/config/`:

- `capability_layers.yaml`
- `skill_registry.yaml`
- `module_registry.yaml`
- `output_modes.yaml`

Runtime scaffolds for each skill/module live under the layer packages
(`core/`, `execution/`, `knowledge/`, `platform/`, `quality/`, `domains/`).
"""

from .capabilities import (
    CapabilityLayer,
    DomainModule,
    OutputMode,
    Skill,
    SkillRegistry,
    load_registry,
    render_system_prompt,
)

__version__ = "1.1.0"

__all__ = [
    "CapabilityLayer",
    "DomainModule",
    "OutputMode",
    "Skill",
    "SkillRegistry",
    "load_registry",
    "render_system_prompt",
]
