import Link from 'next/link'
import { PHONE_NUMBER, SMS_LINK, INSTAGRAM_URL } from '@/lib/constants'

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* ─── Hero ─── */}
      <section className="bg-noble-black text-white py-20 px-6 text-center">
        <h1 className="font-display text-4xl md:text-6xl font-bold mb-4">
          North Shore&rsquo;s Premier Builder
        </h1>
        <p className="text-noble-gold text-xl md:text-2xl font-semibold mb-2">
          $15K+ Custom Projects &middot; Licensed &amp; Insured &middot; North
          Shore MA Only
        </p>
        <p className="max-w-2xl mx-auto text-gray-300 text-lg mt-6 mb-10 leading-relaxed">
          NoblePort Construction delivers serious residential projects with
          control, clarity, and execution. Decks, kitchens, baths, additions,
          exterior work, and high-value renovations.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/quote" className="btn-primary">
            Get a Quote
          </Link>
          <a href={SMS_LINK} className="btn-outline">
            Text Us Now
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary border-gray-500 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            View Our Work
          </a>
        </div>
      </section>

      {/* ─── Credibility Strip ─── */}
      <section className="bg-noble-cream py-10 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { stat: '35+', label: 'Years Experience' },
            { stat: '✓', label: 'Licensed & Insured' },
            { stat: 'North Shore', label: 'Focused' },
            { stat: '$15K+', label: 'Serious Projects Only' },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-noble-gold text-3xl font-bold font-display">
                {item.stat}
              </div>
              <div className="text-noble-dark text-sm font-semibold mt-1 uppercase tracking-wide">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Services ─── */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-center mb-10">
            What We Build
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              'Decks',
              'Kitchens',
              'Baths',
              'Additions',
              'Exterior / Roofing',
              'Windows / Doors',
              'Renovations',
              'Custom Projects',
            ].map((service) => (
              <div
                key={service}
                className="bg-noble-cream rounded-lg p-5 text-center font-semibold text-noble-dark hover:bg-noble-gold hover:text-white transition-colors duration-200"
              >
                {service}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="bg-noble-black text-white py-16 px-6 text-center">
        <h2 className="font-display text-3xl font-bold mb-4">
          Ready to Build?
        </h2>
        <p className="text-gray-400 mb-8 text-lg">
          Tell us about your project. We&rsquo;ll get back to you within 24
          hours if it&rsquo;s a fit.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/quote" className="btn-primary">
            Get Your Quote
          </Link>
          <a href={`tel:${PHONE_NUMBER}`} className="btn-outline">
            Call Us Now
          </a>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-noble-dark text-gray-400 py-8 px-6 text-center text-sm">
        <p className="font-semibold text-white mb-1">
          NoblePort Construction
        </p>
        <p>Serving North Shore MA only. $15K+ projects only.</p>
        <p className="mt-3">
          <a href={`tel:${PHONE_NUMBER}`} className="text-noble-gold hover:underline">
            {PHONE_NUMBER}
          </a>
        </p>
      </footer>
    </main>
  )
}
