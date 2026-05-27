import { NextResponse } from 'next/server';

export const runtime = 'edge';

const INVESTORS = [
  { id: 'inv-1', name: 'Highland Holdings LLC', status: 'verified', kyc: 'approved', tokens: 12_500, wallet: '0x4a91...8c2f' },
  { id: 'inv-2', name: 'Coastline Capital', status: 'verified', kyc: 'approved', tokens: 25_000, wallet: '0x7b3e...1d4a' },
  { id: 'inv-3', name: 'Tannery Mills LP', status: 'verified', kyc: 'approved', tokens: 18_750, wallet: '0x9c5f...6e8b' },
  { id: 'inv-4', name: 'B. Whitcomb', status: 'pending', kyc: 'in_review', tokens: 0, wallet: null },
  { id: 'inv-5', name: 'Merrimack Valley Trust', status: 'verified', kyc: 'approved', tokens: 31_250, wallet: '0x2d7a...4f9c' },
];

export async function GET() {
  return NextResponse.json({
    investors: INVESTORS,
    summary: {
      total: INVESTORS.length,
      verified: INVESTORS.filter((i) => i.status === 'verified').length,
      pendingKyc: INVESTORS.filter((i) => i.kyc === 'in_review').length,
      totalTokens: INVESTORS.reduce((s, i) => s + i.tokens, 0),
    },
    generatedAt: new Date().toISOString(),
  });
}
