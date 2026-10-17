import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateTime, formatMs } from '../utils';

const STEPS = [
  { key: 'dns', label: 'DNS lookup', color: '#7aa2ff', hint: 'Finding the server address' },
  { key: 'tcp', label: 'Connection', color: '#b794f6', hint: 'Reaching the server' },
  { key: 'tls', label: 'HTTPS handshake', color: '#3dd6a5', hint: 'Setting up a secure link' },
  { key: 'ttfb', label: 'Server response', color: '#f5b042', hint: 'Your app and database thinking' },
  { key: 'download', label: 'Download', color: '#ff8fab', hint: 'Sending the page back' },
];

// Simple rules jo bataate hain ki slowness kahan hai
function diagnose(t) {
  const total = STEPS.reduce((a, s) => a + (t[s.key] || 0), 0);
  if (!total) return null;
  const share = (k) => (t[k] || 0) / total;
  const network = share('dns') + share('tcp') + share('tls');

  if (t.ttfb > 500 && share('ttfb') > 0.6) {
    return { tone: 'warn', text: 'Most of the time is spent waiting for your server. Look at slow database queries, heavy code on this route, or a cold start after idle.' };
  }
  if (network > 0.55 && total > 400) {
    return { tone: 'warn', text: 'Most of the time goes to reaching your server, not running your code. Your host may be far from the checker, or DNS is slow.' };
  }
  if (share('download') > 0.4 && t.download > 200) {
    return { tone: 'warn', text: 'The response is slow to download. Turn on compression (gzip or brotli) and reduce the size of what this URL returns.' };
  }
  return { tone: 'ok', text: 'No single step stands out. Time is spread evenly.' };
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1b2338', border: '1px solid #34415f', borderRadius: 10, padding: '8px 12px', fontSize: 13 }}>
      <div style={{ color: '#8c97b5', marginBottom: 4 }}>{formatDateTime(label)}</div>
      {[...payload].reverse().map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span style={{ color: p.color }}>{STEPS.find((s) => s.key === p.dataKey)?.label}</span>
          <b>{formatMs(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

// timeline: [{ t, dns, tcp, tls, ttfb, download }], purane se naya
export default function TimingBreakdown({ stats, timeline = [] }) {
  const t = stats?.timings;

  if (!t) {
    return (
      <div className="panel" style={{ marginTop: 20 }}>
        <h2>Where the time goes</h2>
        <div className="empty">Breakdown appears after the next check runs.</div>
      </div>
    );
  }

  const total = STEPS.reduce((a, s) => a + (t[s.key] || 0), 0) || 1;
  const verdict = diagnose(t);

  const span = timeline.length > 1 ? timeline[timeline.length - 1].t - timeline[0].t : 0;
  const longRange = span > 36 * 60 * 60 * 1000;
  const tick = (v) =>
    longRange
      ? new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short' })
      : new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div className="panel-head">
        <div>
          <h2>Where the time goes</h2>
          <p className="panel-sub">Average of one normal check, split into its steps (cold starts left out)</p>
        </div>
      </div>

      <div className="split-bar" role="img" aria-label="Average time per step">
        {STEPS.map((s) => (
          <div key={s.key} style={{ width: `${Math.max(((t[s.key] || 0) / total) * 100, 1.5)}%`, background: s.color }} title={`${s.label}: ${formatMs(t[s.key])}`} />
        ))}
      </div>

      <div className="split-legend">
        {STEPS.map((s) => (
          <div key={s.key}>
            <span className="swatch" style={{ background: s.color }} />
            <div>
              <b>{formatMs(t[s.key])}</b> {s.label}
              <small>{s.hint}</small>
            </div>
          </div>
        ))}
      </div>

      {verdict && <div className={`verdict ${verdict.tone}`}>{verdict.text}</div>}

      {timeline.length > 1 && (
        <div className="chart-box" style={{ height: 220, marginTop: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#26304a" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} stroke="#5a6585" tickLine={false} axisLine={false} fontSize={12} minTickGap={40} />
              <YAxis stroke="#5a6585" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}s` : `${v}ms`)} />
              <Tooltip content={<Tip />} />
              {STEPS.map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} stackId="1" stroke={s.color} fill={s.color} fillOpacity={0.55} strokeWidth={1.2} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}