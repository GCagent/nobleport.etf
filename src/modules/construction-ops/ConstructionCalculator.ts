/**
 * Module 29 — Construction Calculator
 * Estimation engine ($847K/mo revenue, $3.2M pipeline)
 */

export type ProjectType = 'GARAGE' | 'ADDITION' | 'GUT_RENO' | 'NEW_BUILD' | 'COMMERCIAL' | 'MIXED_USE';

export interface EstimateLineItem {
  category: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  laborPercent: number;
  materialPercent: number;
}

export interface ProjectEstimate {
  estimateId: string;
  projectType: ProjectType;
  squareFootage: number;
  location: { city: string; state: string; zipCode: string };
  lineItems: EstimateLineItem[];
  subtotal: number;
  overheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
  totalEstimate: number;
  costPerSqFt: number;
  estimatedDuration: { months: number; weeks: number };
  createdAt: number;
  validUntil: number;
}

export interface PipelineMetrics {
  monthlyRevenue: number;
  activePipeline: number;
  estimatesCreated: number;
  conversionRate: number;
  averageProjectSize: number;
}

// Regional cost multipliers based on RSMeans data
const REGIONAL_MULTIPLIERS: Record<string, number> = {
  'TX-Austin': 0.92,
  'FL-Miami': 1.05,
  'CO-Denver': 1.08,
  'MA-Boston': 1.25,
  'CA-SanFrancisco': 1.45,
  'NY-NewYork': 1.40,
};

// Base cost per sq ft by project type
const BASE_COSTS: Record<ProjectType, number> = {
  GARAGE: 85,
  ADDITION: 175,
  GUT_RENO: 225,
  NEW_BUILD: 285,
  COMMERCIAL: 350,
  MIXED_USE: 310,
};

export class ConstructionCalculator {
  private estimates = new Map<string, ProjectEstimate>();
  private estimateCounter = 0;
  private pipeline: PipelineMetrics = {
    monthlyRevenue: 847000,
    activePipeline: 3200000,
    estimatesCreated: 0,
    conversionRate: 0.34,
    averageProjectSize: 0,
  };

  async createEstimate(
    projectType: ProjectType,
    squareFootage: number,
    location: { city: string; state: string; zipCode: string },
    customItems?: Partial<EstimateLineItem>[]
  ): Promise<ProjectEstimate> {
    const estimateId = `est-${++this.estimateCounter}-${Date.now()}`;
    const regionKey = `${location.state}-${location.city}`;
    const multiplier = REGIONAL_MULTIPLIERS[regionKey] ?? 1.0;
    const baseCost = BASE_COSTS[projectType] * multiplier;

    // Generate line items
    const lineItems = this.generateLineItems(projectType, squareFootage, baseCost);

    // Add custom items
    if (customItems) {
      for (const item of customItems) {
        lineItems.push({
          category: item.category ?? 'Custom',
          description: item.description ?? 'Custom line item',
          unit: item.unit ?? 'LS',
          quantity: item.quantity ?? 1,
          unitCost: item.unitCost ?? 0,
          totalCost: (item.quantity ?? 1) * (item.unitCost ?? 0),
          laborPercent: item.laborPercent ?? 50,
          materialPercent: item.materialPercent ?? 50,
        });
      }
    }

    const subtotal = lineItems.reduce((s, li) => s + li.totalCost, 0);
    const overheadPercent = 15;
    const profitPercent = 10;
    const contingencyPercent = 8;

    const totalEstimate = subtotal * (1 + (overheadPercent + profitPercent + contingencyPercent) / 100);

    const estimate: ProjectEstimate = {
      estimateId,
      projectType,
      squareFootage,
      location,
      lineItems,
      subtotal,
      overheadPercent,
      profitPercent,
      contingencyPercent,
      totalEstimate: Math.round(totalEstimate),
      costPerSqFt: Math.round(totalEstimate / squareFootage),
      estimatedDuration: this.estimateDuration(projectType, squareFootage),
      createdAt: Date.now(),
      validUntil: Date.now() + 30 * 86400000, // 30 days
    };

    this.estimates.set(estimateId, estimate);
    this.pipeline.estimatesCreated++;
    this.updatePipelineMetrics(estimate);

    return estimate;
  }

  private generateLineItems(type: ProjectType, sqft: number, baseCost: number): EstimateLineItem[] {
    const breakdown: Array<{ category: string; description: string; pct: number; labor: number }> = [
      { category: 'Site Work', description: 'Excavation, grading, utilities', pct: 0.08, labor: 60 },
      { category: 'Foundation', description: 'Footings, slab, waterproofing', pct: 0.12, labor: 55 },
      { category: 'Framing', description: 'Structural framing and sheathing', pct: 0.15, labor: 50 },
      { category: 'Exterior', description: 'Siding, roofing, windows, doors', pct: 0.12, labor: 45 },
      { category: 'Plumbing', description: 'Rough and finish plumbing', pct: 0.10, labor: 60 },
      { category: 'Electrical', description: 'Rough and finish electrical', pct: 0.10, labor: 65 },
      { category: 'HVAC', description: 'Heating, ventilation, AC systems', pct: 0.08, labor: 55 },
      { category: 'Insulation', description: 'Wall, floor, attic insulation', pct: 0.04, labor: 40 },
      { category: 'Drywall', description: 'Hang, tape, texture, paint', pct: 0.07, labor: 70 },
      { category: 'Flooring', description: 'Hardwood, tile, carpet', pct: 0.06, labor: 50 },
      { category: 'Finishes', description: 'Trim, cabinets, countertops, fixtures', pct: 0.08, labor: 45 },
    ];

    return breakdown.map(({ category, description, pct, labor }) => {
      const totalCost = Math.round(baseCost * sqft * pct);
      return {
        category,
        description,
        unit: 'SF',
        quantity: sqft,
        unitCost: Math.round(baseCost * pct * 100) / 100,
        totalCost,
        laborPercent: labor,
        materialPercent: 100 - labor,
      };
    });
  }

  private estimateDuration(type: ProjectType, sqft: number): { months: number; weeks: number } {
    const baseDurations: Record<ProjectType, number> = {
      GARAGE: 8, ADDITION: 16, GUT_RENO: 20, NEW_BUILD: 32, COMMERCIAL: 48, MIXED_USE: 40,
    };
    const weeks = Math.ceil(baseDurations[type] * (sqft / 2000));
    return { months: Math.ceil(weeks / 4.33), weeks };
  }

  private updatePipelineMetrics(estimate: ProjectEstimate): void {
    const allEstimates = Array.from(this.estimates.values());
    this.pipeline.averageProjectSize =
      allEstimates.reduce((s, e) => s + e.totalEstimate, 0) / allEstimates.length;
  }

  getEstimate(estimateId: string): ProjectEstimate | undefined {
    return this.estimates.get(estimateId);
  }

  getPipelineMetrics(): PipelineMetrics {
    return { ...this.pipeline };
  }
}
