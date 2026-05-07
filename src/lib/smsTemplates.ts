import { PHONE_NUMBER, FORM_URL } from './constants'

/**
 * SMS auto-reply templates for OpenPhone.
 * Copy these into your OpenPhone auto-reply / snippet settings.
 */
export const SMS_TEMPLATES = {
  /** First inbound auto-reply when someone texts the business number */
  firstInbound: `NoblePort Construction here. Got your message. Reply with one of these:

QUOTE – request an estimate
BUILD – discuss your project
CALL – request a callback today

North Shore MA only. $15K+ projects.`,

  /** Reply when they text QUOTE */
  replyQuote: `Perfect. Fill this out so we can qualify the project and get back to you fast: ${FORM_URL}

Or call us here: ${PHONE_NUMBER}`,

  /** Reply when they text BUILD */
  replyBuild: `Good. Send the project type, town, and budget range here.

If you want to move faster, fill this out: ${FORM_URL}`,

  /** Reply when they text CALL */
  replyCall: `Got it. We'll call you as soon as possible.

If it's urgent, call us now: ${PHONE_NUMBER}`,

  /** Hot lead (score 8+) follow-up */
  hotLead:
    'Got your request. This looks like a strong fit. We'll reach out today.',

  /** Warm lead (score 5–7) follow-up */
  warmLead:
    'Thanks. We received your project details and will follow up within 24 hours.',

  /** Low-priority lead (score 0–4) follow-up */
  lowLead:
    'Thanks for reaching out. We received your info and will review it shortly.',
} as const

/**
 * Social post CTA copy — paste under reels / posts.
 */
export const POST_CTA = {
  primary: `DM "QUOTE" or hit the link in bio.\nNorth Shore only. $15K+ projects.`,
  alternate: `Ready to build? Text us or request a quote through the link in bio.`,
  pinnedComment: `Get your quote here: [LINK]\nOr text us: ${PHONE_NUMBER}\nNorth Shore only | $15K+ projects`,
} as const

/**
 * QR placement copy — use on physical media.
 */
export const QR_COPY = {
  jobsiteSign: 'SEE THIS BUILD LIVE\nSCAN TO GET A QUOTE',
  truckMagnet: 'NoblePort Construction\nScan to Start Your Project',
  businessCard: 'Ready to build?\nScan for quote',
  proposalFolder:
    'Know someone planning a project?\nScan and send them here',
} as const
