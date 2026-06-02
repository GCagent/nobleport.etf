# Open-Source DocuSign Alternatives — Decision Brief for NoblePort Construction LLC

**Prepared:** June 2026
**Scope:** Self-hosted, open-source electronic-signature platforms that NoblePort can deploy
and operate itself, integrated into the existing NoblePort platform
(Next.js frontend + FastAPI backend, with HubSpot / Stripe / Buildertrend sync).
**Status:** Research + recommendation. No platform has been deployed yet.

> **Why this brief exists:** an earlier overview circulated internally listed six
> projects and recommended "the MIT-licensed FreeSign" as the safe commercial bet.
> Two of its claims were factually wrong (see [Corrections](#corrections-to-the-earlier-overview)),
> and the headline recommendation would have put legally-binding construction
> contracts on a 6-star hobby project. This brief re-verifies every candidate
> against its GitHub repository and project site, and re-frames the decision around
> what a general contractor actually signs.

---

## 1. What NoblePort actually needs to sign

Unlike a generic SaaS, a GC's signature workload is **template-heavy and repetitive**,
and a meaningful share of it is **legally consequential**:

| Document type | Frequency | Legal weight | Implication for tooling |
|---|---|---|---|
| Proposal / estimate acceptance | High | Moderate | Fast mobile signing; embed in the pipeline |
| Subcontractor agreements | High | High | Multi-signer, templates, audit trail |
| Change orders | Very high | High | Reusable templates, fast turnaround, audit trail |
| Lien waivers (MA) | High | **High** | Tamper-evident, notarizable trail, retention |
| Certificates of Insurance requests | Medium | Moderate | Guest signing (subs/vendors), reminders |
| Owner/client contracts (AIA-style) | Medium | **High** | Cryptographic signatures, sequential signing |

Three requirements fall out of this:

1. **A real template/form builder** — most of the volume is the *same* documents
   over and over (change orders, lien waivers, subcontracts). Field placement should
   be a one-time setup, not per-document drudgery.
2. **Legally robust, tamper-evident signatures** — ESIGN Act (US) / UETA / (Massachusetts)
   electronic-signature compliance, plus a defensible audit trail. For lien waivers and
   owner contracts, cryptographic PDF signing (PAdES / PKCS#7) is a real advantage in a dispute.
3. **A clean REST API + webhooks** — signing must drop into the existing FastAPI pipeline
   so a signed change order can update Buildertrend, trigger a Stripe deposit, or move a
   HubSpot deal automatically.

---

## 2. Verified candidate comparison

All facts below were checked against each project's GitHub repository and official site in June 2026.

| Project | Stack | License | Maturity | Signature model | Fit for NoblePort |
|---|---|---|---|---|---|
| **DocuSeal** | Ruby on Rails + Vue | AGPL-3.0 **+ §7(b) attribution** | Mature (~11.8k★) | Standard PDF e-signature; verification built in | **Primary pick** — best template builder, most mature, strong API |
| **Documenso** | Next.js + PostgreSQL | AGPL-3.0 | Active, modern | **PKCS#12 / PAdES cryptographic** signing | **Recommended alternative** — stack match, strongest crypto |
| **OpenSign** | Node + React + MongoDB | AGPL-3.0 | Active | E-sign + guest OTP; no formal compliance attestations | High-volume guest signing (COIs, subs) |
| **LibreSign** | Nextcloud app (PHP) | AGPL-3.0 | Active | X.509 certificate signing; PDF-only | Only if NoblePort adopts Nextcloud; no visual handwritten signature yet |
| **goSign** (shurco/goSign) | Go + Vue 3 + PostgreSQL | **GPL-3.0** *(not MIT)* | Early/small | X.509 (PKCS#7/CMS, PAdES) | Promising but immature; do not standardize on it yet |
| **FreeSign** (salocin93/freesign) | React + TS + Supabase | MIT | **Experimental (~6★)** | Basic | **Not for binding contracts** — hobby-stage |
| 开放签 (kaifangqian) | Java / Spring Boot | AGPL-3.0 | Mature in CN market | SM2/RSA, CN identity verification | China-focused; not relevant to a US GC |

### The two that matter for NoblePort

**DocuSeal** and **Documenso** are the only two that are simultaneously (a) mature enough to
trust with binding contracts, (b) genuinely self-hostable for free, and (c) API-first.
The others are either too immature (FreeSign, goSign), stack-mismatched and scope-limited
(LibreSign, OpenSign), or aimed at a different market (开放签).

---

## 3. Recommendation

### Primary: **DocuSeal**

- **Best-in-class template builder.** Its WYSIWYG PDF form builder (10 field types — checkbox,
  date, image, multi-select, cells, file upload, etc.) is the standout reason to pick it for a GC.
  NoblePort's volume is repetitive forms — change orders, lien waivers, subcontracts — and DocuSeal
  turns each into a reusable template that a PM fills and sends in seconds.
- **Most mature option** (~11.8k★, 1k+ forks) — the safest bet for documents that may be litigated.
- **Compliance:** ESIGN (US), UETA, eIDAS (EU); built-in PDF signature verification.
- **Integration-ready:** REST API + webhooks, SMTP email, storage on disk or S3 / GCS / Azure.
- **Cost:** open-source self-hosted edition is free for core signing. Pro features
  (advanced roles, bulk send, etc.) are ~$240/user/yr on-prem, or ~$0.20/signed doc via API/embedding.
  Most of NoblePort's workflow fits the free core.

### Recommended alternative: **Documenso**

Choose Documenso instead **if** either of these is a top priority:

1. **Single-stack simplicity.** Documenso is Next.js + PostgreSQL — the same stack as
   NoblePort's frontend and database. It can run as one more service in the existing
   deployment rather than introducing a Ruby runtime.
2. **Strongest cryptographic signatures out of the box.** Documenso uses standard PKCS#12
   certificates and produces **PAdES-compatible** PDFs — the same cryptographic standard
   DocuSign and Adobe Sign use. For MA lien waivers and owner contracts, that is the most
   defensible signature artifact of any option here.

Documenso is fully AGPL-3.0 with no per-document fees or seat limits when self-hosted,
deploys via Docker/Compose/Kubernetes, and supports templates, teams, API, audit trail,
custom branding, and SSO. Its only deduction vs. DocuSeal is a less powerful form builder
and a smaller (though fast-growing) ecosystem.

### Decision rule

> Lead with **DocuSeal** for the template-driven day-to-day (change orders, subcontracts,
> proposals). If, after a one-week pilot, the team weights *cryptographic signature strength*
> or *running everything in one Next.js/Postgres codebase* above the form-builder advantage,
> switch the lead to **Documenso**. Both are free to self-host, so the pilot is cheap.

---

## 4. Licensing reality check (AGPL-3.0)

Five of the seven candidates — including both finalists — are **AGPL-3.0**. The earlier
overview framed this as a blocker and steered toward MIT. For NoblePort's situation that
framing is **wrong**, and here is why:

- The AGPL "network use" copyleft only obligates you to publish source **if you modify the
  software and offer the modified version to third parties over a network.**
- NoblePort using DocuSeal/Documenso **internally** to send and collect signatures — even from
  external clients and subcontractors who sign in a browser — is **ordinary use, not
  distribution**. Recipients are *users of the document*, not users of a modified codebase.
  No source-disclosure obligation is triggered.
- The obligation would only bite if NoblePort **forked and modified** the signing app and then
  **offered that modified app as a service** to outside parties. That is not the plan.
- **DocuSeal's §7(b)** additional term requires keeping the "Powered by DocuSeal" attribution
  unless you buy a license to remove it — a cosmetic, low-cost consideration, not a legal risk.

**Conclusion:** AGPL is not a problem for an internal e-signature deployment. Picking the
MIT-licensed FreeSign *to avoid AGPL* would trade a non-issue for a real one (betting binding
contracts on a 6-star experimental project).

The only scenario that changes this analysis: if NoblePort later **white-labels and resells**
a signing product to other contractors as SaaS. In that case, revisit the license — DocuSeal
and Documenso both sell commercial licenses for exactly this, and goSign/LibreSign would need
separate review.

---

## 5. How it plugs into the existing NoblePort platform

The signing service runs as a self-hosted microservice behind the existing FastAPI backend.
Recommended integration shape:

```
Client / Subcontractor (browser, mobile)
        │  signs document
        ▼
┌─────────────────────────┐     webhook (signed)      ┌──────────────────────┐
│  DocuSeal / Documenso    │ ───────────────────────▶ │  FastAPI backend      │
│  (Docker, self-hosted)   │                           │  /api/esign/webhook   │
│  Postgres + S3 storage   │ ◀─────────────────────── │  (create envelope via │
└─────────────────────────┘   REST: create from        │   REST, store doc id) │
                               template, send            └──────────┬───────────┘
                                                                     │ on signed
                                          ┌──────────────────────────┼───────────────────┐
                                          ▼                          ▼                   ▼
                                   HubSpot deal stage        Stripe deposit invoice   Buildertrend
                                   advance                   (change-order $)         change order
```

Suggested first integration milestones (no code in this brief — these are the build steps):

1. **Deploy** DocuSeal (or Documenso) via Docker Compose with Postgres + S3-compatible storage;
   wire SMTP for signer emails.
2. **Templatize** the three highest-volume documents first: change order, lien waiver,
   subcontractor agreement.
3. **Add a FastAPI module** (`backend/api/esign.py`) that creates envelopes from templates via
   the platform's REST API and exposes a signed-document webhook endpoint.
4. **Close the loop:** on the signed webhook, advance the HubSpot deal, trigger the Stripe
   deposit where applicable, and post the change order to Buildertrend — reusing the existing
   `services/hubspot_sync.py`, `services/stripe_service.py`, and `api/buildertrend.py`.
5. **Retention:** store the signed PDF + audit certificate in S3 with a retention policy aligned
   to MA contract/lien record-keeping needs.

---

## Corrections to the earlier overview

For the record, the earlier internal overview contained these errors, now corrected:

- **goSign is GPL-3.0, not MIT.** (Verified at `github.com/shurco/goSign`.) This matters because
  the earlier note recommended it partly on its supposed permissive license.
- **"FreeSign is the safer bet for unrestricted commercial use" is misleading.** FreeSign is
  indeed MIT, but it is an early-stage project (~6 stars) and is not appropriate for
  legally-binding construction contracts. License permissiveness ≠ production-readiness.
- **AGPL was over-stated as a blocker.** For internal use it imposes no source-disclosure
  obligation (see §4).
- **OpenSign publishes no formal compliance attestations** (no SOC 2 / ISO 27001 / eIDAS / ESIGN
  certification) — fine for low-stakes signing, a gap for high-stakes contracts.

---

## Sources

- DocuSeal — [GitHub](https://github.com/docusealco/docuseal) · [On-Premises](https://www.docuseal.com/on-premises) · [Site](https://www.docuseal.com/)
- Documenso — [GitHub](https://github.com/documenso/documenso) · [Site](https://documenso.com/)
- OpenSign — [GitHub](https://github.com/OpenSignLabs/OpenSign)
- LibreSign — [GitHub](https://github.com/LibreSign/libresign) · [Nextcloud App Store](https://apps.nextcloud.com/apps/libresign) · [Site](https://libresign.coop/)
- goSign — [GitHub](https://github.com/shurco/goSign) *(license: GPL-3.0)*
- FreeSign — [GitHub](https://github.com/salocin93/freesign) *(license: MIT; ~6 stars, experimental)*
- Comparison reference — [Sliplane: 5 Open-Source DocuSign Alternatives](https://sliplane.io/blog/5-open-source-docusign-alternatives) · [OpenAlternative: DocuSign alternatives](https://openalternative.co/alternatives/docusign)
