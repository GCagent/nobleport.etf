// ── Contact details ──
// Replace these with real values before going live
export const PHONE_NUMBER = '(978) 000-0000'
export const SMS_LINK = 'sms:+19780000000'
export const INSTAGRAM_URL = 'https://instagram.com/nobleportconstruction'
export const FORM_URL = '/quote'

// ── North Shore service area towns ──
export const SERVICE_AREA_TOWNS = [
  'Newburyport',
  'Newbury',
  'Amesbury',
  'Salisbury',
  'West Newbury',
  'Georgetown',
  'Rowley',
  'Ipswich',
  'Essex',
  'Gloucester',
  'Rockport',
  'Manchester-by-the-Sea',
  'Beverly',
  'Salem',
  'Marblehead',
  'Swampscott',
  'Lynn',
  'Nahant',
  'Peabody',
  'Danvers',
  'Wenham',
  'Hamilton',
  'Topsfield',
  'Middleton',
  'Boxford',
  'Groveland',
  'Merrimac',
] as const

// ── Lead scoring ──
export const BUDGET_SCORES: Record<string, number> = {
  '$50K+': 3,
  '$25K–$50K': 2,
  '$15K–$25K': 1,
  'Not sure yet': 0,
}

export const TIMELINE_SCORES: Record<string, number> = {
  'Less than 30 days': 3,
  '1–3 months': 2,
  '3–6 months': 1,
  'Planning stage': 0,
}

export const PROJECT_TYPE_SCORES: Record<string, number> = {
  Addition: 2,
  Kitchen: 2,
  Bath: 2,
  Deck: 1,
  'Exterior / Roofing': 1,
  'Windows / Doors': 1,
  Renovation: 1,
  Other: 0,
}
