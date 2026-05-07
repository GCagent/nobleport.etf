import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoblePort Designer — Digital Design Studio',
  description:
    'Digital design studio for architecture and the built environment. 20 design specialties, 14 digital tools across 3D modeling, file sharing, and project management.',
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
