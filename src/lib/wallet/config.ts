import { http, cookieStorage, createConfig, createStorage } from 'wagmi';
import type { CreateConnectorFn } from 'wagmi';
import { arbitrum, base, mainnet, optimism, polygon } from 'wagmi/chains';
import { coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors';

import { WALLET_APP_METADATA } from './nobleport';

/**
 * Reown (WalletConnect) Cloud project id. Create one at
 * https://cloud.reown.com and set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
 * Without it the WalletConnect QR option is hidden; injected wallets
 * (MetaMask, Rabby, OKX, …) and Coinbase Wallet still work.
 */
export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

// Base first: it is the default/primary chain for NoblePort.
export const CHAINS = [base, mainnet, polygon, arbitrum, optimism] as const;

function buildConnectors() {
  const connectors: CreateConnectorFn[] = [
    // Covers MetaMask, Rabby, OKX, Trust, Phantom (EVM), and any other
    // EIP-6963 / window.ethereum wallet.
    injected(),
    coinbaseWallet({
      appName: WALLET_APP_METADATA.name,
      appLogoUrl: WALLET_APP_METADATA.icons[0],
      preference: { options: 'all' },
    }),
    safe(),
  ];
  if (WALLETCONNECT_PROJECT_ID) {
    connectors.push(
      walletConnect({
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata: WALLET_APP_METADATA,
        showQrModal: true,
      }),
    );
  }
  return connectors;
}

export function getWalletConfig() {
  return createConfig({
    chains: CHAINS,
    connectors: buildConnectors(),
    storage: createStorage({ storage: cookieStorage }),
    ssr: true,
    transports: {
      [base.id]: http(),
      [mainnet.id]: http(),
      [polygon.id]: http(),
      [arbitrum.id]: http(),
      [optimism.id]: http(),
    },
  });
}

export type WalletConfig = ReturnType<typeof getWalletConfig>;

declare module 'wagmi' {
  interface Register {
    config: WalletConfig;
  }
}
