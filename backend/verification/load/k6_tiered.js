// NoblePort Tiered Load Test  (audit issue #5)
// ============================================
//
// The audit's objection: a previously-referenced target of "1000+ req/sec" was
// "proven" by a 20 -> 50 VU ramp. That proves nothing about 1000. NoblePort
// production load must be characterized at distinct tiers, each as its own
// scenario with its own pass/fail thresholds:
//
//     250 concurrent users  ->  500  ->  1000
//
// Each tier runs as a separate, sequentially-scheduled scenario so the report
// shows where the system degrades instead of averaging it away. Thresholds are
// per-tier; a tier that breaches its error-rate or latency budget fails the run.
//
// Run (against a DEPLOYED instance — never localhost dev server):
//   BASE_URL=https://api.nobleport.example k6 run k6_tiered.js
//
// Single tier only:
//   BASE_URL=... k6 run --env TIER=t1000 k6_tiered.js
//
// Output a sharable report:
//   k6 run --summary-export=evidence/results/k6_tiered.json k6_tiered.js
//
// NOTE: This file is the load HARNESS. The load REPORT it produces is the RC1
// evidence artifact ("load_report"), and it stays PENDING until run against a
// real environment.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const ONLY = __ENV.TIER || ''; // e.g. "t250" | "t500" | "t1000"

const errorRate = new Rate('nobleport_errors');
const healthLatency = new Trend('nobleport_health_latency', true);

// Each tier: ramp up to the target VUs, hold, ramp down. Scenarios are staggered
// with startTime so they don't overlap (each tier is measured in isolation).
function tier(targetVUs, startTime) {
  return {
    executor: 'ramping-vus',
    startVUs: 0,
    startTime,
    stages: [
      { duration: '30s', target: targetVUs }, // ramp
      { duration: '2m', target: targetVUs },   // hold (the measured window)
      { duration: '20s', target: 0 },          // drain
    ],
    gracefulRampDown: '20s',
  };
}

const allScenarios = {
  t250: tier(250, '0s'),
  t500: tier(500, '3m'),
  t1000: tier(1000, '6m'),
};

const scenarios = ONLY
  ? { [ONLY]: { ...allScenarios[ONLY], startTime: '0s' } }
  : allScenarios;

export const options = {
  scenarios,
  thresholds: {
    // Per-tier latency budgets (read-path health/list endpoints).
    'http_req_duration{scenario:t250}': ['p(95)<400'],
    'http_req_duration{scenario:t500}': ['p(95)<800'],
    'http_req_duration{scenario:t1000}': ['p(95)<1500'],
    // Global correctness budget: <1% errors at every tier.
    nobleport_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

// Read-only endpoints only — load testing must never create real charges or
// mutate the revenue ledger. The webhook/payment WRITE paths are proven by the
// pytest suite and Stripe sandbox artifact, not by load.
const READ_PATHS = [
  '/api/health',
  '/api/health/features',
  '/api/leads?page=1&page_size=20',
  '/api/jobs?page=1&page_size=20',
  '/api/estimates?page=1&page_size=20',
  '/api/payments?page=1&page_size=20',
];

export default function () {
  const path = READ_PATHS[Math.floor(Math.random() * READ_PATHS.length)];
  const res = http.get(`${BASE_URL}${path}`, {
    tags: { endpoint: path },
  });

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'body is non-empty': (r) => r.body && r.body.length > 0,
  });
  errorRate.add(!ok);

  if (path === '/api/health') {
    healthLatency.add(res.timings.duration);
    // Exact-match the health status (audit issue #1) even under load.
    check(res, {
      'health status is exactly healthy': (r) => {
        try {
          return JSON.parse(r.body).status === 'healthy';
        } catch (_e) {
          return false;
        }
      },
    });
  }

  sleep(1);
}
