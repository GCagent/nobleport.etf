/**
 * Luxury Restroom Trailer Directory - Service
 *
 * Business logic for searching, filtering, and managing
 * the luxury restroom trailer supplier directory.
 */

import {
  TrailerListing,
  TrailerCategory,
  IndustryEvent,
  ServiceRegion,
  TRAILER_CATEGORIES,
  TRAILER_LISTINGS,
  INDUSTRY_EVENTS,
  SERVICE_REGIONS,
  INDUSTRY_STATS,
} from '../data/luxury-restroom-directory';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchFilters {
  query?: string;
  categoryId?: string;
  subcategory?: string;
  priceRange?: string;
  tags?: string[];
  featured?: boolean;
  verified?: boolean;
  minRating?: number;
  serviceArea?: string;
  adaCompliant?: boolean;
  trailerType?: string;
  minStations?: number;
  maxStations?: number;
}

export interface SearchResult {
  listings: TrailerListing[];
  total: number;
  filters: SearchFilters;
}

export interface DirectoryStats {
  totalListings: number;
  totalCategories: number;
  featuredListings: number;
  verifiedListings: number;
  averageRating: number;
  totalReviews: number;
  adaCompliantCount: number;
}

// ============================================================================
// DIRECTORY SERVICE
// ============================================================================

export class LuxuryRestroomDirectoryService {
  private listings: TrailerListing[];
  private categories: TrailerCategory[];
  private events: IndustryEvent[];
  private regions: ServiceRegion[];

  constructor() {
    this.listings = TRAILER_LISTINGS;
    this.categories = TRAILER_CATEGORIES;
    this.events = INDUSTRY_EVENTS;
    this.regions = SERVICE_REGIONS;
  }

  search(filters: SearchFilters): SearchResult {
    let results = [...this.listings];

    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q)) ||
          l.amenities.some((a) => a.toLowerCase().includes(q)) ||
          l.serviceArea.some((s) => s.toLowerCase().includes(q)) ||
          l.trailerTypes.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filters.categoryId) {
      results = results.filter((l) => l.categoryId === filters.categoryId);
    }

    if (filters.subcategory) {
      results = results.filter((l) => l.subcategory === filters.subcategory);
    }

    if (filters.priceRange) {
      results = results.filter((l) => l.priceRange === filters.priceRange);
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((l) =>
        filters.tags!.some((tag) => l.tags.includes(tag))
      );
    }

    if (filters.featured !== undefined) {
      results = results.filter((l) => l.featured === filters.featured);
    }

    if (filters.verified !== undefined) {
      results = results.filter((l) => l.verified === filters.verified);
    }

    if (filters.minRating !== undefined) {
      results = results.filter(
        (l) => l.rating !== undefined && l.rating >= filters.minRating!
      );
    }

    if (filters.serviceArea) {
      const area = filters.serviceArea.toLowerCase();
      results = results.filter((l) =>
        l.serviceArea.some(
          (s) => s.toLowerCase() === area || s.toLowerCase() === 'nationwide'
        )
      );
    }

    if (filters.adaCompliant) {
      results = results.filter((l) => l.adaCompliant === true);
    }

    if (filters.trailerType) {
      const type = filters.trailerType.toLowerCase();
      results = results.filter((l) =>
        l.trailerTypes.some((t) => t.toLowerCase().includes(type))
      );
    }

    if (filters.minStations !== undefined) {
      results = results.filter((l) =>
        l.trailerSizes.some((s) => s.stations >= filters.minStations!)
      );
    }

    if (filters.maxStations !== undefined) {
      results = results.filter((l) =>
        l.trailerSizes.some((s) => s.stations <= filters.maxStations!)
      );
    }

    return {
      listings: results,
      total: results.length,
      filters,
    };
  }

  getAllListings(): TrailerListing[] {
    return this.listings;
  }

  getListingById(id: string): TrailerListing | undefined {
    return this.listings.find((l) => l.id === id);
  }

  getFeaturedListings(): TrailerListing[] {
    return this.listings.filter((l) => l.featured);
  }

  getVerifiedListings(): TrailerListing[] {
    return this.listings.filter((l) => l.verified);
  }

  getListingsByCategory(categoryId: string): TrailerListing[] {
    return this.listings.filter((l) => l.categoryId === categoryId);
  }

  getCategories(): TrailerCategory[] {
    return this.categories;
  }

  getSubcategories(categoryId: string): string[] {
    const category = this.categories.find((c) => c.id === categoryId);
    return category ? category.subcategories : [];
  }

  getEvents(): IndustryEvent[] {
    return this.events;
  }

  getRegions(): ServiceRegion[] {
    return this.regions;
  }

  getRegionByState(state: string): ServiceRegion | undefined {
    return this.regions.find((r) =>
      r.states.some((s) => s.toLowerCase() === state.toLowerCase())
    );
  }

  getIndustryStats() {
    return INDUSTRY_STATS;
  }

  getDirectoryStats(): DirectoryStats {
    const ratings = this.listings
      .filter((l) => l.rating !== undefined)
      .map((l) => l.rating!);

    return {
      totalListings: this.listings.length,
      totalCategories: this.categories.length,
      featuredListings: this.listings.filter((l) => l.featured).length,
      verifiedListings: this.listings.filter((l) => l.verified).length,
      averageRating:
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : 0,
      totalReviews: this.listings.reduce((sum, l) => sum + (l.reviewCount || 0), 0),
      adaCompliantCount: this.listings.filter((l) => l.adaCompliant).length,
    };
  }

  getAllTags(): string[] {
    const tagSet = new Set<string>();
    this.listings.forEach((l) => l.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }

  getAllAmenities(): string[] {
    const amenitySet = new Set<string>();
    this.listings.forEach((l) => l.amenities.forEach((a) => amenitySet.add(a)));
    return Array.from(amenitySet).sort();
  }

  getServiceAreaCoverage(): Record<string, number> {
    const coverage: Record<string, number> = {};
    this.listings.forEach((l) => {
      l.serviceArea.forEach((area) => {
        coverage[area] = (coverage[area] || 0) + 1;
      });
    });
    return coverage;
  }
}
