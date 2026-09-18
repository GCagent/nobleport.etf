# PermitStream.ai — Essex County Permit Monitor

Standalone daily permit monitoring workflow for the NoblePort PermitStream.ai
layer. Watches building permits across Essex County, MA municipalities
(Newburyport, Newbury, Amesbury, Salisbury by default), notifies Slack about
new permits / status changes / watchlist hits, and writes a daily digest.

This is the project the scheduled playbook expects at
`/home/ubuntu/permit_monitor` (see *Deployment* below). It is intentionally
**dependency-free** — Python 3.10+ standard library only — so the playbook
never blocks on a missing virtualenv or pip install.

## Quick start

```bash
cd permit_monitor
python3 permit_monitor.py validate      # sanity-check config
python3 permit_monitor.py run --dry-run # fetch + print digest, write nothing
python3 permit_monitor.py run           # full daily run
```

A full run produces, under `data/`:

| File | Purpose |
| --- | --- |
| `daily_digest_YYYY-MM-DD.md` | Human-readable daily digest (source for the digest PDF) |
| `state.json` | Persisted permit state used to detect new permits and status changes |
| `last_run_report.json` | Machine-readable run report for the playbook |

Exit code is `0` on success and `1` if every enabled source failed.

## Slack notifications

Set an incoming-webhook URL before the run:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T000/B000/XXXX"
```

If the variable is unset the run still completes — the digest records the
notification as skipped. `--no-slack` forces a skip; notifications are also
skipped when there is no activity to report.

## Configuration (`config.json`)

- `sources` — list of permit data sources. Types:
  - `sample` — reads `sample_permits.json` (offline / pre-integration mode,
    enabled by default so the workflow runs end-to-end out of the box).
  - `arcgis` — queries an ArcGIS feature layer (`url` should end at the layer,
    e.g. `.../FeatureServer/0`); map layer attributes to permit fields via
    `field_map`.
  - `socrata` — queries a Socrata open-data JSON endpoint with optional
    `where` clause and `field_map`.
- `watch_keywords` — case-insensitive keywords matched against description,
  permit type, and address (roofing, solar, demolition, …).
- `min_estimated_value` — permits at or above this estimated value are
  flagged regardless of keywords.
- `data_dir` — output directory (relative paths resolve against this folder).

To go live for a municipality, set its real endpoint `url` + `field_map` on
the `arcgis`/`socrata` template entry, set `"enabled": true`, and disable the
corresponding `sample` entry.

## Tests

```bash
cd permit_monitor
python3 -m unittest test_permit_monitor -v
```

## Deployment

The scheduled playbook runs `python3 /home/ubuntu/permit_monitor/permit_monitor.py run`
daily. To deploy, copy this directory to the sandbox:

```bash
cp -r permit_monitor /home/ubuntu/permit_monitor
export SLACK_WEBHOOK_URL=...   # from the NoblePort Slack workspace
python3 /home/ubuntu/permit_monitor/permit_monitor.py run
```

State lives in `data/state.json`; preserve it between runs so the monitor can
diff against previous days. The first run will report everything as new.
