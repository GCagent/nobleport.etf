"""
Journey Agent — content channels (the outputs).

A *channel* is one downstream asset a single artifact can become: a LinkedIn
post, an Instagram reel script, a case study, a portfolio entry, a customer
update. Each channel declares:

  * the ``medium`` that shapes how it is rendered,
  * the ``audience`` it serves (the five conversions in the doctrine —
    marketing, sales, recruiting, training, documentation — plus the customer),
  * whether publishing it ``requires_consent`` (any externally published asset
    about an identifiable client project does), and
  * the artifact fields it ``needs`` to render well (missing fields become
    content gaps, never invented facts).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class Medium(StrEnum):
    """How an asset is shaped when rendered."""

    SOCIAL = "social"              # short social post
    VIDEO_SCRIPT = "video_script"  # reel / short-form shot list
    BLOG = "blog"                  # long-form article / case study
    PORTFOLIO = "portfolio"        # website portfolio entry
    DOCUMENT = "document"          # internal report / training doc
    EMAIL = "email"                # direct customer / prospect message


class Audience(StrEnum):
    """The conversions the Journey Agent feeds (doctrine: one activity → many)."""

    MARKETING = "marketing"
    SALES = "sales"
    RECRUITING = "recruiting"
    TRAINING = "training"
    DOCUMENTATION = "documentation"
    CUSTOMER = "customer"


@dataclass(frozen=True)
class ContentChannel:
    """A single downstream asset type an artifact can be published to."""

    key: str
    name: str
    medium: Medium
    audience: Audience
    purpose: str
    # Externally published + about an identifiable client project → consent gate.
    requires_consent: bool = False
    # Artifact fields this channel needs to render well.
    needs: tuple[str, ...] = field(default_factory=tuple)
    call_to_action: str = ""

    def to_dict(self) -> dict[str, object]:
        return {
            "key": self.key,
            "name": self.name,
            "medium": self.medium.value,
            "audience": self.audience.value,
            "purpose": self.purpose,
            "requires_consent": self.requires_consent,
            "needs": list(self.needs),
            "call_to_action": self.call_to_action,
        }


# ---------------------------------------------------------------------------
# The channel catalog
# ---------------------------------------------------------------------------

_CHANNELS: tuple[ContentChannel, ...] = (
    ContentChannel(
        key="linkedin_post",
        name="LinkedIn Post",
        medium=Medium.SOCIAL,
        audience=Audience.MARKETING,
        purpose="Professional credibility and B2B / referral reach.",
        requires_consent=True,
        needs=("summary",),
        call_to_action="Considering a project? Let's talk.",
    ),
    ContentChannel(
        key="facebook_post",
        name="Facebook Post",
        medium=Medium.SOCIAL,
        audience=Audience.MARKETING,
        purpose="Local community reach and homeowner engagement.",
        requires_consent=True,
        needs=("summary",),
        call_to_action="Message us for a free consultation.",
    ),
    ContentChannel(
        key="instagram_reel",
        name="Instagram Reel Script",
        medium=Medium.VIDEO_SCRIPT,
        audience=Audience.MARKETING,
        purpose="Short-form video that documents the journey visually.",
        requires_consent=True,
        needs=("photo_count",),
        call_to_action="Follow the build → @nobleport",
    ),
    ContentChannel(
        key="google_business_update",
        name="Google Business Update",
        medium=Medium.SOCIAL,
        audience=Audience.MARKETING,
        purpose="Local SEO signal and proof of recent, nearby work.",
        requires_consent=True,
        needs=("location",),
        call_to_action="Serving the Greater Newburyport area.",
    ),
    ContentChannel(
        key="blog_post",
        name="Blog Post Draft",
        medium=Medium.BLOG,
        audience=Audience.MARKETING,
        purpose="Owned-channel SEO and depth that builds expertise/trust.",
        requires_consent=True,
        needs=("summary", "highlights"),
        call_to_action="Read more on the NoblePort journal.",
    ),
    ContentChannel(
        key="case_study",
        name="Case Study Draft",
        medium=Medium.BLOG,
        audience=Audience.SALES,
        purpose="Proof asset the sales team uses to close similar work.",
        requires_consent=True,
        needs=("summary", "metrics"),
        call_to_action="See whether your project is a fit.",
    ),
    ContentChannel(
        key="sales_alert",
        name="Sales Alert",
        medium=Medium.DOCUMENT,
        audience=Audience.SALES,
        purpose="Internal trigger so sales acts on a fresh signal quickly.",
        requires_consent=False,
        needs=("summary",),
        call_to_action="Action within 24 hours.",
    ),
    ContentChannel(
        key="market_intelligence_post",
        name="Market Intelligence Post",
        medium=Medium.SOCIAL,
        audience=Audience.MARKETING,
        purpose="Position NoblePort as the authority on local permit/market data.",
        requires_consent=False,  # about market data, not an identifiable client
        needs=("summary",),
        call_to_action="Watch this market with us.",
    ),
    ContentChannel(
        key="lead_magnet",
        name="Lead Magnet",
        medium=Medium.DOCUMENT,
        audience=Audience.MARKETING,
        purpose="Gated checklist / guide that captures contact details.",
        requires_consent=False,
        needs=("service_line",),
        call_to_action="Download the free guide.",
    ),
    ContentChannel(
        key="client_proposal",
        name="Client Proposal",
        medium=Medium.EMAIL,
        audience=Audience.SALES,
        purpose="Turn an estimate into a persuasive, branded proposal.",
        requires_consent=False,  # sent privately to the client themselves
        needs=("summary", "metrics"),
        call_to_action="Approve to reserve your spot on the schedule.",
    ),
    ContentChannel(
        key="portfolio_entry",
        name="Website Portfolio Entry",
        medium=Medium.PORTFOLIO,
        audience=Audience.MARKETING,
        purpose="Permanent proof of completed work on the website.",
        requires_consent=True,
        needs=("location", "photo_count"),
        call_to_action="Start your project.",
    ),
    ContentChannel(
        key="before_after",
        name="Before / After Content",
        medium=Medium.PORTFOLIO,
        audience=Audience.MARKETING,
        purpose="High-converting visual proof of transformation.",
        requires_consent=True,
        needs=("photo_count",),
        call_to_action="Imagine the after on your home.",
    ),
    ContentChannel(
        key="testimonial_request",
        name="Testimonial Request",
        medium=Medium.EMAIL,
        audience=Audience.CUSTOMER,
        purpose="Capture social proof at the moment of peak satisfaction.",
        requires_consent=False,  # a private ask to the customer
        needs=("client_name",),
        call_to_action="Would you share a few words about your experience?",
    ),
    ContentChannel(
        key="customer_update",
        name="Customer Update",
        medium=Medium.EMAIL,
        audience=Audience.CUSTOMER,
        purpose="Keep the client informed — transparency builds trust.",
        requires_consent=False,
        needs=("summary",),
        call_to_action="Questions? Reply any time.",
    ),
    ContentChannel(
        key="weekly_summary",
        name="Weekly Project Summary",
        medium=Medium.DOCUMENT,
        audience=Audience.DOCUMENTATION,
        purpose="Roll project activity into the operational record.",
        requires_consent=False,
        needs=("summary",),
        call_to_action="",
    ),
    ContentChannel(
        key="training_example",
        name="Training Example",
        medium=Medium.DOCUMENT,
        audience=Audience.TRAINING,
        purpose="Turn a real decision into a teaching case for the team.",
        requires_consent=False,
        needs=("summary",),
        call_to_action="Add to the onboarding library.",
    ),
    ContentChannel(
        key="process_improvement",
        name="Process Improvement Note",
        medium=Medium.DOCUMENT,
        audience=Audience.TRAINING,
        purpose="Capture what a change taught us so the system improves.",
        requires_consent=False,
        needs=("summary",),
        call_to_action="Review at the next ops meeting.",
    ),
    ContentChannel(
        key="inspection_report",
        name="Inspection Report",
        medium=Medium.DOCUMENT,
        audience=Audience.DOCUMENTATION,
        purpose="Structured record of a site visit for the project file.",
        requires_consent=False,
        needs=("summary",),
        call_to_action="",
    ),
    ContentChannel(
        key="recruiting_post",
        name="Recruiting Post",
        medium=Medium.SOCIAL,
        audience=Audience.RECRUITING,
        purpose="Show the work and culture to attract skilled trades.",
        requires_consent=False,
        needs=("service_line",),
        call_to_action="We're hiring — join the crew.",
    ),
)


CONTENT_CHANNELS: dict[str, ContentChannel] = {c.key: c for c in _CHANNELS}


def get_channel(key: str) -> ContentChannel:
    channel = CONTENT_CHANNELS.get(key)
    if channel is None:
        raise KeyError(f"Unknown content channel: {key!r}")
    return channel
