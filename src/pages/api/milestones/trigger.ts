/**
 * POST /api/milestones/trigger
 *
 * Make Scenario 5 calls this endpoint after PermitStream emits a
 * `permit.approved` (or later construction) event. It:
 *
 *   1. Authenticates via a shared internal bearer token.
 *   2. Validates the milestone payload.
 *   3. Fires a Stripe PaymentIntent (the money event).
 *   4. Appends a row to the billing ledger.
 *   5. Posts a Slack alert to #nobleport-finance.
 *
 * Ledger + Slack failures are logged but never fail the response — the
 * Stripe charge is the source of truth for whether billing happened.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

import {
  MilestoneValidationError,
  parseMilestoneRequest,
  triggerMilestoneFromRequest,
  type MilestoneTriggerResult,
} from '../../../lib/stripe/milestones';
import { postBillingAlert } from '../../../lib/stripe/slack';
import { recordBillingEvent } from '../../../lib/stripe/ledger';

type ErrorBody = { error: string };
type SuccessBody = { ok: true; result: MilestoneTriggerResult };

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function authorized(req: NextApiRequest): boolean {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) {
    console.error('[api/milestones] INTERNAL_API_TOKEN is not set; refusing all requests');
    return false;
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return false;
  return timingSafeEqual(header.slice('Bearer '.length), expected);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessBody | ErrorBody>,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!authorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let request;
  try {
    request = parseMilestoneRequest(req.body);
  } catch (err) {
    if (err instanceof MilestoneValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  let result: MilestoneTriggerResult;
  try {
    result = await triggerMilestoneFromRequest(request);
  } catch (err) {
    console.error('[api/milestones] Stripe PaymentIntent creation failed', {
      project_id: request.project_id,
      milestone: request.milestone,
      err,
    });
    res.status(502).json({ error: 'Stripe PaymentIntent creation failed' });
    return;
  }

  // Downstream side effects: best-effort, never fail the response.
  await Promise.all([
    recordBillingEvent(request, result),
    postBillingAlert({ request, result }),
  ]);

  res.status(200).json({ ok: true, result });
}
