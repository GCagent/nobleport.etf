'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/roofing', label: 'Fall Protection' },
  { href: '/dashboard/roofing/division', label: 'Division' },
  { href: '/dashboard/roofing/estimator', label: 'Estimator' },
  { href: '/dashboard/roofing/proposals', label: 'Proposals' },
];

export function RoofingTabs() {
  const pathname = usePathname() ?? '';
  return (
    <nav className="flex gap-1 border-b border-ink-700 px-4 pt-2 sm:px-6">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-b-2 border-violet-500 text-violet-100'
                : 'text-ink-300 hover:bg-ink-800/60 hover:text-ink-100'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
