/**
 * Module 40 — Property Dashboard
 * Portfolio view across Austin, Miami, Denver holdings with real-time yield
 */

export interface PortfolioHolding {
  propertyId: string;
  tokenId: number;
  address: string;
  city: string;
  state: string;
  appraisalValue: number;
  purchasePrice: number;
  monthlyRentalIncome: number;
  occupancyRate: number;       // 0-1
  capRate: number;             // %
  cashOnCashReturn: number;    // %
  appreciation: number;        // %
  shares: { total: number; sold: number; available: number };
  lastUpdated: number;
}

export interface PortfolioDashboardView {
  totalValue: number;
  totalMonthlyIncome: number;
  averageCapRate: number;
  averageOccupancy: number;
  totalAppreciation: number;
  holdings: PortfolioHolding[];
  byCity: Record<string, CityBreakdown>;
  recentTransactions: Transaction[];
  yieldTrend: YieldDataPoint[];
}

export interface CityBreakdown {
  city: string;
  propertyCount: number;
  totalValue: number;
  averageCapRate: number;
  totalMonthlyIncome: number;
}

export interface Transaction {
  type: 'SHARE_PURCHASE' | 'DISTRIBUTION' | 'APPRAISAL_UPDATE' | 'PROPERTY_ADDED';
  description: string;
  amount: number;
  timestamp: number;
}

export interface YieldDataPoint {
  month: string;
  grossYield: number;
  netYield: number;
  occupancy: number;
}

export class PropertyDashboard {
  private holdings = new Map<string, PortfolioHolding>();
  private transactions: Transaction[] = [];
  private yieldHistory: YieldDataPoint[] = [];

  async addHolding(holding: PortfolioHolding): Promise<void> {
    this.holdings.set(holding.propertyId, holding);
    this.transactions.push({
      type: 'PROPERTY_ADDED',
      description: `Added ${holding.address}, ${holding.city}`,
      amount: holding.appraisalValue,
      timestamp: Date.now(),
    });
  }

  async updateHolding(propertyId: string, updates: Partial<PortfolioHolding>): Promise<PortfolioHolding> {
    const holding = this.holdings.get(propertyId);
    if (!holding) throw new Error(`Holding ${propertyId} not found`);
    Object.assign(holding, updates, { lastUpdated: Date.now() });
    return holding;
  }

  async getDashboard(): Promise<PortfolioDashboardView> {
    const allHoldings = Array.from(this.holdings.values());

    const totalValue = allHoldings.reduce((s, h) => s + h.appraisalValue, 0);
    const totalMonthlyIncome = allHoldings.reduce((s, h) => s + h.monthlyRentalIncome * h.occupancyRate, 0);
    const averageCapRate = allHoldings.length > 0
      ? allHoldings.reduce((s, h) => s + h.capRate, 0) / allHoldings.length
      : 0;
    const averageOccupancy = allHoldings.length > 0
      ? allHoldings.reduce((s, h) => s + h.occupancyRate, 0) / allHoldings.length
      : 0;
    const totalAppreciation = allHoldings.length > 0
      ? allHoldings.reduce((s, h) => s + h.appreciation, 0) / allHoldings.length
      : 0;

    // City breakdown
    const byCity: Record<string, CityBreakdown> = {};
    for (const h of allHoldings) {
      if (!byCity[h.city]) {
        byCity[h.city] = { city: h.city, propertyCount: 0, totalValue: 0, averageCapRate: 0, totalMonthlyIncome: 0 };
      }
      byCity[h.city].propertyCount++;
      byCity[h.city].totalValue += h.appraisalValue;
      byCity[h.city].totalMonthlyIncome += h.monthlyRentalIncome * h.occupancyRate;
    }
    // Compute average cap rates per city
    for (const city of Object.keys(byCity)) {
      const cityHoldings = allHoldings.filter((h) => h.city === city);
      byCity[city].averageCapRate = cityHoldings.reduce((s, h) => s + h.capRate, 0) / cityHoldings.length;
    }

    return {
      totalValue,
      totalMonthlyIncome,
      averageCapRate,
      averageOccupancy,
      totalAppreciation,
      holdings: allHoldings,
      byCity,
      recentTransactions: this.transactions.slice(-20).reverse(),
      yieldTrend: this.yieldHistory.slice(-12),
    };
  }

  async recordYieldDataPoint(month: string, grossYield: number, netYield: number, occupancy: number): Promise<void> {
    this.yieldHistory.push({ month, grossYield, netYield, occupancy });
  }

  getHolding(propertyId: string): PortfolioHolding | undefined { return this.holdings.get(propertyId); }
}
