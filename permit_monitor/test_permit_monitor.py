"""
Unit tests for the PermitStream.ai Essex County permit monitor.

Run from the permit_monitor directory (stdlib only, no pytest needed):

    python3 -m unittest test_permit_monitor -v
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import permit_monitor as pm


def make_permit(**overrides) -> dict:
    permit = {key: None for key in pm.PERMIT_FIELDS}
    permit.update({
        "permit_id": "B-2026-0001",
        "municipality": "Newburyport",
        "address": "1 Test Street",
        "permit_type": "Building - Residential",
        "status": "Filed",
        "description": "Test permit",
        "estimated_value": 10000.0,
        "filed_date": "2026-06-01",
    })
    permit.update(overrides)
    return permit


class DiffTests(unittest.TestCase):
    def test_new_permit_detected(self):
        state = {"permits": {}}
        new, changes = pm.diff_permits([make_permit()], state)
        self.assertEqual(len(new), 1)
        self.assertEqual(changes, [])

    def test_status_change_detected(self):
        permit = make_permit(status="Issued")
        state = {"permits": {pm.permit_key(permit): {"status": "Filed", "record": permit}}}
        new, changes = pm.diff_permits([permit], state)
        self.assertEqual(new, [])
        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0]["previous_status"], "Filed")
        self.assertEqual(changes[0]["new_status"], "Issued")

    def test_unchanged_permit_ignored(self):
        permit = make_permit()
        state = {"permits": {pm.permit_key(permit): {"status": "Filed", "record": permit}}}
        new, changes = pm.diff_permits([permit], state)
        self.assertEqual(new, [])
        self.assertEqual(changes, [])

    def test_same_permit_id_different_municipality_is_distinct(self):
        a = make_permit(municipality="Newbury")
        state = {"permits": {pm.permit_key(make_permit()): {"status": "Filed"}}}
        new, _ = pm.diff_permits([a], state)
        self.assertEqual(len(new), 1)


class WatchlistTests(unittest.TestCase):
    def _config(self, keywords=("roof",), min_value=50000):
        return pm.Config(watch_keywords=list(keywords), min_estimated_value=min_value)

    def test_keyword_match(self):
        permit = make_permit(description="Full roof replacement")
        matches = pm.watchlist_matches([permit], self._config())
        self.assertEqual(len(matches), 1)
        self.assertIn("keyword: roof", matches[0]["reasons"])

    def test_value_threshold_match(self):
        permit = make_permit(description="Generic work", estimated_value=120000.0)
        matches = pm.watchlist_matches([permit], self._config())
        self.assertEqual(len(matches), 1)
        self.assertTrue(matches[0]["reasons"][0].startswith("estimated value"))

    def test_no_match(self):
        permit = make_permit(description="Generic work", estimated_value=1000.0)
        self.assertEqual(pm.watchlist_matches([permit], self._config()), [])


class StateTests(unittest.TestCase):
    def test_update_state_tracks_permits(self):
        state = {"permits": {}}
        permit = make_permit()
        state = pm.update_state(state, [permit], "2026-06-12T00:00:00+00:00")
        self.assertIn(pm.permit_key(permit), state["permits"])
        self.assertEqual(state["last_run"], "2026-06-12T00:00:00+00:00")


class SampleSourceTests(unittest.TestCase):
    def test_sample_source_filters_by_municipality(self):
        permits = pm.fetch_sample({"municipality": "Salisbury", "path": "sample_permits.json"})
        self.assertTrue(permits)
        self.assertTrue(all(p["municipality"] == "Salisbury" for p in permits))


class DigestTests(unittest.TestCase):
    def test_digest_contains_sections_and_permits(self):
        permit = make_permit(description="Roof replacement")
        digest = pm.build_digest(
            run_date="2026-06-12",
            new_permits=[permit],
            status_changes=[],
            matches=[{"permit": permit, "reasons": ["keyword: roof"]}],
            source_results=[{"source": "Newburyport (sample)", "status": "ok", "permits": 1}],
            slack_status="skipped (test)",
            total_tracked=1,
        )
        for expected in (
            "# PermitStream.ai — Essex County Daily Digest",
            "**Run date:** 2026-06-12",
            "## Watchlist hits",
            "## New permits",
            "## Source health",
            "B-2026-0001",
        ):
            self.assertIn(expected, digest)


class EndToEndTests(unittest.TestCase):
    def test_run_writes_digest_state_and_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = pm.Config(
                sources=[{"name": "sample", "type": "sample", "path": "sample_permits.json"}],
                watch_keywords=["roof"],
                min_estimated_value=50000,
                data_dir=Path(tmp),
            )
            exit_code = pm.run_monitor(config, run_date="2026-06-12", dry_run=False, no_slack=True)
            self.assertEqual(exit_code, 0)
            digest_path = Path(tmp) / "daily_digest_2026-06-12.md"
            self.assertTrue(digest_path.exists())
            state = json.loads((Path(tmp) / "state.json").read_text())
            self.assertTrue(state["permits"])
            report = json.loads((Path(tmp) / "last_run_report.json").read_text())
            self.assertGreater(report["new_permits"], 0)

            # Second run with no changes should report zero new permits.
            exit_code = pm.run_monitor(config, run_date="2026-06-13", dry_run=False, no_slack=True)
            self.assertEqual(exit_code, 0)
            report = json.loads((Path(tmp) / "last_run_report.json").read_text())
            self.assertEqual(report["new_permits"], 0)
            self.assertEqual(report["status_changes"], 0)

    def test_all_sources_failing_returns_nonzero(self):
        with tempfile.TemporaryDirectory() as tmp:
            config = pm.Config(
                sources=[{"name": "broken", "type": "sample", "path": "does_not_exist.json"}],
                data_dir=Path(tmp),
            )
            exit_code = pm.run_monitor(config, run_date="2026-06-12", dry_run=False, no_slack=True)
            self.assertEqual(exit_code, 1)


if __name__ == "__main__":
    unittest.main()
