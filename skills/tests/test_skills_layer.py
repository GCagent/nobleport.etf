"""Contract + harness tests for the Noble Port Skills Layer.

Run with:  python -m pytest skills/tests/ -q
Or standalone (no pytest):  python skills/tests/test_skills_layer.py
"""

from __future__ import annotations

from pathlib import Path

from skills.registry import load_registry
from skills.evaluation.harness import evaluate_golden_set, score
from skills.evaluation.store import Correction, CorrectionStore


# --- registry / contract validation ---------------------------------------


def test_registry_loads_and_validates():
    layer = load_registry()
    assert layer.version == "1.0"
    assert len(layer.domains) == 6
    assert len(layer.skills) >= 20
    assert len(layer.lanes) == 4
    # load_registry already enforced: every rubric weight sums to 1.0, every
    # skill rubric/domain/dependency resolves, lanes reference known skills,
    # and the feedback loop is closed.


def test_every_skill_has_a_resolvable_rubric():
    layer = load_registry()
    for skill in layer.skills.values():
        assert skill.rubric in layer.rubrics, skill.id
        # rubric_for is the convenience accessor agents will use.
        assert layer.rubric_for(skill.id).id == skill.rubric


def test_first_ten_are_ordered_and_complete():
    layer = load_registry()
    first_ten = layer.first_ten()
    assert [s.build_order for s in first_ten] == list(range(1, 11))
    # The prioritized slice spans multiple domains, not just construction.
    assert len({s.domain for s in first_ten}) >= 3


def test_lanes_cover_the_four_agents():
    layer = load_registry()
    agents = {lane.agent for lane in layer.lanes.values()}
    assert agents == {"GCagent.ai", "PMagent", "PermitStream", "Stephanie.ai"}
    for lane in layer.lanes.values():
        assert lane.skills  # non-empty
        for sid in lane.skills:
            assert layer.has_skill(sid)


def test_shared_foundations_resolve():
    layer = load_registry()
    assert "evaluation" in layer.shared_foundations
    for sid in layer.shared_foundations:
        assert layer.has_skill(sid)


def test_feedback_loop_is_closed():
    layer = load_registry()
    stage_ids = list(layer.stages)
    assert stage_ids[0] == "intake"
    assert layer.stages[stage_ids[-1]].feeds == stage_ids[0]


# --- harness math ----------------------------------------------------------


def test_score_passes_clean_output():
    layer = load_registry()
    # All criteria scored 4 -> overall 1.0 -> passes any threshold.
    rubric = layer.rubrics["lead_qualification"]
    scores = {c.id: 4 for c in rubric.criteria}
    ev = score(rubric, scores, layer=layer)
    assert ev.overall == 1.0
    assert ev.passed
    assert not ev.failed_must_pass


def test_must_pass_floor_fails_even_with_high_overall():
    layer = load_registry()
    # client_communication: no_unauthorized_commitment must score a full 4.
    rubric = layer.rubrics["client_communication"]
    scores = {c.id: 4 for c in rubric.criteria}
    scores["no_unauthorized_commitment"] = 3  # one below its floor of 4
    ev = score(rubric, scores, layer=layer)
    assert "no_unauthorized_commitment" in ev.failed_must_pass
    assert not ev.passed
    assert ev.needs_human_review


def test_normalized_overall_math():
    layer = load_registry()
    rubric = layer.rubrics["risk_scoring"]
    # Score every criterion 2 -> weighted sum 2 -> normalized 0.5.
    ev = score(rubric, {c.id: 2 for c in rubric.criteria}, layer=layer)
    assert abs(ev.overall - 0.5) < 1e-9


def test_review_policy_always_flags():
    layer = load_registry()
    # estimate_generation review_policy: always review.
    rubric = layer.rubrics["estimate_generation"]
    ev = score(rubric, {c.id: 4 for c in rubric.criteria}, layer=layer)
    assert ev.passed
    assert ev.needs_human_review  # always-review skill


def test_context_keyed_review_policy():
    layer = load_registry()
    rubric = layer.rubrics["lead_qualification"]
    scores = {c.id: 4 for c in rubric.criteria}
    # disposition: reject must force a human review even on a clean score.
    ev = score(rubric, scores, layer=layer, context={"disposition": "reject"})
    assert ev.needs_human_review


def test_score_rejects_mismatched_keys():
    layer = load_registry()
    rubric = layer.rubrics["lead_qualification"]
    try:
        score(rubric, {"only_one": 4}, layer=layer)
    except ValueError as e:
        assert "do not match" in str(e)
    else:
        raise AssertionError("expected ValueError on mismatched score keys")


def test_golden_set_rollup():
    layer = load_registry()
    rubric = layer.rubrics["risk_scoring"]
    full = {c.id: 4 for c in rubric.criteria}
    half = {c.id: 2 for c in rubric.criteria}
    res = evaluate_golden_set(
        rubric, [{"scores": full}, {"scores": full}, {"scores": half}], layer=layer
    )
    assert res.cases == 3
    assert res.passes == 2
    assert abs(res.pass_rate - 2 / 3) < 1e-9


# --- correction store ------------------------------------------------------


def test_correction_store_roundtrip(tmp_path: Path):
    store = CorrectionStore(tmp_path / "corrections.jsonl")
    store.append(
        Correction(
            skill_id="estimate_generation",
            case_id="case-001",
            reviewer="expert@nobleport",
            rubric_id="estimate_generation",
            automated_overall=0.74,
            human_overall=0.60,
            accepted=False,
            correction_note="Missing demo allowance; labor burden too low.",
            corrected_output={"added_line": "selective demolition allowance"},
        )
    )
    assert store.count() == 1
    got = store.for_skill("estimate_generation")
    assert got[0].case_id == "case-001"
    assert not got[0].accepted


def test_correction_requires_links(tmp_path: Path):
    store = CorrectionStore(tmp_path / "c.jsonl")
    try:
        store.append(
            Correction(
                skill_id="", case_id="x", reviewer="r", rubric_id="z",
                automated_overall=0.0, human_overall=0.0, accepted=True,
                correction_note="",
            )
        )
    except ValueError as e:
        assert "missing required link" in str(e)
    else:
        raise AssertionError("expected ValueError on unlinked correction")


# --- standalone runner (no pytest) -----------------------------------------

if __name__ == "__main__":
    import tempfile

    passed = 0
    failed = 0
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_")]
    for name, fn in tests:
        try:
            if "tmp_path" in fn.__code__.co_varnames:
                with tempfile.TemporaryDirectory() as d:
                    fn(Path(d))
            else:
                fn()
            passed += 1
            print(f"  PASS {name}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  FAIL {name}: {exc}")
    print(f"\n{passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)
