"""
Tests for the NoblePort v2.0 sales-intelligence engine.

These assert the model's hard guarantees: GPPI weights sum to 1.0 and are
applied as documented, the heaviest-weighted KPI dominates ranking, the
revenue hierarchy orders ADUs above bathrooms, the 80/20 rule sends premium
leads to top performers, the simulation is deterministic and carries the
SIMULATED truth tag, and the data-readiness gate transitions on schedule.
"""

from __future__ import annotations

from backend.governance.truth_layer import TruthTag
from backend.sales import (
    BASELINE_HIGH,
    BASELINE_LOW,
    CLOSE_RATE_CEILING,
    GPPI_WEIGHTS,
    SALES_BUDGET_GATE_USD,
    CaptureState,
    DataProvenance,
    Gate,
    Lead,
    LeadGrade,
    RepStats,
    RevenueTier,
    SalesAction,
    SimulationMode,
    aggregate,
    classify_action,
    collaboration_map,
    enrich_lead,
    governance_matrix,
    grade_lead,
    profitability_score,
    project_close_rate,
    route_leads,
    run_simulation,
    score_cohort,
    tier_of,
)
from backend.sales.gppi import GppiKpi


# ---------------------------------------------------------------------------
# GPPI
# ---------------------------------------------------------------------------

def test_gppi_weights_sum_to_one():
    assert abs(sum(GPPI_WEIGHTS.values()) - 1.0) < 1e-9


def test_gppi_weights_match_spec():
    assert GPPI_WEIGHTS[GppiKpi.GROSS_PROFIT] == 0.40
    assert GPPI_WEIGHTS[GppiKpi.REVENUE] == 0.25
    assert GPPI_WEIGHTS[GppiKpi.AVG_JOB_SIZE] == 0.15
    assert GPPI_WEIGHTS[GppiKpi.CLOSE_RATE] == 0.10
    assert GPPI_WEIGHTS[GppiKpi.LEAD_RESPONSE_TIME] == 0.05
    assert GPPI_WEIGHTS[GppiKpi.CUSTOMER_SATISFACTION] == 0.05


def _rep(rep_id: str, gp: float, rev: float, jobs: int, opps: int,
         resp: float, csat: float) -> RepStats:
    return RepStats(
        rep_id=rep_id, name=rep_id, gross_profit=gp, revenue=rev,
        jobs_won=jobs, opportunities=opps, lead_response_hours=resp,
        customer_satisfaction=csat,
    )


def test_high_gross_profit_rep_outranks_high_volume_rep():
    """The v2.0 thesis: one ADU at $325k beats two bathrooms at $15k."""
    adu_closer = _rep("adu", gp=110_000, rev=325_000, jobs=1, opps=2, resp=2.0, csat=4.8)
    bath_closer = _rep("bath", gp=9_000, rev=30_000, jobs=2, opps=3, resp=2.0, csat=4.8)
    ranked = score_cohort([adu_closer, bath_closer])
    assert ranked[0].rep_id == "adu"
    assert ranked[0].rank == 1
    assert ranked[1].rep_id == "bath"


def test_close_rate_alone_does_not_win():
    """A perfect close rate on tiny jobs loses to big gross profit (v1 -> v2 fix)."""
    perfect_closer = _rep("perfect", gp=12_000, rev=40_000, jobs=5, opps=5, resp=1.0, csat=5.0)
    big_gp = _rep("big", gp=200_000, rev=600_000, jobs=3, opps=8, resp=8.0, csat=4.0)
    ranked = score_cohort([perfect_closer, big_gp])
    assert ranked[0].rep_id == "big"


def test_lead_response_time_is_inverted():
    """Faster response should score higher on that KPI."""
    fast = _rep("fast", gp=50_000, rev=150_000, jobs=2, opps=4, resp=0.5, csat=4.5)
    slow = _rep("slow", gp=50_000, rev=150_000, jobs=2, opps=4, resp=24.0, csat=4.5)
    ranked = {s.rep_id: s for s in score_cohort([fast, slow])}
    rt = GppiKpi.LEAD_RESPONSE_TIME.value
    assert ranked["fast"].normalized[rt] > ranked["slow"].normalized[rt]


def test_score_is_bounded_and_percentile_assigned():
    reps = [_rep(f"r{i}", gp=i * 10_000, rev=i * 30_000, jobs=i + 1, opps=i + 3,
                 resp=float(i + 1), csat=4.0) for i in range(1, 6)]
    ranked = score_cohort(reps)
    for s in ranked:
        assert 0.0 <= s.score <= 100.0
    assert ranked[0].percentile == 1.0
    assert ranked[-1].percentile == 0.0


def test_single_rep_cohort_is_neutral_and_top():
    only = _rep("solo", gp=50_000, rev=150_000, jobs=2, opps=4, resp=3.0, csat=4.5)
    ranked = score_cohort([only])
    assert len(ranked) == 1
    assert ranked[0].percentile == 1.0
    # All KPIs normalize to neutral 1.0 -> score is the full 100.
    assert abs(ranked[0].score - 100.0) < 1e-6


def test_empty_cohort_returns_empty():
    assert score_cohort([]) == []


# ---------------------------------------------------------------------------
# Hierarchy
# ---------------------------------------------------------------------------

def test_adu_is_tier_one_and_bathroom_is_tier_three():
    assert tier_of("adu") == RevenueTier.TIER_1
    assert tier_of("bathroom") == RevenueTier.TIER_3
    assert tier_of("painting") == RevenueTier.TIER_4


def test_strategic_weight_decreases_with_tier():
    from backend.sales import strategic_weight
    assert strategic_weight("adu") > strategic_weight("roofing")
    assert strategic_weight("roofing") > strategic_weight("bathroom")
    assert strategic_weight("bathroom") > strategic_weight("painting")


# ---------------------------------------------------------------------------
# Lead routing (80/20 profitable-lead rule)
# ---------------------------------------------------------------------------

def test_tier_one_lead_is_always_premium():
    lead = Lead("l1", "adu", "Newburyport", 325_000)
    assert grade_lead(lead) == LeadGrade.PREMIUM


def test_qualifier_promotes_lower_tier_lead_to_premium():
    plain = Lead("l2", "roofing", "Ipswich", 40_000)
    waterfront = Lead("l3", "roofing", "Marblehead", 80_000, qualifiers=("waterfront",))
    assert profitability_score(waterfront) > profitability_score(plain)
    assert grade_lead(waterfront) == LeadGrade.PREMIUM


def test_small_painting_lead_is_standard():
    assert grade_lead(Lead("l4", "painting", "Essex", 6_000)) == LeadGrade.STANDARD


def test_premium_leads_route_to_top_performers():
    reps = [_rep(f"r{i}", gp=i * 40_000, rev=i * 120_000, jobs=i, opps=i + 2,
                 resp=float(6 - i), csat=4.0 + i * 0.1) for i in range(1, 6)]
    leaderboard = score_cohort(reps)
    leads = [
        Lead("p1", "adu", "Newburyport", 300_000),
        Lead("p2", "design_build", "Portsmouth", 400_000),
        Lead("s1", "painting", "Essex", 6_000),
    ]
    plan = route_leads(leads, leaderboard)
    top_ids = set(plan.top_performer_ids)
    premium = [r for r in plan.routed if r.grade == LeadGrade.PREMIUM]
    assert premium, "expected at least one premium lead"
    for r in premium:
        assert r.assigned_to in top_ids


def test_routing_top_performer_fraction_is_twenty_percent():
    reps = [_rep(f"r{i}", gp=i * 10_000, rev=i * 30_000, jobs=i, opps=i + 2,
                 resp=1.0, csat=4.0) for i in range(1, 11)]
    leaderboard = score_cohort(reps)
    plan = route_leads([], leaderboard)
    # 20% of 10 reps -> 2 top performers.
    assert len(plan.top_performer_ids) == 2
    assert len(plan.developing_ids) == 8


def test_routing_with_no_reps_leaves_leads_unassigned():
    plan = route_leads([Lead("l", "adu", "Rye", 300_000)], [])
    assert plan.routed[0].assigned_to is None


# ---------------------------------------------------------------------------
# Simulation + truth tagging
# ---------------------------------------------------------------------------

def test_simulation_is_deterministic():
    a = run_simulation(team_size=8, lead_count=40, seed=7)
    b = run_simulation(team_size=8, lead_count=40, seed=7)
    assert a.to_dict() == b.to_dict()


def test_simulation_is_tagged_simulated():
    sim = run_simulation(seed=1)
    assert sim.truth_tag == TruthTag.SIMULATED
    payload = sim.to_dict()
    assert payload["label"] == "SIMULATED MODEL OUTPUT"
    assert payload["needed_next"] == "ACTUAL NOBLEPORT SALES DATASET"
    assert payload["decision_authority"] == "Human Review Required"


def test_simulation_leaderboard_is_ranked():
    sim = run_simulation(team_size=8, seed=3)
    ranks = [s.rank for s in sim.leaderboard]
    assert ranks == sorted(ranks)
    scores = [s.score for s in sim.leaderboard]
    assert scores == sorted(scores, reverse=True)


def test_different_seeds_differ():
    a = run_simulation(seed=1)
    b = run_simulation(seed=2)
    assert a.to_dict() != b.to_dict()


# ---------------------------------------------------------------------------
# Data readiness gate
# ---------------------------------------------------------------------------

def test_data_readiness_transitions():
    assert run_simulation(months_of_real_data=0).readiness.mode is SimulationMode.SIMULATION_PRIMARY
    assert run_simulation(months_of_real_data=6).readiness.mode is SimulationMode.BLENDED
    assert run_simulation(months_of_real_data=12).readiness.mode is SimulationMode.DATA_PRIMARY


def test_data_readiness_weight_caps_at_one():
    assert run_simulation(months_of_real_data=24).readiness.real_data_weight == 1.0
    assert run_simulation(months_of_real_data=3).readiness.real_data_weight == 0.25


# ---------------------------------------------------------------------------
# Dashboard aggregation
# ---------------------------------------------------------------------------

def test_dashboard_aggregate_shape():
    sim = run_simulation(team_size=8, lead_count=40, seed=5)
    payload = aggregate(sim)
    assert payload["label"] == "SIMULATED MODEL OUTPUT"
    assert payload["version"] == "2.1"
    assert set(payload["headline"]) >= {"gross_profit", "revenue", "gross_margin_pct"}
    assert len(payload["markets"]) == 8
    # Premium + standard routed leads reconcile with the lead count.
    routed = payload["routing"]["premium"] + payload["routing"]["standard"]
    assert routed == 40
    assert {"lead", "sales", "financial"} <= set(payload["metric_groups"])
    # v2.1 War Board sections present.
    assert {"capture", "close_rate", "governance", "collaboration"} <= set(payload)


# ---------------------------------------------------------------------------
# v2.1 — Data provenance (SIMULATED | BLENDED | ACTUAL), capture-first
# ---------------------------------------------------------------------------

def test_provenance_starts_simulated():
    assert CaptureState().provenance is DataProvenance.SIMULATED
    assert CaptureState(months_of_real_data=24).provenance is DataProvenance.SIMULATED


def test_capture_first_time_alone_does_not_promote():
    """Twelve months with an empty CRM is still SIMULATED — capture-first."""
    state = CaptureState(months_of_real_data=18, captured_opportunities=0)
    assert state.provenance is DataProvenance.SIMULATED


def test_provenance_blended_on_captured_data():
    state = CaptureState(months_of_real_data=3, captured_opportunities=60, captured_completions=5)
    assert state.provenance is DataProvenance.BLENDED
    assert 0.0 < state.real_data_weight < 1.0


def test_provenance_actual_requires_time_and_capture():
    enough = CaptureState(months_of_real_data=12, captured_opportunities=200, captured_completions=30)
    assert enough.provenance is DataProvenance.ACTUAL
    assert enough.real_data_weight == 1.0
    # Plenty of data but not enough calendar -> still BLENDED.
    early = CaptureState(months_of_real_data=8, captured_opportunities=300, captured_completions=40)
    assert early.provenance is DataProvenance.BLENDED


def test_provenance_blocking_gaps_reported():
    state = CaptureState(months_of_real_data=2, captured_opportunities=10, captured_completions=0)
    gaps = state.blocking_gaps
    assert len(gaps) == 3  # months, opportunities, completions all short


def test_simulation_provenance_flows_through():
    sim = run_simulation(captured_opportunities=200, captured_completions=30, months_of_real_data=12)
    assert sim.provenance is DataProvenance.ACTUAL
    assert sim.to_dict()["provenance"] == "ACTUAL"
    assert sim.to_dict()["label"] == "ACTUAL MODEL OUTPUT"


# ---------------------------------------------------------------------------
# v2.1 — Close-rate growth loop
# ---------------------------------------------------------------------------

def test_close_rate_projects_from_baseline_midpoint():
    proj = project_close_rate()
    assert proj.current == (BASELINE_LOW + BASELINE_HIGH) / 2
    assert proj.projected > proj.current  # levers add lift


def test_close_rate_never_exceeds_ceiling():
    proj = project_close_rate(current=0.40)
    assert proj.projected <= CLOSE_RATE_CEILING + 1e-9


def test_close_rate_marginal_gains_sum_to_total():
    proj = project_close_rate(current=0.10)
    total = sum(l["marginal_gain"] for l in proj.applied)
    # Per-lever marginals are rounded to 4dp, so allow cumulative rounding slack.
    assert abs(total - (proj.projected - proj.current)) < 1e-3


# ---------------------------------------------------------------------------
# v2.1 — Human-gated sales governance
# ---------------------------------------------------------------------------

def test_routing_is_autonomous():
    d = classify_action(SalesAction.ROUTE_LEAD)
    assert d.gate is Gate.AUTO
    assert d.requires_human is False
    assert d.tag is TruthTag.LIVE


def test_contract_approval_is_human_gated():
    d = classify_action(SalesAction.APPROVE_CONTRACT)
    assert d.gate is Gate.HUMAN
    assert d.tag is TruthTag.STAGED


def test_budget_gate_demotes_autonomous_action():
    d = classify_action(SalesAction.ROUTE_LEAD, amount_usd=SALES_BUDGET_GATE_USD + 1)
    assert d.gate is Gate.HUMAN
    assert d.escalated is True


def test_unknown_sales_action_fails_closed():
    d = classify_action("totally_unknown_action")
    assert d.tag is TruthTag.BLOCKED
    assert d.requires_human is True


def test_governance_matrix_complete():
    matrix = governance_matrix()
    assert len(matrix) == len(SalesAction)


# ---------------------------------------------------------------------------
# v2.1 — Collaboration layer + tax-aware enrichment (advisory only)
# ---------------------------------------------------------------------------

def test_collaboration_map_has_all_agents():
    systems = set()
    for h in collaboration_map():
        systems.add(h["from"])
        systems.add(h["to"])
    assert {"Stephanie.ai", "PermitStream.ai", "GCagent.ai", "Cyborg.ai"} <= systems


def test_tax_enrichment_is_advisory_and_cpa_gated():
    adv = enrich_lead("investor_redevelopment", estimated_value=500_000)
    assert adv.eligible is True
    assert adv.advisory_only is True
    assert adv.cpa_review_required is True
    assert adv.topics  # has talking points
    assert adv.governance["requires_human"] is True


def test_tax_enrichment_ineligible_for_small_jobs():
    adv = enrich_lead("painting", estimated_value=6_000)
    assert adv.eligible is False
    assert adv.topics == []
    # Still advisory-only/CPA-gated even when ineligible — guardrails never drop.
    assert adv.cpa_review_required is True
