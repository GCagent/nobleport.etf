export enum Domain {
  Construction = 'construction',
  Permits = 'permits',
  DeFi = 'defi',
  Investment = 'investment',
  Compliance = 'compliance',
  General = 'general',
  Greeting = 'greeting',
}

export interface DomainConfig {
  domain: Domain;
  requiresHumanApproval: boolean;
  disclaimer?: string;
  keywords: string[];
}

export const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    domain: Domain.Greeting,
    requiresHumanApproval: false,
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'start', 'help'],
  },
  {
    domain: Domain.Construction,
    requiresHumanApproval: false,
    keywords: ['build', 'renovation', 'contractor', 'estimate', 'timeline', 'construction', 'roof', 'foundation', 'framing', 'electrical', 'plumbing', 'hvac', 'demolition'],
  },
  {
    domain: Domain.Permits,
    requiresHumanApproval: false,
    keywords: ['permit', 'zoning', 'inspection', 'code', 'building department', 'variance', 'setback', 'occupancy', 'certificate', 'application'],
  },
  {
    domain: Domain.DeFi,
    requiresHumanApproval: false,
    disclaimer: 'This information is for educational purposes only and does not constitute financial advice. Consult a licensed financial advisor before making investment decisions.',
    keywords: ['defi', 'token', 'blockchain', 'yield', 'staking', 'liquidity', 'smart contract', 'wallet', 'nobleport token', 'nbpt', 'eth'],
  },
  {
    domain: Domain.Investment,
    requiresHumanApproval: true,
    disclaimer: 'Investment recommendations require human approval from a licensed advisor before being acted upon.',
    keywords: ['invest', 'return', 'portfolio', 'dividend', 'equity', 'fund', 'allocation', 'risk', 'capital'],
  },
  {
    domain: Domain.Compliance,
    requiresHumanApproval: true,
    disclaimer: 'Compliance-related guidance requires review and approval by our compliance team.',
    keywords: ['compliance', 'regulation', 'legal', 'sec', 'accredited', 'disclosure', 'kyc', 'aml', 'fiduciary'],
  },
  {
    domain: Domain.General,
    requiresHumanApproval: false,
    keywords: [],
  },
];

export function classifyDomain(text: string): DomainConfig {
  const lower = text.toLowerCase();

  // Greeting check first (short utterances)
  if (lower.length < 30) {
    const greetingConfig = DOMAIN_CONFIGS.find(d => d.domain === Domain.Greeting)!;
    if (greetingConfig.keywords.some(k => lower.includes(k))) {
      return greetingConfig;
    }
  }

  // Score each domain by keyword matches
  let best: DomainConfig = DOMAIN_CONFIGS.find(d => d.domain === Domain.General)!;
  let bestScore = 0;

  for (const config of DOMAIN_CONFIGS) {
    if (config.domain === Domain.General || config.domain === Domain.Greeting) continue;
    const score = config.keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = config;
    }
  }

  return best;
}
