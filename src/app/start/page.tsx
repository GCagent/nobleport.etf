import Link from 'next/link'
import { SMS_LINK, INSTAGRAM_URL, PHONE_NUMBER } from '@/lib/constants'

/**
 * /start — QR code destination page.
 * All QR codes point here. This is the controlled entry point.
 */
export default function StartPage() {
  return (
    <main className="min-h-screen bg-noble-black flex items-center justify-center px-6 py-16">
      <div className="max-w-sm w-full text-center">
        {/* Brand */}
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          NoblePort
        </h1>
        <p className="text-noble-gold text-sm font-semibold uppercase tracking-widest mb-10">
          Construction
        </p>

        {/* Primary CTA */}
        <Link href="/quote" className="btn-primary w-full block mb-4">
          Get a Quote
        </Link>

        {/* Text CTA */}
        <a href={SMS_LINK} className="btn-outline w-full block mb-4">
          Text Us Now
        </a>

        {/* Instagram — third option by design */}
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full border-2 border-gray-600 text-gray-400 font-bold text-lg px-8 py-4 rounded-md hover:border-gray-400 hover:text-white transition-colors duration-200 text-center"
        >
          View Our Work
        </a>

        {/* Phone */}
        <p className="text-gray-500 text-sm mt-8">
          Or call us:{' '}
          <a
            href={`tel:${PHONE_NUMBER}`}
            className="text-noble-gold hover:underline"
          >
            {PHONE_NUMBER}
          </a>
        </p>
        <p className="text-gray-600 text-xs mt-4">
          North Shore MA &middot; $15K+ Projects Only
        </p>
      </div>
    </main>
  )
}
