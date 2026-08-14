/**
 * Garage Slab Takeoff Calculator — Interactive CSI 03 component
 * Input dimensions → auto-calc CY, cost, material list
 * MA 780 CMR / IRC 2021 compliant
 */

import React, { useState, useMemo } from "react";
import {
  calculateSlabTakeoff,
  DEFAULT_DIMENSIONS,
  DEFAULT_OPTIONS,
  formatCurrency,
} from "../lib/garageSlabTakeoff";
import type { SlabDimensions, SlabOptions, TakeoffLineItem, SlabTakeoff } from "../lib/garageSlabTakeoff";

// ─── Styles ─────────────────────────────────────────────────────────────────

const inputRow = { display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" as const };
const inputGroup = { flex: 1, minWidth: "140px" };
const label = { display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "4px", fontWeight: 600 as const };
const input = { width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.9rem", boxSizing: "border-box" as const };
const checkbox = { marginRight: "8px" };
const card = { background: "#f9fafb", padding: "16px", borderRadius: "8px", marginBottom: "12px" };
const badge = (color: string) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "4px",
  fontSize: "0.7rem",
  fontWeight: 600 as const,
  color: "#fff",
  background: color,
  marginRight: "4px",
});

// ─── Line Item Row ──────────────────────────────────────────────────────────

function LineItemRow({ item }: { item: TakeoffLineItem }) {
  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: "8px 4px", fontWeight: 600, whiteSpace: "nowrap" }}>
        {item.code}
        {item.holdPoint && <span style={{ ...badge("#dc2626"), marginLeft: "4px" }}>HOLD</span>}
      </td>
      <td style={{ padding: "8px 4px" }}>
        <div style={{ fontWeight: 500 }}>{item.description}</div>
        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{item.spec}</div>
      </td>
      <td style={{ padding: "8px 4px", textAlign: "right", whiteSpace: "nowrap" }}>
        {item.totalQty} {item.unit}
      </td>
      <td style={{ padding: "8px 4px", textAlign: "right", whiteSpace: "nowrap", fontSize: "0.85rem", color: "#6b7280" }}>
        {formatCurrency(item.unitCostLow)}–{formatCurrency(item.unitCostHigh)}/{item.unit}
      </td>
      <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>
        {formatCurrency(item.extCostLow)} – {formatCurrency(item.extCostHigh)}
      </td>
    </tr>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function GarageSlabCalculator() {
  const [dims, setDims] = useState<SlabDimensions>(DEFAULT_DIMENSIONS);
  const [opts, setOpts] = useState<SlabOptions>(DEFAULT_OPTIONS);

  const takeoff: SlabTakeoff = useMemo(
    () => calculateSlabTakeoff(dims, opts),
    [dims, opts]
  );

  const concreteCY = takeoff.lineItems.find((i) => i.code === "03G-01");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "960px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "4px" }}>Garage Slab Takeoff Calculator</h1>
      <p style={{ color: "#6b7280", marginTop: 0, fontSize: "0.85rem" }}>
        CSI Division 03 (Garage Only) — MA 780 CMR / IRC 2021 Compliant
      </p>

      {/* Input Section */}
      <div style={{ ...card, border: "2px solid #3b82f6" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Dimensions</h3>
        <div style={inputRow}>
          <div style={inputGroup}>
            <label style={label}>Length (ft)</label>
            <input
              type="number"
              style={input}
              value={dims.lengthFt}
              min={10}
              max={60}
              onChange={(e) => setDims({ ...dims, lengthFt: Number(e.target.value) || 10 })}
            />
          </div>
          <div style={inputGroup}>
            <label style={label}>Width (ft)</label>
            <input
              type="number"
              style={input}
              value={dims.widthFt}
              min={10}
              max={60}
              onChange={(e) => setDims({ ...dims, widthFt: Number(e.target.value) || 10 })}
            />
          </div>
          <div style={inputGroup}>
            <label style={label}>Thickness (in)</label>
            <input
              type="number"
              style={input}
              value={dims.thicknessIn}
              min={4}
              max={8}
              step={0.5}
              onChange={(e) => setDims({ ...dims, thicknessIn: Number(e.target.value) || 4 })}
            />
          </div>
          <div style={inputGroup}>
            <label style={label}>Base Depth (in)</label>
            <input
              type="number"
              style={input}
              value={opts.baseDepthin}
              min={4}
              max={12}
              onChange={(e) => setOpts({ ...opts, baseDepthin: Number(e.target.value) || 4 })}
            />
          </div>
        </div>

        <h3 style={{ margin: "16px 0 8px", fontSize: "0.95rem" }}>Options</h3>
        <div style={inputRow}>
          <div style={inputGroup}>
            <label style={label}>PSI</label>
            <select style={input} value={opts.psi} onChange={(e) => setOpts({ ...opts, psi: Number(e.target.value) })}>
              <option value={3000}>3,000 PSI</option>
              <option value={3500}>3,500 PSI</option>
              <option value={4000}>4,000 PSI</option>
            </select>
          </div>
          <div style={inputGroup}>
            <label style={label}>Waste %</label>
            <select style={input} value={opts.wastePercent} onChange={(e) => setOpts({ ...opts, wastePercent: Number(e.target.value) })}>
              <option value={5}>5%</option>
              <option value={8}>8%</option>
              <option value={10}>10%</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.85rem", cursor: "pointer" }}>
            <input type="checkbox" style={checkbox} checked={opts.heated} onChange={(e) => setOpts({ ...opts, heated: e.target.checked })} />
            Heated Garage (adds vapor retarder + R-10 insulation)
          </label>
          <label style={{ fontSize: "0.85rem", cursor: "pointer" }}>
            <input type="checkbox" style={checkbox} checked={opts.heavyVehicle} onChange={(e) => setOpts({ ...opts, heavyVehicle: e.target.checked })} />
            Heavy Vehicle (adds rebar grid)
          </label>
          <label style={{ fontSize: "0.85rem", cursor: "pointer" }}>
            <input type="checkbox" style={checkbox} checked={opts.useRebar} onChange={(e) => setOpts({ ...opts, useRebar: e.target.checked })} />
            Add Rebar (#4 @ 18" O.C.)
          </label>
          <label style={{ fontSize: "0.85rem", cursor: "pointer" }}>
            <input type="checkbox" style={checkbox} checked={opts.airEntrained} onChange={(e) => setOpts({ ...opts, airEntrained: e.target.checked })} />
            Air-Entrained (MA freeze-thaw)
          </label>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{ ...card, flex: 1, minWidth: "140px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Area</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{takeoff.areaFt2} SF</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "140px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Concrete</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{concreteCY?.totalQty ?? 0} CY</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "140px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Material</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
            {formatCurrency(takeoff.subtotalLow)}–{formatCurrency(takeoff.subtotalHigh)}
          </div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "140px", textAlign: "center", border: "2px solid #10b981" }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Total (Material + Labor)</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#059669" }}>
            {formatCurrency(takeoff.totalLow)}–{formatCurrency(takeoff.totalHigh)}
          </div>
        </div>
      </div>

      {/* Takeoff Table */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "24px" }}>Material Takeoff</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
              <th style={{ padding: "8px 4px" }}>Code</th>
              <th style={{ padding: "8px 4px" }}>Description / Spec</th>
              <th style={{ padding: "8px 4px", textAlign: "right" }}>Qty</th>
              <th style={{ padding: "8px 4px", textAlign: "right" }}>Unit Cost</th>
              <th style={{ padding: "8px 4px", textAlign: "right" }}>Extended Cost</th>
            </tr>
          </thead>
          <tbody>
            {takeoff.lineItems.map((item) => (
              <LineItemRow key={item.code} item={item} />
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #111", fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: "8px 4px" }}>MATERIAL SUBTOTAL</td>
              <td style={{ padding: "8px 4px", textAlign: "right" }}>
                {formatCurrency(takeoff.subtotalLow)} – {formatCurrency(takeoff.subtotalHigh)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: "8px 4px" }}>Labor ($4–$8/SF pour + finish)</td>
              <td style={{ padding: "8px 4px", textAlign: "right" }}>
                {formatCurrency(takeoff.laborLow)} – {formatCurrency(takeoff.laborHigh)}
              </td>
            </tr>
            <tr style={{ borderTop: "2px solid #059669", fontWeight: 700, color: "#059669" }}>
              <td colSpan={4} style={{ padding: "8px 4px" }}>TOTAL (MATERIAL + LABOR)</td>
              <td style={{ padding: "8px 4px", textAlign: "right" }}>
                {formatCurrency(takeoff.totalLow)} – {formatCurrency(takeoff.totalHigh)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Code Notes */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "28px" }}>MA Code Notes (780 CMR / IRC 2021)</h2>
      <div style={card}>
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem" }}>
          {takeoff.codeNotes.map((note, i) => (
            <li key={i} style={{ marginBottom: "4px" }}>{note}</li>
          ))}
        </ul>
      </div>

      {/* Risk Flags */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "24px" }}>Risk Flags</h2>
      <div style={{ ...card, borderLeft: "4px solid #f59e0b" }}>
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem" }}>
          {takeoff.riskFlags.map((flag, i) => (
            <li key={i} style={{ marginBottom: "4px", color: "#92400e" }}>{flag}</li>
          ))}
        </ul>
      </div>

      {/* Quick Scale Reference */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "24px" }}>Quick Scaling Reference</h2>
      <div style={card}>
        <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
              <th style={{ padding: "6px 4px" }}>Adjustment</th>
              <th style={{ padding: "6px 4px" }}>Factor</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: "4px" }}>20'x22' (~440 SF)</td><td style={{ padding: "4px" }}>Multiply quantities by ~0.76</td></tr>
            <tr><td style={{ padding: "4px" }}>20'x24' (~480 SF)</td><td style={{ padding: "4px" }}>Multiply quantities by ~0.83</td></tr>
            <tr><td style={{ padding: "4px" }}>24'x24' (~576 SF)</td><td style={{ padding: "4px" }}>Baseline (1.0x)</td></tr>
            <tr><td style={{ padding: "4px" }}>24'x30' (~720 SF)</td><td style={{ padding: "4px" }}>Multiply quantities by ~1.25</td></tr>
            <tr style={{ borderTop: "1px solid #e5e7eb" }}><td style={{ padding: "4px" }}>4" thick (vs 5")</td><td style={{ padding: "4px" }}>Concrete CY x 0.80</td></tr>
            <tr><td style={{ padding: "4px" }}>6" thick (vs 5")</td><td style={{ padding: "4px" }}>Concrete CY x 1.20</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
