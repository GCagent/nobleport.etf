/**
 * GC Estimator — cost calculation utilities for baseline construction packages
 */

import type { Phase, LineItem, GCBaselinePackage } from "../data/gc-baseline-package";

export interface PhaseSummary {
  phaseId: string;
  phaseName: string;
  totalLabor: number;
  totalMaterial: number;
  phaseTotal: number;
  laborPercent: number;
  materialPercent: number;
}

export interface ProjectSummary {
  projectName: string;
  location: string;
  squareFootage: number;
  totalLabor: number;
  totalMaterial: number;
  totalCost: number;
  costPerSF: number;
  totalDuration: number;
  inspectionCount: number;
  phases: PhaseSummary[];
  riskFlags: string[];
}

function sumLineItems(items: LineItem[]): { labor: number; material: number } {
  return items.reduce(
    (acc, item) => ({
      labor: acc.labor + item.labor,
      material: acc.material + item.material,
    }),
    { labor: 0, material: 0 }
  );
}

export function summarizePhase(phase: Phase): PhaseSummary {
  const { labor, material } = sumLineItems(phase.lineItems);
  const total = labor + material;
  return {
    phaseId: phase.id,
    phaseName: phase.name,
    totalLabor: labor,
    totalMaterial: material,
    phaseTotal: total,
    laborPercent: total > 0 ? Math.round((labor / total) * 100) : 0,
    materialPercent: total > 0 ? Math.round((material / total) * 100) : 0,
  };
}

export function summarizeProject(pkg: GCBaselinePackage): ProjectSummary {
  const phases = pkg.phases.map(summarizePhase);
  const totalLabor = phases.reduce((s, p) => s + p.totalLabor, 0);
  const totalMaterial = phases.reduce((s, p) => s + p.totalMaterial, 0);
  const totalCost = totalLabor + totalMaterial;
  const totalDuration = pkg.phases.reduce((s, p) => s + p.durationDays, 0);
  const inspectionCount = pkg.phases.filter((p) => p.phaseId && pkg.phases.find((ph) => ph.id === p.phaseId)?.inspectionRequired).length;

  const riskFlags = identifyRisks(phases, pkg);

  return {
    projectName: pkg.projectName,
    location: pkg.location,
    squareFootage: pkg.squareFootage,
    totalLabor,
    totalMaterial,
    totalCost,
    costPerSF: Math.round((totalCost / pkg.squareFootage) * 100) / 100,
    totalDuration,
    inspectionCount: pkg.phases.filter((p) => p.inspectionRequired).length,
    phases,
    riskFlags,
  };
}

function identifyRisks(phases: PhaseSummary[], pkg: GCBaselinePackage): string[] {
  const flags: string[] = [];

  // Framing + foundation = ~70% of structural risk
  const foundation = phases.find((p) => p.phaseName.includes("Foundation"));
  const framing = phases.find((p) => p.phaseName.includes("Framing"));
  const totalCost = phases.reduce((s, p) => s + p.phaseTotal, 0);

  if (foundation && framing) {
    const structuralPct = Math.round(((foundation.phaseTotal + framing.phaseTotal) / totalCost) * 100);
    if (structuralPct > 50) {
      flags.push(`Structural phases (foundation + framing) = ${structuralPct}% of cost — lock subs early`);
    }
  }

  // Windows + roof = schedule unlock
  const roof = phases.find((p) => p.phaseName.includes("Roof"));
  const windows = phases.find((p) => p.phaseName.includes("Window"));
  if (roof && windows) {
    flags.push("Roofing + windows on critical path — delays here cascade to MEP rough-in");
  }

  // Electrical/plumbing coordination
  const electrical = phases.find((p) => p.phaseName.includes("Electrical"));
  const plumbing = phases.find((p) => p.phaseName.includes("Plumbing"));
  if (electrical && plumbing) {
    flags.push("Electrical/plumbing coordination risk — schedule joint walk-through before rough inspection");
  }

  return flags;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function printProjectSummary(pkg: GCBaselinePackage): string {
  const summary = summarizeProject(pkg);
  const lines: string[] = [];

  lines.push(`=== ${summary.projectName} ===`);
  lines.push(`Location: ${summary.location}`);
  lines.push(`Build: ${pkg.buildType} | ${summary.squareFootage} SF | ${pkg.stories} stories`);
  lines.push(`Version: ${pkg.version}`);
  lines.push("");
  lines.push("--- Phase Breakdown ---");

  for (const phase of summary.phases) {
    lines.push(`  ${phase.phaseName}`);
    lines.push(`    Labor: ${formatCurrency(phase.totalLabor)} (${phase.laborPercent}%) | Material: ${formatCurrency(phase.totalMaterial)} (${phase.materialPercent}%) | Total: ${formatCurrency(phase.phaseTotal)}`);
  }

  lines.push("");
  lines.push("--- Project Totals ---");
  lines.push(`  Total Labor:    ${formatCurrency(summary.totalLabor)}`);
  lines.push(`  Total Material: ${formatCurrency(summary.totalMaterial)}`);
  lines.push(`  Total Cost:     ${formatCurrency(summary.totalCost)}`);
  lines.push(`  Cost/SF:        ${formatCurrency(summary.costPerSF)}`);
  lines.push(`  Duration:       ${summary.totalDuration} days`);
  lines.push(`  Inspections:    ${summary.inspectionCount}`);

  if (summary.riskFlags.length > 0) {
    lines.push("");
    lines.push("--- Risk Flags ---");
    for (const flag of summary.riskFlags) {
      lines.push(`  ⚠ ${flag}`);
    }
  }

  return lines.join("\n");
}
