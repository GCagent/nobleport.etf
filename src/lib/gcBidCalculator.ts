/**
 * GC Bid Calculator — markup, sell price, and division analysis for v2 packages
 */

import type { GCBidPackageV2, CostRange, TradeDiv, MarkupModel } from "../data/gc-bid-package-v2";

export interface DivisionAnalysis {
  division: string;
  csiCode: string;
  costMidpoint: number;
  costPercentOfTotal: number;
  laborMidpoint: number;
  materialMidpoint: number;
  laborSplit: number;
  subScopeItemCount: number;
  criticalControlCount: number;
}

export interface SellPriceBreakdown {
  hardCostLow: number;
  hardCostHigh: number;
  hardCostMid: number;
  overhead: number;
  profit: number;
  contingency: number;
  sellPriceLow: number;
  sellPriceHigh: number;
  sellPriceMid: number;
  marginPercent: number;
}

export interface ScheduleAnalysis {
  totalWeeksLow: number;
  totalWeeksHigh: number;
  criticalPathPhases: string[];
  totalFloatDays: number;
  inspectionGateCount: number;
}

export interface V2Summary {
  projectName: string;
  location: string;
  squareFootage: CostRange;
  divisionAnalysis: DivisionAnalysis[];
  sellPrice: SellPriceBreakdown;
  scheduleAnalysis: ScheduleAnalysis;
  riskCount: { critical: number; high: number; medium: number };
}

function midpoint(range: CostRange): number {
  return Math.round((range.low + range.high) / 2);
}

function analyzeDivision(div: TradeDiv, totalMid: number): DivisionAnalysis {
  const costMid = midpoint(div.totalRange);
  return {
    division: div.division,
    csiCode: div.csiCode,
    costMidpoint: costMid,
    costPercentOfTotal: totalMid > 0 ? Math.round((costMid / totalMid) * 100) : 0,
    laborMidpoint: midpoint(div.laborRange),
    materialMidpoint: midpoint(div.materialRange),
    laborSplit: Math.round((midpoint(div.laborRange) / costMid) * 100),
    subScopeItemCount: div.subScope.items.length,
    criticalControlCount: div.controlPoints.filter((cp) => cp.critical).length,
  };
}

export function calculateSellPrice(hardCost: CostRange, markup: MarkupModel): SellPriceBreakdown {
  const mid = midpoint(hardCost);
  const overhead = Math.round(mid * (markup.overheadPercent / 100));
  const profit = Math.round(mid * (markup.profitPercent / 100));
  const contingency = Math.round(mid * (markup.contingencyPercent / 100));
  const totalMarkup = overhead + profit + contingency;

  const sellLow = Math.round(hardCost.low * (1 + (markup.overheadPercent + markup.profitPercent + markup.contingencyPercent) / 100));
  const sellHigh = Math.round(hardCost.high * (1 + (markup.overheadPercent + markup.profitPercent + markup.contingencyPercent) / 100));
  const sellMid = mid + totalMarkup;
  const marginPercent = Math.round((totalMarkup / sellMid) * 100);

  return {
    hardCostLow: hardCost.low,
    hardCostHigh: hardCost.high,
    hardCostMid: mid,
    overhead,
    profit,
    contingency,
    sellPriceLow: sellLow,
    sellPriceHigh: sellHigh,
    sellPriceMid: sellMid,
    marginPercent,
  };
}

export function analyzeSchedule(pkg: GCBidPackageV2): ScheduleAnalysis {
  const criticalPath = pkg.schedule.filter((p) => p.floatDays === 0).map((p) => p.phase);

  // Sum duration along critical path (sequential phases)
  let totalLow = 0;
  let totalHigh = 0;
  let totalFloat = 0;

  for (const phase of pkg.schedule) {
    totalLow += phase.durationWeeksLow;
    totalHigh += phase.durationWeeksHigh;
    totalFloat += phase.floatDays;
  }

  return {
    totalWeeksLow: totalLow,
    totalWeeksHigh: totalHigh,
    criticalPathPhases: criticalPath,
    totalFloatDays: totalFloat,
    inspectionGateCount: pkg.schedule.filter((p) => p.inspectionGate).length,
  };
}

export function summarizeV2(pkg: GCBidPackageV2): V2Summary {
  const totalMid = midpoint(pkg.hardCostRange);
  const divisionAnalysis = pkg.divisions.map((d) => analyzeDivision(d, totalMid));
  const sellPrice = calculateSellPrice(pkg.hardCostRange, pkg.markup);
  const scheduleAnalysis = analyzeSchedule(pkg);

  const riskCount = {
    critical: pkg.risks.filter((r) => r.impact === "critical").length,
    high: pkg.risks.filter((r) => r.impact === "high").length,
    medium: pkg.risks.filter((r) => r.impact === "medium").length,
  };

  return {
    projectName: pkg.projectName,
    location: pkg.location,
    squareFootage: pkg.squareFootage,
    divisionAnalysis,
    sellPrice,
    scheduleAnalysis,
    riskCount,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function formatRange(range: CostRange): string {
  return `${formatCurrency(range.low)} – ${formatCurrency(range.high)}`;
}

export function printV2Summary(pkg: GCBidPackageV2): string {
  const summary = summarizeV2(pkg);
  const sp = summary.sellPrice;
  const sched = summary.scheduleAnalysis;
  const lines: string[] = [];

  lines.push(`${"=".repeat(60)}`);
  lines.push(`  ${summary.projectName}`);
  lines.push(`  ${summary.location} | ${pkg.squareFootage.low}–${pkg.squareFootage.high} SF | ${pkg.stories} stories | ${pkg.spec} spec`);
  lines.push(`  Version ${pkg.version} — ${pkg.created}`);
  lines.push(`${"=".repeat(60)}`);
  lines.push("");

  // Sell price
  lines.push("--- PRICING ---");
  lines.push(`  Hard Cost:   ${formatRange(pkg.hardCostRange)}`);
  lines.push(`  Overhead:    ${pkg.markup.overheadPercent}% = ${formatCurrency(sp.overhead)}`);
  lines.push(`  Profit:      ${pkg.markup.profitPercent}% = ${formatCurrency(sp.profit)}`);
  lines.push(`  Contingency: ${pkg.markup.contingencyPercent}% = ${formatCurrency(sp.contingency)}`);
  lines.push(`  SELL PRICE:  ${formatCurrency(sp.sellPriceLow)} – ${formatCurrency(sp.sellPriceHigh)}`);
  lines.push(`  Margin:      ${sp.marginPercent}%`);
  lines.push("");

  // Divisions
  lines.push("--- DIVISIONS ---");
  for (const div of summary.divisionAnalysis) {
    lines.push(`  CSI ${div.csiCode} — ${div.division}`);
    lines.push(`    Cost: ${formatCurrency(div.costMidpoint)} (${div.costPercentOfTotal}%) | L/M: ${div.laborSplit}%/${100 - div.laborSplit}% | Scope items: ${div.subScopeItemCount} | Critical controls: ${div.criticalControlCount}`);
  }
  lines.push("");

  // Schedule
  lines.push("--- SCHEDULE ---");
  lines.push(`  Total: ${sched.totalWeeksLow}–${sched.totalWeeksHigh} weeks to rough inspection`);
  lines.push(`  Critical path: ${sched.criticalPathPhases.join(" → ")}`);
  lines.push(`  Float: ${sched.totalFloatDays} days total`);
  lines.push(`  Inspection gates: ${sched.inspectionGateCount}`);
  lines.push("");

  // Risks
  lines.push("--- RISKS ---");
  lines.push(`  Critical: ${summary.riskCount.critical} | High: ${summary.riskCount.high} | Medium: ${summary.riskCount.medium}`);
  for (const risk of pkg.risks) {
    const icon = risk.impact === "critical" ? "!!!" : risk.impact === "high" ? "!!" : "!";
    lines.push(`  [${icon}] ${risk.category}: ${risk.description}`);
    lines.push(`       Mitigation: ${risk.mitigation}`);
  }
  lines.push("");

  // Playbook
  lines.push("--- EXECUTION PLAYBOOK ---");
  for (const step of pkg.executionPlaybook) {
    lines.push(`  > ${step}`);
  }

  return lines.join("\n");
}
