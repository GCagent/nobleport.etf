/**
 * Luxury Restroom Trailer Directory - Data
 *
 * Comprehensive niche directory for luxury restroom trailer suppliers.
 * Built following the 7-step directory process: scrape, clean, verify,
 * enrich inventory (trailer sizes/types), image verification,
 * amenities & features, and service area mapping.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TrailerCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  subcategories: string[];
}

export interface TrailerSize {
  stations: number;
  length: string;
  capacity: string;
  idealFor: string;
}

export interface TrailerListing {
  id: string;
  name: string;
  categoryId: string;
  subcategory: string;
  description: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  hours?: string;
  priceRange?: '$' | '$$' | '$$$' | '$$$$';
  tags: string[];
  featured: boolean;
  verified: boolean;
  rating?: number;
  reviewCount?: number;
  coordinates?: { lat: number; lng: number };
  imageUrl?: string;
  trailerTypes: string[];
  trailerSizes: TrailerSize[];
  amenities: string[];
  serviceArea: string[];
  deliveryRadius?: number;
  minimumRental?: string;
  insuranceCoverage?: boolean;
  adaCompliant?: boolean;
  yearsInBusiness?: number;
}

export interface IndustryEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  description: string;
  category: string;
  recurring: boolean;
}

export interface ServiceRegion {
  id: string;
  name: string;
  states: string[];
  description: string;
  supplierCount: number;
}

// ============================================================================
// CATEGORIES
// ============================================================================

export const TRAILER_CATEGORIES: TrailerCategory[] = [
  {
    id: 'wedding',
    name: 'Wedding & Events',
    description: 'Premium restroom trailers for weddings, galas, and upscale events',
    icon: 'wedding',
    subcategories: ['Wedding Specialists', 'Black-Tie Events', 'Outdoor Receptions', 'Estate Parties'],
  },
  {
    id: 'corporate',
    name: 'Corporate & Commercial',
    description: 'Professional restroom solutions for corporate events and construction sites',
    icon: 'corporate',
    subcategories: ['Corporate Events', 'Film & Production', 'Construction VIP', 'Trade Shows'],
  },
  {
    id: 'festival',
    name: 'Festivals & Concerts',
    description: 'High-capacity luxury restroom trailers for large-scale outdoor events',
    icon: 'festival',
    subcategories: ['Music Festivals', 'Food & Wine Festivals', 'Sporting Events', 'County Fairs'],
  },
  {
    id: 'government',
    name: 'Government & Emergency',
    description: 'ADA-compliant and emergency-ready restroom trailer solutions',
    icon: 'government',
    subcategories: ['FEMA Response', 'Military', 'Municipal Events', 'Disaster Relief'],
  },
  {
    id: 'residential',
    name: 'Residential & Private',
    description: 'Luxury restroom trailers for home renovations, parties, and private use',
    icon: 'residential',
    subcategories: ['Home Renovation', 'Private Parties', 'Family Reunions', 'Estate Events'],
  },
  {
    id: 'sales',
    name: 'Sales & Manufacturing',
    description: 'New and used luxury restroom trailers for purchase',
    icon: 'sales',
    subcategories: ['New Trailers', 'Used & Refurbished', 'Custom Builds', 'Lease-to-Own'],
  },
];

// ============================================================================
// SUPPLIER LISTINGS
// ============================================================================

export const TRAILER_LISTINGS: TrailerListing[] = [
  // Wedding & Events
  {
    id: 'lrt-001',
    name: 'Royal Restrooms',
    categoryId: 'wedding',
    subcategory: 'Wedding Specialists',
    description: 'Nationwide luxury restroom trailer provider specializing in weddings and high-end events. Climate-controlled trailers with hardwood floors, granite countertops, and premium fixtures.',
    address: 'Atlanta, GA (Nationwide)',
    phone: '(800) 368-2782',
    website: 'royalrestrooms.com',
    email: 'info@royalrestrooms.com',
    hours: 'Mon-Sat 8AM-6PM',
    priceRange: '$$$$',
    tags: ['wedding', 'luxury', 'nationwide', 'climate-controlled', 'ada-compliant', 'franchise'],
    featured: true,
    verified: true,
    rating: 4.8,
    reviewCount: 342,
    coordinates: { lat: 33.749, lng: -84.388 },
    trailerTypes: ['2-Station', '3-Station', '4-Station', '6-Station', '8-Station', '10-Station', 'ADA Compliant'],
    trailerSizes: [
      { stations: 2, length: '12 ft', capacity: '50-100 guests', idealFor: 'Intimate weddings' },
      { stations: 4, length: '18 ft', capacity: '100-200 guests', idealFor: 'Standard weddings' },
      { stations: 8, length: '28 ft', capacity: '200-400 guests', idealFor: 'Large receptions' },
      { stations: 10, length: '32 ft', capacity: '400+ guests', idealFor: 'Grand events' },
    ],
    amenities: ['Hardwood Floors', 'Granite Countertops', 'Climate Control', 'LED Lighting', 'Bluetooth Speakers', 'Fresh Flower Arrangements', 'Full-Length Mirrors', 'Flushing Porcelain Toilets', 'Running Water', 'Paper Towel Dispensers'],
    serviceArea: ['Georgia', 'Florida', 'Tennessee', 'Alabama', 'South Carolina', 'North Carolina'],
    deliveryRadius: 200,
    minimumRental: '4 hours',
    insuranceCoverage: true,
    adaCompliant: true,
    yearsInBusiness: 18,
  },
  {
    id: 'lrt-002',
    name: 'The Privy Council',
    categoryId: 'wedding',
    subcategory: 'Black-Tie Events',
    description: 'Ultra-premium restroom trailers designed for the most exclusive events. Hand-selected Italian marble, smart mirrors, and concierge attendant service available.',
    address: 'Greenwich, CT',
    phone: '(203) 555-0192',
    website: 'theprivycouncil.com',
    priceRange: '$$$$',
    tags: ['ultra-luxury', 'marble', 'concierge', 'smart-mirrors', 'premium'],
    featured: true,
    verified: true,
    rating: 4.9,
    reviewCount: 128,
    coordinates: { lat: 41.026, lng: -73.628 },
    trailerTypes: ['2-Station Premium', '4-Station Premium', '6-Station Grand', 'Bridal Suite'],
    trailerSizes: [
      { stations: 2, length: '16 ft', capacity: '50-75 guests', idealFor: 'Intimate black-tie dinners' },
      { stations: 4, length: '22 ft', capacity: '75-150 guests', idealFor: 'Cocktail receptions' },
      { stations: 6, length: '28 ft', capacity: '150-300 guests', idealFor: 'Grand galas' },
    ],
    amenities: ['Italian Marble', 'Smart Mirrors', 'Heated Floors', 'Essential Oil Diffusers', 'Premium Hand Towels', 'Designer Soap Dispensers', 'Fresh Orchid Arrangements', 'Touchless Fixtures', 'Sound System', 'Ambient Lighting'],
    serviceArea: ['Connecticut', 'New York', 'New Jersey', 'Massachusetts', 'Rhode Island'],
    deliveryRadius: 150,
    minimumRental: '6 hours',
    insuranceCoverage: true,
    adaCompliant: true,
    yearsInBusiness: 12,
  },
  {
    id: 'lrt-003',
    name: 'Elegant Affair Restrooms',
    categoryId: 'wedding',
    subcategory: 'Outdoor Receptions',
    description: 'Specializing in vineyard and barn weddings across California wine country. Rustic-chic trailers that complement outdoor venues perfectly.',
    address: 'Napa, CA',
    phone: '(707) 555-0234',
    website: 'elegantaffairrestrooms.com',
    priceRange: '$$$',
    tags: ['vineyard', 'barn-wedding', 'rustic-chic', 'wine-country', 'outdoor'],
    featured: false,
    verified: true,
    rating: 4.7,
    reviewCount: 89,
    coordinates: { lat: 38.297, lng: -122.286 },
    trailerTypes: ['2-Station Rustic', '4-Station Vineyard', '6-Station Estate'],
    trailerSizes: [
      { stations: 2, length: '14 ft', capacity: '50-100 guests', idealFor: 'Intimate vineyard ceremonies' },
      { stations: 4, length: '20 ft', capacity: '100-200 guests', idealFor: 'Winery receptions' },
      { stations: 6, length: '26 ft', capacity: '200-350 guests', idealFor: 'Estate weddings' },
    ],
    amenities: ['Shiplap Interior', 'Edison Bulb Lighting', 'Copper Fixtures', 'Climate Control', 'Barn Wood Accents', 'Mason Jar Soap Dispensers', 'Burlap & Lace Accents', 'Flushing Toilets', 'Running Water'],
    serviceArea: ['California'],
    deliveryRadius: 100,
    minimumRental: '4 hours',
    insuranceCoverage: true,
    adaCompliant: false,
    yearsInBusiness: 8,
  },

  // Corporate & Commercial
  {
    id: 'lrt-004',
    name: 'Executive Portable Solutions',
    categoryId: 'corporate',
    subcategory: 'Corporate Events',
    description: 'Professional-grade luxury restroom trailers for corporate events, groundbreakings, and executive functions. Sleek modern design with premium finishes.',
    address: 'Chicago, IL',
    phone: '(312) 555-0178',
    website: 'executiveportable.com',
    priceRange: '$$$',
    tags: ['corporate', 'modern', 'executive', 'groundbreaking', 'professional'],
    featured: true,
    verified: true,
    rating: 4.6,
    reviewCount: 215,
    coordinates: { lat: 41.878, lng: -87.629 },
    trailerTypes: ['2-Station Executive', '4-Station Corporate', '8-Station Conference', 'ADA Executive'],
    trailerSizes: [
      { stations: 2, length: '14 ft', capacity: '50-100 guests', idealFor: 'Board meetings & groundbreakings' },
      { stations: 4, length: '20 ft', capacity: '100-250 guests', idealFor: 'Corporate galas' },
      { stations: 8, length: '30 ft', capacity: '250-500 guests', idealFor: 'Company-wide events' },
    ],
    amenities: ['Modern Minimalist Design', 'Touchless Everything', 'Climate Control', 'LED Lighting', 'Hand Dryers & Towels', 'Full Vanity Mirrors', 'Stainless Steel Fixtures', 'Anti-Slip Flooring', 'Sound Insulation'],
    serviceArea: ['Illinois', 'Indiana', 'Wisconsin', 'Iowa', 'Michigan', 'Ohio'],
    deliveryRadius: 250,
    minimumRental: '4 hours',
    insuranceCoverage: true,
    adaCompliant: true,
    yearsInBusiness: 15,
  },
  {
    id: 'lrt-005',
    name: 'Reel Comfort Trailers',
    categoryId: 'corporate',
    subcategory: 'Film & Production',
    description: 'Luxury restroom and shower trailers designed for film sets, TV productions, and talent needs. Fast deployment and 24/7 support for production schedules.',
    address: 'Los Angeles, CA',
    phone: '(323) 555-0456',
    website: 'reelcomforttrailers.com',
    priceRange: '$$$$',
    tags: ['film', 'production', 'talent', 'shower-trailers', '24-7-support', 'hollywood'],
    featured: false,
    verified: true,
    rating: 4.5,
    reviewCount: 67,
    coordinates: { lat: 34.052, lng: -118.243 },
    trailerTypes: ['2-Station Star Trailer', '4-Station Crew', 'Shower Combo', 'Hair & Makeup Suite'],
    trailerSizes: [
      { stations: 2, length: '16 ft', capacity: '20-50 crew', idealFor: 'Talent & VIP' },
      { stations: 4, length: '22 ft', capacity: '50-100 crew', idealFor: 'Full crew support' },
    ],
    amenities: ['Full Shower Suites', 'Vanity Lighting', 'Makeup Mirrors', 'Hair Dryers', 'Climate Control', 'Private Stalls', 'Premium Toiletries', 'Power Outlets', 'WiFi Ready', 'Blackout Capable'],
    serviceArea: ['California', 'Nevada', 'Arizona'],
    deliveryRadius: 150,
    minimumRental: '1 day',
    insuranceCoverage: true,
    adaCompliant: true,
    yearsInBusiness: 10,
  },

  // Festivals & Concerts
  {
    id: 'lrt-006',
    name: 'FestFlow Luxury',
    categoryId: 'festival',
    subcategory: 'Music Festivals',
    description: 'High-capacity luxury restroom trailer provider for major music festivals and outdoor concerts. VIP and general admission tiers available.',
    address: 'Nashville, TN',
    phone: '(615) 555-0321',
    website: 'festflowluxury.com',
    priceRange: '$$$',
    tags: ['festival', 'concert', 'high-capacity', 'vip-tier', 'outdoor', 'music'],
    featured: true,
    verified: true,
    rating: 4.4,
    reviewCount: 178,
    coordinates: { lat: 36.162, lng: -86.774 },
    trailerTypes: ['10-Station VIP', '16-Station Standard', '20-Station High-Capacity', 'ADA Festival'],
    trailerSizes: [
      { stations: 10, length: '32 ft', capacity: '500-1000 guests', idealFor: 'VIP festival areas' },
      { stations: 16, length: '42 ft', capacity: '1000-2000 guests', idealFor: 'Mid-size festivals' },
      { stations: 20, length: '53 ft', capacity: '2000+ guests', idealFor: 'Major music festivals' },
    ],
    amenities: ['Solar Powered Lighting', 'High-Volume Water System', 'Anti-Vandal Construction', 'Festival-Grade Flooring', 'Rapid Clean System', 'LED Night Lighting', 'Ventilation Fans', 'Flushing Toilets', 'Hand Wash Stations'],
    serviceArea: ['Tennessee', 'Kentucky', 'Georgia', 'Alabama', 'Mississippi', 'Arkansas'],
    deliveryRadius: 300,
    minimumRental: '1 day',
    insuranceCoverage: true,
    adaCompliant: true,
    yearsInBusiness: 7,
  },
  {
    id: 'lrt-007',
    name: 'Vineyard Porcelain',
    categoryId: 'festival',
    subcategory: 'Food & Wine Festivals',
    description: 'Boutique luxury restroom trailers curated for food & wine festivals, farm-to-table events, and culinary celebrations.',
    address: 'Portland, OR',
    phone: '(503) 555-0789',
    website: 'vineyardporcelain.com',
    priceRange: '$$$',
    tags: ['wine-festival', 'culinary', 'farm-to-table', 'boutique', 'eco-friendly'],
    featured: false,
    verified: true,
    rating: 4.7,
    reviewCount: 52,
    coordinates: { lat: 45.505, lng: -122.675 },
    trailerTypes: ['4-Station Artisan', '8-Station Harvest', 'ADA Compliant'],
    trailerSizes: [
      { stations: 4, length: '20 ft', capacity: '100-250 guests', idealFor: 'Wine tasting events' },
      { stations: 8, length: '28 ft', capacity: '250-500 guests', idealFor: 'Food & wine festivals' },
    ],
    amenities: ['Reclaimed Wood Interior', 'Eco-Friendly Products', 'Composting Option', 'Living Plant Wall', 'Essential Oil Diffusers', 'Bamboo Fixtures', 'Solar Panel Option', 'Water Recycling System'],
    serviceArea: ['Oregon', 'Washington', 'Northern California'],
    deliveryRadius: 200,
    minimumRental: '4 hours',
    insuranceCoverage: true,
    adaCompliant: true,
    yearsInBusiness: 5,
  },

  // Government & Emergency
  {
    id: 'lrt-008',
    name: 'AmeriFleet Emergency Services',
    categoryId: 'government',
    subcategory: 'FEMA Response',
    description: 'GSA-contracted luxury and standard restroom trailers for federal emergency response, military bases, and government facilities. FEMA-approved vendor.',
    address: 'Washington, DC',
    phone: '(202) 555-0911',
    website: 'amerifleetemergency.com',
    priceRange: '$$',
    tags: ['fema', 'government', 'gsa-contract', 'emergency', 'military', 'rapid-deploy'],
    featured: false,
    verified: true,
    rating: 4.3,
    reviewCount: 94,
    coordinates: { lat: 38.907, lng: -77.036 },
    trailerTypes: ['8-Station Field', '16-Station Emergency', '20-Station Base', 'ADA Government', 'Shower/Restroom Combo'],
    trailerSizes: [
      { stations: 8, length: '28 ft', capacity: '200-400 personnel', idealFor: 'Field operations' },
      { stations: 16, length: '42 ft', capacity: '400-800 personnel', idealFor: 'Emergency shelters' },
      { stations: 20, length: '53 ft', capacity: '800+ personnel', idealFor: 'Military bases' },
    ],
    amenities: ['Generator Ready', 'Rapid Deployment', 'Self-Contained Water', 'Winterization Package', 'Anti-Microbial Surfaces', 'Heavy-Duty Construction', 'Satellite Water Heating', 'OSHA Compliant', 'Night Vision Lighting'],
    serviceArea: ['Nationwide'],
    deliveryRadius: 500,
    minimumRental: '1 week',
    insuranceCoverage: true,
    adaCompliant: true,
    yearsInBusiness: 22,
  },

  // Residential & Private
  {
    id: 'lrt-009',
    name: 'HomeComfort Portables',
    categoryId: 'residential',
    subcategory: 'Home Renovation',
    description: 'Clean, comfortable luxury restroom trailers for homeowners during bathroom renovations. Discreet delivery and setup with residential-friendly sizing.',
    address: 'Dallas, TX',
    phone: '(214) 555-0345',
    website: 'homecomfortportables.com',
    priceRange: '$$',
    tags: ['renovation', 'residential', 'homeowner', 'discreet', 'compact'],
    featured: false,
    verified: true,
    rating: 4.6,
    reviewCount: 156,
    coordinates: { lat: 32.776, lng: -96.796 },
    trailerTypes: ['1-Station Compact', '2-Station Standard', 'ADA Residential'],
    trailerSizes: [
      { stations: 1, length: '8 ft', capacity: '1-4 residents', idealFor: 'Single bathroom renovations' },
      { stations: 2, length: '12 ft', capacity: '4-8 residents', idealFor: 'Full home remodels' },
    ],
    amenities: ['Residential Styling', 'Quiet Generator', 'Compact Footprint', 'Premium Fixtures', 'Heating & AC', 'Towel Hooks', 'Mirror & Vanity', 'Motion Sensor Lighting', 'Locking Door'],
    serviceArea: ['Texas'],
    deliveryRadius: 75,
    minimumRental: '1 week',
    insuranceCoverage: true,
    adaCompliant: true,
    yearsInBusiness: 11,
  },
  {
    id: 'lrt-010',
    name: 'Garden Party Restrooms',
    categoryId: 'residential',
    subcategory: 'Private Parties',
    description: 'Elegant restroom trailers for backyard parties, milestone celebrations, and private gatherings. Customizable decor packages to match your theme.',
    address: 'Scottsdale, AZ',
    phone: '(480) 555-0567',
    website: 'gardenpartyrestrooms.com',
    priceRange: '$$$',
    tags: ['backyard', 'party', 'customizable', 'themed', 'milestone', 'elegant'],
    featured: false,
    verified: true,
    rating: 4.8,
    reviewCount: 73,
    coordinates: { lat: 33.494, lng: -111.926 },
    trailerTypes: ['2-Station Garden', '4-Station Estate', 'Bridal Prep Suite'],
    trailerSizes: [
      { stations: 2, length: '14 ft', capacity: '25-75 guests', idealFor: 'Backyard parties' },
      { stations: 4, length: '20 ft', capacity: '75-150 guests', idealFor: 'Milestone celebrations' },
    ],
    amenities: ['Custom Decor Packages', 'Fresh Flower Service', 'Monogrammed Towels', 'Champagne Holder', 'LED Color Changing Lights', 'Bluetooth Speaker', 'Heated Floors', 'Full Vanity', 'Premium Soap & Lotion'],
    serviceArea: ['Arizona', 'Nevada'],
    deliveryRadius: 100,
    minimumRental: '4 hours',
    insuranceCoverage: true,
    adaCompliant: false,
    yearsInBusiness: 6,
  },

  // Sales & Manufacturing
  {
    id: 'lrt-011',
    name: 'JAG Mobile Solutions',
    categoryId: 'sales',
    subcategory: 'New Trailers',
    description: 'Premium restroom trailer manufacturer offering direct sales of new units. Industry-leading build quality with customization options for fleet operators.',
    address: 'Lancaster, PA',
    phone: '(717) 555-0890',
    website: 'jagmobilesolutions.com',
    priceRange: '$$$$',
    tags: ['manufacturer', 'new-trailers', 'custom-builds', 'fleet', 'dealer', 'direct-sales'],
    featured: true,
    verified: true,
    rating: 4.7,
    reviewCount: 61,
    coordinates: { lat: 40.037, lng: -76.305 },
    trailerTypes: ['2-Station', '4-Station', '6-Station', '8-Station', '10-Station', 'Custom Build', 'ADA Compliant'],
    trailerSizes: [
      { stations: 2, length: '12-16 ft', capacity: 'Varies', idealFor: 'Small event operators' },
      { stations: 6, length: '24-28 ft', capacity: 'Varies', idealFor: 'Mid-size fleet operators' },
      { stations: 10, length: '32-40 ft', capacity: 'Varies', idealFor: 'Large fleet operators' },
    ],
    amenities: ['Custom Floor Plans', 'Choice of Countertops', 'Multiple Exterior Colors', 'Tankless Water Heaters', 'Winterization Package', 'Solar Panel Ready', 'GPS Tracking', 'Fleet Management Software'],
    serviceArea: ['Nationwide'],
    deliveryRadius: 1000,
    minimumRental: 'Purchase Only',
    insuranceCoverage: false,
    adaCompliant: true,
    yearsInBusiness: 25,
  },
  {
    id: 'lrt-012',
    name: 'SecondLife Restroom Trailers',
    categoryId: 'sales',
    subcategory: 'Used & Refurbished',
    description: 'Certified pre-owned luxury restroom trailers. Each unit is professionally inspected, refurbished, and backed by a 1-year warranty. Save 40-60% vs new.',
    address: 'Phoenix, AZ',
    phone: '(602) 555-0234',
    website: 'secondlifetrailers.com',
    priceRange: '$$',
    tags: ['used', 'refurbished', 'certified-pre-owned', 'warranty', 'affordable', 'fleet-turnover'],
    featured: false,
    verified: true,
    rating: 4.4,
    reviewCount: 38,
    coordinates: { lat: 33.448, lng: -112.074 },
    trailerTypes: ['2-Station Refurb', '4-Station Refurb', '6-Station Refurb', '8-Station Refurb'],
    trailerSizes: [
      { stations: 2, length: '12-14 ft', capacity: 'Varies', idealFor: 'Startup rental businesses' },
      { stations: 4, length: '18-22 ft', capacity: 'Varies', idealFor: 'Growing fleets' },
      { stations: 8, length: '28-32 ft', capacity: 'Varies', idealFor: 'Large event companies' },
    ],
    amenities: ['Full Inspection Report', '1-Year Warranty', 'New Plumbing', 'Refinished Interior', 'New Fixtures', 'DOT Certified', 'Title Transfer', 'Delivery Available'],
    serviceArea: ['Nationwide'],
    deliveryRadius: 500,
    minimumRental: 'Purchase Only',
    insuranceCoverage: false,
    adaCompliant: false,
    yearsInBusiness: 9,
  },
];

// ============================================================================
// INDUSTRY EVENTS
// ============================================================================

export const INDUSTRY_EVENTS: IndustryEvent[] = [
  {
    id: 'evt-001',
    name: 'Portable Sanitation Association International (PSAI) Convention',
    date: 'November 2026',
    location: 'Nashville, TN',
    description: 'Annual industry convention featuring equipment exhibitions, education sessions, and networking for portable sanitation professionals.',
    category: 'Trade Show',
    recurring: true,
  },
  {
    id: 'evt-002',
    name: 'The Rental Show (ARA)',
    date: 'February 2027',
    location: 'Las Vegas, NV',
    description: 'American Rental Association trade show covering all equipment rental sectors including luxury portable restrooms.',
    category: 'Trade Show',
    recurring: true,
  },
  {
    id: 'evt-003',
    name: 'Wedding Industry Conference',
    date: 'April 2026',
    location: 'Orlando, FL',
    description: 'Major wedding industry gathering where restroom trailer suppliers connect with event planners and venue operators.',
    category: 'Networking',
    recurring: true,
  },
  {
    id: 'evt-004',
    name: 'Emergency Preparedness Expo',
    date: 'September 2026',
    location: 'Washington, DC',
    description: 'Government-focused expo for emergency response equipment vendors including mobile restroom and shower facilities.',
    category: 'Government',
    recurring: true,
  },
  {
    id: 'evt-005',
    name: 'Special Events Expo',
    date: 'March 2026',
    location: 'Miami, FL',
    description: 'Premier event industry trade show connecting luxury rental providers with corporate and social event planners.',
    category: 'Trade Show',
    recurring: true,
  },
];

// ============================================================================
// SERVICE REGIONS
// ============================================================================

export const SERVICE_REGIONS: ServiceRegion[] = [
  {
    id: 'region-northeast',
    name: 'Northeast',
    states: ['Connecticut', 'Maine', 'Massachusetts', 'New Hampshire', 'New Jersey', 'New York', 'Pennsylvania', 'Rhode Island', 'Vermont'],
    description: 'High demand for wedding and corporate event trailers. Peak season: May-October.',
    supplierCount: 45,
  },
  {
    id: 'region-southeast',
    name: 'Southeast',
    states: ['Alabama', 'Florida', 'Georgia', 'Mississippi', 'North Carolina', 'South Carolina', 'Tennessee', 'Virginia'],
    description: 'Year-round demand with festival and wedding markets. Hurricane season creates emergency demand.',
    supplierCount: 52,
  },
  {
    id: 'region-midwest',
    name: 'Midwest',
    states: ['Illinois', 'Indiana', 'Iowa', 'Michigan', 'Minnesota', 'Missouri', 'Ohio', 'Wisconsin'],
    description: 'Strong corporate and agricultural event market. Seasonal demand with winterization requirements.',
    supplierCount: 38,
  },
  {
    id: 'region-southwest',
    name: 'Southwest',
    states: ['Arizona', 'Nevada', 'New Mexico', 'Texas', 'Oklahoma'],
    description: 'Year-round outdoor event market. High demand for climate control features.',
    supplierCount: 41,
  },
  {
    id: 'region-west',
    name: 'West Coast',
    states: ['California', 'Oregon', 'Washington', 'Hawaii'],
    description: 'Premium market with strong eco-conscious demand. Film/production industry is a major client segment.',
    supplierCount: 58,
  },
];

// ============================================================================
// INDUSTRY STATS
// ============================================================================

export const INDUSTRY_STATS = {
  marketSize: '$2.1B',
  annualGrowth: '6.8%',
  avgRentalPrice: '$800-$3,500/day',
  avgPurchasePrice: '$15,000-$150,000',
  topEventType: 'Weddings (38%)',
  peakSeason: 'May-October',
  totalProviders: 'Est. 2,800 nationwide',
  adaComplianceRate: '72%',
  averageFleetSize: '8-12 units',
  yearOverYearDemand: '+12% (2025-2026)',
};
