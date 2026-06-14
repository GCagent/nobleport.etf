/**
 * Stripe Milestone Triggers — Scenario 5
 *
 * Wires PermitStream construction milestones to Stripe billing. PermitStream
 * is the authoritative source for lifecycle transitions (permit approved,
 * foundation poured, framing complete, CofO issued). Each transition is
 * translated into a Stripe PaymentIntent so invoicing fires the moment
 * construction becomes legally possible.
 *
 * The full revenue loop:
 *
 *   Lead → Deal → Permit Approved → Construction Begins → Milestone Billing
 *
 * This module is invoked by Make Scenario 5 via POST /api/milestones/trigger.
 */

import Stripe from 'stripe';

// ─── Milestone Taxonomy ──────────────────────────────────────────

/**
 * Canonical milestones that can trigger billing. PermitStream emits these
 * as permit lifecycle events, and Make Scenario 5 relays them here.
 */
export enum Milestone {
  /** Permit cleared and approved — construction is legally authorized. */
  PERMIT_CLEARED = 'PERMIT_CLEARED',
  /** Foundation poured / groundwork complete. */
  FOUNDATION_STARTED = 'FOUNDATION_STARTED',
  /** Framing inspection passed. */
  FRAMING_COMPLETE = 'FRAMING_COMPLETE',
  /** Certificate of occupancy / final inspection complete. */
  PROJECT_COMPLETE = 'PROJECT_COMPLETE',
}

export const SUPPORTED_MILESTONES: ReadonlySet<Milestone> = new Set([
  Milestone.PERMIT_CLEARED,
  Milestone.FOUNDATION_STARTED,
  Milestone.FRAMING_COMPLETE,
  Milestone.PROJECT_COMPLETE,
]);

export function isMilestone(value: unknown): value is Milestone {
  return typeof value === 'string' && SUPPORTED_MILESTONES.has(value as Milestone);
}

// ─── Request & Response Contracts ────────────────────────────────

export interface MilestoneTriggerRequest {
  /** Internal project ID (Supabase / PermitStream). */
  project_id: string;
  /** Milestone being billed. */
  milestone: Milestone;
  /** Billable amount in USD (whole dollars). Converted to cents for Stripe. */
  amount: number;
  /** Optional Stripe customer the PaymentIntent should attach to. */
  customer_id?: string;
  /** Optional free-form address/location for logs and Slack alerts. */
  address?: string;
  /** Optional applicant / client name for logs and Slack alerts. */
  applicant_name?: string;
  /**
   * Idempotency key. When Make retries, pass the same key so Stripe
   * collapses retries into a single PaymentIntent.
   */
  idempotency_key?: string;
}

export interface MilestoneTriggerResult {
  payment_intent_id: string;
  client_secret: string | null;
  status: Stripe.PaymentIntent.Status;
  amount_cents: number;
  currency: string;
  milestone: Milestone;
  project_id: string;
}

// ─── Validation ──────────────────────────────────────────────────

export class MilestoneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MilestoneValidationError';
  }
}

/**
 * Parses and validates an incoming milestone trigger payload. Throws
 * {@link MilestoneValidationError} with a descriptive message when the
 * payload is malformed so the API layer can map it to a 400 response.
 */
export function parseMilestoneRequest(body: unknown): MilestoneTriggerRequest {
  if (!body || typeof body !== 'object') {
    throw new MilestoneValidationError('Request body must be a JSON object');
  }
  const raw = body as Record<string, unknown>;

  const project_id = raw.project_id;
  if (typeof project_id !== 'string' || project_id.trim() === '') {
    throw new MilestoneValidationError('project_id is required');
  }

  const milestone = raw.milestone;
  if (!isMilestone(milestone)) {
    throw new MilestoneValidationError(
      `milestone must be one of: ${Array.from(SUPPORTED_MILESTONES).join(', ')}`,
    );
  }

  // Amount arrives from Make as either a number or numeric string.
  const amountRaw = raw.amount;
  const amount = typeof amountRaw === 'string' ? Number(amountRaw) : amountRaw;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new MilestoneValidationError('amount must be a positive number (USD whole dollars)');
  }

  return {
    project_id: project_id.trim(),
    milestone,
    amount,
    customer_id: typeof raw.customer_id === 'string' ? raw.customer_id : undefined,
    address: typeof raw.address === 'string' ? raw.address : undefined,
    applicant_name: typeof raw.applicant_name === 'string' ? raw.applicant_name : undefined,
    idempotency_key: typeof raw.idempotency_key === 'string' ? raw.idempotency_key : undefined,
  };
}

// ─── Stripe Client ───────────────────────────────────────────────

let cachedClient: Stripe | null = null;

/**
 * Lazily construct a shared Stripe client. Kept as a function (not a
 * top-level constant) so the module stays importable in environments
 * where STRIPE_SECRET_KEY isn't set — e.g. during type-checks or tests.
 */
export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  cachedClient = new Stripe(secret, { apiVersion: '2023-10-16' });
  return cachedClient;
}

/** Reset the cached client (used by tests). */
export function __resetStripeClientForTests(): void {
  cachedClient = null;
}

// ─── Core Trigger ────────────────────────────────────────────────

/**
 * Creates a Stripe PaymentIntent for a construction milestone. This is the
 * function the task specification calls out directly — kept with the exact
 * 3-arg signature so Make / other callers stay compatible. Richer callers
 * should prefer {@link triggerMilestoneFromRequest}.
 */
export async function triggerMilestone(
  project_id: string,
  milestone: string,
  amount: number,
): Promise<Stripe.PaymentIntent> {
  if (!isMilestone(milestone)) {
    throw new MilestoneValidationError(
      `milestone must be one of: ${Array.from(SUPPORTED_MILESTONES).join(', ')}`,
    );
  }
  return getStripeClient().paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    metadata: {
      project_id,
      milestone,
      source: 'permitstream',
    },
  });
}

/**
 * Higher-level wrapper that accepts the full validated request, forwards
 * optional customer/applicant metadata to Stripe, and honors idempotency
 * keys so Make retries are safe.
 */
export async function triggerMilestoneFromRequest(
  req: MilestoneTriggerRequest,
): Promise<MilestoneTriggerResult> {
  const stripe = getStripeClient();
  const amountCents = Math.round(req.amount * 100);

  const params: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency: 'usd',
    customer: req.customer_id,
    description: `NoblePort milestone: ${req.milestone} — ${req.address ?? req.project_id}`,
    metadata: {
      project_id: req.project_id,
      milestone: req.milestone,
      source: 'permitstream',
      ...(req.address ? { address: req.address } : {}),
      ...(req.applicant_name ? { applicant_name: req.applicant_name } : {}),
    },
  };

  // Default idempotency key derived from project + milestone so repeated
  // PermitStream emissions for the same transition collapse into a single
  // charge. Callers can override for finer control.
  const idempotencyKey =
    req.idempotency_key ?? `milestone:${req.project_id}:${req.milestone}`;

  const intent = await stripe.paymentIntents.create(params, {
    idempotencyKey,
  });

  return {
    payment_intent_id: intent.id,
    client_secret: intent.client_secret,
    status: intent.status,
    amount_cents: intent.amount,
    currency: intent.currency,
    milestone: req.milestone,
    project_id: req.project_id,
  };
}
