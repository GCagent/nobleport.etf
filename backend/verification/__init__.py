"""
NoblePort Verification Framework
================================

Evidence-gated production verification for the NoblePort backend.

Design principle (per the RC1 audit): *architecture quality* and *runtime
evidence* are two different axes and must never be conflated. A well-designed
deployment package with zero runtime evidence is STAGED, not a production
candidate. This package exists to (a) run the checks that can be run without a
live deployment and produce real evidence, and (b) honestly mark the checks
that still require a live environment as PENDING — never fabricating proof.

Modules:
  truth_label   -- computes the honest STATUS / CLASSIFICATION / EVIDENCE label
                   for the WHOLE backend (the RC1 production-candidate decision)
  app_audit     -- per-app truth scorecard: the four evidence categories
                   (Verified Live / Staging / Prototype / Planned) + six scored
                   dimensions for every NoblePort surface, with the same
                   honesty gate (scores can never promote an evidence level)
  tests/        -- runnable verification suite (route contract, payments,
                   webhook security, migration rollback, object storage, app
                   audit honesty)
  load/         -- k6 tiered load configs (250 / 500 / 1000 concurrent users)
  evidence/     -- collection target; MANIFEST.md lists the 10 RC1 artifacts
"""

__all__ = ["truth_label", "app_audit"]
