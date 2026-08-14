/**
 * Metrics Verification Dashboard
 * Separates verified, verifiable, modeled, and claimed metrics
 * with corrected investor-safe language for each
 */

import React, { useState } from "react";
import {
  metricsRegistry,
  analyzeVerificationStatus,
  getMetricsByCategory,
} from "../lib/metricsVerification";
import type { VerifiedMetric, MetricCategory, VerificationStatus } from "../lib/metricsVerification";
import { auditRFP, assessAuditReadiness } from "../data/audit-rfp";
import type { AuditPillar, AuditItem } from "../data/audit-rfp";

const statusColors: Record<VerificationStatus, string> = {
  verified: "#059669",
  verifiable: "#2563eb",
  modeled: "#d97706",
  claimed: "#dc2626",
  deprecated: "#6b7280",
};

const riskColors: Record<string, string> = {
  low: "#6b7280",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626",
};

const card = { background: "#f9fafb", padding: "16px", borderRadius: "8px", marginBottom: "12px" };
const badge = (bg: string) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "4px",
  fontSize: "0.7rem",
  fontWeight: 600 as const,
  color: "#fff",
  background: bg,
  marginRight: "4px",
});

function MetricCard({ metric }: { metric: VerifiedMetric }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{ ...card, borderLeft: `4px solid ${statusColors[metric.status]}`, cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={badge(statusColors[metric.status])}>{metric.status.toUpperCase()}</span>
          <span style={badge(riskColors[metric.riskIfMisstated])}>RISK: {metric.riskIfMisstated.toUpperCase()}</span>
          <strong style={{ marginLeft: "4px" }}>{metric.id}</strong>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{metric.category}</span>
      </div>
      <div style={{ marginTop: "8px", fontSize: "0.9rem" }}>
        <div style={{ textDecoration: metric.status === "modeled" || metric.status === "claimed" ? "line-through" : "none", color: "#374151" }}>
          {metric.claim}: {metric.value}
        </div>
        <div style={{ color: "#059669", fontWeight: 500, marginTop: "4px" }}>
          {metric.correctedLanguage}
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: "12px", fontSize: "0.82rem", color: "#6b7280" }}>
          <div><strong>Evidence type:</strong> {metric.evidenceType}</div>
          <div><strong>Evidence ref:</strong> {metric.evidenceRef}</div>
          <div><strong>Last verified:</strong> {metric.lastVerified || "Never"}</div>
          <div style={{ marginTop: "6px", fontStyle: "italic" }}>{metric.notes}</div>
        </div>
      )}
    </div>
  );
}

function AuditItemRow({ item }: { item: AuditItem }) {
  const priorityColor = item.priority === "P0" ? "#dc2626" : item.priority === "P1" ? "#d97706" : "#6b7280";
  return (
    <div style={{ ...card, borderLeft: `4px solid ${priorityColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <span style={badge(priorityColor)}>{item.priority}</span>
          <strong>{item.id}</strong>
        </div>
      </div>
      <div style={{ fontSize: "0.9rem", marginTop: "6px" }}>{item.description}</div>
      <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "4px" }}>
        <strong>Method:</strong> {item.verificationMethod}
      </div>
      <div style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: "4px" }}>
        <strong>Fail risk:</strong> {item.failRisk}
      </div>
    </div>
  );
}

export default function MetricsVerificationDashboard() {
  const summary = analyzeVerificationStatus();
  const readiness = assessAuditReadiness();
  const [activeCategory, setActiveCategory] = useState<MetricCategory | "all">("all");
  const [showAuditRFP, setShowAuditRFP] = useState(false);

  const filteredMetrics = activeCategory === "all"
    ? metricsRegistry
    : getMetricsByCategory(activeCategory);

  const categories: (MetricCategory | "all")[] = [
    "all", "infrastructure", "ai-compute", "financial", "compliance", "token", "governance",
  ];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "960px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "4px" }}>NoblePort Metrics Verification</h1>
      <p style={{ color: "#6b7280", marginTop: 0, fontSize: "0.85rem" }}>
        Truth Layer — Real vs Modeled Separation
      </p>

      {/* Readiness Score */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px" }}>
        <div style={{
          ...card, flex: 1, minWidth: "180px", textAlign: "center",
          border: `2px solid ${summary.investorReady ? "#10b981" : "#dc2626"}`,
        }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Readiness Score</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: summary.investorReady ? "#059669" : "#dc2626" }}>
            {summary.readinessScore}/100
          </div>
          <div style={{ fontSize: "0.75rem", color: summary.investorReady ? "#059669" : "#dc2626" }}>
            {summary.investorReady ? "INVESTOR READY" : "NOT INVESTOR READY"}
          </div>
        </div>

        <div style={{ ...card, flex: 1, minWidth: "120px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Verified</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>{summary.verified}</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "120px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Verifiable</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2563eb" }}>{summary.verifiable}</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "120px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Modeled</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#d97706" }}>{summary.modeled}</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: "120px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>Claimed</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626" }}>{summary.claimed}</div>
        </div>
      </div>

      {/* Critical Alerts */}
      {summary.criticalRisks.length > 0 && (
        <div style={{ ...card, border: "2px solid #dc2626", background: "#fef2f2", marginTop: "16px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem", color: "#dc2626" }}>
            Critical Risk Items — Fix Before Any Investor Document
          </h3>
          {summary.criticalRisks.map(m => (
            <div key={m.id} style={{ marginBottom: "8px", fontSize: "0.85rem" }}>
              <span style={badge("#dc2626")}>{m.status.toUpperCase()}</span>
              <strong>{m.id}:</strong> {m.claim}
              <div style={{ color: "#059669", marginTop: "2px", paddingLeft: "16px" }}>
                Use instead: "{m.correctedLanguage}"
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Filter */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "24px", marginBottom: "12px" }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: activeCategory === cat ? "2px solid #2563eb" : "1px solid #d1d5db",
              background: activeCategory === cat ? "#eff6ff" : "#fff",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: activeCategory === cat ? 600 : 400,
            }}
          >
            {cat === "all" ? "All" : cat.replace("-", " / ")}
          </button>
        ))}
      </div>

      {/* Metrics List */}
      {filteredMetrics.map(m => <MetricCard key={m.id} metric={m} />)}

      {/* Audit RFP Toggle */}
      <div style={{ marginTop: "32px" }}>
        <button
          onClick={() => setShowAuditRFP(!showAuditRFP)}
          style={{
            padding: "12px 24px",
            borderRadius: "8px",
            border: "2px solid #2563eb",
            background: showAuditRFP ? "#2563eb" : "#fff",
            color: showAuditRFP ? "#fff" : "#2563eb",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          {showAuditRFP ? "Hide" : "Show"} Audit RFP ({readiness.totalItems} items, {readiness.p0Count} P0)
        </button>
      </div>

      {showAuditRFP && (
        <div style={{ marginTop: "16px" }}>
          <h2 style={{ fontSize: "1.2rem" }}>{auditRFP.title}</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            {auditRFP.scope} | Est. duration: {auditRFP.estimatedDuration}
          </p>

          {auditRFP.pillars.map(pillar => (
            <div key={pillar.pillarNumber} style={{ marginTop: "20px" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "8px" }}>
                Pillar {pillar.pillarNumber}: {pillar.pillar}
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: 0 }}>{pillar.objective}</p>
              {pillar.items.map(item => <AuditItemRow key={item.id} item={item} />)}
            </div>
          ))}

          <div style={{ ...card, marginTop: "20px", borderLeft: "4px solid #2563eb" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Target Auditors</h3>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem" }}>
              {auditRFP.targetAuditors.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>

          <div style={{ ...card, borderLeft: "4px solid #059669" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Deliverables</h3>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem" }}>
              {auditRFP.deliverables.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>

          <div style={{ ...card, borderLeft: "4px solid #dc2626" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Auditor Disqualifiers</h3>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem" }}>
              {auditRFP.disqualifiers.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
