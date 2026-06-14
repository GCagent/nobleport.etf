/**
 * Slack finance alerting for Stripe milestone triggers.
 *
 * Posts to #nobleport-finance via an incoming webhook. Finance visibility
 * into every automated charge is a non-negotiable part of the revenue loop
 * — a silent charge is a support ticket waiting to happen.
 */

import { MilestoneTriggerRequest, MilestoneTriggerResult } from './milestones';

export interface SlackBillingAlertInput {
  request: MilestoneTriggerRequest;
  result: MilestoneTriggerResult;
}

const FINANCE_CHANNEL = '#nobleport-finance';

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

/**
 * Build the Slack message body. Exposed separately so tests and other
 * integrations (e.g. the Make Slack module) can reuse the exact format.
 */
export function buildBillingAlertMessage(input: SlackBillingAlertInput): {
  channel: string;
  text: string;
} {
  const { request, result } = input;
  const lines = [
    '*BILLING MILESTONE TRIGGERED*',
    `Project: ${request.address ?? request.project_id}`,
    `Milestone: ${request.milestone}`,
    `Amount: ${formatUsd(result.amount_cents)}`,
  ];
  if (request.applicant_name) {
    lines.push(`Client: ${request.applicant_name}`);
  }
  lines.push(`Stripe: ${result.payment_intent_id} (${result.status})`);
  return { channel: FINANCE_CHANNEL, text: lines.join('\n') };
}

/**
 * Post a billing alert to Slack. No-ops (with a console warning) when
 * SLACK_FINANCE_WEBHOOK_URL is unset so local dev and tests don't need to
 * stub the network. Never throws — Slack failure must not roll back the
 * Stripe charge that already fired.
 */
export async function postBillingAlert(input: SlackBillingAlertInput): Promise<void> {
  const webhook = process.env.SLACK_FINANCE_WEBHOOK_URL;
  if (!webhook) {
    console.warn('[stripe:slack] SLACK_FINANCE_WEBHOOK_URL not set; skipping billing alert');
    return;
  }
  const message = buildBillingAlertMessage(input);
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      console.error(
        `[stripe:slack] Slack webhook returned ${res.status}: ${await res.text()}`,
      );
    }
  } catch (err) {
    console.error('[stripe:slack] Failed to post billing alert', err);
  }
}
