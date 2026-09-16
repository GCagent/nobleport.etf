# Governed IT Ops Agent — Design

**Date:** 2026-09-16
**Status:** Approved design baseline
**Target:** Standalone operational service, separated from NoblePort application runtime

## Purpose
Build a governed IT operations agent for authorized NoblePort infrastructure. It will monitor configured APIs, nodes, domains/DNS targets, IP endpoints, and printers; expose health, scan, report, and Prometheus metrics; score bottlenecks; provide CIO-level reporting; and support explicitly approved remediation.

## Architecture
The service is a standalone Python 3.12/FastAPI application. Monitoring is read-only by default. Targets are declared in YAML and must pass an explicit authorization allowlist before any network check runs. Checks execute with bounded concurrency and per-check timeouts. Results feed Prometheus metrics and a reporting layer. Remediation is a separate control plane invoked only through named playbooks and human approval gates; monitoring never silently mutates infrastructure.

Deployment targets are bare metal/systemd, Docker/Compose, and Kubernetes. Prometheus, Grafana, and Alertmanager remain separate observability services. Secrets are injected through environment variables or a secrets manager and are never stored in target YAML or logs.

## Components
- `agent/models.py`: typed target, check-result, severity, and incident models.
- `agent/config.py`: YAML loading, schema validation, authorization allowlist, thresholds.
- `agent/checks.py`: ICMP, TCP, HTTP, DNS, printer IPP/raw-print/SNMP reachability checks.
- `agent/scanner.py`: bounded-concurrency orchestration and timeouts.
- `agent/bottleneck.py`: deterministic threshold-driven bottleneck score and severity.
- `agent/incidents.py`: persistent incident lifecycle used to calculate uptime and MTTR.
- `agent/cio.py`: CIO report projection including operational/business impact fields.
- `agent/audit.py`: append-only structured audit events for scans and remediation decisions.
- `agent/remediation.py`: allowlisted Ansible playbook requests with approval requirement.
- `agent/main.py`: FastAPI routes `/health`, `/ready`, `/scan`, `/report`, `/metrics`, and governed remediation routes.
- `config/targets.yaml`: authorized target definitions only.
- `config/thresholds.yaml`: latency, loss, resource, and queue thresholds.
- `config/authorization.yaml`: explicit CIDR/domain/host allowlist and remediation policy.
- `deploy/`: Docker, Compose, systemd, Prometheus, Alertmanager rules, Kubernetes resources.
- `remediation/ansible/`: narrowly scoped playbooks; no arbitrary command endpoint.
- `dashboards/`: Grafana CIO dashboard.
- `tests/`: unit/API tests and safe mocked network checks.

## Data Flow
1. Operator or scheduler requests a scan.
2. Configuration is parsed and validated.
3. Every target is checked against the authorization policy before network I/O.
4. Scanner executes approved checks with concurrency and timeout bounds.
5. Check results are normalized, threshold-scored, and emitted as Prometheus metrics.
6. Incident state is updated from transitions rather than inferred from a single scan.
7. `/report` projects SLA, MTTR, top bottlenecks, capacity, and business-impact metadata.
8. Alertmanager consumes Prometheus rules for actionable alerts.
9. A remediation request identifies one allowlisted action and target, records the request, requires human approval for mutating actions, executes through Ansible, and records outcome/evidence.

## Safety and Governance
- Authorized targets only; reject targets outside configured hosts/domains/CIDRs.
- No subnet discovery or nmap sweep is performed by the API unless a future, separately approved capability is added.
- No default SNMP community such as `public` is embedded in application configuration.
- API tokens and SNMP credentials come from secret references/environment variables.
- Service runs non-root where possible; Linux capabilities are added only when required for ICMP.
- API protected by TLS at ingress plus authentication/RBAC for scan/report/remediation surfaces.
- Remediation is deny-by-default, allowlisted, auditable, and human-gated.
- No arbitrary SSH, shell, Ansible module, host, command, or playbook input from API callers.
- Audit records include actor, action, target, timestamp, decision, execution result, and evidence reference without secret values.

## Corrections to Supplied Draft
1. Docker Compose build context must point to repository root when the compose file lives under `deploy/`; `build: .` from `deploy/` would otherwise miss `requirements.txt` and `agent/`.
2. SNMP normally uses UDP/161; a TCP connect to port 161 is not an SNMP health check. Initial implementation separates reachability from an authenticated SNMP query.
3. Thresholds must drive severity and bottleneck scoring; hard-coded latency math is insufficient.
4. `MTTR = 0` is not an operational metric. MTTR is calculated from persisted incident open/resolve timestamps.
5. `/scan` is operationally sensitive and cannot be an unauthenticated arbitrary trigger in production.
6. `/health` is process health; `/ready` verifies configuration/state readiness.
7. CUPS queue clearing and DNS failover are mutating actions and require approval/audit controls.
8. Editing `/etc/resolv.conf` directly is not a portable DNS failover strategy; remediation must use an environment-specific adapter/playbook and verify the result.
9. Kubernetes deployment needs ConfigMap/Secret/RBAC/network-policy treatment rather than an undeclared ConfigMap reference.
10. Monitoring and remediation are separated so a failed check cannot automatically mutate production.

## API Contract
- `GET /health`: liveness plus local resource snapshot; no network scan.
- `GET /ready`: validates config, incident store, and policy load.
- `POST /scan`: authenticated trigger for configured authorized targets only.
- `GET /report`: authenticated latest CIO projection.
- `GET /metrics`: Prometheus scrape endpoint, network-restricted or authenticated at ingress.
- `POST /remediations`: create a pending request for a named allowlisted action/target.
- `POST /remediations/{id}/approve`: human approval gate.
- `POST /remediations/{id}/execute`: executes only an approved, unexpired request and records evidence.

## Failure Handling
A failed target check returns a structured result and never crashes the whole scan. Global concurrency is bounded. Timeouts are explicit. Configuration/policy errors fail closed. Remediation failure leaves the incident open, records stderr/status in sanitized evidence, and does not retry indefinitely. Alert deduplication is based on target + check kind + failure class.

## Testing and Acceptance
- Unit tests for authorization matching, thresholds, scoring, incident transitions, and report projection.
- Async tests for HTTP/DNS/TCP/ICMP adapters with network operations mocked.
- Printer tests verify IPP/raw TCP separately from SNMP UDP query behavior.
- API tests verify unauthenticated mutation is denied and unauthorized targets never reach network adapters.
- Remediation tests prove unapproved actions cannot execute and arbitrary commands/playbooks are rejected.
- Container build smoke test verifies `/health` and `/ready`.
- Compose configuration validation and Kubernetes manifest validation run in CI.
- Prometheus rule tests validate alert expressions.

## Acceptance Criteria
The first release is complete when authorized configured targets can be scanned from a supported deployment, unauthorized targets are fail-closed, Prometheus metrics and the CIO report are generated, incident-derived uptime/MTTR are real rather than placeholders, and every mutating remediation requires an auditable human approval before execution.

## Scope Boundary
V1 does not perform autonomous network discovery, vulnerability exploitation, credential testing, arbitrary shell execution, or autonomous remediation. Those capabilities are outside this design and require separate authorization and review.