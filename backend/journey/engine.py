"""
Journey Agent — the engine.

``JourneyEngine.process_artifact`` takes one captured operational artifact, looks
up its playbook, and renders a draft asset for each channel the playbook fans out
into. It then records every draft in the tamper-evident ledger and reports the
*leverage ratio* (assets produced per artifact — the doctrine target is 5–10).

Honesty contract (mirrors the recursive-learning engine):

  * No fabricated facts. Drafts are assembled only from the fields the artifact
    supplies. Where a channel needs a field the artifact lacks, the body carries
    an explicit ``[[provide: field]]`` marker and the gap is reported — never a
    guessed number.
  * Never auto-published. Every asset is created DRAFT, or BLOCKED when it is a
    consent-gated channel and client consent is not yet on file. Promotion to
    APPROVED is a separate, human-only action on the ledger.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from backend.journey.artifacts import Artifact, ArtifactType
from backend.journey.assets import AssetLedger, AssetStatus, GeneratedAsset
from backend.journey.channels import CONTENT_CHANNELS, ContentChannel, Medium
from backend.journey.playbooks import get_playbook

LEVERAGE_TARGET_MIN = 5
LEVERAGE_TARGET_MAX = 10


@dataclass
class JourneyRun:
    """The full record of converting one artifact into its downstream assets."""

    artifact: dict[str, Any]
    playbook: dict[str, Any]
    assets: list[dict[str, Any]]
    asset_count: int
    leverage_ratio: int
    meets_leverage_target: bool
    drafts: int
    blocked_on_consent: int
    content_gaps: list[str]
    generated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class JourneyEngine:
    """Renders artifacts into draft assets and records them in the ledger."""

    def __init__(self, ledger: AssetLedger | None = None) -> None:
        self.ledger = ledger if ledger is not None else AssetLedger()

    # -----------------------------------------------------------------------
    # Public entry point
    # -----------------------------------------------------------------------

    def process_artifact(self, artifact: Artifact) -> JourneyRun:
        """Convert one artifact into the full set of drafts its playbook calls for."""
        playbook = get_playbook(artifact.artifact_type)

        assets: list[GeneratedAsset] = []
        all_gaps: list[str] = []
        for key in playbook.channels:
            channel = CONTENT_CHANNELS.get(key)
            if channel is None:
                continue
            asset = self._render(channel, artifact)
            self.ledger.add(asset)
            assets.append(asset)
            all_gaps.extend(asset.content_gaps)

        asset_count = len(assets)
        blocked = sum(1 for a in assets if a.status == AssetStatus.BLOCKED)
        drafts = sum(1 for a in assets if a.status == AssetStatus.DRAFT)

        # De-duplicate gaps while preserving order.
        seen: set[str] = set()
        gaps: list[str] = []
        for gap in all_gaps:
            if gap not in seen:
                seen.add(gap)
                gaps.append(gap)

        return JourneyRun(
            artifact=artifact.to_dict(),
            playbook=playbook.to_dict(),
            assets=[a.to_dict() for a in assets],
            asset_count=asset_count,
            leverage_ratio=asset_count,
            meets_leverage_target=asset_count >= LEVERAGE_TARGET_MIN,
            drafts=drafts,
            blocked_on_consent=blocked,
            content_gaps=gaps,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    # -----------------------------------------------------------------------
    # Rendering
    # -----------------------------------------------------------------------

    def _render(self, channel: ContentChannel, artifact: Artifact) -> GeneratedAsset:
        gaps = self._content_gaps(channel, artifact)
        headline, body = self._render_body(channel, artifact)

        # Consent gate: a consent-required channel without consent is BLOCKED.
        status = AssetStatus.DRAFT
        if channel.requires_consent and not artifact.client_consent:
            status = AssetStatus.BLOCKED

        return GeneratedAsset(
            channel=channel.key,
            channel_name=channel.name,
            medium=channel.medium.value,
            audience=channel.audience.value,
            headline=headline,
            body=body,
            call_to_action=channel.call_to_action,
            hashtags=self._hashtags(channel, artifact),
            requires_consent=channel.requires_consent,
            consent_on_file=artifact.client_consent,
            content_gaps=gaps,
            source_artifact_type=artifact.artifact_type.value,
            source_id=artifact.source_id,
            project_name=artifact.project_name,
            status=status,
        )

    def _content_gaps(self, channel: ContentChannel, artifact: Artifact) -> list[str]:
        gaps: list[str] = []
        for needed in channel.needs:
            if not artifact.has(needed):
                gaps.append(
                    f"{channel.name}: missing '{needed}' — supply it for a "
                    "stronger asset (not invented)."
                )
        return gaps

    def _field(self, artifact: Artifact, attribute: str, label: str) -> str:
        """Return a field's value, or an explicit provide-marker if absent."""
        if artifact.has(attribute):
            value = getattr(artifact, attribute)
            return ", ".join(value) if isinstance(value, list) else str(value)
        return f"[[provide: {label}]]"

    def _hashtags(self, channel: ContentChannel, artifact: Artifact) -> list[str]:
        if channel.medium not in (Medium.SOCIAL, Medium.VIDEO_SCRIPT):
            return []
        raw = ["NoblePort"]
        if artifact.service_line:
            raw.append(artifact.service_line.replace(" ", ""))
        if artifact.location:
            raw.append(artifact.location.split(",")[0].strip().replace(" ", ""))
        raw.extend(["Construction", "BuiltToLast"])
        # De-duplicate, preserve order.
        seen: set[str] = set()
        tags: list[str] = []
        for token in raw:
            if token and token not in seen:
                seen.add(token)
                tags.append(f"#{token}")
        return tags

    def _render_body(
        self, channel: ContentChannel, artifact: Artifact
    ) -> tuple[str, str]:
        """Dispatch to a medium-specific template. Returns (headline, body)."""
        match channel.medium:
            case Medium.SOCIAL:
                return self._render_social(channel, artifact)
            case Medium.VIDEO_SCRIPT:
                return self._render_reel(channel, artifact)
            case Medium.BLOG:
                return self._render_blog(channel, artifact)
            case Medium.PORTFOLIO:
                return self._render_portfolio(channel, artifact)
            case Medium.EMAIL:
                return self._render_email(channel, artifact)
            case _:
                return self._render_document(channel, artifact)

    # -- medium templates ----------------------------------------------------

    def _render_social(self, channel: ContentChannel, artifact: Artifact) -> tuple[str, str]:
        headline = f"{artifact.service_line or 'Project'} in {artifact.location or 'our area'}"
        summary = self._field(artifact, "summary", "what happened")
        lines = [summary]
        if artifact.highlights:
            lines.append("Highlights: " + "; ".join(artifact.highlights))
        return headline.strip(), "\n\n".join(lines)

    def _render_reel(self, channel: ContentChannel, artifact: Artifact) -> tuple[str, str]:
        headline = f"Reel: {artifact.project_name}"
        count = artifact.photo_count or 0
        shots = [
            "Hook (0–2s): the before — show the problem.",
            "Build (2–8s): progress montage — "
            f"{count if count else '[[provide: photo/video clips]]'} clips.",
            "Reveal (8–12s): the finished result.",
            f"Caption: {self._field(artifact, 'summary', 'one-line story')}",
        ]
        return headline, "\n".join(f"- {s}" for s in shots)

    def _render_blog(self, channel: ContentChannel, artifact: Artifact) -> tuple[str, str]:
        headline = f"{artifact.service_line or 'Project'}: {artifact.project_name}"
        sections = [
            f"## The challenge\n{self._field(artifact, 'summary', 'the challenge')}",
        ]
        if artifact.highlights:
            sections.append(
                "## What we did\n" + "\n".join(f"- {h}" for h in artifact.highlights)
            )
        if artifact.metrics:
            metrics = "\n".join(f"- {k}: {v}" for k, v in artifact.metrics.items())
            sections.append(f"## By the numbers\n{metrics}")
        else:
            sections.append("## By the numbers\n[[provide: project metrics]]")
        sections.append(
            f"## The result\nDelivered in {artifact.location or '[[provide: location]]'}."
        )
        return headline, "\n\n".join(sections)

    def _render_portfolio(self, channel: ContentChannel, artifact: Artifact) -> tuple[str, str]:
        headline = f"{artifact.project_name} — {artifact.service_line or 'Project'}"
        lines = [
            f"Location: {self._field(artifact, 'location', 'location')}",
            f"Scope: {self._field(artifact, 'summary', 'scope')}",
            f"Photos: {artifact.photo_count or '[[provide: project photos]]'}",
        ]
        if artifact.metrics:
            lines.append("Specs: " + ", ".join(f"{k} {v}" for k, v in artifact.metrics.items()))
        return headline, "\n".join(lines)

    def _render_email(self, channel: ContentChannel, artifact: Artifact) -> tuple[str, str]:
        greeting = f"Hi {artifact.client_name}," if artifact.client_name else "Hi [[provide: client_name]],"
        subject = f"{channel.name}: {artifact.project_name}"
        body = "\n\n".join([
            greeting,
            self._field(artifact, "summary", "message"),
            channel.call_to_action,
            "— The NoblePort Team",
        ])
        return subject, body

    def _render_document(self, channel: ContentChannel, artifact: Artifact) -> tuple[str, str]:
        headline = f"{channel.name}: {artifact.project_name}"
        lines = [
            f"Artifact: {artifact.label}",
            f"Summary: {self._field(artifact, 'summary', 'summary')}",
        ]
        if artifact.highlights:
            lines.append("Notes:\n" + "\n".join(f"- {h}" for h in artifact.highlights))
        return headline, "\n".join(lines)
