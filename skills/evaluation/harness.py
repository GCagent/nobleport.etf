"""Evaluation harness for the Noble Port Skills Layer (v1.0).

Turns a rubric (declared in `evaluation_rubrics.yaml`) plus per-criterion
scores into a deterministic pass/fail with the same math the rubric documents:

    overall = sum(weight_i * score_i) / max_scale          # normalized 0..1
    PASS    = overall >= pass_threshold
              AND every must_pass criterion scores >= its floor

It also applies a rubric's `review_policy` to decide whether a human must look
regardless of the automated verdict — the human-in-the-loop gate that the
feedback loop's "Human Review" stage consumes.

This is the automated "Score Against Rubric" stage made real: feed it scores
(from a human, an LLM judge, or a metric) and it returns a structured,
auditable `Evaluation`. It deliberately does NOT call any model — scoring is
pure and testable; wiring an LLM judge is the caller's job.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..registry import Rubric, SkillsLayer, load_registry

MAX_SCALE = 4  # rubric anchors are 0..4 across the layer


@dataclass(frozen=True)
class CriterionResult:
    id: str
    score: int
    weight: float
    must_pass: bool
    floor: int

    @property
    def below_floor(self) -> bool:
        return self.must_pass and self.score < self.floor

    @property
    def weighted(self) -> float:
        return self.weight * self.score


@dataclass(frozen=True)
class Evaluation:
    rubric_id: str
    overall: float                      # normalized 0..1
    passed: bool
    needs_human_review: bool
    criterion_results: tuple[CriterionResult, ...]
    failed_must_pass: tuple[str, ...]
    review_reasons: tuple[str, ...] = ()

    def summary(self) -> str:
        verdict = "PASS" if self.passed else "FAIL"
        review = " (needs human review)" if self.needs_human_review else ""
        return f"[{verdict}] {self.rubric_id} overall={self.overall:.2f}{review}"


def _resolve_rubric(rubric: Rubric | str, layer: SkillsLayer | None) -> tuple[Rubric, SkillsLayer]:
    if isinstance(rubric, Rubric):
        return rubric, (layer or load_registry())
    layer = layer or load_registry()
    if rubric not in layer.rubrics:
        raise KeyError(f"Unknown rubric: {rubric}")
    return layer.rubrics[rubric], layer


def score(
    rubric: Rubric | str,
    scores: dict[str, int],
    *,
    layer: SkillsLayer | None = None,
    context: dict | None = None,
) -> Evaluation:
    """Score a single skill output against its rubric.

    Args:
        rubric:   a Rubric object or a rubric id resolvable in the layer.
        scores:   {criterion_id: 0..4} — must cover every rubric criterion.
        layer:    optional preloaded SkillsLayer (avoids re-reading YAML).
        context:  optional signals the rubric's review_policy may key on,
                  e.g. {"disposition": "reject", "risk_band": "high"}.

    Returns:
        An Evaluation with the normalized score, pass/fail, must-pass failures,
        and whether a human must review.
    """
    rubric_obj, layer = _resolve_rubric(rubric, layer)
    context = context or {}

    expected = {c.id for c in rubric_obj.criteria}
    provided = set(scores)
    if expected != provided:
        missing = expected - provided
        extra = provided - expected
        raise ValueError(
            f"Score keys do not match rubric '{rubric_obj.id}'. "
            f"missing={sorted(missing)} extra={sorted(extra)}"
        )

    results: list[CriterionResult] = []
    for c in rubric_obj.criteria:
        s = int(scores[c.id])
        if not 0 <= s <= MAX_SCALE:
            raise ValueError(
                f"Score for '{c.id}' is {s}; must be within 0..{MAX_SCALE}."
            )
        results.append(
            CriterionResult(
                id=c.id, score=s, weight=c.weight,
                must_pass=c.must_pass, floor=c.floor,
            )
        )

    overall = sum(r.weighted for r in results) / MAX_SCALE
    failed_must_pass = tuple(r.id for r in results if r.below_floor)
    passed = overall >= rubric_obj.pass_threshold and not failed_must_pass

    needs_review, reasons = _apply_review_policy(rubric_obj, overall, results, context)

    return Evaluation(
        rubric_id=rubric_obj.id,
        overall=round(overall, 4),
        passed=passed,
        needs_human_review=needs_review,
        criterion_results=tuple(results),
        failed_must_pass=failed_must_pass,
        review_reasons=tuple(reasons),
    )


def _apply_review_policy(
    rubric: Rubric,
    overall: float,
    results: list[CriterionResult],
    context: dict,
) -> tuple[bool, list[str]]:
    """Evaluate `review_policy.human_review_when` clauses against the result."""
    reasons: list[str] = []
    policy = rubric.review_policy or {}
    clauses = policy.get("human_review_when", []) or []

    # A failed must-pass criterion always warrants review.
    if any(r.below_floor for r in results):
        reasons.append("must_pass criterion below floor")

    for clause in clauses:
        if not isinstance(clause, dict):
            continue
        for key, value in clause.items():
            if key == "always" and value:
                reasons.append("rubric requires review on every case")
            elif key == "score_below" and overall < float(value):
                reasons.append(f"overall {overall:.2f} < {value}")
            elif key == "any_must_pass_at_floor" and value:
                if any(r.must_pass and r.score == r.floor for r in results):
                    reasons.append("a must_pass criterion is exactly at its floor")
            elif key in context:
                # Context-keyed clauses, e.g. {disposition: reject},
                # {risk_band: high}, {confidence_below: 0.6}.
                ctx_val = context[key]
                if key.endswith("_below"):
                    if float(ctx_val) < float(value):
                        reasons.append(f"context {key}={ctx_val} < {value}")
                elif ctx_val == value:
                    reasons.append(f"context {key}={ctx_val}")
            elif key in ("high_stakes_context", "calibration_run", "calibration_below") \
                    and context.get(key):
                reasons.append(f"context flag {key} set")

    return (len(reasons) > 0, reasons)


@dataclass
class GoldenSetResult:
    rubric_id: str
    cases: int = 0
    passes: int = 0
    review_flagged: int = 0
    evaluations: list[Evaluation] = field(default_factory=list)

    @property
    def pass_rate(self) -> float:
        return self.passes / self.cases if self.cases else 0.0


def evaluate_golden_set(
    rubric: Rubric | str,
    cases: list[dict],
    *,
    layer: SkillsLayer | None = None,
) -> GoldenSetResult:
    """Score a list of cases (each {scores, context?}) and roll up pass rate.

    This is what the feedback loop's `retrain_workflow` gate runs to prove a
    skill change does not regress its golden set before it merges.
    """
    rubric_obj, layer = _resolve_rubric(rubric, layer)
    result = GoldenSetResult(rubric_id=rubric_obj.id)
    for case in cases:
        ev = score(
            rubric_obj,
            case["scores"],
            layer=layer,
            context=case.get("context"),
        )
        result.cases += 1
        result.passes += int(ev.passed)
        result.review_flagged += int(ev.needs_human_review)
        result.evaluations.append(ev)
    return result
