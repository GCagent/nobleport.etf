import Stripe from 'stripe';
import {
  PaymentMethod,
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  PaymentVerification,
} from './types';

export class StripeProvider implements PaymentProvider {
  method = PaymentMethod.Stripe;
  private client: Stripe | null = null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key && key !== 'placeholder' && !key.startsWith('sk_test_placeholder')) {
      this.client = new Stripe(key);
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async processPayment(params: PaymentRequest): Promise<PaymentResult> {
    if (!this.client) return { success: false, error: 'Stripe not configured' };

    try {
      const session = await this.client.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: params.packageName
                ? `NBPT Tokens — ${params.packageName}`
                : 'NBPT Tokens',
              description: `NoblePort ETF token purchase`,
            },
            unit_amount: Math.round(params.amountUsd * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: params.returnUrl ?? `${process.env.APP_URL}/payment/success`,
        cancel_url: `${process.env.APP_URL}/payment/cancel`,
        metadata: {
          user_id: params.userId,
          amount_usd: String(params.amountUsd),
          package: params.packageName ?? 'custom',
        },
      });

      return {
        success: true,
        externalId: session.id,
        checkoutUrl: session.url ?? undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Stripe payment failed',
      };
    }
  }

  async verifyPayment(sessionId: string): Promise<PaymentVerification> {
    if (!this.client) return { verified: false, amountUsd: 0, externalId: sessionId, error: 'Stripe not configured' };

    try {
      const session = await this.client.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid' && session.amount_total) {
        return {
          verified: true,
          amountUsd: session.amount_total / 100,
          externalId: sessionId,
        };
      }
      return { verified: false, amountUsd: 0, externalId: sessionId, error: `Payment status: ${session.payment_status}` };
    } catch (err) {
      return { verified: false, amountUsd: 0, externalId: sessionId, error: err instanceof Error ? err.message : 'Verification failed' };
    }
  }
}
