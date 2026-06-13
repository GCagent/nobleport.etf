"""Per-agent expert lanes.

Lane *assignments* are declared in `skills/config/expert_lanes.yaml` and loaded
via `skills.load_registry().lanes`. This package is where each lane's runtime
scaffolding (skill adapters, golden-set loaders, sub-agents) will land as the
lanes move from registry to implementation.
"""
