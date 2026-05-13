# NoblePort Systems — AI Guardrails Policy (v1.0)

> Binding policy for every NoblePort Systems platform, agent, model, and
> feature that emits, ingests, or acts on AI output. Includes GCagent.ai,
> StephanieAI, NavigateNewburyport, the NoblePort ETF stack, the
> Buildertrend bridge, the Mission Control dashboard, and any future
> NoblePort product.
>
> Canonical sources:
> - Human-readable policy: this file
> - Machine-readable manifest: `gcagent/config/ai_guardrails.yaml`
> - Runtime helpers: `gcagent/core/reliability_safety/ai_guardrails.py`
> - Backend enforcement: `backend/utils/ai_guardrails.py`
> - User disclosure surface: `src/components/AIGuardrailsBanner.tsx`
>
> Every guardrail has a stable ID (e.g. `S1`, `T16`, `A100`). IDs are used
> in commit messages, audit logs, code comments, incident reports, and the
> public registry. Do not renumber.

---

## Scope and authority

This policy applies to:

1. **All NoblePort-built AI systems** — agents (GCagent.ai, StephanieAI),
   retrieval pipelines, predictive models, scoring engines, code-gen
   assistants, voice consoles, and any model-driven automation embedded in
   construction, ETF, compliance, reporting, or investor-admin flows.
2. **All third-party AI services routed through NoblePort infrastructure**
   — Claude / Anthropic, OpenAI, vendor AI APIs, vendor agents, vendor
   evaluation services, and any AI-backed SaaS integration.
3. **All NoblePort surfaces that present or accept AI output** —
   dashboards, investor portals, customer chats, internal tooling, signed
   smart-contract actions, and machine-to-machine APIs.

The policy is **subject to democratic review and amendment** (guardrail
**A100**). Changes require a tagged release of this file, an updated
`ai_guardrails.yaml` checksum, and a logged approval from the designated
ethics review board (guardrail **L66**).

Severity levels:

- **MUST** — non-negotiable; non-compliance blocks shipping.
- **MUST NOT** — prohibited; treat occurrences as incidents.
- **SHOULD** — strongly preferred; deviations require a documented
  exception.

Enforcement layers:

- **Policy** — written in this document and the YAML manifest.
- **Code** — enforced in `backend/utils/ai_guardrails.py`,
  `gcagent/core/reliability_safety/`, and platform-specific shims.
- **Process** — enforced by reviews, audits, ethics board, on-call.

---

## I. Safety & Robustness (S1–S15)

- **S1.** AI MUST NOT cause physical harm to humans or property.
- **S2.** AI systems MUST have a kill switch or emergency shutdown
  reachable by a designated human operator.
- **S3.** AI systems MUST undergo a pre-deployment safety audit before
  serving production traffic.
- **S4.** Red-teaming for adversarial attacks is MANDATORY before launch
  and at each major version.
- **S5.** AI MUST degrade gracefully; catastrophic failure modes are
  prohibited.
- **S6.** Self-replication, self-modification, or model mutation without
  prior human approval is PROHIBITED.
- **S7.** AI MUST NOT exploit reward hacks or specification gaps to
  bypass intended behavior.
- **S8.** Latency, throughput, and reliability thresholds for any
  critical system MUST be declared and monitored.
- **S9.** Models MUST be retrained or revalidated on a documented cadence
  to fix safety drift.
- **S10.** Stealth updates that bypass safety reviews are PROHIBITED.
- **S11.** AI MUST detect and reject attempts to override safety layers,
  including prompt-injection and jailbreak attempts.
- **S12.** Real-time monitoring for out-of-distribution inputs is REQUIRED
  for any decision-making system.
- **S13.** Safety incidents MUST be reported to the designated regulator
  and to the internal incident channel.
- **S14.** Mandatory downtime windows MUST be reserved for patching
  critical flaws.
- **S15.** AI in physical robots or actuators MUST enforce declared
  speed, force, and reach limits.

## II. Transparency & Explainability (T16–T30)

- **T16.** Users have the right to know when they are interacting with
  AI; NoblePort surfaces MUST disclose AI use.
- **T17.** Decisions that affect a person's legal rights MUST be
  explainable in plain language.
- **T18.** Training data sources and known biases MUST be disclosed.
- **T19.** Every production model MUST have a model card or equivalent
  documentation.
- **T20.** Proprietary systems MUST permit third-party interpretability
  testing under NDA.
- **T21.** Logs of key decisions MUST be retained for the statutory
  period (minimum seven years for financial decisions).
- **T22.** Black-box models MUST NOT be used for high-stakes decisions
  (lending, hiring, underwriting, permitting).
- **T23.** Source code or sufficient transparency artifacts MUST be
  available to regulators on request.
- **T24.** AI outputs MUST include calibrated confidence levels with
  predictions where uncertainty is material.
- **T25.** Plain-language summaries of AI logic MUST be available to end
  users.
- **T26.** An auditable chain of custody for AI inputs and outputs MUST
  be maintained.
- **T27.** AI-generated content MUST carry watermarking or provenance
  tags when distributed outside the originating system.
- **T28.** High-risk AI deployments MUST be entered into the public
  registry surfaced at `/api/ai/guardrails/registry`.
- **T29.** "Persona" claims that mislead users about identity or
  capability are PROHIBITED.
- **T30.** System interventions (overrides, rollbacks, manual edits)
  MUST be logged systematically.

## III. Privacy & Data Governance (P31–P45)

- **P31.** AI MUST NOT be trained on personal data without a lawful
  basis.
- **P32.** Users have the right to opt out of data collection for AI
  training.
- **P33.** Data minimization principles apply to all AI pipelines.
- **P34.** AI MUST honor do-not-track and platform privacy signals.
- **P35.** Personal data MUST be deletable upon valid request (right to
  be forgotten).
- **P36.** Cross-device tracking via AI without consent is PROHIBITED.
- **P37.** Strict access controls MUST gate training data.
- **P38.** Personal data MUST be anonymized before training unless
  strictly necessary and documented.
- **P39.** Purpose limitation applies; mission creep is PROHIBITED.
- **P40.** Children's data has special protections; default deny.
- **P41.** Biometric data requires a higher consent bar and a
  documented retention plan.
- **P42.** On-device processing MUST be preferred for sensitive data
  when feasible.
- **P43.** Privacy impact assessments MUST be completed before launching
  new AI systems.
- **P44.** Data breaches MUST be reported within 72 hours.
- **P45.** Covert collection of keystrokes or behavior logs is
  PROHIBITED.

## IV. Fairness & Non-Discrimination (F46–F60)

- **F46.** AI outputs MUST NOT unlawfully discriminate.
- **F47.** Bias audits across race, gender, age, disability, and other
  protected attributes MUST run on a documented cadence.
- **F48.** Disparate-impact testing MUST run before deployment.
- **F49.** Algorithmic redlining MUST be mitigated and documented.
- **F50.** Accessibility for people with disabilities is MANDATORY.
- **F51.** Discriminatory pricing or insurance underwriting via AI is
  PROHIBITED.
- **F52.** Training data MUST be representative or explicitly corrected.
- **F53.** Unfairness metrics MUST cover intersectional groups, not just
  single attributes.
- **F54.** An appeals process for adverse AI decisions MUST be exposed
  to affected users.
- **F55.** Diversity requirements apply to AI design teams working on
  high-risk domains.
- **F56.** Fairness metrics MUST be reported publicly on an annual
  basis.
- **F57.** AI profiling based on sensitive attributes is PROHIBITED
  unless the attribute is provably job-relevant and legally permitted.
- **F58.** AI MUST NOT predict protected-class membership outside of
  legally sanctioned contexts.
- **F59.** Social scoring by government AI is PROHIBITED across all
  NoblePort integrations.
- **F60.** Federated fairness benchmarks MUST be adopted where available
  and enforcement-ready.

## V. Accountability & Liability (L61–L75)

- **L61.** A human MUST remain in the loop for lethal, financially
  catastrophic, or otherwise critical decisions.
- **L62.** Every AI deployment MUST have a named legal person or entity
  accountable for it.
- **L63.** Civil and criminal liability for foreseeable harms applies;
  no shielding by AI abstraction.
- **L64.** Mandatory audit trails for high-risk decisions MUST be
  preserved and indexed.
- **L65.** Whistleblower protections apply to AI safety employees and
  contractors.
- **L66.** Independent ethics review boards MUST be empaneled for any
  system rated high-risk under this policy.
- **L67.** "The AI said so" is NOT a valid legal defense.
- **L68.** Insurability of any AI product MUST be tied to documented
  guardrail compliance.
- **L69.** Executive-level legal responsibility MUST be assigned
  (modeled on EU AI Act practice).
- **L70.** Every AI product MUST have an incident response plan with
  named owners.
- **L71.** Third-party vulnerability disclosure programs MUST be
  available for every public AI surface.
- **L72.** Model verification by accredited labs MUST be completed for
  high-risk deployments.
- **L73.** Courts MAY order shutdown of any NoblePort AI system found in
  violation; the platform MUST support clean shutdown.
- **L74.** Financial penalties for violations are proportional to
  revenue or user impact.
- **L75.** Impact assessments are MANDATORY for any public-sector AI
  deployment.

## VI. Autonomy & Human Dignity (A76–A90)

- **A76.** AI MUST NOT override meaningful human consent.
- **A77.** Deceptive persuasion or manipulation of vulnerable
  populations is PROHIBITED.
- **A78.** AI "nudging" that bypasses deliberative choice is PROHIBITED.
- **A79.** Design patterns that foster emotional dependency on AI
  companions are PROHIBITED.
- **A80.** Users have the right to a human alternative for government
  AI services routed through NoblePort.
- **A81.** AI impersonation of real people without explicit consent is
  PROHIBITED.
- **A82.** Employers MUST NOT compel intrusive AI monitoring of workers
  via NoblePort tooling.
- **A83.** Users MUST be able to correct erroneous inferences held about
  them.
- **A84.** Real-time emotion recognition in employment or education
  contexts is PROHIBITED.
- **A85.** Education products MUST teach AI literacy alongside
  deployment.
- **A86.** Subliminal AI stimuli are PROHIBITED.
- **A87.** AI MUST NOT unilaterally change contracts or terms of
  service.
- **A88.** Users have the right to contest fully automated decisions.
- **A89.** AI-driven solitary confinement or parole decisions are
  PROHIBITED.
- **A90.** Digital dignity is preserved: no "forever" AI profiles after
  death without estate consent.

## VII. Alignment & Normative Guardrails (A91–A100)

- **A91.** AI objectives MUST align with constitutional and human-rights
  baselines.
- **A92.** Instructions that bypass core safety rules — jailbreaks,
  prompt smuggling, tool-use circumvention — are PROHIBITED.
- **A93.** AI MUST refuse illegal or unethical commands and log the
  refusal.
- **A94.** Adherence to the Universal Declaration of Human Rights is
  hard-coded into the alignment layer.
- **A95.** International humanitarian law applies to any military AI
  use; no autonomous lethal action.
- **A96.** Autonomous weapons without meaningful human control are
  PROHIBITED.
- **A97.** AI development for mass surveillance incompatible with
  democratic norms is PROHIBITED.
- **A98.** Environmental impact ceilings apply to large model training
  and inference.
- **A99.** Cross-border cooperation is REQUIRED to prevent regulatory
  arbitrage.
- **A100.** All guardrails are subject to democratic review and
  amendment; this document is versioned and publicly disclosed.

---

## Enforcement summary

| Layer | Mechanism |
|---|---|
| Agent prompts | `gcagent/system_prompt.md` Block 5 references this policy by ID. |
| Agent runtime | `gcagent/core/reliability_safety/ai_guardrails.py` exposes `enforce()` and `guard()` helpers used by `prompt_engineering`, `tool_integration`, and `workflow_automation` skills. |
| Backend APIs | `backend/utils/ai_guardrails.py` middleware sets `X-NoblePort-AI-Disclosure` headers (T16), logs AI calls (T26, T30, L64), and exposes `/api/ai/guardrails`. |
| Frontend surfaces | `src/components/AIGuardrailsBanner.tsx` discloses AI use to end users (T16, T25). |
| Process | Pre-deployment audits (S3), red-team exercises (S4), ethics board (L66), incident response (L70). |

## Reporting violations

- Internal: file an incident in the on-call channel and tag the L70 owner.
- External: vulnerability disclosure via the program registered under L71.
- Regulator: safety incidents are routed under S13 within the statutory
  window; data breaches under P44 within 72 hours.
