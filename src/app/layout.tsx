import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoblePort ETF - SSI Architecture',
  description: 'Blockchain-Enabled Real Estate ETF Integration with Self-Sovereign Identity Support',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
