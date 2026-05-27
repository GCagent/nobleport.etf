import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoblePort Mission Control — Stephanie.ai',
  description:
    'Constitutional AI Executive dashboard. Global frontend orchestration and AI interaction delivery infrastructure.',
  applicationName: 'NoblePort Matter OS',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#080b15',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink-950 text-ink-100 antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
