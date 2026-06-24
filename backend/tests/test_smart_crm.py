"""
Tests for the NoblePort Construction Smart CRM blueprint registry.

These assert the canonical blueprint is internally consistent: every hub is
present exactly once, every table a hub references exists in the core catalog,
every hub's primary agent is real, the Finance hub requires human approval, and
the build phases are numbered without gaps. They also pin the blueprint as
STAGED so it cannot silently flip to "live" without an explicit change here.
"""

from __future__ import annotations

import importlib

from backend.core.smart_crm import (
    BUILD_PHASES,
    CRM_AGENTS,
    CRM_TABLES,
    HUBS,
    SMART_CRM,
    STATUS,
    HubId,
    SmartCRM,
)


def test_registry_validates():
    # The singleton validates at import; re-running must stay clean.
    SMART_CRM.validate()


def test_blueprint_is_staged():
    assert STATUS == "staged"
    assert SMART_CRM.system_map()["status"] == "staged"


def test_every_hub_present_exactly_once():
    ids = [hub.id for hub in SMART_CRM.hubs]
    assert sorted(i.value for i in ids) == sorted(i.value for i in HubId)
    assert len(ids) == len(set(ids))


def test_seven_hubs():
    assert len(HUBS) == 7


def test_hub_table_references_exist():
    known = set(SMART_CRM.table_names())
    for hub in SMART_CRM.hubs:
        for table in hub.tables:
            assert table in known, f"{hub.id.value} -> unknown table {table}"


def test_hub_primary_agents_are_real():
    known_agents = set(SMART_CRM.agent_keys())
    for hub in SMART_CRM.hubs:
        if hub.primary_agent:
            assert hub.primary_agent in known_agents


def test_core_catalog_matches_spec():
    expected = {
        "contacts", "properties", "companies", "leads", "opportunities",
        "estimates", "contracts", "projects", "daily_logs", "materials",
        "purchase_orders", "vendors", "subcontractors", "inspections",
        "permits", "change_orders", "invoices", "payments", "warranties",
        "service_requests", "audit_log", "activity_log",
    }
    assert set(SMART_CRM.table_names()) == expected
    assert len(CRM_TABLES) == 22


def test_table_models_are_importable():
    # Every table that claims a model must point at a real, importable class.
    for table in CRM_TABLES:
        if not table.model:
            continue
        module_path, _, attr = table.model.rpartition(".")
        module = importlib.import_module(module_path)
        assert hasattr(module, attr), f"{table.name} -> missing {table.model}"


def test_finance_hub_requires_human_approval():
    finance = SMART_CRM.hub(HubId.FINANCE)
    assert finance.requires_human_approval is True


def test_agent_keys_unique():
    keys = [a.key for a in CRM_AGENTS]
    assert len(keys) == len(set(keys))


def test_build_phases_numbered_without_gaps():
    numbers = sorted(p.number for p in BUILD_PHASES)
    assert numbers == list(range(1, len(BUILD_PHASES) + 1))


def test_table_names_unique():
    names = SMART_CRM.table_names()
    assert len(names) == len(set(names))


def test_malformed_registry_fails_validation():
    # Dropping a hub must make validation fail fast.
    broken = SmartCRM(hubs=HUBS[:-1])
    try:
        broken.validate()
    except ValueError:
        return
    raise AssertionError("Expected ValueError for missing hub")
