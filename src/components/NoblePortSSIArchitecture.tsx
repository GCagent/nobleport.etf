/**
 * NoblePort SSI Architecture Dashboard
 *
 * React component for visualizing and interacting with NoblePort's
 * Self-Sovereign Identity (SSI) infrastructure, including ENS DID resolution.
 */

import React, { useState, useCallback } from 'react';
import {
  resolveEnsDid,
  resolveEnsAddress,
  getEnsTextRecords,
  NOBLEPORT_ENS,
  ensNameToDid,
} from '../lib/ensDidResolver';

// Types
interface DIDDocument {
  id: string;
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyHex?: string;
    blockchainAccountId?: string;
  }>;
  authentication?: string[];
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  [key: string]: unknown;
}

interface ResolverState {
  loading: boolean;
  error: string | null;
  didDocument: DIDDocument | null;
  address: string | null;
  textRecords: Record<string, string | null> | null;
}

// Status Badge Component
const StatusBadge: React.FC<{ status: 'active' | 'pending' | 'error' }> = ({ status }) => {
  const styles = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    error: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
};

// Section Card Component
const SectionCard: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = '' }) => (
  <div className={`bg-slate-900/60 border border-slate-800 rounded-xl p-4 ${className}`}>
    <div className="text-sm font-semibold text-slate-300 mb-3">{title}</div>
    {children}
  </div>
);

// Main Component
const NoblePortSSIArchitecture: React.FC = () => {
  const [customEns, setCustomEns] = useState('');
  const [resolverState, setResolverState] = useState<ResolverState>({
    loading: false,
    error: null,
    didDocument: null,
    address: null,
    textRecords: null,
  });

  // Resolve DID Document
  const handleResolveDid = useCallback(async (ensName: string) => {
    setResolverState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const did = ensNameToDid(ensName);
      const [didDoc, address, textRecords] = await Promise.all([
        resolveEnsDid(did),
        resolveEnsAddress(ensName),
        getEnsTextRecords(ensName, ['url', 'email', 'description', 'com.twitter', 'com.github']),
      ]);

      setResolverState({
        loading: false,
        error: null,
        didDocument: didDoc as DIDDocument | null,
        address,
        textRecords,
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to resolve DID';
      setResolverState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // Resolve NoblePort root
  const handleResolveRoot = useCallback(() => {
    handleResolveDid(NOBLEPORT_ENS.ROOT);
  }, [handleResolveDid]);

  // Resolve custom ENS name
  const handleResolveCustom = useCallback(() => {
    if (customEns.trim()) {
      handleResolveDid(customEns.trim());
    }
  }, [customEns, handleResolveDid]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">NoblePort SSI Architecture</h1>
            <p className="text-sm text-slate-400 mt-1">
              Self-Sovereign Identity &amp; ENS DID Resolution Dashboard
            </p>
          </div>
          <StatusBadge status="active" />
        </div>

        {/* Architecture Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SectionCard title="Identity Layer">
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>DID Method</span>
                <span className="text-cyan-400 font-mono">did:ens</span>
              </div>
              <div className="flex justify-between">
                <span>Root Identity</span>
                <span className="text-cyan-400 font-mono">nobleport.eth</span>
              </div>
              <div className="flex justify-between">
                <span>Network</span>
                <span className="text-slate-300">Ethereum Mainnet</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Resolution Stack">
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>DID Resolver</span>
                <span className="text-slate-300">did-resolver</span>
              </div>
              <div className="flex justify-between">
                <span>ENS Resolver</span>
                <span className="text-slate-300">ens-did-resolver</span>
              </div>
              <div className="flex justify-between">
                <span>Provider</span>
                <span className="text-slate-300">ethers.js v6</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Integration Status">
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>ETF Integration</span>
                <StatusBadge status="active" />
              </div>
              <div className="flex justify-between">
                <span>Token Verification</span>
                <StatusBadge status="active" />
              </div>
              <div className="flex justify-between">
                <span>Cross-chain</span>
                <StatusBadge status="pending" />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ENS/DID Resolver Section */}
        <SectionCard title="ENS/DID Resolver" className="mb-6">
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleResolveRoot}
                disabled={resolverState.loading}
                className="px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Resolve did:ens:nobleport.eth
              </button>
              <button
                onClick={() => handleResolveDid(NOBLEPORT_ENS.ETF)}
                disabled={resolverState.loading}
                className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Resolve did:ens:etf.nobleport.eth
              </button>
            </div>

            {/* Custom ENS Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customEns}
                onChange={(e) => setCustomEns(e.target.value)}
                placeholder="Enter ENS name (e.g., vitalik.eth)"
                className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500"
                onKeyDown={(e) => e.key === 'Enter' && handleResolveCustom()}
              />
              <button
                onClick={handleResolveCustom}
                disabled={resolverState.loading || !customEns.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Resolve
              </button>
            </div>

            {/* Loading State */}
            {resolverState.loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                Resolving DID on ENS...
              </div>
            )}

            {/* Error State */}
            {resolverState.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-sm text-rose-400">
                {resolverState.error}
              </div>
            )}

            {/* Results */}
            {resolverState.didDocument && (
              <div className="space-y-4">
                {/* Address */}
                {resolverState.address && (
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Ethereum Address</div>
                    <div className="font-mono text-sm text-emerald-400 break-all">
                      {resolverState.address}
                    </div>
                  </div>
                )}

                {/* Text Records */}
                {resolverState.textRecords && (
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-2">ENS Text Records</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(resolverState.textRecords).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-slate-500">{key}</span>
                          <span className="text-slate-300 truncate ml-2">
                            {value || '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DID Document */}
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-500 mb-2">DID Document</div>
                  <pre className="max-h-64 overflow-auto text-[10px] text-slate-300 font-mono bg-slate-950/80 p-3 rounded">
                    {JSON.stringify(resolverState.didDocument, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Architecture Diagram */}
        <SectionCard title="SSI Architecture Flow">
          <div className="font-mono text-xs text-slate-400 bg-slate-950/50 p-4 rounded-lg overflow-x-auto">
            <pre>{`
┌─────────────────────────────────────────────────────────────────┐
│                     NoblePort SSI Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   React UI   │───▶│ DID Resolver │───▶│  ENS Contract│      │
│  │  Dashboard   │    │  (did:ens)   │    │  (Mainnet)   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Verifiable  │    │    DID       │    │   ETH        │      │
│  │ Credentials  │◀───│  Document    │◀───│   Address    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    NoblePort ETF Integration                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Token 2022  │───▶│   Identity   │───▶│  Compliance  │      │
│  │   Assets     │    │ Verification │    │  Reporting   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            `}</pre>
          </div>
        </SectionCard>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-600">
          NoblePort SSI Architecture • did:ens:nobleport.eth • Powered by ENS &amp; Ethereum
        </div>
      </div>
    </div>
  );
};

export default NoblePortSSIArchitecture;
