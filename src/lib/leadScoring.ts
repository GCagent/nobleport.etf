import {
  BUDGET_SCORES,
  TIMELINE_SCORES,
  PROJECT_TYPE_SCORES,
  SERVICE_AREA_TOWNS,
} from './constants'

export type LeadPriority = 'hot' | 'warm' | 'low'

export interface LeadScore {
  total: number
  priority: LeadPriority
  breakdown: {
    budget: number
    timeline: number
    projectType: number
    town: number
  }
}

export function scoreLead(fields: {
  budget: string
  timeline: string
  projectType: string
  town: string
}): LeadScore {
  const budget = BUDGET_SCORES[fields.budget] ?? 0
  const timeline = TIMELINE_SCORES[fields.timeline] ?? 0
  const projectType = PROJECT_TYPE_SCORES[fields.projectType] ?? 0

  const normalizedTown = fields.town.trim().toLowerCase()
  const inServiceArea = SERVICE_AREA_TOWNS.some(
    (t) => t.toLowerCase() === normalizedTown
  )
  const town = inServiceArea ? 2 : 0

  const total = budget + timeline + projectType + town

  let priority: LeadPriority
  if (total >= 8) priority = 'hot'
  else if (total >= 5) priority = 'warm'
  else priority = 'low'

  return { total, priority, breakdown: { budget, timeline, projectType, town } }
}

/** Follow-up message based on lead priority */
export function getFollowUpMessage(priority: LeadPriority): string {
  switch (priority) {
    case 'hot':
      return 'Got your request. This looks like a strong fit. We'll reach out today.'
    case 'warm':
      return 'Thanks. We received your project details and will follow up within 24 hours.'
    case 'low':
      return 'Thanks for reaching out. We received your info and will review it shortly.'
  }
}
