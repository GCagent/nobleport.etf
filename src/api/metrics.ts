/**
 * Kuzo Platform — Prometheus Metrics Client
 *
 * Fetches the /metrics endpoint, parses Prometheus exposition format
 * into a typed KuzoMetricSnapshot. No extra library required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface KuzoMetricSnapshot {
  raw: string;
  samples: MetricSample[];
  fetchedAt: Date;

  // Pre-extracted convenience values
  httpRequestsTotal: number;
  httpInFlight: number;
  httpP50: number | null;
  httpP95: number | null;
  deploymentsTotal: number;
  deploymentsFailedTotal: number;
  ipfsPinsTotal: number;
  anchorsTotal: number;
  workerQueueDepth: number;
  workerActiveJobs: number;
  verifyJobsTotal: number;
  stripeWebhooksTotal: number;
  checkoutsTotal: number;
  siweAttemptsTotal: number;
  jwtIssuedTotal: number;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parsePrometheusText(text: string): MetricSample[] {
  const samples: MetricSample[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Match lines like: metric_name{label="val",...} 123.45
    // or plain:          metric_name 123.45
    const match = trimmed.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)\{?(.*?)\}?\s+([\d.eE+-]+|NaN|Inf|-Inf)$/
    );
    if (!match) continue;

    const [, name, labelStr, valueStr] = match;

    const labels: Record<string, string> = {};
    if (labelStr) {
      // Parse label="value" pairs
      const labelRegex = /(\w+)="([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = labelRegex.exec(labelStr)) !== null) {
        labels[m[1]] = m[2];
      }
    }

    const value = parseFloat(valueStr);
    samples.push({ name, labels, value });
  }

  return samples;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumByName(samples: MetricSample[], name: string): number {
  return samples
    .filter((s) => s.name === name)
    .reduce((acc, s) => acc + s.value, 0);
}

function sumByNameAndLabel(
  samples: MetricSample[],
  name: string,
  labelKey: string,
  labelValue: string
): number {
  return samples
    .filter((s) => s.name === name && s.labels[labelKey] === labelValue)
    .reduce((acc, s) => acc + s.value, 0);
}

function gaugeValue(samples: MetricSample[], name: string): number {
  const sample = samples.find((s) => s.name === name);
  return sample?.value ?? 0;
}

// ---------------------------------------------------------------------------
// Fetch & build snapshot
// ---------------------------------------------------------------------------

const METRICS_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
  "/api";

export async function fetchMetrics(): Promise<KuzoMetricSnapshot> {
  const res = await fetch(`${METRICS_URL}/metrics`, {
    headers: { Accept: "text/plain" },
  });

  if (!res.ok) {
    throw new Error(`Metrics fetch failed: ${res.status} ${res.statusText}`);
  }

  const raw = await res.text();
  const samples = parsePrometheusText(raw);

  return {
    raw,
    samples,
    fetchedAt: new Date(),

    httpRequestsTotal: sumByName(samples, "kuzo_http_requests_total"),
    httpInFlight: gaugeValue(samples, "kuzo_http_requests_in_flight"),
    httpP50: null, // quantiles require histogram_quantile (server-side)
    httpP95: null,

    deploymentsTotal: sumByName(samples, "kuzo_deploy_chain_total"),
    deploymentsFailedTotal: sumByNameAndLabel(
      samples,
      "kuzo_deploy_chain_total",
      "status",
      "failed"
    ),
    ipfsPinsTotal: sumByName(samples, "kuzo_ipfs_pin_total"),
    anchorsTotal: sumByName(samples, "kuzo_anchor_total"),

    workerQueueDepth: gaugeValue(samples, "kuzo_worker_queue_depth"),
    workerActiveJobs: gaugeValue(samples, "kuzo_worker_active_jobs"),

    verifyJobsTotal: sumByName(samples, "kuzo_verify_job_total"),
    stripeWebhooksTotal: sumByName(samples, "kuzo_stripe_webhook_total"),
    checkoutsTotal: sumByName(samples, "kuzo_billing_checkout_total"),
    siweAttemptsTotal: sumByName(samples, "kuzo_auth_siwe_total"),
    jwtIssuedTotal: sumByName(samples, "kuzo_auth_jwt_issued_total"),
  };
}
