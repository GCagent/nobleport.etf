/**
 * Module 35 — Schedule Prediction Engine
 * ML delay risk scoring (advisory only) with weather/supply chain inputs
 */

export interface ProjectSchedule {
  projectId: string;
  startDate: string;
  targetEndDate: string;
  milestones: ScheduleMilestone[];
  overallRiskScore: number;    // 0-100
  predictedEndDate: string;
  delayDays: number;
  riskFactors: RiskFactor[];
  lastUpdated: number;
}

export interface ScheduleMilestone {
  name: string;
  plannedStart: string;
  plannedEnd: string;
  predictedEnd: string;
  riskScore: number;          // 0-100
  actualStart: string | null;
  actualEnd: string | null;
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
}

export interface RiskFactor {
  category: 'WEATHER' | 'SUPPLY_CHAIN' | 'LABOR' | 'PERMITTING' | 'INSPECTION' | 'CHANGE_ORDER';
  description: string;
  impactDays: number;
  probability: number;        // 0-1
  weightedImpact: number;     // impactDays * probability
  source: string;
  dataTimestamp: number;
}

export interface WeatherForecast {
  date: string;
  condition: string;
  precipitationProbability: number;
  tempHigh: number;
  tempLow: number;
  windSpeed: number;
  workable: boolean;          // Can construction proceed?
}

export interface SupplyChainSignal {
  material: string;
  currentLeadTimeDays: number;
  baselineLeadTimeDays: number;
  priceChangePercent: number;
  availabilityScore: number;  // 0-1
  region: string;
  timestamp: number;
}

export class SchedulePredictionEngine {
  private schedules = new Map<string, ProjectSchedule>();

  async predictSchedule(
    projectId: string,
    milestones: ScheduleMilestone[],
    startDate: string,
    targetEndDate: string,
    location: { city: string; state: string }
  ): Promise<ProjectSchedule> {
    // Gather risk factors
    const weatherRisks = await this.assessWeatherRisk(location, startDate, targetEndDate);
    const supplyChainRisks = await this.assessSupplyChainRisk();
    const historicalRisks = this.assessHistoricalRisk(milestones);

    const allRisks = [...weatherRisks, ...supplyChainRisks, ...historicalRisks];
    const totalDelayDays = Math.round(allRisks.reduce((s, r) => s + r.weightedImpact, 0));

    // Adjust milestone predictions
    const adjustedMilestones = this.adjustMilestones(milestones, allRisks);

    // Calculate overall risk score
    const overallRiskScore = Math.min(100, Math.round(
      allRisks.reduce((s, r) => s + r.probability * 100, 0) / Math.max(allRisks.length, 1)
    ));

    // Predict end date
    const targetDate = new Date(targetEndDate);
    targetDate.setDate(targetDate.getDate() + totalDelayDays);
    const predictedEndDate = targetDate.toISOString().split('T')[0];

    const schedule: ProjectSchedule = {
      projectId,
      startDate,
      targetEndDate,
      milestones: adjustedMilestones,
      overallRiskScore,
      predictedEndDate,
      delayDays: totalDelayDays,
      riskFactors: allRisks,
      lastUpdated: Date.now(),
    };

    this.schedules.set(projectId, schedule);
    return schedule;
  }

  private async assessWeatherRisk(
    location: { city: string; state: string },
    startDate: string,
    endDate: string
  ): Promise<RiskFactor[]> {
    // Advisory: historical weather patterns for location
    const risks: RiskFactor[] = [];

    // Winter months increase delay risk
    const start = new Date(startDate);
    const end = new Date(endDate);
    const winterMonths = this.countWinterMonths(start, end, location.state);

    if (winterMonths > 0) {
      risks.push({
        category: 'WEATHER',
        description: `${winterMonths} winter month(s) in schedule — potential weather delays`,
        impactDays: winterMonths * 5,
        probability: 0.6,
        weightedImpact: winterMonths * 3,
        source: 'historical-weather-model',
        dataTimestamp: Date.now(),
      });
    }

    return risks;
  }

  private async assessSupplyChainRisk(): Promise<RiskFactor[]> {
    // Advisory: current supply chain conditions
    return [
      {
        category: 'SUPPLY_CHAIN',
        description: 'Lumber lead times elevated 15% above baseline',
        impactDays: 7,
        probability: 0.3,
        weightedImpact: 2.1,
        source: 'supply-chain-monitor',
        dataTimestamp: Date.now(),
      },
    ];
  }

  private assessHistoricalRisk(milestones: ScheduleMilestone[]): RiskFactor[] {
    const risks: RiskFactor[] = [];
    const inProgressCount = milestones.filter((m) => m.status === 'DELAYED').length;
    if (inProgressCount > 0) {
      risks.push({
        category: 'INSPECTION',
        description: `${inProgressCount} milestone(s) already delayed`,
        impactDays: inProgressCount * 3,
        probability: 0.8,
        weightedImpact: inProgressCount * 2.4,
        source: 'project-history',
        dataTimestamp: Date.now(),
      });
    }
    return risks;
  }

  private adjustMilestones(milestones: ScheduleMilestone[], risks: RiskFactor[]): ScheduleMilestone[] {
    const totalDelay = risks.reduce((s, r) => s + r.weightedImpact, 0);
    const delayPerMilestone = totalDelay / Math.max(milestones.length, 1);

    return milestones.map((m, i) => {
      const cumulativeDelay = Math.round(delayPerMilestone * (i + 1));
      const planned = new Date(m.plannedEnd);
      planned.setDate(planned.getDate() + cumulativeDelay);

      return {
        ...m,
        predictedEnd: planned.toISOString().split('T')[0],
        riskScore: Math.min(100, Math.round(cumulativeDelay * 5)),
      };
    });
  }

  private countWinterMonths(start: Date, end: Date, state: string): number {
    const winterMonthsSet = new Set([11, 0, 1, 2]); // Dec, Jan, Feb, Mar
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      if (winterMonthsSet.has(current.getMonth())) count++;
      current.setMonth(current.getMonth() + 1);
    }
    // Southern states have milder winters
    if (['TX', 'FL', 'AZ', 'CA'].includes(state)) count = Math.floor(count * 0.3);
    return count;
  }

  getSchedule(projectId: string): ProjectSchedule | undefined {
    return this.schedules.get(projectId);
  }
}
