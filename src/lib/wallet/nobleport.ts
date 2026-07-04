/**
 * NoblePort on-chain identity and network registry.
 *
 * The canonical receive identity is the Basename `nobleport.base.eth`
 * (Coinbase Wallet). The full treasury address is intentionally NOT
 * hardcoded — set NEXT_PUBLIC_NOBLEPORT_TREASURY in the environment and
 * the UI verifies it against ENS resolution of the Basename at runtime.
 */

export const NOBLEPORT_ENS_NAME = 'nobleport.base.eth';

/** Full 0x treasury address, supplied via env so it can be rotated without a deploy. */
export const NOBLEPORT_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_NOBLEPORT_TREASURY ?? null;

export const WALLET_APP_METADATA = {
  name: 'NoblePort Mission Control',
  description:
    'Single wallet login across SolarCaps, NoblePort Systems, PermitStream, Payment Node, and ERC-1400 tokenized assets.',
  url: 'https://dashboard.nobleport.ai',
  icons: ['https://dashboard.nobleport.ai/icon.png'],
};

export interface SupportedNetwork {
  chainId: number;
  name: string;
  role: 'primary' | 'supported';
  nativeSymbol: string;
}

export const SUPPORTED_NETWORKS: SupportedNetwork[] = [
  { chainId: 8453, name: 'Base', role: 'primary', nativeSymbol: 'ETH' },
  { chainId: 1, name: 'Ethereum', role: 'supported', nativeSymbol: 'ETH' },
  { chainId: 137, name: 'Polygon', role: 'supported', nativeSymbol: 'POL' },
  { chainId: 42161, name: 'Arbitrum', role: 'supported', nativeSymbol: 'ETH' },
  { chainId: 10, name: 'Optimism', role: 'supported', nativeSymbol: 'ETH' },
];

/** NoblePort products that authenticate through this wallet layer. */
export interface WalletModule {
  id: string;
  label: string;
  description: string;
  status: 'live' | 'planned';
}

export const WALLET_MODULES: WalletModule[] = [
  {
    id: 'auth',
    label: 'Wallet authentication',
    description: 'Sign-in with Ethereum across SolarCaps, NoblePort Systems, PermitStream, and Payment Node.',
    status: 'live',
  },
  {
    id: 'token-purchases',
    label: 'Token purchases',
    description: 'SolarCaps token sales settled on Base.',
    status: 'planned',
  },
  {
    id: 'nft-certificates',
    label: 'NFT certificates',
    description: 'Completion and warranty certificates minted per project.',
    status: 'planned',
  },
  {
    id: 'staking',
    label: 'Staking dashboard',
    description: 'Stake SolarCaps positions and track yield.',
    status: 'planned',
  },
  {
    id: 'construction-payments',
    label: 'Construction payment portal',
    description: 'Milestone payouts through Payment Node with on-chain receipts.',
    status: 'planned',
  },
  {
    id: 'dao-voting',
    label: 'NoblePort DAO voting',
    description: 'Governance votes weighted by ERC-1400 security token holdings.',
    status: 'planned',
  },
];

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
