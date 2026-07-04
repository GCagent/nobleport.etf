"""
Tests for the NoblePort Master Operating System (NP-OS) registry.

These assert that the canonical system definition is internally consistent:
every operating layer is present, every table a layer references exists in the
master catalog, North Star metrics point at real layers, and the advisory-only
authority boundary (Stephanie.ai moves no money, files no permits, signs no
contracts) holds.
"""

from __future__ import annotations

import pytest

from backend.core.np_os import (
    LAYERS,
    MASTER_TABLES,
    NORTH_STAR_METRICS,
    NP_OS,
    LayerId,
    MasterOperatingSystem,
)


def test_registry_validates():
    # The singleton validates at import; re-running must stay clean.
    NP_OS.validate()


def test_every_layer_present_exactly_once():
    ids = [layer.id for layer in NP_OS.layers]
    assert sorted(i.value for i in ids) == sorted(i.value for i in LayerId)
    assert len(ids) == len(set(ids))


def test_layer_table_references_exist():
    known = set(NP_OS.table_names())
    for layer in NP_OS.layers:
        for table in layer.tables:
            assert table in known, f"{layer.id.value} -> unknown table {table}"


def test_master_catalog_matches_spec():
    expected = {
        "Clients", "Properties", "Leads", "Estimates", "Contracts", "Projects",
        "Tasks", "Permits", "Inspections", "Invoices", "Payments",
        "Change Orders", "Vendors", "Subcontractors", "Employees", "Equipment",
        "Photos", "Documents", "Audit Logs",
    }
    assert set(NP_OS.table_names()) == expected
    assert len(MASTER_TABLES) == 19


def test_stephanie_is_advisory_only():
    executive = NP_OS.layer(LayerId.EXECUTIVE)
    auth = executive.authority
    assert auth is not None
    assert auth.advisory_only is True
    assert auth.can_release_payments is False
    assert auth.can_submit_permits is False
    assert auth.can_execute_contracts is False
    assert set(auth.forbidden_actions()) == {
        "payment_release",
        "permit_submission",
        "contract_execution",
    }


def test_north_star_sources_are_real_layers():
    valid = {layer.id for layer in NP_OS.layers}
    for metric in NORTH_STAR_METRICS:
        for src in metric.sources:
            assert src in valid


def test_north_star_keys_unique():
    keys = [m.key for m in NORTH_STAR_METRICS]
    assert len(keys) == len(set(keys))


def test_system_map_is_serializable_and_complete():
    sm = NP_OS.system_map()
    assert sm["abbreviation"] == "NP-OS"
    assert len(sm["layers"]) == len(LayerId)
    assert len(sm["masterTables"]) == 19
    assert len(sm["northStarMetrics"]) == len(NORTH_STAR_METRICS)
    # Must be JSON-serializable (no enums/dataclasses leaking through).
    import json

    json.dumps(sm)


def test_advisory_invariant_is_enforced():
    from dataclasses import replace

    executive = NP_OS.layer(LayerId.EXECUTIVE)
    broken_auth = replace(executive.authority, can_release_payments=True)
    broken_layer = replace(executive, authority=broken_auth)
    others = [l for l in LAYERS if l.id is not LayerId.EXECUTIVE]
    bad = MasterOperatingSystem(layers=[broken_layer, *others])
    with pytest.raises(ValueError):
        bad.validate()


def test_lookup_helpers():
    revenue = NP_OS.layer("revenue")
    assert revenue.product == "Lead Command Center"
    tables = NP_OS.tables_for_layer(LayerId.FINANCIAL)
    assert any(t.name == "Payments" for t in tables)
