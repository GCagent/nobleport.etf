export const NBPT_TOKEN_SYMBOL = 'NBPT';
export const NOBLEPORT_TREASURY = '0xc59e66BB2b6E19699F82A72a1569821cb1711504';

export enum PaymentMethod {
  Stripe = 'stripe',
  PayPal = 'paypal',
  MetaMask = 'metamask',
  Uniswap = 'uniswap',
}

export const PAYMENT_PRIORITY: PaymentMethod[] = [
  PaymentMethod.Stripe,
  PaymentMethod.PayPal,
  PaymentMethod.MetaMask,
  PaymentMethod.Uniswap,
];

export enum PaymentStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Refunded = 'refunded',
}

export interface PaymentRecord {
  id: string;
  userId: string;
  method: PaymentMethod;
  amountUsd: number;
  tokensCredited: number;
  status: PaymentStatus;
  externalId?: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface TokenBalance {
  userId: string;
  balance: number;
  lastUpdated: number;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  paymentId?: string;
  balanceAfter: number;
  createdAt: number;
}

export interface PackagePricing {
  name: string;
  priceUsd: number;
  tokens: number;
}

export const TOKEN_PACKAGES: PackagePricing[] = [
  { name: 'Starter',      priceUsd: 49,    tokens: 100 },
  { name: 'Professional', priceUsd: 149,   tokens: 350 },
  { name: 'Enterprise',   priceUsd: 499,   tokens: 1500 },
  { name: 'Institutional', priceUsd: 2499, tokens: 10000 },
];

export const BASE_TOKEN_RATE_USD = 0.50;

export function calculateTokens(amountUsd: number, packageName?: string): number {
  if (packageName) {
    const pkg = TOKEN_PACKAGES.find(p => p.name.toLowerCase() === packageName.toLowerCase());
    if (pkg && amountUsd >= pkg.priceUsd) {
      return pkg.tokens;
    }
  }
  return Math.floor(amountUsd / BASE_TOKEN_RATE_USD);
}

export interface PaymentProvider {
  method: PaymentMethod;
  isConfigured(): boolean;
  processPayment(params: PaymentRequest): Promise<PaymentResult>;
  verifyPayment(externalId: string): Promise<PaymentVerification>;
}

export interface PaymentRequest {
  userId: string;
  amountUsd: number;
  packageName?: string;
  returnUrl?: string;
  walletAddress?: string;
  txHash?: string;
}

export interface PaymentResult {
  success: boolean;
  externalId?: string;
  checkoutUrl?: string;
  txHash?: string;
  error?: string;
}

export interface PaymentVerification {
  verified: boolean;
  amountUsd: number;
  externalId: string;
  error?: string;
}
