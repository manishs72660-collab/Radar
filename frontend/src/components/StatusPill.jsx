export default function StatusPill({ status, paused }) {
  if (paused) return <span className="pill">Paused</span>;
  const map = { UP: ['up', 'Up'], DOWN: ['down', 'Down'], PENDING: ['', 'Waiting'] };
  const [cls, label] = map[status] || ['', status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function StatusDot({ status, paused }) {
  const cls = paused ? '' : status === 'UP' ? 'up' : status === 'DOWN' ? 'down' : '';
  return <span className={`dot ${cls}`} aria-hidden="true" />;
}
