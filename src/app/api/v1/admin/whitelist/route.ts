import { NextResponse } from 'next/server';

export const runtime = 'edge';

const WHITELIST = [
  { address: '0x4a91...8c2f', entity: 'Highland Holdings LLC', credential: 'ACCREDITED_INVESTOR', added: '2026-03-12', transfersAllowed: true },
  { address: '0x7b3e...1d4a', entity: 'Coastline Capital', credential: 'ACCREDITED_INVESTOR', added: '2026-02-28', transfersAllowed: true },
  { address: '0x9c5f...6e8b', entity: 'Tannery Mills LP', credential: 'ACCREDITED_INVESTOR', added: '2026-04-05', transfersAllowed: true },
  { address: '0x2d7a...4f9c', entity: 'Merrimack Valley Trust', credential: 'QUALIFIED_PURCHASER', added: '2026-01-15', transfersAllowed: true },
  { address: '0xb72c...3a1d', entity: '(blocked)', credential: 'NONE', added: '—', transfersAllowed: false },
];

export async function GET() {
  return NextResponse.json({
    entries: WHITELIST,
    config: {
      program: 'Solana Token-2022 Transfer Hook',
      network: 'Mainnet-Beta',
      tokenMint: 'NBPT',
      totalSupply: 100_000_000,
      whitelisted: WHITELIST.filter((e) => e.transfersAllowed).length,
      blocked: WHITELIST.filter((e) => !e.transfersAllowed).length,
    },
    generatedAt: new Date().toISOString(),
  });
}
