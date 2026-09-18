/**
 * GC Baseline Package — Interactive construction estimate viewer
 * Displays phase-by-phase scope with labor/material splits
 */

import React from "react";
import { gcBaselinePackage } from "../data/gc-baseline-package";
import { summarizeProject, formatCurrency } from "../lib/gcEstimator";
import type { PhaseSummary, ProjectSummary } from "../lib/gcEstimator";

function PhaseRow({ phase }: { phase: PhaseSummary }) {
  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{phase.phaseName}</td>
      <td>{formatCurrency(phase.totalLabor)}</td>
      <td>{formatCurrency(phase.totalMaterial)}</td>
      <td style={{ fontWeight: 700 }}>{formatCurrency(phase.phaseTotal)}</td>
      <td>{phase.laborPercent}% / {phase.materialPercent}%</td>
    </tr>
  );
}

function RiskFlag({ flag }: { flag: string }) {
  return (
    <li style={{ marginBottom: "4px" }}>
      <span style={{ color: "#d97706", fontWeight: 600 }}>!</span> {flag}
    </li>
  );
}

export default function GCBaselinePackageView() {
  const summary: ProjectSummary = summarizeProject(gcBaselinePackage);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{summary.projectName}</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        {summary.location} | {gcBaselinePackage.buildType} | {summary.squareFootage} SF | {gcBaselinePackage.stories} stories
      </p>
      <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Version {gcBaselinePackage.version} — {gcBaselinePackage.created}</p>

      <h2 style={{ fontSize: "1.1rem", marginTop: "32px" }}>Phase Breakdown</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Phase</th>
            <th style={{ padding: "8px 4px" }}>Labor</th>
            <th style={{ padding: "8px 4px" }}>Material</th>
            <th style={{ padding: "8px 4px" }}>Total</th>
            <th style={{ padding: "8px 4px" }}>L/M Split</th>
          </tr>
        </thead>
        <tbody>
          {summary.phases.map((phase) => (
            <PhaseRow key={phase.phaseId} phase={phase} />
          ))}
          <tr style={{ borderTop: "2px solid #111827", fontWeight: 700 }}>
            <td style={{ padding: "8px 4px" }}>TOTALS</td>
            <td style={{ padding: "8px 4px" }}>{formatCurrency(summary.totalLabor)}</td>
            <td style={{ padding: "8px 4px" }}>{formatCurrency(summary.totalMaterial)}</td>
            <td style={{ padding: "8px 4px" }}>{formatCurrency(summary.totalCost)}</td>
            <td style={{ padding: "8px 4px" }}>{formatCurrency(summary.costPerSF)}/SF</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: "flex", gap: "24px", marginTop: "24px", flexWrap: "wrap" }}>
        <div style={{ background: "#f9fafb", padding: "16px", borderRadius: "8px", flex: 1, minWidth: "200px" }}>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Duration</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{summary.totalDuration} days</div>
        </div>
        <div style={{ background: "#f9fafb", padding: "16px", borderRadius: "8px", flex: 1, minWidth: "200px" }}>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Inspections</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{summary.inspectionCount}</div>
        </div>
        <div style={{ background: "#f9fafb", padding: "16px", borderRadius: "8px", flex: 1, minWidth: "200px" }}>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Cost / SF</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{formatCurrency(summary.costPerSF)}</div>
        </div>
      </div>

      {summary.riskFlags.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <h2 style={{ fontSize: "1.1rem" }}>Risk Flags</h2>
          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {summary.riskFlags.map((flag, i) => (
              <RiskFlag key={i} flag={flag} />
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: "32px", padding: "16px", background: "#fffbeb", borderRadius: "8px", border: "1px solid #fde68a" }}>
        <h3 style={{ fontSize: "1rem", margin: "0 0 8px 0" }}>v1.0 Baseline — What's Included</h3>
        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.85rem", color: "#92400e" }}>
          <li>Phase-by-phase scope (foundation through MEP rough)</li>
          <li>Labor vs material splits (realistic mid-range for MA)</li>
          <li>Structured breakdown for subs or lenders</li>
          <li>Risk identification flags</li>
        </ul>
      </div>
    </div>
  );
}
