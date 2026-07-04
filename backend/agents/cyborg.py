"""
NoblePort OS — Cyborg.ai

Security, governance, and risk verification agent. Cyborg wraps
every sensitive operation in trust verification, audits compliance
state, assesses risk levels, enforces kill switches, and checks
authorization before critical actions proceed.

Cyborg queries the database directly for compliance audits so it
can verify job state against policy rules in real-time.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from backend.agents.base import AgentFamily, BaseAgent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# High-risk and threshold constants
# ---------------------------------------------------------------------------

HIGH_RISK_ACTIONS = frozenset({
    "delete_job",
    "void_payment",
    "override_deposit_gate",
    "force_close_job",
    "modify_contract_value",
    "bulk_status_change",
    "export_financial_data",
    "change_permissions",
    "trigger_kill_switch",
})

HUMAN_REQUIRED_ACTIONS = frozenset({
    "trigger_kill_switch",
    "override_deposit_gate",
    "delete_job",
    "manage_users",
    "export_financial_data",
    "void_payment",
    "force_close_job",
})

FINANCIAL_THRESHOLDS = {
    "auto_approve_limit": 5_000.0,
    "elevated_review_limit": 25_000.0,
    "executive_approval_limit": 100_000.0,
}

# ---------------------------------------------------------------------------
# Role-based authorization matrix
# ---------------------------------------------------------------------------

AUTHORIZATION_MATRIX: dict[str, set[str]] = {
    "admin": {
        "read", "write", "delete", "approve_estimate", "approve_change_order",
        "process_payment", "manage_users", "trigger_kill_switch",
        "override_deposit_gate", "export_financial_data", "view_audit_trail",
        "void_payment", "force_close_job", "modify_contract_value",
        "bulk_status_change", "change_permissions",
    },
    "project_manager": {
        "read", "write", "approve_estimate", "approve_change_order",
        "process_payment", "view_audit_trail",
    },
    "estimator": {
        "read", "write", "approve_estimate",
    },
    "field_supervisor": {
        "read", "write", "approve_change_order",
    },
    "bookkeeper": {
        "read", "process_payment", "view_audit_trail",
    },
    "viewer": {
        "read",
    },
    # Agent roles
    "stephanie": {
        "read", "write", "approve_estimate", "approve_change_order",
        "process_payment", "view_audit_trail",
    },
    "gcagent": {
        "read", "write",
    },
    "permitstream": {
        "read",
    },
}

# ---------------------------------------------------------------------------
# Policy rules
# ---------------------------------------------------------------------------

_POLICY_RULES: list[dict[str, Any]] = [
    {
        "id": "deposit-before-build",
        "rule": "Deposit must be collected before job activation",
        "scope": "job",
        "enforced": True,
    },
    {
        "id": "human-approval-high-value",
        "rule": f"Human approval required for actions over ${FINANCIAL_THRESHOLDS['elevated_review_limit']:,.0f}",
        "scope": "financial",
        "enforced": True,
    },
    {
        "id": "permit-before-build",
        "rule": "Permit must be issued before construction (unless exempt)",
        "scope": "permit",
        "enforced": True,
    },
    {
        "id": "dual-approval-refunds",
        "rule": "Refunds require dual approval",
        "scope": "financial",
        "enforced": True,
    },
    {
        "id": "co-approval-before-work",
        "rule": "Change orders must be approved before work begins",
        "scope": "change_order",
        "enforced": True,
    },
]


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TrustLevel(StrEnum):
    FULL = "full"
    ELEVATED = "elevated"
    STANDARD = "standard"
    LIMITED = "limited"
    NONE = "none"


class VerificationResult(BaseModel):
    verified: bool
    decision: str  # allowed, requires_approval, blocked
    trust_level: TrustLevel
    verification_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    actor: str
    action: str
    subject: str
    requires_human_approval: bool = False
    violations: list[dict[str, str]] = Field(default_factory=list)
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class KillSwitchState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scope: str
    armed: bool = False
    triggered_at: str | None = None
    triggered_by: str | None = None
    reason: str | None = None
    controller: str = "admin"
    description: str = ""


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class CyborgAgent(BaseAgent):
    """
    Cyborg.ai — security/governance/risk verification.

    Every sensitive action in NoblePort OS passes through Cyborg
    for trust verification. Maintains kill switches, enforces RBAC,
    audits compliance against policy rules, and assesses risk.
    """

    def __init__(self, agent_id: str | None = None) -> None:
        super().__init__(
            name="Cyborg.ai",
            family=AgentFamily.CYBORG,
            role="Security, governance, risk verification",
            agent_id=agent_id or "cyborg-primary",
        )
        # In-memory kill switch registry
        self._kill_switches: dict[str, KillSwitchState] = {
            "global": KillSwitchState(
                scope="global", controller="admin",
                description="Master kill switch — halts all operations",
            ),
            "payments": KillSwitchState(
                scope="payments", controller="admin",
                description="Suspends all payment processing",
            ),
            "estimates": KillSwitchState(
                scope="estimates", controller="project_manager",
                description="Pauses estimate creation and approval",
            ),
            "change_orders": KillSwitchState(
                scope="change_orders", controller="project_manager",
                description="Freezes change order processing",
            ),
            "agent_mesh": KillSwitchState(
                scope="agent_mesh", controller="admin",
                description="Suspends all AI agent operations",
            ),
        }

    # -----------------------------------------------------------------------
    # Task router
    # -----------------------------------------------------------------------

    async def _handle_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        match task_type:
            case "verify_action":
                result = await self.verify_action(
                    actor=payload.get("actor", "unknown"),
                    action=payload.get("action", ""),
                    subject=payload.get("subject", ""),
                    amount=payload.get("amount", 0.0),
                    actor_type=payload.get("actor_type", "human"),
                    context=payload.get("context", {}),
                )
                return result.model_dump()
            case "audit_compliance":
                return await self.audit_compliance(payload["job_id"])
            case "assess_risk":
                return await self.assess_risk(
                    action_type=payload.get("action_type", "unknown"),
                    context=payload.get("context", {}),
                )
            case "enforce_kill_switch":
                return await self.enforce_kill_switch(
                    scope=payload.get("scope", "global"),
                    reason=payload.get("reason", "No reason provided"),
                    actor=payload.get("actor", "system"),
                    armed=payload.get("armed", True),
                )
            case "check_authorization" | "authorization_check":
                return await self.check_authorization(
                    actor=payload.get("actor", ""),
                    resource=payload.get("resource", ""),
                    permission=payload.get("permission", "read"),
                )
            # Routed events from the orchestrator
            case "action_verification_requested":
                result = await self.verify_action(
                    actor=payload.get("actor", "unknown"),
                    action=payload.get("action", ""),
                    subject=payload.get("subject", ""),
                    amount=payload.get("amount", 0.0),
                    actor_type=payload.get("actor_type", "human"),
                    context=payload.get("context", {}),
                )
                return result.model_dump()
            case "risk_assessment_requested":
                return await self.assess_risk(
                    action_type=payload.get("action_type", "unknown"),
                    context=payload.get("context", {}),
                )
            case "kill_switch_toggled":
                return await self.enforce_kill_switch(
                    scope=payload.get("scope", "global"),
                    reason=payload.get("reason", "No reason provided"),
                    actor=payload.get("actor", "system"),
                    armed=payload.get("armed", True),
                )
            case _:
                raise ValueError(f"Unknown Cyborg task type: {task_type}")

    # -----------------------------------------------------------------------
    # 1. Action verification
    # -----------------------------------------------------------------------

    async def verify_action(
        self,
        actor: str,
        action: str,
        subject: str,
        amount: float = 0.0,
        actor_type: str = "human",
        context: dict[str, Any] | None = None,
    ) -> VerificationResult:
        """
        Verify whether an actor is authorized to perform an action.

        Checks in order:
          1. Kill switch state
          2. RBAC authorization
          3. High-risk action classification
          4. Financial threshold policies
          5. Domain-specific policy rules
        """
        context = context or {}
        violations: list[dict[str, str]] = []
        requires_human = False
        blocked = False

        # 1. Kill switches
        for scope, ks in self._kill_switches.items():
            if ks.armed:
                if scope == "global" or action.startswith(scope.rstrip("s")):
                    blocked = True
                    violations.append({
                        "rule": f"kill-switch-{scope}",
                        "detail": f"Kill switch armed for scope '{scope}': {ks.reason}",
                    })

        # 2. RBAC
        actor_lower = actor.lower()
        actor_perms = AUTHORIZATION_MATRIX.get(actor_lower, set())
        action_lower = action.lower()

        if action_lower not in actor_perms and actor_lower in AUTHORIZATION_MATRIX:
            blocked = True
            violations.append({
                "rule": "rbac",
                "detail": f"Actor '{actor}' lacks '{action}' permission",
            })
        elif actor_lower not in AUTHORIZATION_MATRIX:
            blocked = True
            violations.append({
                "rule": "unknown-actor",
                "detail": f"Actor '{actor}' not in authorization matrix",
            })

        # 3. High-risk actions
        if action in HIGH_RISK_ACTIONS:
            requires_human = True
            if actor_type == "agent":
                violations.append({
                    "rule": "high-risk-agent-action",
                    "detail": f"Action '{action}' requires human approval when initiated by agent",
                })

        # 4. Financial thresholds
        if amount > FINANCIAL_THRESHOLDS["executive_approval_limit"]:
            requires_human = True
            violations.append({
                "rule": "executive-threshold",
                "detail": f"Amount ${amount:,.2f} exceeds executive approval threshold",
            })
        elif amount > FINANCIAL_THRESHOLDS["elevated_review_limit"]:
            requires_human = True

        # 5. Human-required actions
        if action in HUMAN_REQUIRED_ACTIONS:
            requires_human = True

        # 6. Policy rules
        for rule in _POLICY_RULES:
            if not rule["enforced"]:
                continue
            if rule["id"] == "deposit-before-build" and action == "activate_job":
                if not context.get("deposit_collected"):
                    blocked = True
                    violations.append({"rule": rule["id"], "detail": rule["rule"]})
            elif rule["id"] == "co-approval-before-work" and action == "start_change_order_work":
                if not context.get("change_order_approved"):
                    blocked = True
                    violations.append({"rule": rule["id"], "detail": rule["rule"]})

        # Decision
        if blocked:
            decision = "blocked"
            trust_level = TrustLevel.NONE
        elif requires_human:
            decision = "requires_approval"
            trust_level = TrustLevel.LIMITED
        else:
            decision = "allowed"
            trust_level = (
                TrustLevel.FULL if actor_lower == "admin"
                else TrustLevel.ELEVATED if actor_lower in ("stephanie", "project_manager")
                else TrustLevel.STANDARD
            )

        if blocked:
            logger.warning(
                "CYBORG BLOCKED: %s by %s on %s — %d violation(s)",
                action, actor, subject, len(violations),
            )
        elif requires_human:
            logger.info("CYBORG APPROVAL REQUIRED: %s by %s", action, actor)

        return VerificationResult(
            verified=not blocked,
            decision=decision,
            trust_level=trust_level,
            actor=actor,
            action=action,
            subject=subject,
            requires_human_approval=requires_human,
            violations=violations,
        )

    # -----------------------------------------------------------------------
    # 2. Compliance audit (database-integrated)
    # -----------------------------------------------------------------------

    async def audit_compliance(self, job_id: str) -> dict[str, Any]:
        """
        Audit a job for compliance issues across financial,
        operational, and safety dimensions by querying the database.
        """
        from sqlalchemy import select as sa_select

        from backend.config.database import async_session
        from backend.models.change_order import ChangeOrder, ChangeOrderStatus
        from backend.models.job import Job, JobStatus
        from backend.models.payment import Payment, PaymentStatus
        from backend.models.project import Project, ProjectStatus

        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found", "compliance_score": 0}

            findings: list[dict[str, Any]] = []

            # -- Financial compliance --

            # Deposit gate
            if not job.deposit_gate_passed and job.status not in (
                JobStatus.PENDING_DEPOSIT, JobStatus.CANCELLED
            ):
                findings.append({
                    "category": "financial",
                    "severity": "critical",
                    "finding": "Job active without deposit gate passed",
                    "detail": f"Status is {job.status.value} but deposit gate not cleared",
                    "action": "Halt work or collect deposit immediately",
                    "rule": "deposit-before-build",
                })

            # Overbilling
            total_authorized = job.contract_value + job.change_order_total
            if job.total_invoiced > total_authorized:
                overbilled = job.total_invoiced - total_authorized
                findings.append({
                    "category": "financial",
                    "severity": "high",
                    "finding": "Invoiced amount exceeds authorized total",
                    "detail": f"Overbilled by ${overbilled:,.2f}",
                    "action": "Review invoicing and issue credit if needed",
                    "rule": "billing-integrity",
                })

            # Overpayment
            if job.total_paid > job.total_invoiced:
                overpaid = job.total_paid - job.total_invoiced
                findings.append({
                    "category": "financial",
                    "severity": "high",
                    "finding": "Payments exceed invoiced amount",
                    "detail": f"Overpaid by ${overpaid:,.2f}",
                    "action": "Reconcile payments against invoices",
                    "rule": "payment-reconciliation",
                })

            # -- Change order compliance --
            unapproved_result = await db.execute(
                sa_select(ChangeOrder).where(
                    ChangeOrder.job_id == job_id,
                    ChangeOrder.status.in_([
                        ChangeOrderStatus.IN_PROGRESS,
                        ChangeOrderStatus.COMPLETED,
                    ]),
                    ChangeOrder.approved_by.is_(None),
                )
            )
            unapproved_cos = list(unapproved_result.scalars())
            if unapproved_cos:
                findings.append({
                    "category": "compliance",
                    "severity": "high",
                    "finding": f"{len(unapproved_cos)} change order(s) executed without approval",
                    "detail": "Work proceeding on unapproved change orders",
                    "action": "Obtain retroactive approval and document justification",
                    "rule": "co-approval-before-work",
                })

            # -- Permit compliance --
            if job.project_id:
                project = await db.get(Project, job.project_id)
                if project:
                    if (
                        project.status == ProjectStatus.PERMIT_PENDING
                        and job.status == JobStatus.IN_PROGRESS
                    ):
                        findings.append({
                            "category": "compliance",
                            "severity": "critical",
                            "finding": "Construction active without issued permit",
                            "detail": f"Project '{project.name}' permit still pending",
                            "action": "Stop work until permit is issued or obtain exemption",
                            "rule": "permit-before-build",
                        })

            # -- Operational compliance --
            if job.contract_value > 50_000 and not job.crew:
                findings.append({
                    "category": "operational",
                    "severity": "medium",
                    "finding": "High-value job with no crew assigned",
                    "detail": f"${job.contract_value:,.0f} job has no crew assignment",
                    "action": "Assign crew and update schedule",
                    "rule": "crew-assignment",
                })

            # Compute compliance score
            critical_count = sum(1 for f in findings if f["severity"] == "critical")
            high_count = sum(1 for f in findings if f["severity"] == "high")
            medium_count = sum(1 for f in findings if f["severity"] == "medium")
            compliance_score = max(
                0, 100 - (critical_count * 25) - (high_count * 10) - (medium_count * 5)
            )

            return {
                "job_id": job_id,
                "job_number": job.job_number,
                "compliance_score": compliance_score,
                "status": (
                    "compliant" if compliance_score >= 90
                    else "needs_attention" if compliance_score >= 60
                    else "non_compliant"
                ),
                "finding_count": len(findings),
                "findings": findings,
                "policy_rules_evaluated": len(_POLICY_RULES),
                "audited_at": datetime.now(timezone.utc).isoformat(),
                "agent": "Cyborg",
            }

    # -----------------------------------------------------------------------
    # 3. Risk assessment
    # -----------------------------------------------------------------------

    async def assess_risk(
        self,
        action_type: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Assess the risk of a proposed action given its context.
        Returns risk level, contributing factors, and mitigations.
        """
        risk_score = 0
        risk_factors: list[dict[str, Any]] = []
        mitigations: list[str] = []

        amount = context.get("amount", 0)
        actor_type = context.get("actor_type", "human")

        # Action type risk
        if action_type in HIGH_RISK_ACTIONS:
            risk_score += 40
            risk_factors.append({
                "factor": "high_risk_action",
                "detail": f"Action '{action_type}' classified as high risk",
                "impact": 40,
            })
            mitigations.append("Require multi-party approval")
            mitigations.append("Log to immutable audit trail")

        # Financial risk
        if amount > FINANCIAL_THRESHOLDS["executive_approval_limit"]:
            risk_score += 30
            risk_factors.append({
                "factor": "executive_threshold",
                "detail": f"Amount ${amount:,.2f} exceeds executive threshold",
                "impact": 30,
            })
            mitigations.append("Require executive approval before proceeding")
        elif amount > FINANCIAL_THRESHOLDS["elevated_review_limit"]:
            risk_score += 20
            risk_factors.append({
                "factor": "elevated_value",
                "detail": f"Amount ${amount:,.2f} requires elevated review",
                "impact": 20,
            })
            mitigations.append("Require PM approval")
        elif amount > FINANCIAL_THRESHOLDS["auto_approve_limit"]:
            risk_score += 10
            risk_factors.append({
                "factor": "above_auto_approve",
                "detail": f"Amount ${amount:,.2f} above auto-approve limit",
                "impact": 10,
            })

        # Actor trust risk
        if actor_type == "agent":
            risk_score += 10
            risk_factors.append({
                "factor": "agent_initiated",
                "detail": "Action initiated by AI agent",
                "impact": 10,
            })
            mitigations.append("Verify AI recommendation before proceeding")

        actor = context.get("actor", "unknown")
        if actor.lower() not in AUTHORIZATION_MATRIX:
            risk_score += 20
            risk_factors.append({
                "factor": "unknown_actor",
                "detail": f"Actor '{actor}' not in authorization matrix",
                "impact": 20,
            })
            mitigations.append("Verify actor identity before proceeding")

        # Missing audit trail
        if not context.get("has_audit_trail", True):
            risk_score += 15
            risk_factors.append({
                "factor": "no_audit_trail",
                "detail": "No prior audit trail for this context",
                "impact": 15,
            })
            mitigations.append("Create audit record before proceeding")

        risk_level = (
            "critical" if risk_score >= 60
            else "high" if risk_score >= 40
            else "medium" if risk_score >= 20
            else "low"
        )

        return {
            "action_type": action_type,
            "risk_level": risk_level,
            "risk_score": min(risk_score, 100),
            "risk_factors": risk_factors,
            "mitigations": mitigations,
            "requires_approval": risk_score >= 40,
            "recommendation": (
                "Block without dual human approval" if risk_level == "critical"
                else "Require human approval" if risk_level == "high"
                else "Proceed with logging" if risk_level == "medium"
                else "Proceed normally"
            ),
            "assessed_at": datetime.now(timezone.utc).isoformat(),
            "agent": "Cyborg",
        }

    # -----------------------------------------------------------------------
    # 4. Kill switch enforcement
    # -----------------------------------------------------------------------

    async def enforce_kill_switch(
        self,
        scope: str,
        reason: str,
        actor: str = "system",
        armed: bool = True,
    ) -> dict[str, Any]:
        """
        Arm or disarm a kill switch for a given scope.
        Kill switches halt all operations in their scope until
        manually reset by an authorized controller.
        """
        # Verify actor can trigger
        auth = await self.check_authorization(actor, scope, "trigger_kill_switch")
        if not auth["authorized"]:
            return {
                "success": False,
                "scope": scope,
                "armed": False,
                "reason": auth["reason"],
                "agent": "Cyborg",
            }

        if scope not in self._kill_switches:
            self._kill_switches[scope] = KillSwitchState(
                scope=scope,
                controller=actor,
                description=f"Kill switch for {scope} operations",
            )

        ks = self._kill_switches[scope]
        ks.armed = armed
        ks.triggered_at = datetime.now(timezone.utc).isoformat()
        ks.triggered_by = actor
        ks.reason = reason

        # Update agent-level kill switch flag
        self._kill_switch_armed = any(
            k.armed for k in self._kill_switches.values()
        )

        action_word = "ARMED" if armed else "DISARMED"
        logger.warning(
            "Kill switch %s — scope=%s, actor=%s, reason=%s",
            action_word, scope, actor, reason,
        )

        return {
            "success": True,
            "scope": scope,
            "armed": armed,
            "triggered_at": ks.triggered_at,
            "triggered_by": actor,
            "reason": reason,
            "affected_operations": self._get_affected_operations(scope),
            "active_kill_switches": [
                {"scope": k.scope, "armed": k.armed, "reason": k.reason}
                for k in self._kill_switches.values()
                if k.armed
            ],
            "agent": "Cyborg",
        }

    def _get_affected_operations(self, scope: str) -> list[str]:
        scope_map: dict[str, list[str]] = {
            "global": [
                "All agent operations halted",
                "All financial transactions suspended",
                "All estimate processing paused",
                "All change orders frozen",
            ],
            "payments": [
                "Stripe payment processing suspended",
                "Deposit collection halted",
                "Invoice payments frozen",
            ],
            "estimates": [
                "Estimate creation paused",
                "Estimate approval suspended",
                "Pipeline intake halted",
            ],
            "change_orders": [
                "Change order creation paused",
                "Change order approval suspended",
                "AWO suggestions disabled",
            ],
            "agent_mesh": [
                "All AI agent operations suspended",
                "Manual-only mode activated",
            ],
        }
        return scope_map.get(scope, [f"Operations in scope '{scope}' halted"])

    # -----------------------------------------------------------------------
    # 5. Authorization check
    # -----------------------------------------------------------------------

    async def check_authorization(
        self,
        actor: str,
        resource: str,
        permission: str,
    ) -> dict[str, Any]:
        """
        Check whether an actor has a specific permission.
        Uses the RBAC authorization matrix.
        """
        actor_lower = actor.lower()
        permission_lower = permission.lower()

        actor_perms = AUTHORIZATION_MATRIX.get(actor_lower, set())
        authorized = permission_lower in actor_perms

        if authorized:
            reason = f"Actor '{actor}' has '{permission}' permission"
        elif actor_lower in AUTHORIZATION_MATRIX:
            reason = f"Actor '{actor}' lacks '{permission}' permission"
        else:
            reason = f"Actor '{actor}' not found in authorization matrix"

        return {
            "authorized": authorized,
            "actor": actor,
            "resource": resource,
            "permission": permission,
            "reason": reason,
            "requires_human_approval": permission_lower in HUMAN_REQUIRED_ACTIONS,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "agent": "Cyborg",
        }

    # -----------------------------------------------------------------------
    # Dashboard helpers
    # -----------------------------------------------------------------------

    async def get_kill_switch_status(self) -> list[dict[str, Any]]:
        """Return kill switch states for the Mission Control dashboard."""
        return [
            {
                "id": ks.id,
                "scope": ks.scope,
                "armed": ks.armed,
                "lastTriggeredAt": ks.triggered_at,
                "controller": ks.controller,
                "description": ks.description,
            }
            for ks in self._kill_switches.values()
        ]

    async def get_policy_rules(self) -> list[dict[str, Any]]:
        """Return the set of enforced policy rules."""
        return [
            {
                "id": r["id"],
                "rule": r["rule"],
                "status": "enforced" if r["enforced"] else "warning",
                "violations": 0,  # would be populated from audit trail
            }
            for r in _POLICY_RULES
        ]
