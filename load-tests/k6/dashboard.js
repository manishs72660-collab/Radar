import http from 'k6/http';
import { check, sleep } from 'k6';
import { login, authHeaders } from './lib/auth.js';

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
  return { token };
}

export default function (data) {
  const res = http.get(`${BASE}/api/dashboard/summary`, {
    headers: authHeaders(data.token),
  });
  check(res, {
    'status 200': (r) => r.status === 200,
  });
  sleep(1);
}