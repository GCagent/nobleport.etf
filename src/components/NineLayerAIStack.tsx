import React from "react";
import {
  NINE_LAYER_STACK,
  STEPHANIE_LAYER_MAPPING,
  INDUSTRY_LAYER_COVERAGE,
  type StackLayer,
} from "../data/nine-layer-ai-stack";

const LAYER_COLORS: Record<number, string> = {
  1: "#1a1a2e",
  2: "#16213e",
  3: "#0f3460",
  4: "#1b4965",
  5: "#2b6777",
  6: "#52ab98",
  7: "#7ec8e3",
  8: "#c8d8e4",
  9: "#f2a154",
};

function LayerCard({ layer }: { layer: StackLayer }) {
  const bgColor = LAYER_COLORS[layer.id] ?? "#333";
  const textColor = layer.id >= 8 ? "#1a1a2e" : "#ffffff";

  return (
    <div
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: "24px",
        borderRadius: "12px",
        marginBottom: "16px",
      }}
    >
      <h3 style={{ margin: "0 0 4px 0", fontSize: "20px" }}>
        {layer.id}. {layer.name}
      </h3>
      <p style={{ margin: "0 0 12px 0", opacity: 0.8, fontStyle: "italic" }}>
        {layer.subtitle}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        {layer.components.map((c) => (
          <span
            key={c.name}
            title={c.description}
            style={{
              padding: "4px 12px",
              borderRadius: "16px",
              border: `1px solid ${textColor}40`,
              fontSize: "13px",
            }}
          >
            {c.name}
          </span>
        ))}
      </div>

      {layer.flow && (
        <div style={{ fontSize: "13px", opacity: 0.7, marginBottom: "8px" }}>
          {layer.flow.join(" → ")}
        </div>
      )}

      <p style={{ margin: 0, fontSize: "14px", fontWeight: 500 }}>
        {layer.purpose}
      </p>
    </div>
  );
}

function StephanieCoverageTable() {
  return (
    <div style={{ marginTop: "32px" }}>
      <h2>Where Stephanie.ai Fits</h2>
      <p style={{ opacity: 0.7 }}>
        Touching all 9 layers — unusually broad coverage for an early system.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #444" }}>
              Layer
            </th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #444" }}>
              Stephanie Role
            </th>
          </tr>
        </thead>
        <tbody>
          {STEPHANIE_LAYER_MAPPING.map((m) => (
            <tr key={m.layer}>
              <td style={{ padding: "8px", borderBottom: "1px solid #333" }}>{m.layer}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #333" }}>{m.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IndustryComparison() {
  return (
    <div style={{ marginTop: "32px" }}>
      <h2>Strategic Reality</h2>
      <p style={{ opacity: 0.7 }}>
        Most AI companies operate in only 1–3 layers. The most powerful future platforms
        operate across 5–9 layers simultaneously.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #444" }}>
              Company Type
            </th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "2px solid #444" }}>
              Layers
            </th>
          </tr>
        </thead>
        <tbody>
          {INDUSTRY_LAYER_COVERAGE.map((c) => (
            <tr key={c.type}>
              <td style={{ padding: "8px", borderBottom: "1px solid #333", fontWeight: c.type.includes("NoblePort") ? 700 : 400 }}>
                {c.type}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #333" }}>
                {c.layers.join(", ")} ({c.layers.length})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NineLayerAIStack() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 16px" }}>
      <h1>9-Layer Autonomous Intelligence Stack</h1>
      <p style={{ fontSize: "16px", opacity: 0.7, marginBottom: "32px" }}>
        The full operating architecture for AI-driven ecosystems — from raw compute
        to civilization-scale coordination.
      </p>

      {NINE_LAYER_STACK.map((layer) => (
        <LayerCard key={layer.id} layer={layer} />
      ))}

      <StephanieCoverageTable />
      <IndustryComparison />

      <div style={{ marginTop: "32px", padding: "24px", borderRadius: "12px", border: "1px solid #52ab98" }}>
        <h3 style={{ margin: "0 0 8px 0" }}>Future Architecture</h3>
        <p style={{ margin: 0, fontSize: "14px" }}>
          The dominant AI ecosystems combine foundation models + agent networks +
          economic systems + real-world infrastructure. When all nine layers operate
          together, you have an AI-driven operating system for society-scale systems.
        </p>
      </div>
    </div>
  );
}
