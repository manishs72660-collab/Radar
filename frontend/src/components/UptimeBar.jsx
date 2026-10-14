export default function UptimeBar({ history = [], slots = 40 }) {
  const padded = [...Array(Math.max(0, slots - history.length)).fill(null), ...history];
  return (
    <div className="uptime-bar" role="img" aria-label="Recent check results">
      {padded.map((s, i) => (
        <i key={i} className={s === 'UP' ? 'up' : s === 'DOWN' ? 'down' : ''} />
      ))}
    </div>
  );
}
