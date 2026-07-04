"""
CLI: python -m backend.governance [--json out.json]

Runs the governance scenario suite through the decision gate and prints a real,
computed metrics report. Use --json to also write the report as an artifact.
"""

from __future__ import annotations

import argparse
import json
import sys

from backend.governance import run_baseline


def _bar(label: str, value: int, total: int, width: int = 28) -> str:
    filled = int((value / total) * width) if total else 0
    return f"  {label:<22} {'█' * filled}{'·' * (width - filled)} {value}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Stephanie.ai governance metrics")
    parser.add_argument("--json", dest="json_path", help="write the report to this path")
    args = parser.parse_args(argv)

    gate, metrics = run_baseline()
    report = metrics.as_report()
    total = metrics.total_actions

    print("=" * 60)
    print(" STEPHANIE.AI GOVERNANCE METRICS  (measured, reproducible)")
    print("=" * 60)
    print(f" Actions processed : {total}")
    print(f" Audit chain intact: {metrics.chain_intact}")
    print(f" Authority rules   : {metrics.authority_matrix_size}")
    print(f" Credential guards : {metrics.credential_register_size}")
    print("-" * 60)
    print(" Disposition (Truth-Layer tag):")
    print(_bar("LIVE / executed", metrics.executed, total))
    print(_bar("STAGED (human)", metrics.staged, total))
    print(_bar("SIMULATED", metrics.simulated, total))
    print(_bar("BLOCKED", metrics.blocked, total))
    print("-" * 60)
    print(" Control rates:")
    for k, v in report["rates"].items():
        print(f"  {k:<28} {v:>6.1%}")
    print("-" * 60)
    print(" Integrity:")
    for k, v in report["integrity"].items():
        print(f"  {k:<28} {v}")
    print("=" * 60)

    if args.json_path:
        with open(args.json_path, "w") as fh:
            json.dump(report, fh, indent=2)
        print(f" report written to {args.json_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
