'use client';

import React, { useState, useMemo } from 'react';
import {
  DwellingConfig,
  DEFAULT_DWELLING_CONFIG,
  MA_CODE_REFERENCES,
  INSPECTION_CHECKPOINTS,
  SAFETY_PRODUCTS,
} from '../data/life-safety-takeoff';
import { LifeSafetyCalculator } from '../lib/lifeSafetyCalculator';

// ============================================================================
// HELPERS
// ============================================================================

const formatCurrency = (low: number, high: number): string => {
  if (low === high) return `$${low.toLocaleString()}`;
  return `$${low.toLocaleString()} – $${high.toLocaleString()}`;
};

const Badge: React.FC<{
  text: string;
  color: 'emerald' | 'amber' | 'red' | 'sky' | 'slate';
}> = ({ text, color }) => {
  const colors = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400',
    sky: 'bg-sky-500/20 text-sky-400',
    slate: 'bg-slate-700 text-slate-300',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[color]}`}>
      {text}
    </span>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type TabId = 'takeoff' | 'codes' | 'inspections' | 'products';

export default function CODetectorIntegration() {
  const calculator = useMemo(() => new LifeSafetyCalculator(), []);

  // Dwelling configuration state
  const [stories, setStories] = useState(DEFAULT_DWELLING_CONFIG.stories);
  const [hasBasement, setHasBasement] = useState(DEFAULT_DWELLING_CONFIG.hasBasement);
  const [hasAttic, setHasAttic] = useState(DEFAULT_DWELLING_CONFIG.hasHabitableAttic);
  const [garageWidth, setGarageWidth] = useState(DEFAULT_DWELLING_CONFIG.garageDimensions.width);
  const [garageDepth, setGarageDepth] = useState(DEFAULT_DWELLING_CONFIG.garageDimensions.depth);
  const [preferCombo, setPreferCombo] = useState(DEFAULT_DWELLING_CONFIG.preferCombo);
  const [existingSystem, setExistingSystem] = useState(DEFAULT_DWELLING_CONFIG.existingSystem);

  const [activeTab, setActiveTab] = useState<TabId>('takeoff');
  const [showVoice, setShowVoice] = useState(false);

  // Build config from state
  const dwellingConfig: DwellingConfig = useMemo(
    () => ({
      stories,
      hasBasement,
      hasHabitableAttic: hasAttic,
      bedroomLevels: stories >= 2 ? [2] : [1],
      garageType: 'attached',
      garageDimensions: { width: garageWidth, depth: garageDepth },
      existingSystem,
      preferCombo,
      wiringType: 'hardwired',
    }),
    [stories, hasBasement, hasAttic, garageWidth, garageDepth, preferCombo, existingSystem]
  );

  // Calculate takeoff
  const takeoff = useMemo(
    () =>
      calculator.calculateCOIntegration(
        dwellingConfig,
        `${garageWidth}' × ${garageDepth}' Attached Garage Addition`
      ),
    [calculator, dwellingConfig, garageWidth, garageDepth]
  );

  const voiceReadout = useMemo(
    () => calculator.generateVoiceReadout(takeoff),
    [calculator, takeoff]
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: 'takeoff', label: 'Takeoff' },
    { id: 'codes', label: 'Code Refs' },
    { id: 'inspections', label: 'Inspections' },
    { id: 'products', label: 'Products' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔥</span>
            <div>
              <h1 className="text-2xl font-bold text-white">
                CO Detector Integration — Life-Safety Takeoff
              </h1>
              <p className="text-sm text-slate-400">
                780 CMR 10th Edition · 527 CMR 31.00 · MGL Ch. 148 §26F½ — MA Compliant
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Configuration Panel — always visible */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Dwelling Configuration
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Stories */}
            <div>
              <label className="block text-xs text-slate-500">Stories</label>
              <select
                value={stories}
                onChange={(e) => setStories(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value={1}>1 Story</option>
                <option value={2}>2 Stories</option>
                <option value={3}>3 Stories</option>
              </select>
            </div>

            {/* Garage Size */}
            <div>
              <label className="block text-xs text-slate-500">Garage Size (W × D ft)</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  value={garageWidth}
                  onChange={(e) => setGarageWidth(Number(e.target.value))}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  min={10}
                  max={50}
                />
                <span className="self-center text-slate-500">×</span>
                <input
                  type="number"
                  value={garageDepth}
                  onChange={(e) => setGarageDepth(Number(e.target.value))}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  min={10}
                  max={50}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={hasBasement}
                  onChange={(e) => setHasBasement(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Basement
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={hasAttic}
                  onChange={(e) => setHasAttic(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Habitable Attic
              </label>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={preferCombo}
                  onChange={(e) => setPreferCombo(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Combo Smoke/CO
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={existingSystem}
                  onChange={(e) => setExistingSystem(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Existing System
              </label>
            </div>
          </div>

          {/* Voice Readout */}
          <div className="mt-4">
            <button
              onClick={() => setShowVoice(!showVoice)}
              className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-400 transition-colors hover:bg-sky-500/20"
            >
              🎙 {showVoice ? 'Hide' : 'Show'} Stephanie Voice Readout
            </button>
            {showVoice && (
              <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-950/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-500">
                  Stephanie.ai Voice Output
                </p>
                <p className="mt-2 text-sm leading-relaxed text-sky-200">{voiceReadout}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cost Summary Bar */}
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-800/80 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Material
            </p>
            <p className="mt-1 text-lg font-bold text-white">
              {formatCurrency(takeoff.materialCostLow, takeoff.materialCostHigh)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-800/80 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Labor
            </p>
            <p className="mt-1 text-lg font-bold text-white">
              {formatCurrency(takeoff.laborCostLow, takeoff.laborCostHigh)}
            </p>
          </div>
          <div className="rounded-lg bg-sky-900/40 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-500">
              Total Direct
            </p>
            <p className="mt-1 text-lg font-bold text-sky-400">
              {formatCurrency(takeoff.totalCostLow, takeoff.totalCostHigh)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-800/80 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Line Items
            </p>
            <p className="mt-1 text-lg font-bold text-white">{takeoff.lineItems.length}</p>
          </div>
        </div>

        {/* ============ TAKEOFF TAB ============ */}
        {activeTab === 'takeoff' && (
          <div>
            <h2 className="text-lg font-semibold text-white">Line-Item Takeoff</h2>
            <p className="mt-1 text-sm text-slate-400">
              {takeoff.garageSize} attached garage · {stories}-story
              {hasBasement ? ' + basement' : ''}
              {hasAttic ? ' + attic' : ''} dwelling
            </p>

            {/* Line Items Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="pb-2 pr-3">Item</th>
                    <th className="pb-2 pr-3">Description</th>
                    <th className="pb-2 pr-3">Qty</th>
                    <th className="pb-2 pr-3">Unit Cost</th>
                    <th className="pb-2 pr-3">Extended</th>
                    <th className="pb-2">Code Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {takeoff.lineItems.map((item) => (
                    <tr
                      key={item.itemId}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <td className="py-3 pr-3 font-mono text-xs text-sky-400">
                        {item.itemId}
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-white">{item.description}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.spec}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{item.location}</p>
                      </td>
                      <td className="py-3 pr-3 text-white">
                        {item.totalQty} {item.unit}
                      </td>
                      <td className="py-3 pr-3 text-slate-300">
                        {formatCurrency(item.unitCostLow, item.unitCostHigh)}
                      </td>
                      <td className="py-3 pr-3 font-medium text-emerald-400">
                        {formatCurrency(item.extendedCostLow, item.extendedCostHigh)}
                      </td>
                      <td className="py-3">
                        <Badge text={item.codeRef} color="sky" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes & Risk Flags */}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                <h3 className="text-sm font-semibold text-white">Code Notes</h3>
                <ul className="mt-2 space-y-1.5">
                  {takeoff.codeNotes.map((note, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-300">
                      <span className="mt-0.5 text-sky-500">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-4">
                <h3 className="text-sm font-semibold text-red-400">Risk Flags</h3>
                <ul className="mt-2 space-y-1.5">
                  {takeoff.riskFlags.map((flag, i) => (
                    <li key={i} className="flex gap-2 text-xs text-red-300">
                      <span className="mt-0.5 text-red-500">⚠</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Inspection Holds */}
            <div className="mt-4 rounded-xl border border-amber-900/30 bg-amber-950/20 p-4">
              <h3 className="text-sm font-semibold text-amber-400">Inspection Hold Points</h3>
              <ul className="mt-2 space-y-1.5">
                {takeoff.inspectionHolds.map((hold, i) => (
                  <li key={i} className="flex gap-2 text-xs text-amber-200">
                    <span className="mt-0.5 text-amber-500">◆</span>
                    {hold}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ============ CODE REFS TAB ============ */}
        {activeTab === 'codes' && (
          <div>
            <h2 className="text-lg font-semibold text-white">MA Code References</h2>
            <p className="mt-1 text-sm text-slate-400">
              780 CMR 10th Edition (IRC 2021 Amendments) · 527 CMR 31.00 · MGL Ch. 148
            </p>
            <div className="mt-4 grid gap-3">
              {MA_CODE_REFERENCES.map((ref, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{ref.code}</h3>
                      <p className="text-sm text-sky-400">{ref.section}</p>
                    </div>
                    <Badge text={ref.applies.split(' ').slice(0, 3).join(' ')} color="slate" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {ref.requirement}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ INSPECTIONS TAB ============ */}
        {activeTab === 'inspections' && (
          <div>
            <h2 className="text-lg font-semibold text-white">Inspection Checkpoints</h2>
            <p className="mt-1 text-sm text-slate-400">
              Life-safety inspection gates for CO/heat detector integration
            </p>
            <div className="mt-4 grid gap-4">
              {INSPECTION_CHECKPOINTS.map((checkpoint, i) => (
                <div
                  key={checkpoint.id}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-400">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{checkpoint.phase}</h3>
                      <p className="text-xs text-slate-400">{checkpoint.inspector}</p>
                    </div>
                    <Badge text={checkpoint.codeRef} color="sky" />
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{checkpoint.description}</p>
                  <div className="mt-3 rounded-lg bg-emerald-950/30 p-3">
                    <p className="text-xs font-semibold text-emerald-500">Pass Condition:</p>
                    <p className="mt-1 text-xs text-emerald-300">{checkpoint.passCondition}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ PRODUCTS TAB ============ */}
        {activeTab === 'products' && (
          <div>
            <h2 className="text-lg font-semibold text-white">Approved Products</h2>
            <p className="mt-1 text-sm text-slate-400">
              UL-listed CO alarms, combination smoke/CO, and heat detectors
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {SAFETY_PRODUCTS.map((product) => (
                <div
                  key={product.id}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-5"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-white">{product.name}</h3>
                    <Badge
                      text={product.type === 'co' ? 'CO' : product.type === 'combo_smoke_co' ? 'Combo' : 'Heat'}
                      color={product.type === 'combo_smoke_co' ? 'emerald' : product.type === 'co' ? 'sky' : 'amber'}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{product.model}</p>
                  <p className="mt-1 text-xs text-sky-400">Listed: {product.listing}</p>

                  <div className="mt-3 flex gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Unit Cost</p>
                      <p className="text-sm font-medium text-white">
                        {formatCurrency(product.unitCostLow, product.unitCostHigh)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Labor/Unit</p>
                      <p className="text-sm font-medium text-white">
                        ${product.laborPerUnit}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {product.specs.map((spec) => (
                      <span
                        key={spec}
                        className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
