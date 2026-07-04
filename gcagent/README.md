# GCagent.ai — Skill Framework (v1.1)

Canonical capability model for **GCagent.ai**, the technical collaborator
agent used across the Noble Port ecosystem.

v1.1 promotes the framework from a flat registry to a **layered model** with
three separate sources of truth, a **four-block system prompt contract**, and
**first-class domain modules** that align the agent with actual product use
cases instead of leaving it as a generic engineering assistant.

## What's in v1.1

1. **Layered taxonomy.** Six capability layers — architecture, execution,
   knowledge, platform, quality, domain — give every skill a home and map
   cleanly to code packages, permissions, and roadmap tagging.
2. **Three-file registry.** `capability_layers.yaml`, `skill_registry.yaml`,
   and `module_registry.yaml` split the three concerns. Each skill and module
   satisfies an explicit contract (purpose, inputs, outputs, dependencies,
   safety rules, success criteria, failure modes).
3. **Domain modules.** Five product-specific operating modes compose core
   skills into real Noble Port workflows (construction ops, internal ops,
   compliance docs, reporting, investor admin).
4. **Four-block system prompt.** Role / competency registry / behavior rules
   / output contract — composable and independently testable.
5. **Module map.** Every skill and module has a corresponding code package
   under the appropriate layer directory, ready for implementation.

## Layout

```
gcagent/
├── README.md
├── __init__.py
├── capabilities.py               # typed registry + prompt renderer
├── system_prompt.md              # four-block drop-in prompt
│
├── config/                       # machine-readable source of truth
│   ├── capability_layers.yaml
│   ├── skill_registry.yaml
│   ├── module_registry.yaml
│   └── output_modes.yaml
│
├── core/                         # architecture layer
│   ├── agent_architecture/
│   ├── prompt_engineering/
│   └── reliability_safety/
│
├── execution/                    # execution layer
│   ├── tool_integration/
│   ├── workflow_orchestration/
│   └── workflow_automation/
│
├── knowledge/                    # knowledge layer
│   ├── memory_management/
│   └── rag_systems/
│
├── platform/                     # platform layer
│   ├── backend_infrastructure/
│   └── developer_experience/
│
├── quality/                      # quality layer
│   ├── debugging_observability/
│   └── performance_optimization/
│
└── domains/                      # domain layer
    ├── construction_operations/
    ├── internal_ops_assistant/
    ├── compliance_documentation/
    ├── reporting_automation/
    └── investor_admin_workflows/
```

## Canonical metadata

```yaml
agent_name: GCagent.ai
version: 1.1
role: Technical collaborator for agentic systems

capabilities:
  - agent_architecture
  - tool_integration
  - workflow_orchestration
  - memory_management
  - rag_systems
  - debugging_observability
  - prompt_engineering
  - backend_infrastructure
  - reliability_safety
  - performance_optimization
  - workflow_automation
  - developer_experience

focus_modules:
  - construction_operations
  - internal_ops_assistant
  - reporting_automation
  - compliance_documentation
  - investor_admin_workflows

preferred_outputs:
  - architecture_spec
  - system_prompt
  - workflow_graph
  - module_map
  - tool_schema
  - repo_scaffold
  - evaluation_plan
```

## Usage

### Load the registry

```python
from gcagent import load_registry

reg = load_registry()
print(reg.agent_name, reg.agent_version)

# Walk the layered taxonomy
for layer in reg.layers.values():
    members = layer.skills or layer.modules
    print(f"[{layer.id}] {layer.name} — {len(members)} members")
```

### Render the system prompt

```python
from gcagent import load_registry, render_system_prompt

reg = load_registry()

# Base prompt only (role + competency registry + behavior rules + output contract)
prompt = render_system_prompt(reg)

# Base prompt + resolved domain modules appended as a "Loaded modules" section
prompt = render_system_prompt(
    reg,
    include_modules=["construction_operations", "reporting_automation"],
)
```

### Resolve a module's required skills

```python
from gcagent import load_registry

reg = load_registry()
required = reg.resolve_module("compliance_documentation")
# -> [Skill(rag_systems), Skill(prompt_engineering), Skill(reliability_safety), Skill(debugging_observability)]
```

### Inspect a layer

```python
from gcagent import load_registry

reg = load_registry()
for skill in reg.skills_in_layer("execution"):
    print(skill.id, "-", skill.purpose)
```

## Skill contract

Every entry in `skill_registry.yaml` must satisfy:

| Field | Meaning |
|---|---|
| `id` | Stable, lowercase identifier used everywhere. |
| `name` | Human-readable name. |
| `purpose` | One-sentence statement of intent. |
| `capabilities` | Competencies this skill exercises. |
| `inputs` | What callers must supply. |
| `outputs` | What the skill produces. |
| `dependencies` | Other skills this skill composes on top of. |
| `safety_rules` | Non-negotiable rules enforced at runtime. |
| `success_criteria` | What "done well" looks like. |
| `failure_modes` | Known failure shapes to detect and prevent. |

Domain modules follow an analogous `module_contract` with `required_skills`
and cross-system `dependencies` (e.g., specific files under `backend/`).

The loader in `capabilities.py` validates these contracts on every load —
missing fields or unknown skill references fail loudly.

## Adding a new capability

1. Add the skill under `config/skill_registry.yaml` with the full contract.
2. Assign it to a layer in `config/capability_layers.yaml`.
3. Create a code package under `gcagent/<layer>/<skill_id>/` for runtime
   scaffolding.
4. If any domain module needs it, add it to that module's `required_skills`.
5. Run `python -m gcagent.capabilities` to validate the registry loads.

## Design notes

- **Declarative first.** YAML is the source of truth; Python types mirror it
  so non-Python callers (Node, shell, CI) can consume the same registry.
- **Contract enforced.** `load_registry()` validates every skill and module
  against its required fields before handing back a registry instance.
- **Prompt in Markdown, structured in blocks.** `system_prompt.md` is four
  labeled sections so individual blocks can be edited, reviewed, and tested
  without touching the others.
- **Module map is code, not prose.** Every skill and module has a real
  package path where runtime scaffolding, sub-agents, and tools will land.
