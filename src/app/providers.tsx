'use client';

import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { config, networks, projectId, queryClient, wagmiAdapter } from '@/lib/web3';
import { ContractProvider } from '@/context/ContractContext';

// AppKit must be initialized once at module scope, before render. Without a
// Reown project id the wallet modal is skipped but the app still renders.
if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata: {
      name: 'NoblePort Mission Control',
      description: 'NBPT security token console',
      url: 'https://nobleport.etf',
      icons: [],
    },
    features: { analytics: false },
  });
}

export function Web3Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ContractProvider>{children}</ContractProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
