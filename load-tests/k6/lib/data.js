import http from 'k6/http';

export function pickMonitor(baseUrl, token) {
  const res = http.get(`${baseUrl}/api/monitors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = res.json();
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('No monitors. Run: npm run seed -- --days=14 --interval=5');
  }
  return list[0]._id;
}