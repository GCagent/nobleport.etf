# Governed IT Ops Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, governed IT operations service that scans only explicitly authorized NoblePort targets, emits metrics and CIO reporting, persists incidents for real uptime/MTTR, and requires auditable human approval for any remediation.

**Architecture:** Python 3.12 + FastAPI service under `ops/it-ops-agent/`, separated from the NoblePort application runtime. Read-only monitoring is default; target authorization is evaluated before network I/O; remediation is a separate deny-by-default control plane backed by named Ansible playbooks and explicit approval state.

**Tech Stack:** Python 3.12, FastAPI, Uvicorn, httpx, psutil, PyYAML, prometheus-client, pysnmp, SQLite, pytest/pytest-asyncio, Docker/Compose, systemd, Kubernetes, Prometheus, Alertmanager, Grafana, Ansible.

**Spec:** `docs/superpowers/specs/2026-09-16-it-ops-agent-design.md`

## Global Constraints

- Authorized targets only; reject targets outside configured hosts/domains/CIDRs.
- No subnet discovery or nmap sweep in V1.
- No arbitrary SSH, shell, host, command, Ansible module, or playbook input from API callers.
- Monitoring is read-only by default; mutating remediation requires human approval and audit logging.
- Secrets come from environment variables or a secrets manager and must never be written to YAML or logs.
- `/health` is local process/resource liveness; `/ready` validates config, policy, and incident-store readiness.
- SNMP must use an authenticated UDP query path rather than TCP/161 reachability.
- MTTR must be derived from persisted incident open/resolution timestamps, never a constant placeholder.
- Concurrency and all network operations must be bounded by explicit limits/timeouts.

---

## File Structure

```text
ops/it-ops-agent/
├── agent/
│   ├── __init__.py
│   ├── main.py
│   ├── models.py
│   ├── config.py
│   ├── checks.py
│   ├── scanner.py
│   ├── bottleneck.py
│   ├── incidents.py
│   ├── cio.py
│   ├── audit.py
│   ├── auth.py
│   └── remediation.py
├── config/
│   ├── targets.yaml
│   ├── thresholds.yaml
│   └── authorization.yaml
├── deploy/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── it-ops-agent.service
│   ├── prometheus.yml
│   ├── alert-rules.yml
│   └── k8s.yaml
├── remediation/ansible/
│   ├── restart_cups.yml
│   ├── clear_queue.yml
│   └── failover_dns.yml
├── dashboards/cio_dashboard.json
├── tests/
│   ├── test_config.py
│   ├── test_checks.py
│   ├── test_scanner.py
│   ├── test_bottleneck.py
│   ├── test_incidents.py
│   ├── test_cio.py
│   ├── test_api.py
│   └── test_remediation.py
├── requirements.txt
└── README.md
```

---

### Task 1: Typed models and fail-closed configuration

**Files:**
- Create: `ops/it-ops-agent/agent/models.py`
- Create: `ops/it-ops-agent/agent/config.py`
- Create: `ops/it-ops-agent/config/targets.yaml`
- Create: `ops/it-ops-agent/config/thresholds.yaml`
- Create: `ops/it-ops-agent/config/authorization.yaml`
- Test: `ops/it-ops-agent/tests/test_config.py`

**Interfaces:**
- Produces: `Target`, `CheckResult`, `Thresholds`, `AuthorizationPolicy`, `load_config()`, `is_target_authorized()`.

- [ ] **Step 1: Write failing authorization tests**

```python
from agent.config import is_target_authorized
from agent.models import AuthorizationPolicy, Target


def test_authorized_exact_host():
    policy = AuthorizationPolicy(hosts={"10.0.2.10"}, domains=set(), cidrs=set())
    target = Target(name="node-web-01", kind="node", host="10.0.2.10")
    assert is_target_authorized(target, policy) is True


def test_unauthorized_host_fails_closed():
    policy = AuthorizationPolicy(hosts=set(), domains=set(), cidrs=set())
    target = Target(name="x", kind="node", host="10.9.9.9")
    assert is_target_authorized(target, policy) is False
```

- [ ] **Step 2: Run the test and verify failure**

Run: `cd ops/it-ops-agent && pytest tests/test_config.py -v`

Expected: import/function failures because configuration modules do not yet exist.

- [ ] **Step 3: Implement minimal typed models and policy matching**

```python
# agent/models.py
from dataclasses import dataclass, field
from typing import Literal

TargetKind = Literal["api", "printer", "dns", "node", "domain"]

@dataclass(frozen=True)
class Target:
    name: str
    kind: TargetKind
    host: str | None = None
    url: str | None = None
    ports: tuple[int, ...] = ()
    token_env: str | None = None
    business_impact: str = ""

@dataclass(frozen=True)
class CheckResult:
    target: str
    kind: str
    ok: bool
    latency_ms: float | None = None
    detail: str = ""
    severity: str = "info"
    failure_class: str = ""

@dataclass(frozen=True)
class AuthorizationPolicy:
    hosts: set[str] = field(default_factory=set)
    domains: set[str] = field(default_factory=set)
    cidrs: set[str] = field(default_factory=set)
```

Implement `is_target_authorized()` with exact host/domain matching plus `ipaddress.ip_network()` CIDR checks. Any malformed policy or unresolved target returns `False`.

- [ ] **Step 4: Add YAML loaders with schema validation and rerun tests**

Run: `pytest tests/test_config.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ops/it-ops-agent/agent/models.py ops/it-ops-agent/agent/config.py ops/it-ops-agent/config ops/it-ops-agent/tests/test_config.py
git commit -m "feat(ops): add fail-closed target authorization"
```

---

### Task 2: Safe network check adapters

**Files:**
- Create: `ops/it-ops-agent/agent/checks.py`
- Test: `ops/it-ops-agent/tests/test_checks.py`

**Interfaces:**
- Consumes: `Target`, `CheckResult`.
- Produces: `ping_check()`, `tcp_check()`, `http_check()`, `dns_check()`, `snmp_printer_check()`, `check_target()`.

- [ ] **Step 1: Write mocked async tests proving no real network is required**

```python
import pytest
from agent.models import Target
from agent.checks import check_target

@pytest.mark.asyncio
async def test_api_check_uses_http_adapter(monkeypatch):
    async def fake_http(url, token_env=None):
        from agent.models import CheckResult
        return CheckResult(url, "http", True, 12.5, "HTTP 200")

    monkeypatch.setattr("agent.checks.http_check", fake_http)
    result = await check_target(Target(name="crm", kind="api", url="https://crm.example.com/health"))
    assert result[0].ok is True
```

- [ ] **Step 2: Verify test failure**

Run: `pytest tests/test_checks.py -v`

- [ ] **Step 3: Implement adapters with explicit timeouts**

Use `asyncio.create_subprocess_exec()` for ping, `asyncio.open_connection()` for TCP, `httpx.AsyncClient()` for HTTP, `asyncio.getaddrinfo()` for DNS, and `pysnmp` for UDP SNMP. Do not implement TCP/161 as an SNMP check.

- [ ] **Step 4: Add printer behavior**

Printer result set must contain separate checks for TCP/631, TCP/9100, and an authenticated SNMP query when an SNMP secret reference is configured. Missing SNMP credentials should yield a structured skipped/degraded result, not a crash.

- [ ] **Step 5: Run tests**

Run: `pytest tests/test_checks.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ops/it-ops-agent/agent/checks.py ops/it-ops-agent/tests/test_checks.py
git commit -m "feat(ops): add bounded network health checks"
```

---

### Task 3: Scanner orchestration, thresholds, and bottleneck scoring

**Files:**
- Create: `ops/it-ops-agent/agent/scanner.py`
- Create: `ops/it-ops-agent/agent/bottleneck.py`
- Test: `ops/it-ops-agent/tests/test_scanner.py`
- Test: `ops/it-ops-agent/tests/test_bottleneck.py`

**Interfaces:**
- Consumes: configured `Target` list, `AuthorizationPolicy`, `CheckResult` list.
- Produces: `scan_targets(targets, policy, concurrency, timeout_s)`, `score_result(result, thresholds)`.

- [ ] **Step 1: Write a test proving unauthorized targets never call adapters**

```python
@pytest.mark.asyncio
async def test_scanner_blocks_unauthorized_before_network(monkeypatch):
    called = False
    async def fake_check(_):
        nonlocal called
        called = True
        return []
    monkeypatch.setattr("agent.scanner.check_target", fake_check)
    results = await scan_targets([unauthorized_target], empty_policy, concurrency=4, timeout_s=2)
    assert called is False
    assert results[0].failure_class == "unauthorized_target"
```

- [ ] **Step 2: Implement semaphore-bounded scanning and per-target timeout**

Use `asyncio.Semaphore(concurrency)` and `asyncio.wait_for()` around each target check.

- [ ] **Step 3: Write scoring tests**

```python
def test_latency_above_critical_scores_high():
    r = CheckResult("api", "http", True, latency_ms=600)
    scored = score_result(r, thresholds)
    assert scored.severity == "critical"
    assert scored.score >= 75
```

- [ ] **Step 4: Implement deterministic threshold-driven severity and score**

Use configured warning/critical latency and failure status; never use hard-coded `latency / 5` logic.

- [ ] **Step 5: Run tests and commit**

Run: `pytest tests/test_scanner.py tests/test_bottleneck.py -v`

```bash
git add ops/it-ops-agent/agent/scanner.py ops/it-ops-agent/agent/bottleneck.py ops/it-ops-agent/tests/test_scanner.py ops/it-ops-agent/tests/test_bottleneck.py
git commit -m "feat(ops): add governed scan orchestration and scoring"
```

---

### Task 4: Persistent incidents, uptime, and MTTR

**Files:**
- Create: `ops/it-ops-agent/agent/incidents.py`
- Test: `ops/it-ops-agent/tests/test_incidents.py`

**Interfaces:**
- Produces: `IncidentStore(path)`, `update_from_results(results, now)`, `uptime_pct(window)`, `mttr_minutes(window)`.

- [ ] **Step 1: Write incident transition tests**

```python
def test_failure_opens_and_recovery_resolves_incident(tmp_path):
    store = IncidentStore(tmp_path / "incidents.db")
    store.update_from_results([failed_result], now=t0)
    store.update_from_results([healthy_result], now=t1)
    incidents = store.list_incidents()
    assert incidents[0].opened_at == t0
    assert incidents[0].resolved_at == t1
```

- [ ] **Step 2: Verify failure, then implement SQLite schema**

Tables: `incidents`, `samples`. Incident dedupe key: `(target, kind, failure_class)`.

- [ ] **Step 3: Implement metric calculations**

MTTR = arithmetic mean of resolved incident durations in the requested window. Uptime = healthy samples / total samples in the window; if there are no samples, return `None` rather than fabricating 100%.

- [ ] **Step 4: Run tests and commit**

Run: `pytest tests/test_incidents.py -v`

```bash
git add ops/it-ops-agent/agent/incidents.py ops/it-ops-agent/tests/test_incidents.py
git commit -m "feat(ops): persist incidents and calculate real SLA metrics"
```

---

### Task 5: CIO projection, Prometheus metrics, and API surface

**Files:**
- Create: `ops/it-ops-agent/agent/cio.py`
- Create: `ops/it-ops-agent/agent/auth.py`
- Create: `ops/it-ops-agent/agent/main.py`
- Test: `ops/it-ops-agent/tests/test_cio.py`
- Test: `ops/it-ops-agent/tests/test_api.py`

**Interfaces:**
- Produces routes: `GET /health`, `GET /ready`, `POST /scan`, `GET /report`, `GET /metrics`.

- [ ] **Step 1: Write API auth tests**

```python
def test_scan_requires_operator_token(client):
    r = client.post("/scan")
    assert r.status_code == 401


def test_health_does_not_trigger_network(client, monkeypatch):
    monkeypatch.setattr("agent.main.run_scan", lambda: (_ for _ in ()).throw(AssertionError("scan called")))
    r = client.get("/health")
    assert r.status_code == 200
```

- [ ] **Step 2: Implement bearer-token operator authentication**

Read token from `IT_OPS_OPERATOR_TOKEN`; compare using `secrets.compare_digest()`. `/health` stays unauthenticated. `/ready`, `/scan`, `/report` require operator auth. `/metrics` is documented as ingress-restricted; optionally accept the same token when configured.

- [ ] **Step 3: Implement Prometheus gauges**

Metrics: `it_check_latency_ms`, `it_check_success`, `it_bottleneck_score`, `it_sla_uptime_pct`, `it_mttr_minutes`, `it_incidents_open`.

- [ ] **Step 4: Implement CIO projection**

Return `overall_risk`, `sla`, `top_bottlenecks`, `capacity`, `business_impact`, and `cost_risk`. Risk must be derived from scored results/incidents and must not invent dollar impact when none is configured.

- [ ] **Step 5: Run tests and commit**

Run: `pytest tests/test_cio.py tests/test_api.py -v`

```bash
git add ops/it-ops-agent/agent/cio.py ops/it-ops-agent/agent/auth.py ops/it-ops-agent/agent/main.py ops/it-ops-agent/tests/test_cio.py ops/it-ops-agent/tests/test_api.py
git commit -m "feat(ops): expose authenticated IT operations API and CIO report"
```

---

### Task 6: Audited human-gated remediation

**Files:**
- Create: `ops/it-ops-agent/agent/audit.py`
- Create: `ops/it-ops-agent/agent/remediation.py`
- Create: `ops/it-ops-agent/remediation/ansible/restart_cups.yml`
- Create: `ops/it-ops-agent/remediation/ansible/clear_queue.yml`
- Create: `ops/it-ops-agent/remediation/ansible/failover_dns.yml`
- Modify: `ops/it-ops-agent/agent/main.py`
- Test: `ops/it-ops-agent/tests/test_remediation.py`

**Interfaces:**
- Produces routes: `POST /remediations`, `POST /remediations/{id}/approve`, `POST /remediations/{id}/execute`.
- Produces states: `PENDING`, `APPROVED`, `EXECUTING`, `SUCCEEDED`, `FAILED`, `EXPIRED`.

- [ ] **Step 1: Write tests proving unapproved and arbitrary actions are denied**

```python
def test_execute_requires_approval(client, auth_headers):
    req = client.post("/remediations", json={"action":"restart_cups","target":"printer-finance-3"}, headers=auth_headers).json()
    r = client.post(f"/remediations/{req['id']}/execute", headers=auth_headers)
    assert r.status_code == 409


def test_arbitrary_playbook_rejected(client, auth_headers):
    r = client.post("/remediations", json={"action":"../../evil.yml","target":"x"}, headers=auth_headers)
    assert r.status_code == 400
```

- [ ] **Step 2: Implement append-only JSONL audit events**

Each event contains actor, action, target, timestamp, decision, result, and evidence reference. Sanitize stdout/stderr before writing; never persist secret env values.

- [ ] **Step 3: Implement named-action allowlist**

Map exact action IDs to exact playbook paths in code/config. API callers never provide filesystem paths, commands, modules, inventory groups, or SSH arguments.

- [ ] **Step 4: Implement approval expiry and execution**

Approval validity defaults to 15 minutes. `execute` runs `ansible-playbook` with a preconfigured inventory and target variable only after approval.

- [ ] **Step 5: Run tests and commit**

Run: `pytest tests/test_remediation.py -v`

```bash
git add ops/it-ops-agent/agent/audit.py ops/it-ops-agent/agent/remediation.py ops/it-ops-agent/agent/main.py ops/it-ops-agent/remediation ops/it-ops-agent/tests/test_remediation.py
git commit -m "feat(ops): add audited human-gated remediation"
```

---

### Task 7: Docker, systemd, Prometheus, Alertmanager, Grafana, and Kubernetes packaging

**Files:**
- Create: `ops/it-ops-agent/requirements.txt`
- Create: `ops/it-ops-agent/deploy/Dockerfile`
- Create: `ops/it-ops-agent/deploy/docker-compose.yml`
- Create: `ops/it-ops-agent/deploy/it-ops-agent.service`
- Create: `ops/it-ops-agent/deploy/prometheus.yml`
- Create: `ops/it-ops-agent/deploy/alert-rules.yml`
- Create: `ops/it-ops-agent/deploy/k8s.yaml`
- Create: `ops/it-ops-agent/dashboards/cio_dashboard.json`

**Interfaces:**
- Produces deployable artifacts for bare metal, Compose, and Kubernetes.

- [ ] **Step 1: Add pinned-compatible dependencies**

Minimums: FastAPI, Uvicorn, httpx, psutil, PyYAML, prometheus-client, pysnmp, pytest, pytest-asyncio.

- [ ] **Step 2: Implement Docker build from repository root**

Compose must use:

```yaml
services:
  agent:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
```

when executed from `ops/it-ops-agent/deploy/`, or document the exact root invocation and use a root-relative context that includes `agent/`, `config/`, and `requirements.txt`.

- [ ] **Step 3: Add Prometheus scrape and alert rules**

At minimum: target failure, critical bottleneck score, stale scan, open critical incident, and local disk critical alerts.

- [ ] **Step 4: Add Kubernetes ConfigMap, Secret references, RBAC, NetworkPolicy, readiness/liveness probes**

No undeclared ConfigMap references. Secret values are referenced, not embedded.

- [ ] **Step 5: Validate deployment artifacts**

Run:

```bash
docker compose -f deploy/docker-compose.yml config
kubectl apply --dry-run=client -f deploy/k8s.yaml
promtool check config deploy/prometheus.yml
promtool check rules deploy/alert-rules.yml
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add ops/it-ops-agent/deploy ops/it-ops-agent/dashboards ops/it-ops-agent/requirements.txt
git commit -m "feat(ops): package IT ops service for production deployment"
```

---

### Task 8: End-to-end verification and operator documentation

**Files:**
- Create: `ops/it-ops-agent/README.md`
- Modify: all tests as required only for verified defects.

**Interfaces:**
- Produces a documented, testable V1 release candidate.

- [ ] **Step 1: Run the full Python test suite**

Run: `cd ops/it-ops-agent && pytest -q`

Expected: 0 failures.

- [ ] **Step 2: Build and smoke-test the container**

```bash
docker build -f deploy/Dockerfile -t nobleport/it-ops-agent:test .
docker run --rm -d --name it-ops-agent-test -p 18080:8080 \
  -e CONFIG_PATH=/app/config/targets.yaml \
  -e IT_OPS_OPERATOR_TOKEN=test-token \
  nobleport/it-ops-agent:test
curl -fsS http://localhost:18080/health
curl -fsS -H 'Authorization: Bearer test-token' http://localhost:18080/ready
docker stop it-ops-agent-test
```

Expected: `/health` and `/ready` return 200.

- [ ] **Step 3: Verify unauthorized target protection with a mocked adapter integration test**

Run: `pytest tests/test_scanner.py::test_scanner_blocks_unauthorized_before_network -v`

Expected: PASS and adapter invocation count remains zero.

- [ ] **Step 4: Verify remediation gate**

Run: `pytest tests/test_remediation.py -v`

Expected: unapproved execution and arbitrary action tests PASS.

- [ ] **Step 5: Document operator workflows**

README must include: authorized target configuration, secrets, bare-metal launch, Docker/Compose, Kubernetes, metrics, dashboard import, incident semantics, remediation approval flow, backup/restore of incident DB and audit log, and explicit V1 exclusions.

- [ ] **Step 6: Final verification**

Run:

```bash
pytest -q
docker compose -f deploy/docker-compose.yml config
kubectl apply --dry-run=client -f deploy/k8s.yaml
promtool check config deploy/prometheus.yml
promtool check rules deploy/alert-rules.yml
```

Expected: all commands exit 0 before any production deployment claim.

- [ ] **Step 7: Commit**

```bash
git add ops/it-ops-agent/README.md ops/it-ops-agent/tests
git commit -m "docs(ops): finalize governed IT ops runbook and verification"
```

---

## Self-Review

- Spec coverage: authorization, network checks, bounded concurrency, thresholds, incident-derived uptime/MTTR, CIO reporting, metrics, audit, human-gated remediation, Docker/Compose/systemd/Kubernetes, Prometheus/Alertmanager/Grafana are all mapped to tasks.
- Scope boundary: no autonomous discovery, vulnerability exploitation, credential testing, arbitrary shell execution, or autonomous remediation is introduced.
- Type consistency: `Target`, `CheckResult`, `AuthorizationPolicy`, `scan_targets()`, `score_result()`, and `IncidentStore` are defined before consumers use them.
- Deployment correction: Compose build context is explicitly handled from `deploy/` so it cannot silently omit application files.
- Security correction: SNMP uses UDP/authenticated querying, operator endpoints require authentication, and remediation remains deny-by-default.
