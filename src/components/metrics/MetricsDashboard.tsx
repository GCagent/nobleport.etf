/**
 * Kuzo Platform — Metrics Dashboard Component
 *
 * At-a-glance operator panel with:
 *   - 4 sections (HTTP, Deployments, Worker, Billing/Auth)
 *   - 10 stat tiles with color-coded thresholds
 *   - Grafana deep-link button
 */

import React from "react";
import { useMetrics } from "../../hooks/useMetrics";

// ---------------------------------------------------------------------------
// Threshold helpers
// ---------------------------------------------------------------------------

interface Threshold {
  green: number;
  yellow: number;
}

function thresholdColor(value: number, t: Threshold): string {
  if (value >= t.yellow) return "text-red-600 bg-red-50 border-red-200";
  if (value >= t.green) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-green-600 bg-green-50 border-green-200";
}

function inverseThresholdColor(value: number, t: Threshold): string {
  // Higher is better (e.g. total deployments)
  if (value >= t.yellow) return "text-green-600 bg-green-50 border-green-200";
  if (value >= t.green) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-gray-600 bg-gray-50 border-gray-200";
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

interface StatTileProps {
  label: string;
  value: number | string;
  colorClass: string;
}

function StatTile({ label, value, colorClass }: StatTileProps) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex flex-col items-center justify-center ${colorClass}`}
    >
      <span className="text-2xl font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-xs mt-1 opacity-75">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3 mt-6 first:mt-0">
      {title}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const GRAFANA_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GRAFANA_URL) ||
  "http://localhost:3001";

export default function MetricsDashboard() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useMetrics();

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-400 animate-pulse">
        Loading metrics...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        <p className="font-medium">Failed to load metrics</p>
        <p className="text-sm mt-1">{error?.message}</p>
      </div>
    );
  }

  if (!data) return null;

  const updatedAt = new Date(dataUpdatedAt).toLocaleTimeString();

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Platform Metrics
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Last updated: {updatedAt}
          </p>
        </div>
        <a
          href={`${GRAFANA_URL}/d/kuzo-platform-v1/kuzo-platform`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
        >
          Open Grafana
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* ── HTTP ─────────────────────────────────────────────────────── */}
      <SectionHeader title="HTTP" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile
          label="Total Requests"
          value={data.httpRequestsTotal}
          colorClass={inverseThresholdColor(data.httpRequestsTotal, { green: 100, yellow: 1000 })}
        />
        <StatTile
          label="In-Flight"
          value={data.httpInFlight}
          colorClass={thresholdColor(data.httpInFlight, { green: 50, yellow: 100 })}
        />
      </div>

      {/* ── Deployments ──────────────────────────────────────────────── */}
      <SectionHeader title="Deployments" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Total Deploys"
          value={data.deploymentsTotal}
          colorClass={inverseThresholdColor(data.deploymentsTotal, { green: 10, yellow: 100 })}
        />
        <StatTile
          label="Failed Deploys"
          value={data.deploymentsFailedTotal}
          colorClass={thresholdColor(data.deploymentsFailedTotal, { green: 1, yellow: 5 })}
        />
        <StatTile
          label="IPFS Pins"
          value={data.ipfsPinsTotal}
          colorClass={inverseThresholdColor(data.ipfsPinsTotal, { green: 10, yellow: 100 })}
        />
        <StatTile
          label="Anchors"
          value={data.anchorsTotal}
          colorClass={inverseThresholdColor(data.anchorsTotal, { green: 10, yellow: 100 })}
        />
      </div>

      {/* ── Worker ───────────────────────────────────────────────────── */}
      <SectionHeader title="ARQ Worker" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile
          label="Queue Depth"
          value={data.workerQueueDepth}
          colorClass={thresholdColor(data.workerQueueDepth, { green: 10, yellow: 50 })}
        />
        <StatTile
          label="Active Jobs"
          value={data.workerActiveJobs}
          colorClass={thresholdColor(data.workerActiveJobs, { green: 5, yellow: 20 })}
        />
        <StatTile
          label="Verify Jobs"
          value={data.verifyJobsTotal}
          colorClass={inverseThresholdColor(data.verifyJobsTotal, { green: 5, yellow: 50 })}
        />
      </div>

      {/* ── Billing / Auth ───────────────────────────────────────────── */}
      <SectionHeader title="Billing & Auth" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatTile
          label="Stripe Webhooks"
          value={data.stripeWebhooksTotal}
          colorClass={inverseThresholdColor(data.stripeWebhooksTotal, { green: 10, yellow: 100 })}
        />
        <StatTile
          label="Checkouts"
          value={data.checkoutsTotal}
          colorClass={inverseThresholdColor(data.checkoutsTotal, { green: 5, yellow: 50 })}
        />
        <StatTile
          label="SIWE Attempts"
          value={data.siweAttemptsTotal}
          colorClass={inverseThresholdColor(data.siweAttemptsTotal, { green: 10, yellow: 100 })}
        />
      </div>
    </div>
  );
}
