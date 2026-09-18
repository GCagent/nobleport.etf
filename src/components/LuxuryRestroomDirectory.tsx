'use client';

import React, { useState, useMemo } from 'react';
import {
  TrailerListing,
  TRAILER_CATEGORIES,
  TRAILER_LISTINGS,
  INDUSTRY_EVENTS,
  SERVICE_REGIONS,
  INDUSTRY_STATS,
} from '../data/luxury-restroom-directory';

// ============================================================================
// ICON MAP
// ============================================================================

const CATEGORY_ICONS: Record<string, string> = {
  wedding: '\u{1F48D}',
  corporate: '\u{1F3E2}',
  festival: '\u{1F3B6}',
  government: '\u{1F3DB}',
  residential: '\u{1F3E1}',
  sales: '\u{1F6E0}',
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StarRating: React.FC<{ rating: number; count?: number }> = ({ rating, count }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`text-sm ${
              i < fullStars
                ? 'text-amber-400'
                : i === fullStars && hasHalf
                ? 'text-amber-300'
                : 'text-slate-600'
            }`}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-xs text-slate-400">
        {rating.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </div>
  );
};

const VerifiedBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
    ✓ Verified
  </span>
);

const ADABadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
    ♿ ADA
  </span>
);

const PriceIndicator: React.FC<{ range?: string }> = ({ range }) => {
  if (!range) return null;
  return (
    <span className="text-sm font-medium text-emerald-400">{range}</span>
  );
};

// ============================================================================
// LISTING CARD
// ============================================================================

const ListingCard: React.FC<{
  listing: TrailerListing;
  onSelect: (listing: TrailerListing) => void;
  isSelected: boolean;
}> = ({ listing, onSelect, isSelected }) => (
  <div
    onClick={() => onSelect(listing)}
    className={`cursor-pointer rounded-xl border p-4 transition-all hover:border-sky-500/50 hover:bg-slate-800/50 ${
      isSelected
        ? 'border-sky-500 bg-slate-800/80 shadow-lg shadow-sky-500/10'
        : 'border-slate-700/50 bg-slate-900/50'
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">{listing.name}</h3>
          {listing.featured && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
              Featured
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400">{listing.subcategory}</p>
      </div>
      <PriceIndicator range={listing.priceRange} />
    </div>

    <p className="mt-2 line-clamp-2 text-sm text-slate-300">{listing.description}</p>

    <div className="mt-3 flex flex-wrap items-center gap-2">
      {listing.verified && <VerifiedBadge />}
      {listing.adaCompliant && <ADABadge />}
      {listing.rating && (
        <StarRating rating={listing.rating} count={listing.reviewCount} />
      )}
    </div>

    <div className="mt-2 flex flex-wrap gap-1">
      {listing.trailerTypes.slice(0, 3).map((type) => (
        <span
          key={type}
          className="rounded bg-slate-700/50 px-1.5 py-0.5 text-xs text-slate-400"
        >
          {type}
        </span>
      ))}
      {listing.trailerTypes.length > 3 && (
        <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-xs text-slate-500">
          +{listing.trailerTypes.length - 3} more
        </span>
      )}
    </div>

    <div className="mt-2 text-xs text-slate-500">
      📍 {listing.address}
      {listing.deliveryRadius && ` · ${listing.deliveryRadius}mi radius`}
    </div>
  </div>
);

// ============================================================================
// DETAIL PANEL
// ============================================================================

const DetailPanel: React.FC<{ listing: TrailerListing; onClose: () => void }> = ({
  listing,
  onClose,
}) => (
  <div className="sticky top-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-xl font-bold text-white">{listing.name}</h2>
        <p className="text-sm text-slate-400">{listing.subcategory}</p>
      </div>
      <button
        onClick={onClose}
        className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
      >
        ✕
      </button>
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      {listing.featured && (
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
          Featured
        </span>
      )}
      {listing.verified && <VerifiedBadge />}
      {listing.adaCompliant && <ADABadge />}
      <PriceIndicator range={listing.priceRange} />
    </div>

    {listing.rating && (
      <div className="mt-3">
        <StarRating rating={listing.rating} count={listing.reviewCount} />
      </div>
    )}

    <p className="mt-4 text-sm leading-relaxed text-slate-300">{listing.description}</p>

    {/* Contact Info */}
    <div className="mt-4 space-y-1.5 rounded-lg bg-slate-800/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</p>
      <p className="text-sm text-slate-300">📍 {listing.address}</p>
      {listing.phone && <p className="text-sm text-slate-300">📞 {listing.phone}</p>}
      {listing.website && (
        <p className="text-sm text-sky-400">{listing.website}</p>
      )}
      {listing.email && <p className="text-sm text-slate-300">✉ {listing.email}</p>}
      {listing.hours && <p className="text-sm text-slate-300">🕐 {listing.hours}</p>}
    </div>

    {/* Trailer Sizes */}
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Trailer Inventory
      </p>
      <div className="mt-2 space-y-2">
        {listing.trailerSizes.map((size, i) => (
          <div key={i} className="rounded-lg bg-slate-800/50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">
                {size.stations}-Station
              </span>
              <span className="text-xs text-slate-400">{size.length}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Capacity: {size.capacity}
            </p>
            <p className="text-xs text-sky-400/80">Ideal for: {size.idealFor}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Amenities */}
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Amenities & Features
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {listing.amenities.map((amenity) => (
          <span
            key={amenity}
            className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300"
          >
            {amenity}
          </span>
        ))}
      </div>
    </div>

    {/* Service Areas */}
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Service Areas
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {listing.serviceArea.map((area) => (
          <span
            key={area}
            className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
          >
            {area}
          </span>
        ))}
      </div>
      {listing.deliveryRadius && (
        <p className="mt-1 text-xs text-slate-500">
          Delivery radius: {listing.deliveryRadius} miles
        </p>
      )}
    </div>

    {/* Business Details */}
    <div className="mt-4 space-y-1 rounded-lg bg-slate-800/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
      {listing.minimumRental && (
        <p className="text-xs text-slate-400">Min rental: {listing.minimumRental}</p>
      )}
      {listing.yearsInBusiness && (
        <p className="text-xs text-slate-400">In business: {listing.yearsInBusiness} years</p>
      )}
      {listing.insuranceCoverage !== undefined && (
        <p className="text-xs text-slate-400">
          Insurance: {listing.insuranceCoverage ? 'Included' : 'Not included'}
        </p>
      )}
    </div>

    {/* Tags */}
    <div className="mt-4 flex flex-wrap gap-1">
      {listing.tags.map((tag) => (
        <span
          key={tag}
          className="rounded bg-slate-700/50 px-1.5 py-0.5 text-xs text-slate-500"
        >
          #{tag}
        </span>
      ))}
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type TabId = 'directory' | 'events' | 'regions' | 'market';

export default function LuxuryRestroomDirectory() {
  const [activeTab, setActiveTab] = useState<TabId>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<TrailerListing | null>(null);
  const [showADAOnly, setShowADAOnly] = useState(false);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  const filteredListings = useMemo(() => {
    let results = [...TRAILER_LISTINGS];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.tags.some((t) => t.includes(q)) ||
          l.amenities.some((a) => a.toLowerCase().includes(q)) ||
          l.serviceArea.some((s) => s.toLowerCase().includes(q)) ||
          l.trailerTypes.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (selectedCategory) {
      results = results.filter((l) => l.categoryId === selectedCategory);
    }

    if (showADAOnly) {
      results = results.filter((l) => l.adaCompliant);
    }

    if (showVerifiedOnly) {
      results = results.filter((l) => l.verified);
    }

    return results;
  }, [searchQuery, selectedCategory, showADAOnly, showVerifiedOnly]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TRAILER_LISTINGS.forEach((l) => {
      counts[l.categoryId] = (counts[l.categoryId] || 0) + 1;
    });
    return counts;
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'directory', label: 'Directory' },
    { id: 'events', label: 'Events' },
    { id: 'regions', label: 'Regions' },
    { id: 'market', label: 'Market Data' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚿</span>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Luxury Restroom Trailer Directory
              </h1>
              <p className="text-sm text-slate-400">
                Find premium portable restroom suppliers for weddings, events, and more
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* ============ DIRECTORY TAB ============ */}
        {activeTab === 'directory' && (
          <div>
            {/* Search & Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search suppliers, amenities, locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 pl-10 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="absolute left-3 top-2.5 text-slate-500">🔍</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    showVerifiedOnly
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  ✓ Verified
                </button>
                <button
                  onClick={() => setShowADAOnly(!showADAOnly)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    showADAOnly
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  ♿ ADA Only
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({TRAILER_LISTINGS.length})
              </button>
              {TRAILER_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {CATEGORY_ICONS[cat.id] || ''} {cat.name} ({categoryCounts[cat.id] || 0})
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="mt-4 flex gap-6">
              {/* Listing Grid */}
              <div className={`flex-1 ${selectedListing ? 'max-w-[55%]' : ''}`}>
                <p className="mb-3 text-sm text-slate-500">
                  {filteredListings.length} supplier{filteredListings.length !== 1 ? 's' : ''} found
                </p>
                <div className="grid gap-3">
                  {filteredListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onSelect={setSelectedListing}
                      isSelected={selectedListing?.id === listing.id}
                    />
                  ))}
                  {filteredListings.length === 0 && (
                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-8 text-center">
                      <p className="text-slate-400">No suppliers match your search.</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory(null);
                          setShowADAOnly(false);
                          setShowVerifiedOnly(false);
                        }}
                        className="mt-2 text-sm text-sky-400 hover:text-sky-300"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Detail Panel */}
              {selectedListing && (
                <div className="hidden w-[45%] lg:block">
                  <DetailPanel
                    listing={selectedListing}
                    onClose={() => setSelectedListing(null)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ EVENTS TAB ============ */}
        {activeTab === 'events' && (
          <div>
            <h2 className="text-lg font-semibold text-white">Industry Events</h2>
            <p className="mt-1 text-sm text-slate-400">
              Trade shows, conferences, and networking events for the portable sanitation industry
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {INDUSTRY_EVENTS.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-white">{event.name}</h3>
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                      {event.category}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    📅 {event.date} · 📍 {event.location}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{event.description}</p>
                  {event.recurring && (
                    <p className="mt-2 text-xs text-slate-500">🔄 Recurring annual event</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ REGIONS TAB ============ */}
        {activeTab === 'regions' && (
          <div>
            <h2 className="text-lg font-semibold text-white">Service Regions</h2>
            <p className="mt-1 text-sm text-slate-400">
              Where luxury restroom trailer suppliers operate across the country
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICE_REGIONS.map((region) => (
                <div
                  key={region.id}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4"
                >
                  <h3 className="text-lg font-semibold text-white">{region.name}</h3>
                  <p className="mt-1 text-sm text-emerald-400">
                    {region.supplierCount} suppliers
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{region.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {region.states.map((state) => (
                      <span
                        key={state}
                        className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400"
                      >
                        {state}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ MARKET DATA TAB ============ */}
        {activeTab === 'market' && (
          <div>
            <h2 className="text-lg font-semibold text-white">Market Overview</h2>
            <p className="mt-1 text-sm text-slate-400">
              Luxury portable restroom trailer industry data and trends
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(INDUSTRY_STATS).map(([key, value]) => {
                const labels: Record<string, string> = {
                  marketSize: 'Market Size',
                  annualGrowth: 'Annual Growth',
                  avgRentalPrice: 'Avg Rental Price',
                  avgPurchasePrice: 'Avg Purchase Price',
                  topEventType: 'Top Event Type',
                  peakSeason: 'Peak Season',
                  totalProviders: 'Total Providers',
                  adaComplianceRate: 'ADA Compliance Rate',
                  averageFleetSize: 'Average Fleet Size',
                  yearOverYearDemand: 'YoY Demand Growth',
                };
                return (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {labels[key] || key}
                    </p>
                    <p className="mt-1 text-lg font-bold text-sky-400">{value}</p>
                  </div>
                );
              })}
            </div>

            {/* Directory-level Stats */}
            <div className="mt-8">
              <h3 className="text-md font-semibold text-white">This Directory</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-800/50 p-3 text-center">
                  <p className="text-2xl font-bold text-white">{TRAILER_LISTINGS.length}</p>
                  <p className="text-xs text-slate-400">Listed Suppliers</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {TRAILER_LISTINGS.filter((l) => l.verified).length}
                  </p>
                  <p className="text-xs text-slate-400">Verified</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {TRAILER_LISTINGS.filter((l) => l.adaCompliant).length}
                  </p>
                  <p className="text-xs text-slate-400">ADA Compliant</p>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {TRAILER_LISTINGS.reduce((sum, l) => sum + (l.reviewCount || 0), 0)}
                  </p>
                  <p className="text-xs text-slate-400">Total Reviews</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
