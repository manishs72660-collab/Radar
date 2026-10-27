export default function UptimeBar({ history = [], slots = 40 }) {
  const count = Math.max(0, Math.floor(slots));
  const recent = Array.isArray(history) ? (count ? history.slice(-count) : []) : [];
  const padded = [...Array(Math.max(0, count - recent.length)).fill(null), ...recent];
  return (
    <div className="uptime-bar" role="img" aria-label="Recent check results">
      {padded.map((s, i) => (
        <i key={i} className={s === 'UP' ? 'up' : s === 'DOWN' ? 'down' : ''} />
      ))}
    </div>
  );
}
