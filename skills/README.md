# Noble Port — Cross-Agent Skills Layer (v1.0)

> Build skills → build evaluations → build feedback loops → **then** build features.
>
> The bottleneck is not "more AI." It's better training systems. This package is
> that training system, built first.

```
Data → Evals → Feedback Loops → Domain Expertise → Better AI
```

This is the domain-expertise foundation **shared by every Noble Port agent** —
GCagent.ai, PMagent, PermitStream, and Stephanie.ai. It is deliberately separate
from `gcagent/`, which models GCagent's generic *engineering* competence. This
layer models *domain* competence (construction, sales, permits, project
management, operations, reasoning) that any agent composes.

The core rule: **a skill does not exist until it has a declared contract *and* a
matching evaluation rubric.** The loader enforces it — no rubric, no skill.

## What's here

| Tier | Concept | Source of truth |
|---|---|---|
| 1 | **Core skills layer** — the 29 domain skills, 10 prioritized | `config/skill_registry.yaml` |
| 2 | **Expert lanes** — which agent masters which skills | `config/expert_lanes.yaml` |
| 3 | **Evaluation system** — weighted, anchored rubric per skill | `config/evaluation_rubrics.yaml` |
| 3 | **Feedback loop** — data → score → review → correct → retrain | `config/feedback_loop.yaml` |

Runtime:

```
skills/
├── registry.py                 # typed loader + contract validation
├── config/
│   ├── skill_registry.yaml     # domains + skills (contract per skill)
│   ├── evaluation_rubrics.yaml # rubric per skill (Tier 3 — the spine)
│   ├── expert_lanes.yaml       # per-agent skill assignments (Tier 2)
│   └── feedback_loop.yaml      # the closed reinforcement loop
├── evaluation/
│   ├── harness.py              # deterministic rubric scoring ("Score Against Rubric")
│   ├── store.py                # append-only correction store ("Store Corrections")
│   └── corrections/            # JSONL corrections land here
├── lanes/                      # per-lane runtime scaffolding (stubs)
└── tests/                      # contract + harness tests
```

## The first ten skills

The prioritized slice that ships before any new avatar / token / agent-count
feature work. Each carries `build_order: 1..10` in the registry.

| # | Skill | Domain | Lane |
|---|---|---|---|
| 1 | Lead Qualification | sales | Stephanie.ai |
| 2 | Estimate Generation | construction | GCagent.ai |
| 3 | Construction Scope Parsing | construction | GCagent.ai |
| 4 | Permit Interpretation | permits | PermitStream |
| 5 | Change Order Detection | construction | GCagent.ai |
| 6 | Risk Scoring | operations | Stephanie.ai |
| 7 | Proposal Generation | sales | Stephanie.ai |
| 8 | Client Communication | sales | Stephanie.ai |
| 9 | Job Sequencing | construction | GCagent.ai |
| 10 | Revenue Prioritization | operations | Stephanie.ai |

## Skill contract

Every entry in `skill_registry.yaml` satisfies:

| Field | Meaning |
|---|---|
| `id` / `name` | Stable identifier / human name. |
| `domain` | One of the six declared domains. |
| `tier` | 1 core · 2 expert-lane · 3 reasoning/eval foundation. |
| `purpose` | One-sentence statement of intent. |
| `inputs` / `outputs` | What the skill consumes and produces. |
| `expert_signals` | What a domain expert checks that a generic model misses. |
| `rubric` | The rubric id that scores it (must resolve). |
| `safety_rules` | Non-negotiable runtime rules (no autonomous sends, etc.). |
| `success_criteria` / `failure_modes` | What "done well" and known failures look like. |
| `build_order` *(opt)* | 1..10 for the prioritized slice. |
| `dependencies` *(opt)* | Other skill ids this composes on. |

## Rubric model (Tier 3 — the most important part)

Each rubric scores an output on a **0..4 anchored scale** across weighted
criteria whose weights sum to 1.0 (enforced on load):

```
overall = Σ(weightᵢ · scoreᵢ) / 4          # normalized 0..1
PASS    = overall ≥ pass_threshold
          AND every must_pass criterion ≥ its floor
```

`review_policy.human_review_when` decides when a human must look regardless of
the automated verdict — on failure, borderline scores, high-stakes context, or
for always-review skills (estimates, proposals, client messages, change orders,
permit interpretation).

## Usage

```python
from skills import load_registry
from skills.evaluation import score

layer = load_registry()                       # validates the whole layer

# Walk the prioritized build slice
for s in layer.first_ten():
    print(s.build_order, s.name, "→", s.rubric)

# What does GCagent own?
gc = layer.lane_for_agent("GCagent.ai")
print(gc.skills, "+ shared:", layer.shared_foundations)

# Score an estimate against its rubric (scores come from a human or LLM judge)
ev = score("estimate_generation", {
    "total_variance": 3,
    "line_item_traceability": 4,
    "assumptions_exclusions": 4,
    "not_presented_as_bid": 4,
})
print(ev.summary())          # [PASS] estimate_generation overall=0.94 (needs human review)
print(ev.needs_human_review) # True — estimates are always human-approved
```

Store a human correction so the retrain stage can pull it back out:

```python
from skills.evaluation import Correction, CorrectionStore

CorrectionStore().append(Correction(
    skill_id="estimate_generation", case_id="case-001",
    reviewer="expert@nobleport", rubric_id="estimate_generation",
    automated_overall=0.74, human_overall=0.60, accepted=False,
    correction_note="Missing demo allowance; labor burden too low.",
    corrected_output={"added_line": "selective demolition allowance"},
))
```

## The feedback loop

`config/feedback_loop.yaml` declares the closed reinforcement loop the harness
and store implement:

```
INPUT → Agent Response → Score Against Rubric → Human Review
      → Store Corrections → Retrain Workflow → (back to INPUT)
```

Invariants enforced by the design:

- No skill ships to the intake pipeline without a passing golden-set run.
- Human corrections are never discarded; they expand the golden set.
- A retrain that regresses the golden set is rejected, not merged.

## Validate

```bash
python -m skills.registry             # loads + prints the layer summary
python -m skills.tests.test_skills_layer   # 15 contract + harness tests (no pytest needed)
# or, with pytest installed:
python -m pytest skills/tests/ -q
```

`load_registry()` fails loudly on: a missing contract field, a skill pointing at
an unknown rubric/domain/dependency, rubric weights that don't sum to 1.0, a
duplicate `build_order`, a lane referencing an unknown skill, or a feedback loop
that isn't closed.

## Adding a skill

1. Add the rubric to `config/evaluation_rubrics.yaml` (weights must sum to 1.0).
2. Add the skill to `config/skill_registry.yaml` with the full contract, pointing
   `rubric:` at it.
3. Assign it to a lane in `config/expert_lanes.yaml` (or `shared_foundations`).
4. Run `python -m skills.registry` to validate, then build the golden set.

## What this replaces (sequencing, not scope deletion)

Per the directive that opened this work, the **first** improvement is skills, not
features. Until the first ten skills pass their golden sets, hold: new avatar
features, new token features, and expanding agent count. Build the training
system first; the features compound on top of it.
