/**
 * GC Bid Package v2 — Full interactive bid viewer
 * Trade scopes, markup/sell price, schedule, risk register, execution playbook
 */

import React, { useState } from "react";
import { gcBidPackageV2 } from "../data/gc-bid-package-v2";
import type { TradeDiv, RiskItem, SchedulePhase } from "../data/gc-bid-package-v2";
import { summarizeV2, formatCurrency, formatRange } from "../lib/gcBidCalculator";
import type { DivisionAnalysis, SellPriceBreakdown, ScheduleAnalysis } from "../lib/gcBidCalculator";

// ─── Styles ─────────────────────────────────────────────────────────────────

const card = { background: "#f9fafb", padding: "16px", borderRadius: "8px", marginBottom: "12px" };
const sectionTitle = { fontSize: "1.1rem", fontWeight: 700 as const, marginTop: "32px", marginBottom: "12px" };
const badge = (color: string) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "4px",
  fontSize: "0.75rem",
  fontWeight: 600 as const,
  color: "#fff",
  background: color,
  marginRight: "6px",
});

// ─── Sub-components ─────────────────────────────────────────────────────────

function PricingCard({ sp }: { sp: SellPriceBreakdown }) {
  return (
    <div style={{ ...card, border: "2px solid #10b981" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Sell Price Breakdown</h3>
      <table style={{ width: "100%", fontSize: "0.85rem" }}>
        <tbody>
          <tr><td>Hard Cost</td><td style={{ textAlign: "right" }}>{formatCurrency(sp.hardCostLow)} – {formatCurrency(sp.hardCostHigh)}</td></tr>
          <tr><td>Overhead (15%)</td><td style={{ textAlign: "right" }}>{formatCurrency(sp.overhead)}</td></tr>
          <tr><td>Profit (10%)</td><td style={{ textAlign: "right" }}>{formatCurrency(sp.profit)}</td></tr>
          <tr><td>Contingency (5%)</td><td style={{ textAlign: "right" }}>{formatCurrency(sp.contingency)}</td></tr>
          <tr style={{ borderTop: "2px solid #111", fontWeight: 700 }}>
            <td style={{ paddingTop: "8px" }}>SELL PRICE</td>
            <td style={{ textAlign: "right", paddingTop: "8px" }}>{formatCurrency(sp.sellPriceLow)} – {formatCurrency(sp.sellPriceHigh)}</td>
          </tr>
          <tr><td>Effective Margin</td><td style={{ textAlign: "right" }}>{sp.marginPercent}%</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function DivisionCard({ div, analysis }: { div: TradeDiv; analysis: DivisionAnalysis }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ ...card, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={badge("#374151")}>CSI {div.csiCode}</span>
          <strong>{div.division}</strong>
        </div>
        <div style={{ textAlign: "right", fontSize: "0.9rem" }}>
          <strong>{formatRange(div.totalRange)}</strong>
          <span style={{ color: "#6b7280", marginLeft: "8px" }}>({analysis.costPercentOfTotal}%)</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: "12px", fontSize: "0.85rem" }}>
          <div style={{ display: "flex", gap: "24px", marginBottom: "12px" }}>
            <div>Labor: {formatRange(div.laborRange)} ({analysis.laborSplit}%)</div>
            <div>Material: {formatRange(div.materialRange)} ({100 - analysis.laborSplit}%)</div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <strong>Sub Scope — {div.subScope.description}</strong>
            <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>
              {div.subScope.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <strong>Control Points</strong>
            <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>
              {div.controlPoints.map((cp, i) => (
                <li key={i} style={{ color: cp.critical ? "#dc2626" : "#374151" }}>
                  {cp.critical && <span style={badge("#dc2626")}>CRITICAL</span>}
                  {cp.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleRow({ phase }: { phase: SchedulePhase }) {
  const barWidth = `${(phase.durationWeeksHigh / 5) * 100}%`;
  return (
    <tr>
      <td style={{ padding: "6px 4px", fontWeight: 600 }}>{phase.phase}</td>
      <td style={{ padding: "6px 4px" }}>{phase.durationWeeksLow}–{phase.durationWeeksHigh} wks</td>
      <td style={{ padding: "6px 4px" }}>
        <div style={{ background: "#e5e7eb", borderRadius: "4px", height: "16px", width: "100%" }}>
          <div style={{
            background: phase.floatDays === 0 ? "#dc2626" : "#3b82f6",
            borderRadius: "4px",
            height: "16px",
            width: barWidth,
          }} />
        </div>
      </td>
      <td style={{ padding: "6px 4px", textAlign: "center" }}>{phase.inspectionGate ? "Yes" : "—"}</td>
      <td style={{ padding: "6px 4px", textAlign: "center" }}>{phase.floatDays}d</td>
    </tr>
  );
}

function RiskRow({ risk }: { risk: RiskItem }) {
  const impactColor = risk.impact === "critical" ? "#dc2626" : risk.impact === "high" ? "#f59e0b" : "#6b7280";
  return (
    <div style={{ ...card, borderLeft: `4px solid ${impactColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <div>
          <span style={badge(impactColor)}>{risk.impact.toUpperCase()}</span>
          <strong>{risk.category}</strong>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{risk.id}</span>
      </div>
      <div style={{ fontSize: "0.85rem", marginBottom: "4px" }}>{risk.description}</div>
      <div style={{ fontSize: "0.85rem", color: "#065f46" }}>Mitigation: {risk.mitigation}</div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function GCBidPackageV2View() {
  const pkg = gcBidPackageV2;
  const summary = summarizeV2(pkg);
  const sp = summary.sellPrice;
  const sched = summary.scheduleAnalysis;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "960px", margin: "0 auto", padding: "24px" }}>
      {/* Header */}
      <h1 style={{ fontSize: "1.5rem", marginBottom: "4px" }}>{pkg.projectName}</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        {pkg.location} | {pkg.squareFootage.low}–{pkg.squareFootage.high} SF | {pkg.stories} stories | {pkg.spec} spec
      </p>
      <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Version {pkg.version} — {pkg.created}</p>

      {/* KPI Row */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "16px" }}>
        <div style={{ ...card, flex: 1, minWidth: "180px", textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Hard Cost</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{formatRange(pkg.hardCostRange)}</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "180px", textAlign: "center", border: "2px solid #10b981" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Sell Price</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#059669" }}>
            {formatCurrency(sp.sellPriceLow)} – {formatCurrency(sp.sellPriceHigh)}
          </div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "180px", textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Duration</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{sched.totalWeeksLow}–{sched.totalWeeksHigh} weeks</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "180px", textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Margin</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{sp.marginPercent}%</div>
        </div>
      </div>

      {/* Pricing */}
      <h2 style={sectionTitle}>Pricing + Markup</h2>
      <PricingCard sp={sp} />

      {/* Divisions */}
      <h2 style={sectionTitle}>Trade Divisions (click to expand scope)</h2>
      {pkg.divisions.map((div, i) => (
        <DivisionCard key={div.csiCode} div={div} analysis={summary.divisionAnalysis[i]} />
      ))}

      {/* Schedule */}
      <h2 style={sectionTitle}>Master Schedule (Critical Path)</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "8px 4px" }}>Phase</th>
            <th style={{ padding: "8px 4px" }}>Duration</th>
            <th style={{ padding: "8px 4px" }}>Bar</th>
            <th style={{ padding: "8px 4px", textAlign: "center" }}>Inspection</th>
            <th style={{ padding: "8px 4px", textAlign: "center" }}>Float</th>
          </tr>
        </thead>
        <tbody>
          {pkg.schedule.map((phase) => (
            <ScheduleRow key={phase.phase} phase={phase} />
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "8px" }}>
        Total to rough inspection: {sched.totalWeeksLow}–{sched.totalWeeksHigh} weeks | Critical path (red bars): {sched.criticalPathPhases.join(" → ")} | Inspection gates: {sched.inspectionGateCount}
      </p>

      {/* Risk Register */}
      <h2 style={sectionTitle}>Risk Register</h2>
      <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
        <span style={badge("#dc2626")}>{summary.riskCount.critical} Critical</span>
        <span style={badge("#f59e0b")}>{summary.riskCount.high} High</span>
        <span style={badge("#6b7280")}>{summary.riskCount.medium} Medium</span>
      </div>
      {pkg.risks.map((risk) => (
        <RiskRow key={risk.id} risk={risk} />
      ))}

      {/* Execution Playbook */}
      <h2 style={sectionTitle}>Execution Playbook</h2>
      <div style={{ ...card, borderLeft: "4px solid #2563eb" }}>
        <ol style={{ margin: 0, paddingLeft: "20px" }}>
          {pkg.executionPlaybook.map((step, i) => (
            <li key={i} style={{ marginBottom: "6px", fontWeight: 600 }}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Version note */}
      <div style={{ marginTop: "32px", padding: "16px", background: "#ecfdf5", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
        <h3 style={{ fontSize: "1rem", margin: "0 0 8px" }}>v2.0 Bid Ready — What's Included</h3>
        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.85rem", color: "#065f46" }}>
          <li>6 CSI trade divisions with bid-ready sub scopes</li>
          <li>Cost ranges (labor + material) at MA mid-upper spec</li>
          <li>Markup model: 15% overhead + 10% profit + 5% contingency</li>
          <li>Critical path schedule with float + inspection gates</li>
          <li>5-item risk register with mitigations</li>
          <li>Field execution playbook</li>
        </ul>
      </div>
    </div>
  );
}
