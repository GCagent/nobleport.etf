import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoblePort Mission Control',
  description:
    'Operator-grade execution console for revenue, construction ops, permits, AI agents, compliance, and audit chain.',
  applicationName: 'NoblePort Mission Control',
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
      <body className="min-h-screen bg-ink-950 text-ink-100 antialiased">{children}</body>
    </html>
  );
}
