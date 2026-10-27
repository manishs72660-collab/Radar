import http from 'k6/http';
import { check } from 'k6';

export function login(baseUrl, email, password) {
  const res = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  return res.json('token');
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}