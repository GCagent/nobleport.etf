import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "NoblePort Construction | North Shore's Premier Builder",
  description:
    '$15K+ Custom Projects | Licensed & Insured | North Shore MA Only. Decks, kitchens, baths, additions, exterior work, and high-value renovations.',
  openGraph: {
    title: "NoblePort Construction | North Shore's Premier Builder",
    description:
      '$15K+ Custom Projects | Licensed & Insured | North Shore MA Only.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
