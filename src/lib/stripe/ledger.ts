/**
 * Billing ledger — the construction revenue tracker.
 *
 * Every milestone trigger writes one row to the ledger so finance always
 * has a source of truth independent of Stripe. The ledger is keyed on
 * (project_id, milestone) so repeats are detectable and the table can
 * be joined back to the HubSpot deal + PermitStream project records.
 *
 * Default implementation posts to Supabase REST. Callers can inject
 * a custom {@link LedgerWriter} for tests or alternate backends.
 */

import { MilestoneTriggerRequest, MilestoneTriggerResult } from './milestones';

export interface BillingLedgerRow {
  timestamp: string;
  project_id: string;
  address: string | null;
  milestone: string;
  amount_cents: number;
  currency: string;
  stripe_payment_intent: string;
  status: string;
  applicant_name: string | null;
}

export interface LedgerWriter {
  append(row: BillingLedgerRow): Promise<void>;
}

export function buildLedgerRow(
  request: MilestoneTriggerRequest,
  result: MilestoneTriggerResult,
): BillingLedgerRow {
  return {
    timestamp: new Date().toISOString(),
    project_id: request.project_id,
    address: request.address ?? null,
    milestone: request.milestone,
    amount_cents: result.amount_cents,
    currency: result.currency,
    stripe_payment_intent: result.payment_intent_id,
    status: result.status,
    applicant_name: request.applicant_name ?? null,
  };
}

// ─── Supabase REST Writer ────────────────────────────────────────

const LEDGER_TABLE = 'billing_ledger';

export class SupabaseLedgerWriter implements LedgerWriter {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly table: string = LEDGER_TABLE,
  ) {}

  async append(row: BillingLedgerRow): Promise<void> {
    const endpoint = `${this.url.replace(/\/$/, '')}/rest/v1/${this.table}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      throw new Error(
        `Supabase ledger append failed: ${res.status} ${await res.text()}`,
      );
    }
  }
}

/**
 * Resolve a ledger writer from the environment. Returns null if Supabase
 * isn't configured so callers can fall back to logging without crashing.
 */
export function ledgerWriterFromEnv(): LedgerWriter | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return new SupabaseLedgerWriter(url, key);
}

/**
 * Append a row to the billing ledger without throwing. A ledger write
 * failure is a finance incident but must not roll back the Stripe
 * PaymentIntent that already succeeded — we log and continue.
 */
export async function recordBillingEvent(
  request: MilestoneTriggerRequest,
  result: MilestoneTriggerResult,
  writer: LedgerWriter | null = ledgerWriterFromEnv(),
): Promise<void> {
  const row = buildLedgerRow(request, result);
  if (!writer) {
    console.warn('[stripe:ledger] Supabase not configured; ledger row logged only', row);
    return;
  }
  try {
    await writer.append(row);
  } catch (err) {
    console.error('[stripe:ledger] Failed to append ledger row', { row, err });
  }
}
