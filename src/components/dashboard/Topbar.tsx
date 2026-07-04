'use client';

import { useEffect, useState } from 'react';

import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';

const fmt = (d: Date) =>
  d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

export function Topbar({ pageTitle, generatedAt }: { pageTitle: string; generatedAt?: string }) {
  const [now, setNow] = useState<string>('');
  useEffect(() => {
    const tick = () => setNow(fmt(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-950/85 px-4 py-3 backdrop-blur sm:px-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400">
          dashboard.nobleport.ai
        </div>
        <h1 className="text-lg font-semibold text-ink-50">{pageTitle}</h1>
      </div>
      <div className="flex items-center gap-2">
        {generatedAt && (
          <span className="hidden text-[11px] text-ink-400 sm:inline">
            data <span className="num">@ {new Date(generatedAt).toLocaleTimeString()}</span>
          </span>
        )}
        <span className="num hidden rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11px] text-ink-200 md:inline">
          {now}
        </span>
        <button type="button" className="btn" aria-label="Refresh">
          ↻ <span className="hidden sm:inline">Refresh</span>
        </button>
        <ConnectWalletButton />
        <button type="button" className="btn-primary" aria-label="Operator">
          OP · m.velasquez
        </button>
      </div>
    </header>
  );
}
