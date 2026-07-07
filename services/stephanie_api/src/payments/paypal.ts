import {
  PaymentMethod,
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  PaymentVerification,
} from './types';

export class PayPalProvider implements PaymentProvider {
  method = PaymentMethod.PayPal;
  private clientId: string | null;
  private clientSecret: string | null;
  private baseUrl: string;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID ?? null;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? null;
    this.baseUrl = process.env.PAYPAL_SANDBOX === 'true'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.clientId !== 'placeholder');
  }

  private async getAccessToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  async processPayment(params: PaymentRequest): Promise<PaymentResult> {
    if (!this.isConfigured()) return { success: false, error: 'PayPal not configured' };

    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'USD', value: params.amountUsd.toFixed(2) },
            description: params.packageName
              ? `NBPT Tokens — ${params.packageName}`
              : 'NBPT Tokens',
            custom_id: params.userId,
          }],
          application_context: {
            return_url: params.returnUrl ?? `${process.env.APP_URL}/payment/success`,
            cancel_url: `${process.env.APP_URL}/payment/cancel`,
            brand_name: 'NoblePort',
          },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `PayPal order failed: ${err}` };
      }

      const order = await res.json() as { id: string; links: Array<{ rel: string; href: string }> };
      const approveLink = order.links.find(l => l.rel === 'approve');

      return {
        success: true,
        externalId: order.id,
        checkoutUrl: approveLink?.href,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'PayPal payment failed' };
    }
  }

  async verifyPayment(orderId: string): Promise<PaymentVerification> {
    if (!this.isConfigured()) return { verified: false, amountUsd: 0, externalId: orderId, error: 'PayPal not configured' };

    try {
      const token = await this.getAccessToken();

      const captureRes = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!captureRes.ok) {
        const err = await captureRes.text();
        return { verified: false, amountUsd: 0, externalId: orderId, error: `Capture failed: ${err}` };
      }

      const captured = await captureRes.json() as {
        status: string;
        purchase_units: Array<{ payments: { captures: Array<{ amount: { value: string } }> } }>;
      };

      if (captured.status === 'COMPLETED') {
        const amount = parseFloat(captured.purchase_units[0]?.payments?.captures?.[0]?.amount?.value ?? '0');
        return { verified: true, amountUsd: amount, externalId: orderId };
      }

      return { verified: false, amountUsd: 0, externalId: orderId, error: `Order status: ${captured.status}` };
    } catch (err) {
      return { verified: false, amountUsd: 0, externalId: orderId, error: err instanceof Error ? err.message : 'Verification failed' };
    }
  }
}
