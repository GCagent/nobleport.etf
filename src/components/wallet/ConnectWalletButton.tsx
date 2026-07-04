'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useEnsName, useSwitchChain } from 'wagmi';
import { base, mainnet } from 'wagmi/chains';

import { shortenAddress } from '@/lib/wallet/nobleport';

const CONNECTOR_LABELS: Record<string, string> = {
  injected: 'Browser Wallet (MetaMask · Rabby · OKX)',
  coinbaseWalletSDK: 'Coinbase Wallet',
  walletConnect: 'WalletConnect QR (Rainbow · Trust · Phantom)',
  safe: 'Safe',
};

export function ConnectWalletButton() {
  const { address, chain, isConnected, isConnecting } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { chains, switchChain } = useSwitchChain();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const onWrongChain = isConnected && chain === undefined;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={isConnected ? 'btn' : 'btn-primary'}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isConnected && address ? (
          <>
            <span
              className={`h-2 w-2 rounded-full ${onWrongChain ? 'bg-signal-warn' : 'bg-signal-ok'}`}
            />
            <span className="num">{ensName ?? shortenAddress(address)}</span>
            {chain && (
              <span className="hidden text-[11px] text-ink-400 sm:inline">{chain.name}</span>
            )}
          </>
        ) : (
          <>{isConnecting || isPending ? 'Connecting…' : 'Connect Wallet'}</>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="panel absolute right-0 z-20 mt-2 w-72 overflow-hidden text-left"
        >
          {!isConnected ? (
            <div className="flex flex-col p-1.5">
              <div className="panel-subtitle px-2.5 pb-1 pt-1.5">Connect a wallet</div>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  role="menuitem"
                  className="row-hover rounded-md px-2.5 py-2 text-left text-sm text-ink-100"
                  onClick={() => {
                    connect({ connector, chainId: base.id });
                    setOpen(false);
                  }}
                >
                  {CONNECTOR_LABELS[connector.id] ?? connector.name}
                </button>
              ))}
              {error && (
                <div className="px-2.5 py-2 text-[11px] text-red-300">{error.message}</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col p-1.5">
              <div className="panel-subtitle px-2.5 pb-1 pt-1.5">Network</div>
              {chains.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="menuitem"
                  className={`row-hover flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm ${
                    chain?.id === c.id ? 'text-violet-200' : 'text-ink-100'
                  }`}
                  onClick={() => switchChain({ chainId: c.id })}
                >
                  <span>{c.name}</span>
                  {c.id === base.id && <span className="pill-info">primary</span>}
                  {chain?.id === c.id && c.id !== base.id && <span className="pill-ok">active</span>}
                </button>
              ))}
              <div className="my-1.5 divider" />
              <button
                type="button"
                role="menuitem"
                className="row-hover rounded-md px-2.5 py-2 text-left text-sm text-red-300"
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
