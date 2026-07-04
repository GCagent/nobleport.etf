// NoblePort Load Smoke Test
// =========================
//
// A fast (sub-minute) sanity check that the load harness and target are wired
// up correctly before committing to the full tiered run (k6_tiered.js). This is
// NOT the RC1 load evidence — it only proves the rig works.
//
//   BASE_URL=https://api.nobleport.example k6 run k6_smoke.js

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    'status 200': (r) => r.status === 200,
    'status is exactly healthy': (r) => {
      try {
        return JSON.parse(r.body).status === 'healthy';
      } catch (_e) {
        return false;
      }
    },
  });
  sleep(1);
}
