'use client';

import { formatUnits } from 'viem';
import { useAccount, useBalance, useEnsAddress, useEnsName } from 'wagmi';
import { mainnet } from 'wagmi/chains';

import {
  NOBLEPORT_ENS_NAME,
  NOBLEPORT_TREASURY_ADDRESS,
  SUPPORTED_NETWORKS,
  WALLET_MODULES,
  shortenAddress,
} from '@/lib/wallet/nobleport';
import { Panel } from '@/components/dashboard/Panel';
import { ConnectWalletButton } from './ConnectWalletButton';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-ink-400">{label}</span>
      <span className="num text-right text-ink-100">{children}</span>
    </div>
  );
}

export function SessionPanel() {
  const { address, chain, connector, isConnected } = useAccount();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: balance } = useBalance({ address, chainId: chain?.id });

  return (
    <Panel
      title="Wallet Session"
      subtitle="sign-in with Ethereum"
      actions={<ConnectWalletButton />}
    >
      {isConnected && address ? (
        <div className="divide-y divide-ink-700 text-sm">
          <Field label="Account">{ensName ?? shortenAddress(address, 6)}</Field>
          <Field label="Address">{shortenAddress(address, 8)}</Field>
          <Field label="Network">
            {chain ? chain.name : <span className="text-yellow-300">unsupported — switch</span>}
          </Field>
          <Field label="Connector">{connector?.name ?? '—'}</Field>
          <Field label="Balance">
            {balance
              ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(5)} ${balance.symbol}`
              : '—'}
          </Field>
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-ink-400">
          No wallet connected. Connect Coinbase Wallet, MetaMask, Rainbow, Trust, Phantom, Rabby,
          OKX, Safe, or any EVM wallet via WalletConnect.
        </div>
      )}
    </Panel>
  );
}

export function TreasuryPanel() {
  const { data: resolved, isLoading } = useEnsAddress({
    name: NOBLEPORT_ENS_NAME,
    chainId: mainnet.id,
  });

  const envAddress = NOBLEPORT_TREASURY_ADDRESS;
  const mismatch =
    envAddress && resolved && envAddress.toLowerCase() !== resolved.toLowerCase();

  return (
    <Panel title="NoblePort Treasury" subtitle="canonical receive identity">
      <div className="divide-y divide-ink-700 text-sm">
        <Field label="Basename">{NOBLEPORT_ENS_NAME}</Field>
        <Field label="Resolved address">
          {isLoading ? 'resolving…' : resolved ? shortenAddress(resolved, 8) : 'not resolved'}
        </Field>
        <Field label="Configured address">
          {envAddress ? shortenAddress(envAddress, 8) : 'set NEXT_PUBLIC_NOBLEPORT_TREASURY'}
        </Field>
        <div className="flex items-center justify-between py-2">
          <span className="text-ink-400">Verification</span>
          {mismatch ? (
            <span className="pill-err">ENS ≠ configured — investigate</span>
          ) : envAddress && resolved ? (
            <span className="pill-ok">ENS matches configured address</span>
          ) : (
            <span className="pill-mute">pending</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function NetworksPanel() {
  const { chain } = useAccount();
  return (
    <Panel title="Networks" subtitle="Base primary · EVM supported">
      <ul className="divide-y divide-ink-700 text-sm">
        {SUPPORTED_NETWORKS.map((n) => (
          <li key={n.chainId} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="text-ink-100">{n.name}</span>
              <span className="num text-[11px] text-ink-400">#{n.chainId}</span>
            </div>
            <div className="flex items-center gap-2">
              {n.role === 'primary' && <span className="pill-info">primary</span>}
              {chain?.id === n.chainId && <span className="pill-ok">connected</span>}
              <span className="num text-[11px] text-ink-400">{n.nativeSymbol}</span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ModulesPanel() {
  return (
    <Panel title="Wallet-Gated Modules" subtitle="SolarCaps · PermitStream · Payment Node · DAO">
      <ul className="divide-y divide-ink-700 text-sm">
        {WALLET_MODULES.map((m) => (
          <li key={m.id} className="py-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink-100">{m.label}</span>
              {m.status === 'live' ? (
                <span className="pill-ok">live</span>
              ) : (
                <span className="pill-mute">planned</span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-ink-400">{m.description}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
