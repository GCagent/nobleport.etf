/**
 * Number, currency, and date formatters used across Mission Control.
 * Centralized so every panel renders consistently.
 */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const pct = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const intFmt = new Intl.NumberFormat('en-US');

export const fmtUSD = (n: number) => usd.format(n);
export const fmtUSDCompact = (n: number) => usdCompact.format(n);
export const fmtPct = (n: number) => pct.format(n);
export const fmtInt = (n: number) => intFmt.format(n);

export const fmtMs = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${Math.round(n)}ms`;
};

export const fmtRelative = (iso: string, now = new Date()) => {
  const t = new Date(iso).getTime();
  const diffMs = now.getTime() - t;
  const past = diffMs >= 0;
  const abs = Math.abs(diffMs);
  const sec = Math.round(abs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const word = (n: number, u: string) => `${n}${u}${past ? ' ago' : ' ahead'}`;
  if (sec < 60) return word(sec, 's');
  if (min < 60) return word(min, 'm');
  if (hr < 48) return word(hr, 'h');
  return word(day, 'd');
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

export const shortHash = (h: string, head = 8, tail = 6) => {
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
};
