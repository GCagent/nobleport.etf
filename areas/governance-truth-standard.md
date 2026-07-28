# Governance Truth Standard

**Description:** Canonical Governance Truth Standard aligned with the full 11-class evidence taxonomy of the 1B Capability Standard.

## Evidence Taxonomy

### Class 1 — Verifiable System Telemetry
Direct execution logs, system metrics, runtime traces, and other observable production telemetry.

### Class 2 — Cryptographic Proofs & On-Chain State
Signed state updates, verified smart-contract state, transaction proofs, and other cryptographically verifiable records.

### Class 3 — Automated Test & Validation Artifacts
CI/CD test results, static-analysis outputs, validation reports, and reproducible automated checks.

### Class 4 — Third-Party Audit & Attestation
External legal, financial, compliance, accounting, or security audit reports and formal attestations.

### Class 5 — Human Approval & Authorization Sign-Offs
Signed administrative approvals, compliance authorizations, named approver decisions, and documented human-control gates.

### Class 6 — Domain-Specific Regulatory & Licensing Filings
Official licenses, registrations, disclosures, filings, and regulator-issued records, including CSL and HIC records where applicable.

### Class 7 — Canonical Memory & System Records
Explicitly committed `[stated]` governance entries and approved records held in the designated system of record.

A Class 7 record proves that a statement was formally recorded. It does not automatically prove the underlying operational claim unless supported by the appropriate evidence class.

### Class 8 — User-Provided Reference Artifacts
Deployment PDFs, architectural specifications, pitch decks, spreadsheets, screenshots, reports, and similar user-supplied materials treated as unverified input.

### Class 9 — Simulated / Synthetic Data Outputs
Local testnet output, sandbox activity, mock telemetry, synthetic records, staged demonstrations, and non-production simulations.

### Class 10 — Agentic Recommendation & Reasoning Traces
Model recommendations, generated execution plans, analysis summaries, and reasoning records. These materials are advisory and are not execution evidence or authorization.

### Class 11 — Unverified External Data Inputs
Web-scraped material, third-party API payloads, imported feeds, and external records before provenance, integrity, and relevance are validated.

## Production Threshold Rules

1. **Class 8 and Class 9 cannot independently satisfy any production-deployment, legal-clearance, active-liquidity, regulatory-approval, or operational-readiness threshold.**
2. **Class 10 cannot authorize execution or satisfy a human-approval gate.**
3. **Class 11 must be validated and promoted into an appropriate higher-confidence evidence class before supporting a production claim.**
4. A `[stated]` Class 7 record must remain visibly distinguished from independently verified evidence.
5. Claims must cite the strongest applicable evidence class and may not be upgraded by wording alone.

## Cross-File Alignment

All governance labels, file tags, scorecards, deployment gates, and truth-status fields must use this taxonomy consistently.

The canonical NBPT/NPETF file at `/areas/nbpt-token.md` is governed by this standard. In particular, its User-Provided Reference Artifacts and Simulated / Synthetic Data Outputs can never independently satisfy production thresholds.

## Change-Control Rule

Future revisions must preserve prior history and use merge-and-append change control rather than destructive overwrite. Taxonomy changes require a named human approver, dated rationale, compatibility review, and recorded migration instructions for affected files.
