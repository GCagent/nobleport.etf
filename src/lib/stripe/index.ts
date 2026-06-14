/**
 * Stripe integration — Scenario 5 (Milestone Billing)
 *
 * Public surface for the PermitStream → Make → Stripe revenue loop.
 */

export {
  Milestone,
  SUPPORTED_MILESTONES,
  MilestoneValidationError,
  isMilestone,
  parseMilestoneRequest,
  triggerMilestone,
  triggerMilestoneFromRequest,
  getStripeClient,
} from './milestones';
export type {
  MilestoneTriggerRequest,
  MilestoneTriggerResult,
} from './milestones';

export { postBillingAlert, buildBillingAlertMessage } from './slack';
export type { SlackBillingAlertInput } from './slack';

export {
  recordBillingEvent,
  buildLedgerRow,
  ledgerWriterFromEnv,
  SupabaseLedgerWriter,
} from './ledger';
export type { BillingLedgerRow, LedgerWriter } from './ledger';
