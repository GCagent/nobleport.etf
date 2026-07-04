# Stephanie.ai Journey Agent — Built Out, Auditable

**Source spec:** Stephanie.ai Operating Doctrine — Build Once, Publish Everywhere
· Document the Journey · Content as a Byproduct (NoblePort Systems).
**Status:** DRAFT-by-default / Human-Approved Publishing.
**Final decision authority:** Michael F. O'Rourke.

This converts the Operating Doctrine from a concept into an executable, auditable
subsystem of NoblePort OS. It adds a seventh mesh agent — the **Journey Agent** —
that captures the operational artifacts work already produces and converts each
into 5–10 downstream assets across marketing, sales, recruiting, training,
documentation, and customer communications.

The defining constraint: turn normal construction operations into a continuous
lead-generation and trust engine **without adding overhead to project teams, and
without ever auto-publishing a client's project.** Every design choice below
serves that constraint.

---

## The three principles, made executable

| Principle | What it means | Code |
|-----------|---------------|------|
| **#1 Build Once, Publish Everywhere** | One primary activity → many downstream assets | `backend/journey/playbooks.py` |
| **#2 Document the Journey** | Capture the artifacts work already creates | `backend/journey/artifacts.py` |
| **#3 Content as a Byproduct** | Convert artifacts → assets with no extra field work | `backend/journey/channels.py` + `engine.py` |

---

## What was built

| Layer | Code | What it does |
|-------|------|--------------|
| Artifacts (inputs) | `backend/journey/artifacts.py` | `ArtifactType` + `Artifact`: estimate, site visit, permit finding, change order, completed job, photos, logs, … |
| Channels (outputs) | `backend/journey/channels.py` | 19 content channels across 6 mediums and 6 audiences; each declares its consent gate and the fields it needs |
| Playbooks | `backend/journey/playbooks.py` | The doctrine table as data: each artifact type → the set of channels it fans out into |
| Engine | `backend/journey/engine.py` | Renders one artifact into all its draft assets; reports the leverage ratio and content gaps |
| Asset ledger | `backend/journey/assets.py` | `GeneratedAsset` + a SHA-256 hash-chained, append-only ledger with a human approval gate |
| Story Engine metrics | `backend/journey/metrics.py` | Artifacts processed, assets generated, leverage vs. the 5–10 target, drafts pending — all measured |
| Flywheel | `backend/journey/flywheel.py` | Project → Documentation → Content → Audience → Leads → Projects |
| Mesh agent | `backend/agents/journey.py` | `JourneyAgent` wired into the AgentMesh and event router |
| Persistence | `backend/models/journey_asset.py` | `JourneyAsset` table mirroring the asset shape for production |
| API | `backend/api/journey.py` | `/api/journey/{process-artifact,playbook/{type},assets,assets/{id}/approve,story-engine,flywheel,channels,playbooks}` |
| Tests | `backend/tests/test_journey.py` | 15 tests asserting the guarantees below |

> **Mesh, not a side service.** The Journey Agent is a seventh `BaseAgent`
> alongside Stephanie, GCagent, PermitStream, Cyborg, AuditBeacon, and the
> RecursiveLearningAgent, so it shares the same task router, health telemetry,
> audit recording, and governance posture as the rest of the OS.

---

## Build Once, Publish Everywhere (the playbook table)

| Primary work | Downstream assets |
|--------------|-------------------|
| Estimate | Client proposal · LinkedIn post · case study |
| Site visit | Instagram reel · inspection report · lead magnet |
| PermitStream finding | Market intelligence post · sales alert |
| Change order | Training example · process improvement |
| **Completed job** | Portfolio entry · testimonial request · before/after · LinkedIn · Facebook · Google Business · case study |
| Roofing completion | Before/after · Google Business · portfolio · testimonial request |
| Customer walkthrough | Testimonial request · customer update · case study |

The doctrine target is **5–10 downstream assets per field activity**. The richest
artifacts (a completed job, a roofing completion) fan out widest; lightweight
artifacts (an invoice) stay deliberately small.

---

## The hard guarantees (enforced, not described)

1. **An asset is a draft, never a publish.** Every generated asset is `DRAFT`,
   and the engine can never auto-publish. Promotion to `APPROVED` is a separate,
   human-only call on the ledger. (`test_assets_are_drafts_never_published`,
   `test_approval_is_the_only_path_out_of_draft`)
2. **Client-visible content requires consent.** Any externally published asset
   about an identifiable client project is `BLOCKED` until consent is on file or
   recorded at approval time. (`test_consent_gated_channels_block_without_consent`,
   `test_blocked_asset_requires_consent_to_approve`)
3. **No fabricated facts.** Drafts are assembled only from the fields the artifact
   supplies; a missing field becomes an explicit `[[provide: …]]` marker and a
   reported content gap — never a guessed number.
   (`test_missing_fields_become_content_gaps_not_invented`)
4. **Tamper-evident ledger.** Every asset is SHA-256 hash-chained; altering the
   generated content breaks verification, while a human approving a draft does
   not (approval is metadata, not content).
   (`test_ledger_is_tamper_evident`, `test_approval_does_not_break_the_chain`)
5. **Measured metrics.** The Story Engine numbers are computed from the assets
   actually produced, not asserted. (`test_story_engine_matches_stored_assets`)
6. **Leverage is measured against the target.** Each run reports its leverage
   ratio and whether it meets the 5–10 doctrine target.
   (`test_completed_job_fans_out_to_many_assets`)

---

## The NoblePort Flywheel

```
Project → Documentation → Content → Audience → Leads → Projects
```

The Journey Agent is the mechanism that keeps the wheel turning: a project
generates documentation, the agent converts documentation into content, content
builds an audience, the audience produces leads (routed by Stephanie.ai), and
leads become the next projects.

---

## API quick reference

```
POST /api/journey/process-artifact      # capture an artifact → draft assets
POST /api/journey/playbook/{type}       # run a specific artifact type's playbook
GET  /api/journey/assets                # stored assets (?status, ?project_name)
POST /api/journey/assets/{id}/approve   # human approval gate (DRAFT/BLOCKED → APPROVED)
GET  /api/journey/story-engine          # measured Story Engine metrics
GET  /api/journey/flywheel              # the NoblePort Flywheel
GET  /api/journey/channels              # the content channel catalog
GET  /api/journey/playbooks             # Build Once, Publish Everywhere table
```

Through the mesh, the same capability is reachable as events (`process_artifact`,
`approve_asset`, `get_story_engine`, `get_assets`, `get_flywheel`,
`list_channels`, `list_playbooks`) routed to `JourneyAgent` and recorded in
AuditBeacon like every other mesh action.

## Success metric

The doctrine's bar: one field activity should generate 5–10 downstream assets,
turning normal operations into a continuous lead-generation and trust engine
without adding overhead to project teams. The engine makes that measurable —
leverage ratio is scored per run, the Story Engine tracks it against the 5–10
target, and the hash-chained ledger makes every published asset traceable back to
the operational artifact and the human who approved it.
