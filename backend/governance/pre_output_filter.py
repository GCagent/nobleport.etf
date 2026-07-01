"""
Stephanie.ai — Pre-Output Truth Filter
======================================

The enforcement point the Truth & Audit Module calls a "pre-output filter
hook": every avatar utterance and executive briefing is routed through here
*before* it reaches a human, so nothing ships untagged and nothing that requires
licensed oversight ships without saying so.

This is the executable form of the architecture's Truth-Layer protocol
(Section 04) and Credential Register (Section 03), composed:

  1. Every output must carry a confirmed Truth-Layer tag. Untagged output is
     rejected (fail-closed) — never defaulted to LIVE.
  2. A BLOCKED tag withholds the output from release and escalates to Michael.
  3. Any tag requiring human approval (STAGED / BLOCKED) attaches the standard
     oversight notice.
  4. Text that reads as a claim over a registered credential (a PE stamp, a
     securities recommendation, a legal opinion, an appraisal, …) attaches the
     specific "licensed reviewer required" caveat from the Credential Register.

The filter does not rewrite the substance of an output; it tags, caveats, and —
when fail-closed — withholds it. The result is auditable: same tag in, same
disposition out.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

from backend.governance.authority_matrix import CREDENTIAL_REGISTER
from backend.governance.stephanie_gate import FINAL_DECISION_AUTHORITY
from backend.governance.truth_layer import (
    TAG_DEFINITIONS,
    TruthTag,
    assert_tagged,
    requires_human_approval,
)

OVERSIGHT_NOTICE = (
    "Advisory only. Subject to licensed human oversight — not cleared for final "
    "engineering, legal, or investment decisions without a qualified reviewer."
)

# Phrases that suggest an output is claiming/exercising a registered credential.
# Conservative and keyed to the register so the caveat we attach is the real one.
_CREDENTIAL_TRIGGERS: dict[str, tuple[str, ...]] = {
    "PE": ("stamp", "sealed", "certify", "certified", "engineering certification",
           "structurally sound", "load-bearing", "code-compliant per my"),
    "Series 7": ("buy", "sell", "invest in", "guaranteed return", "recommend the security",
                 "you should trade", "portfolio allocation"),
    "Attorney": ("legal opinion", "legally binding", "you are liable", "this contract is enforceable",
                 "as your attorney", "legal advice"),
    "Appraiser": ("appraised value", "the property is worth", "certified valuation"),
}


@dataclass
class FilterResult:
    """The disposition of one output routed through the pre-output filter."""

    released: bool                 # False => withheld from the human/action surface
    tag: str
    disposition: str               # RELEASE | RELEASE_WITH_CAVEAT | WITHHOLD_ESCALATE
    text: str                      # possibly annotated with disclaimer/caveats
    disclaimer: str
    credential_caveats: list[str] = field(default_factory=list)
    escalate_to: str | None = None
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "released": self.released,
            "tag": self.tag,
            "disposition": self.disposition,
            "text": self.text,
            "disclaimer": self.disclaimer,
            "credential_caveats": self.credential_caveats,
            "escalate_to": self.escalate_to,
            "reason": self.reason,
        }


def _matched_credentials(text: str) -> list[str]:
    lowered = text.lower()
    hits: list[str] = []
    for credential, triggers in _CREDENTIAL_TRIGGERS.items():
        if any(t in lowered for t in triggers):
            hits.append(credential)
    return hits


def _caveat_for(credential: str) -> str:
    for rule in CREDENTIAL_REGISTER:
        if rule.credential == credential:
            return (
                f"[{credential}] {rule.correct_treatment}. "
                f"Requires review by a {rule.licensed_reviewer_required}."
            )
    # Unknown credential name — still fail safe with a generic caveat.
    return f"[{credential}] Requires review by a licensed professional."


def filter_output(
    text: str,
    tag: TruthTag | str | None,
    *,
    target: str | None = None,
    extra_credentials: Iterable[str] = (),
) -> FilterResult:
    """
    Route one output through the truth filter.

    ``tag`` is the Truth-Layer tag for this output — typically the ``truth_tag``
    from a :class:`TruthAuditReport`. It is mandatory: an untagged output is
    rejected (fail-closed).
    """
    # Rule 1: fail-closed on missing/unknown tag.
    confirmed = assert_tagged(tag)

    credentials = sorted(set(_matched_credentials(text)) | set(extra_credentials))
    caveats = [_caveat_for(c) for c in credentials]

    # Rule 2: BLOCKED withholds and escalates.
    if confirmed == TruthTag.BLOCKED:
        return FilterResult(
            released=False,
            tag=confirmed.value,
            disposition="WITHHOLD_ESCALATE",
            text="",  # nothing is released downstream
            disclaimer=OVERSIGHT_NOTICE,
            credential_caveats=caveats,
            escalate_to=FINAL_DECISION_AUTHORITY,
            reason=f"BLOCKED — {TAG_DEFINITIONS[confirmed]}",
        )

    # Rules 3 & 4: attach oversight notice + any credential caveats.
    needs_approval = requires_human_approval(confirmed)
    disclaimer = OVERSIGHT_NOTICE if (needs_approval or caveats) else ""

    annotated = text
    footer_parts: list[str] = []
    if disclaimer:
        footer_parts.append(disclaimer)
    footer_parts.extend(caveats)
    if footer_parts:
        annotated = text.rstrip() + "\n\n— " + "\n— ".join(footer_parts)

    disposition = "RELEASE_WITH_CAVEAT" if footer_parts else "RELEASE"
    reason = TAG_DEFINITIONS[confirmed]
    if caveats:
        reason += f" | credential caveats: {', '.join(credentials)}"

    return FilterResult(
        released=True,
        tag=confirmed.value,
        disposition=disposition,
        text=annotated,
        disclaimer=disclaimer,
        credential_caveats=caveats,
        escalate_to=None,
        reason=reason,
    )
