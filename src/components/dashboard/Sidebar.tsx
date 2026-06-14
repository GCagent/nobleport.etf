'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  hint: string;
}

const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Command', hint: 'Executive overview' },
  { href: '/dashboard/noblenest', label: 'NobleNest', hint: 'Homeowner OS · passport' },
  { href: '/dashboard/revenue', label: 'Revenue', hint: 'Warboard · cash · AR' },
  { href: '/dashboard/jobs', label: 'Jobs', hint: 'GCagent · production' },
  { href: '/dashboard/permits', label: 'Permits', hint: 'PermitStream · AHJs' },
  { href: '/dashboard/roofing', label: 'Roofing', hint: 'Fall protection · safety gates' },
  { href: '/dashboard/realty', label: 'Realty', hint: 'Property analysis · assets' },
  { href: '/dashboard/agents', label: 'Agents', hint: 'AI mesh · queues' },
  { href: '/dashboard/voice', label: 'Voice', hint: 'Stephanie console' },
  { href: '/dashboard/compliance', label: 'Compliance', hint: 'Cyborg · kill switches' },
  { href: '/dashboard/audit', label: 'Audit', hint: 'Hash-linked chain' },
];

const SECONDARY: NavItem[] = [
  { href: '/dashboard/settings', label: 'Settings', hint: 'Operators · keys · webhooks' },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`group flex flex-col rounded-md px-3 py-2 transition-colors ${
        active
          ? 'bg-violet-600/15 text-violet-100 ring-1 ring-violet-500/30'
          : 'text-ink-200 hover:bg-ink-800/80'
      }`}
    >
      <span className="text-sm font-semibold">{item.label}</span>
      <span
        className={`text-[11px] ${active ? 'text-violet-300/80' : 'text-ink-400 group-hover:text-ink-300'}`}
      >
        {item.hint}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? '';
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-ink-700 bg-ink-950/60 lg:flex">
      <div className="flex items-center gap-2 border-b border-ink-700 px-5 py-4">
        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-violet-500 to-blue-500" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-ink-50">NoblePort</div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">Mission Control</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <div className="my-3 divider" />
        {SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="border-t border-ink-700 px-5 py-3 text-[11px] text-ink-400">
        <div className="flex items-center justify-between">
          <span>Env</span>
          <span className="pill-info">production</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Region</span>
          <span className="num">hetzner-fsn1</span>
        </div>
      </div>
    </aside>
  );
}
