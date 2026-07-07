export const NOBLEPORT_IDENTITY = {
  ens: 'nobleport.eth',
  address: '0xc59e66BB2b6E19699F82A72a1569821cb1711504',
  did: 'did:ens:nobleport.eth',
} as const;

export const NBPT_FUND_IDENTITY = {
  ens: 'etf.nobleport.eth',
  treasury: NOBLEPORT_IDENTITY.address,
  did: 'did:ens:etf.nobleport.eth',
} as const;

export const MODULE_IDENTITIES = {
  portfolio:   { ens: 'portfolio.nobleport.eth',   did: 'did:ens:portfolio.nobleport.eth' },
  operations:  { ens: 'operations.nobleport.eth',  did: 'did:ens:operations.nobleport.eth' },
  compliance:  { ens: 'compliance.nobleport.eth',  did: 'did:ens:compliance.nobleport.eth' },
  governance:  { ens: 'governance.nobleport.eth',  did: 'did:ens:governance.nobleport.eth' },
  investors:   { ens: 'investors.nobleport.eth',   did: 'did:ens:investors.nobleport.eth' },
  ap:          { ens: 'ap.nobleport.eth',          did: 'did:ens:ap.nobleport.eth' },
  holdings:    { ens: 'holdings.nobleport.eth',    did: 'did:ens:holdings.nobleport.eth' },
  oracle:      { ens: 'oracle.nobleport.eth',      did: 'did:ens:oracle.nobleport.eth' },
  custodian:   { ens: 'custodian.nobleport.eth',   did: 'did:ens:custodian.nobleport.eth' },
  bookkeeper:  { ens: 'bookkeeper.nobleport.eth',  did: 'did:ens:bookkeeper.nobleport.eth' },
  cpa:         { ens: 'cpa.nobleport.eth',         did: 'did:ens:cpa.nobleport.eth' },
  identity:    { ens: 'identity.nobleport.eth',    did: 'did:ens:identity.nobleport.eth' },
  stephanie:   { ens: 'stephanie.nobleport.eth',   did: 'did:ens:stephanie.nobleport.eth' },
} as const;
