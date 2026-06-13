/**
 * Reown AppKit + Wagmi configuration for the NBPT token console.
 *
 * Requires NEXT_PUBLIC_REOWN_PROJECT_ID (from https://dashboard.reown.com).
 * Targets Base; Base Sepolia is kept first while the offering is pre-clearance
 * (the Cooley gate in NBPTSecurityToken1400 blocks real-money paths anyway).
 */

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base, baseSepolia } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { QueryClient } from '@tanstack/react-query';
import { cookieStorage, createStorage } from 'wagmi';

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '';

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [baseSepolia, base];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

export const config = wagmiAdapter.wagmiConfig;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // On-chain reads: avoid hammering the RPC from dashboard re-renders.
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});
