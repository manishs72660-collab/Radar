import http from 'k6/http';
import { check, sleep } from 'k6';
import { login, authHeaders } from './lib/auth.js';
import { pickMonitor } from './lib/data.js';

export const options = {
  stages: [
    { duration: '10s', target: Number(__ENV.VUS) || 5 },
    { duration: __ENV.DURATION || '60s', target: Number(__ENV.VUS) || 5 },
    { duration: '10s', target: 0 },
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const BASE = __ENV.BASE_URL || 'http://localhost:5000';

export function setup() {
  const token = login(BASE, __ENV.EMAIL, __ENV.PASSWORD);
  const monitorId = pickMonitor(BASE, token);
  return { token, monitorId };
}

export default function (data) {
  const h = authHeaders(data.token);
  const m = data.monitorId;

  http.get(`${BASE}/api/monitors/${m}/series?range=7d`, { headers: h });
  http.get(`${BASE}/api/monitors/${m}/series?range=30d`, { headers: h });
  http.get(`${BASE}/api/monitors/${m}/heatmap`, { headers: h });

  sleep(1);
}