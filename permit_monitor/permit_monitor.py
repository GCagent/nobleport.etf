#!/usr/bin/env python3
"""
NoblePort OS — PermitStream.ai Essex County Permit Monitor

Standalone daily permit monitoring workflow. Designed to run unattended
from a scheduled playbook (deployed at /home/ubuntu/permit_monitor):

    python3 permit_monitor.py run

Each run:
  1. Fetches building permits from configured Essex County sources
     (Newburyport, Newbury, Amesbury, Salisbury by default).
  2. Diffs against persisted state to find new permits and status changes.
  3. Flags watchlist matches (keywords / minimum estimated value).
  4. Posts a summary to Slack via incoming webhook (SLACK_WEBHOOK_URL).
  5. Writes a daily digest markdown file: data/daily_digest_YYYY-MM-DD.md.
  6. Persists state and a machine-readable run report.

The script is intentionally dependency-free (Python 3.10+ stdlib only) so
the playbook never blocks on a missing virtualenv. Municipal data sources
are pluggable via config.json: "arcgis" and "socrata" adapters cover the
common open-data backends; the bundled "sample" source keeps the workflow
runnable end-to-end before real endpoints are wired in.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("permit_monitor")

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = BASE_DIR / "config.json"
HTTP_TIMEOUT_SECONDS = 30
SLACK_WEBHOOK_ENV = "SLACK_WEBHOOK_URL"

PERMIT_FIELDS = (
    "permit_id",
    "municipality",
    "address",
    "permit_type",
    "status",
    "description",
    "applicant",
    "estimated_value",
    "filed_date",
    "status_date",
    "link",
)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@dataclass
class Config:
    """Runtime configuration loaded from config.json."""

    sources: list[dict[str, Any]] = field(default_factory=list)
    watch_keywords: list[str] = field(default_factory=list)
    min_estimated_value: float = 0.0
    data_dir: Path = BASE_DIR / "data"
    slack_channel_label: str = "#permits"
    raw: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path) -> "Config":
        raw = json.loads(path.read_text())
        data_dir = Path(raw.get("data_dir", "data"))
        if not data_dir.is_absolute():
            data_dir = BASE_DIR / data_dir
        return cls(
            sources=raw.get("sources", []),
            watch_keywords=[k.lower() for k in raw.get("watch_keywords", [])],
            min_estimated_value=float(raw.get("min_estimated_value", 0)),
            data_dir=data_dir,
            slack_channel_label=raw.get("slack_channel_label", "#permits"),
            raw=raw,
        )


# ---------------------------------------------------------------------------
# Source adapters — each returns a list of normalized permit dicts
# ---------------------------------------------------------------------------


def _http_get_json(url: str) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": "PermitStream.ai monitor"})
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def _normalize(record: dict[str, Any], field_map: dict[str, str], municipality: str) -> dict[str, Any]:
    permit: dict[str, Any] = {key: None for key in PERMIT_FIELDS}
    permit["municipality"] = municipality
    for target, source_field in field_map.items():
        if target in PERMIT_FIELDS and source_field in record:
            permit[target] = record[source_field]
    if permit.get("estimated_value") is not None:
        try:
            permit["estimated_value"] = float(permit["estimated_value"])
        except (TypeError, ValueError):
            permit["estimated_value"] = None
    return permit


def fetch_arcgis(source: dict[str, Any]) -> list[dict[str, Any]]:
    """Query an ArcGIS feature layer (the backend behind many MA town GIS portals)."""
    params = {
        "where": source.get("where", "1=1"),
        "outFields": "*",
        "f": "json",
        "resultRecordCount": str(source.get("max_records", 500)),
    }
    url = source["url"].rstrip("/") + "/query?" + urllib.parse.urlencode(params)
    payload = _http_get_json(url)
    field_map = source.get("field_map", {})
    return [
        _normalize(feature.get("attributes", {}), field_map, source["municipality"])
        for feature in payload.get("features", [])
    ]


def fetch_socrata(source: dict[str, Any]) -> list[dict[str, Any]]:
    """Query a Socrata open-data JSON endpoint."""
    params = {"$limit": str(source.get("max_records", 500))}
    if source.get("where"):
        params["$where"] = source["where"]
    url = source["url"] + "?" + urllib.parse.urlencode(params)
    payload = _http_get_json(url)
    field_map = source.get("field_map", {})
    return [_normalize(record, field_map, source["municipality"]) for record in payload]


def fetch_sample(source: dict[str, Any]) -> list[dict[str, Any]]:
    """Read permits from the bundled sample dataset (offline / pre-integration mode)."""
    sample_path = BASE_DIR / source.get("path", "sample_permits.json")
    records = json.loads(sample_path.read_text())
    municipality = source.get("municipality")
    if municipality:
        records = [r for r in records if r.get("municipality") == municipality]
    return [_normalize(r, {key: key for key in PERMIT_FIELDS}, r.get("municipality", "unknown")) for r in records]


FETCHERS = {
    "arcgis": fetch_arcgis,
    "socrata": fetch_socrata,
    "sample": fetch_sample,
}


def fetch_all_sources(config: Config) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Fetch every enabled source. Returns (permits, source_results)."""
    permits: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []
    for source in config.sources:
        name = source.get("name", source.get("municipality", "unnamed"))
        if not source.get("enabled", True):
            results.append({"source": name, "status": "disabled", "permits": 0})
            continue
        fetcher = FETCHERS.get(source.get("type", ""))
        if fetcher is None:
            results.append({"source": name, "status": "error", "permits": 0,
                            "detail": f"Unknown source type: {source.get('type')}"})
            continue
        try:
            fetched = [p for p in fetcher(source) if p.get("permit_id")]
            permits.extend(fetched)
            results.append({"source": name, "status": "ok", "permits": len(fetched)})
        except (urllib.error.URLError, OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
            logger.warning("Source %s failed: %s", name, exc)
            results.append({"source": name, "status": "error", "permits": 0, "detail": str(exc)})
    return permits, results


# ---------------------------------------------------------------------------
# State + diffing
# ---------------------------------------------------------------------------


def permit_key(permit: dict[str, Any]) -> str:
    return f"{permit.get('municipality', 'unknown')}:{permit.get('permit_id')}"


def load_state(state_path: Path) -> dict[str, Any]:
    if state_path.exists():
        return json.loads(state_path.read_text())
    return {"permits": {}, "last_run": None}


def diff_permits(
    fetched: list[dict[str, Any]],
    state: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Compare fetched permits to state. Returns (new_permits, status_changes)."""
    known = state.get("permits", {})
    new_permits: list[dict[str, Any]] = []
    status_changes: list[dict[str, Any]] = []
    for permit in fetched:
        key = permit_key(permit)
        previous = known.get(key)
        if previous is None:
            new_permits.append(permit)
        elif (permit.get("status") or "") != (previous.get("status") or ""):
            status_changes.append({
                "permit": permit,
                "previous_status": previous.get("status"),
                "new_status": permit.get("status"),
            })
    return new_permits, status_changes


def update_state(state: dict[str, Any], fetched: list[dict[str, Any]], run_at: str) -> dict[str, Any]:
    known = state.setdefault("permits", {})
    for permit in fetched:
        known[permit_key(permit)] = {
            "status": permit.get("status"),
            "last_seen": run_at,
            "record": permit,
        }
    state["last_run"] = run_at
    return state


# ---------------------------------------------------------------------------
# Watchlist scoring
# ---------------------------------------------------------------------------


def watchlist_matches(permits: list[dict[str, Any]], config: Config) -> list[dict[str, Any]]:
    """Flag permits matching watch keywords or exceeding the value threshold."""
    matches: list[dict[str, Any]] = []
    for permit in permits:
        reasons: list[str] = []
        haystack = " ".join(
            str(permit.get(field) or "") for field in ("description", "permit_type", "address")
        ).lower()
        for keyword in config.watch_keywords:
            if keyword in haystack:
                reasons.append(f"keyword: {keyword}")
        value = permit.get("estimated_value")
        if value and config.min_estimated_value and value >= config.min_estimated_value:
            reasons.append(f"estimated value ${value:,.0f} >= ${config.min_estimated_value:,.0f}")
        if reasons:
            matches.append({"permit": permit, "reasons": reasons})
    return matches


# ---------------------------------------------------------------------------
# Slack notification
# ---------------------------------------------------------------------------


def _permit_line(permit: dict[str, Any]) -> str:
    value = permit.get("estimated_value")
    value_text = f" — ${value:,.0f}" if value else ""
    return (
        f"*{permit.get('permit_id')}* ({permit.get('municipality')}) "
        f"{permit.get('address') or 'address n/a'} — "
        f"{permit.get('permit_type') or 'type n/a'}: "
        f"{(permit.get('description') or '').strip() or 'no description'}{value_text}"
    )


def build_slack_message(
    run_date: str,
    new_permits: list[dict[str, Any]],
    status_changes: list[dict[str, Any]],
    matches: list[dict[str, Any]],
    source_results: list[dict[str, Any]],
) -> dict[str, Any]:
    errored = [r for r in source_results if r["status"] == "error"]
    lines = [
        f"*PermitStream.ai — Essex County permit monitor ({run_date})*",
        f"New permits: {len(new_permits)} | Status changes: {len(status_changes)} "
        f"| Watchlist hits: {len(matches)} | Source errors: {len(errored)}",
    ]
    if matches:
        lines.append("\n*Watchlist hits:*")
        for match in matches[:10]:
            lines.append(f"• {_permit_line(match['permit'])} _({'; '.join(match['reasons'])})_")
    if new_permits:
        lines.append("\n*New permits:*")
        for permit in new_permits[:15]:
            lines.append(f"• {_permit_line(permit)}")
        if len(new_permits) > 15:
            lines.append(f"…and {len(new_permits) - 15} more (see daily digest).")
    if status_changes:
        lines.append("\n*Status changes:*")
        for change in status_changes[:10]:
            lines.append(
                f"• {_permit_line(change['permit'])} — "
                f"{change['previous_status']} → {change['new_status']}"
            )
    if errored:
        lines.append("\n*Source errors:*")
        for result in errored:
            lines.append(f"• {result['source']}: {result.get('detail', 'unknown error')}")
    return {"text": "\n".join(lines)}


def post_to_slack(message: dict[str, Any], webhook_url: str) -> None:
    request = urllib.request.Request(
        webhook_url,
        data=json.dumps(message).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        body = response.read().decode("utf-8")
        if response.status >= 300 or body not in ("ok", ""):
            raise RuntimeError(f"Slack webhook returned {response.status}: {body}")


# ---------------------------------------------------------------------------
# Daily digest
# ---------------------------------------------------------------------------


def _md_table(headers: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        out.append("| " + " | ".join(cell.replace("|", "\\|") for cell in row) + " |")
    return "\n".join(out)


def _permit_row(permit: dict[str, Any]) -> list[str]:
    value = permit.get("estimated_value")
    return [
        str(permit.get("permit_id") or ""),
        str(permit.get("municipality") or ""),
        str(permit.get("address") or ""),
        str(permit.get("permit_type") or ""),
        str(permit.get("status") or ""),
        f"${value:,.0f}" if value else "—",
        str(permit.get("filed_date") or ""),
    ]


def build_digest(
    run_date: str,
    new_permits: list[dict[str, Any]],
    status_changes: list[dict[str, Any]],
    matches: list[dict[str, Any]],
    source_results: list[dict[str, Any]],
    slack_status: str,
    total_tracked: int,
) -> str:
    permit_headers = ["Permit", "Municipality", "Address", "Type", "Status", "Est. value", "Filed"]
    errored = [r for r in source_results if r["status"] == "error"]

    sections = [
        "# PermitStream.ai — Essex County Daily Digest",
        f"\n**Run date:** {run_date}",
        "\n## Summary\n",
        _md_table(
            ["Metric", "Value"],
            [
                ["New permits", str(len(new_permits))],
                ["Status changes", str(len(status_changes))],
                ["Watchlist hits", str(len(matches))],
                ["Sources with errors", str(len(errored))],
                ["Total permits tracked", str(total_tracked)],
                ["Slack notification", slack_status],
            ],
        ),
    ]

    sections.append("\n## Watchlist hits\n")
    if matches:
        sections.append(_md_table(
            permit_headers + ["Why flagged"],
            [_permit_row(m["permit"]) + ["; ".join(m["reasons"])] for m in matches],
        ))
    else:
        sections.append("No watchlist matches today.")

    sections.append("\n## New permits\n")
    if new_permits:
        sections.append(_md_table(permit_headers, [_permit_row(p) for p in new_permits]))
    else:
        sections.append("No new permits found today.")

    sections.append("\n## Status changes\n")
    if status_changes:
        sections.append(_md_table(
            ["Permit", "Municipality", "Address", "Previous status", "New status"],
            [
                [
                    str(c["permit"].get("permit_id") or ""),
                    str(c["permit"].get("municipality") or ""),
                    str(c["permit"].get("address") or ""),
                    str(c["previous_status"] or "—"),
                    str(c["new_status"] or "—"),
                ]
                for c in status_changes
            ],
        ))
    else:
        sections.append("No status changes today.")

    sections.append("\n## Source health\n")
    sections.append(_md_table(
        ["Source", "Status", "Permits fetched", "Detail"],
        [
            [r["source"], r["status"], str(r["permits"]), r.get("detail", "")]
            for r in source_results
        ],
    ))

    sections.append(
        f"\n---\n_Generated by PermitStream.ai permit_monitor.py at "
        f"{datetime.now(timezone.utc).isoformat(timespec='seconds')}_\n"
    )
    return "\n".join(sections)


# ---------------------------------------------------------------------------
# Run orchestration
# ---------------------------------------------------------------------------


def run_monitor(config: Config, run_date: str, dry_run: bool, no_slack: bool) -> int:
    run_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    config.data_dir.mkdir(parents=True, exist_ok=True)
    state_path = config.data_dir / "state.json"
    state = load_state(state_path)

    permits, source_results = fetch_all_sources(config)
    new_permits, status_changes = diff_permits(permits, state)
    matches = watchlist_matches(new_permits + [c["permit"] for c in status_changes], config)

    logger.info(
        "Fetched %d permits (%d new, %d status changes, %d watchlist hits)",
        len(permits), len(new_permits), len(status_changes), len(matches),
    )

    # Slack notification
    webhook_url = os.environ.get(SLACK_WEBHOOK_ENV, "").strip()
    has_activity = bool(new_permits or status_changes or matches)
    if no_slack or dry_run:
        slack_status = "skipped (dry run)" if dry_run else "skipped (--no-slack)"
    elif not webhook_url:
        slack_status = f"skipped ({SLACK_WEBHOOK_ENV} not set)"
        logger.warning("Slack webhook not configured; set %s to enable notifications", SLACK_WEBHOOK_ENV)
    elif not has_activity:
        slack_status = "skipped (no activity)"
    else:
        message = build_slack_message(run_date, new_permits, status_changes, matches, source_results)
        try:
            post_to_slack(message, webhook_url)
            slack_status = f"sent to {config.slack_channel_label}"
        except (urllib.error.URLError, OSError, RuntimeError) as exc:
            slack_status = f"failed: {exc}"
            logger.error("Slack notification failed: %s", exc)

    # Daily digest
    state = update_state(state, permits, run_at)
    digest = build_digest(
        run_date, new_permits, status_changes, matches, source_results,
        slack_status, total_tracked=len(state["permits"]),
    )
    digest_path = config.data_dir / f"daily_digest_{run_date}.md"

    report = {
        "run_date": run_date,
        "run_at": run_at,
        "permits_fetched": len(permits),
        "new_permits": len(new_permits),
        "status_changes": len(status_changes),
        "watchlist_hits": len(matches),
        "slack_status": slack_status,
        "sources": source_results,
        "digest_path": str(digest_path),
        "dry_run": dry_run,
    }

    if dry_run:
        logger.info("Dry run — not writing state or digest")
        print(digest)
    else:
        digest_path.write_text(digest)
        state_path.write_text(json.dumps(state, indent=2))
        (config.data_dir / "last_run_report.json").write_text(json.dumps(report, indent=2))
        logger.info("Digest written to %s", digest_path)

    print(json.dumps(report, indent=2))

    all_sources_failed = bool(source_results) and all(
        r["status"] == "error" for r in source_results if r["status"] != "disabled"
    )
    return 1 if all_sources_failed else 0


def validate_config(config: Config) -> int:
    """Sanity-check the configuration without fetching anything remote."""
    problems: list[str] = []
    if not config.sources:
        problems.append("No sources configured")
    for source in config.sources:
        name = source.get("name", source.get("municipality", "unnamed"))
        if source.get("type") not in FETCHERS:
            problems.append(f"{name}: unknown type {source.get('type')!r}")
        if source.get("type") in ("arcgis", "socrata") and not source.get("url"):
            problems.append(f"{name}: missing url")
        if source.get("type") == "sample":
            sample_path = BASE_DIR / source.get("path", "sample_permits.json")
            if not sample_path.exists():
                problems.append(f"{name}: sample file {sample_path} not found")
    if not os.environ.get(SLACK_WEBHOOK_ENV):
        print(f"note: {SLACK_WEBHOOK_ENV} is not set — Slack notifications will be skipped")
    if problems:
        for problem in problems:
            print(f"error: {problem}")
        return 1
    print(f"config ok: {len(config.sources)} source(s), "
          f"{len(config.watch_keywords)} watch keyword(s), data dir {config.data_dir}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="PermitStream.ai Essex County permit monitor")
    parser.add_argument("command", nargs="?", default="run", choices=["run", "validate"],
                        help="run: execute the daily workflow (default); validate: check config")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH,
                        help="Path to config.json")
    parser.add_argument("--date", default=date.today().isoformat(),
                        help="Run date for the digest filename (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and report but do not write state/digest or notify Slack")
    parser.add_argument("--no-slack", action="store_true",
                        help="Skip Slack notification even if a webhook is configured")
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )

    config = Config.load(args.config)
    if args.command == "validate":
        return validate_config(config)
    return run_monitor(config, run_date=args.date, dry_run=args.dry_run, no_slack=args.no_slack)


if __name__ == "__main__":
    raise SystemExit(main())
