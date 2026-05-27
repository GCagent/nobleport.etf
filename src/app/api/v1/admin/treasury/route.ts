import { NextResponse } from 'next/server';

export const runtime = 'edge';

const PENDING_APPROVALS = [
  { id: 'ta-1', type: 'Disbursement', amount: 84_500, recipient: 'Apex Electrical LLC', signers: '1/3', status: 'pending' },
  { id: 'ta-2', type: 'Disbursement', amount: 127_200, recipient: 'Northeast Concrete', signers: '2/3', status: 'ready' },
  { id: 'ta-3', type: 'Distribution', amount: 250_000, recipient: 'Investor Pool Q2', signers: '0/4', status: 'pending' },
  { id: 'ta-4', type: 'Transfer', amount: 50_000, recipient: 'Operating → Reserve', signers: '2/2', status: 'executed' },
];

const SAFE_CONFIG = {
  address: '0x7a4B...9f2E',
  network: 'Ethereum Mainnet',
  threshold: '3/5',
  balance: 2_142_300,
  pendingTxs: 3,
};

export async function GET() {
  return NextResponse.json({
    safe: SAFE_CONFIG,
    approvals: PENDING_APPROVALS,
    generatedAt: new Date().toISOString(),
  });
}
