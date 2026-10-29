import { Link } from 'react-router-dom';
import StatusPill from './StatusPill';
import UptimeBar from './UptimeBar';
import { formatMs, formatPct, hostOf, timeAgo } from '../utils';

export default function MonitorRow({ m }) {
  const status = !m.isActive ? 'Paused' : m.currentStatus === 'UP' ? 'Operational' : m.currentStatus === 'DOWN' ? 'Down' : 'Waiting';
  return (
    <tr>
      <td className="monitor-cell">
        <Link to={`/monitors/${m._id}`} className="monitor-link">
          <strong>{m.name}</strong>
          <span>{hostOf(m.url)}</span>
        </Link>
        <div className="monitor-status-inline"><StatusPill status={m.currentStatus} paused={!m.isActive} /></div>
      </td>
      <td className="monitor-history">
        <UptimeBar history={m.history} />
        <span className="sr-only">{status}</span>
      </td>
      <td className="response-cell">
        <strong>{formatMs(m.lastResponse)}</strong>
        <small>avg {formatMs(m.avgResponse)}</small>
      </td>
      <td className="mono-cell">{formatPct(m.uptime24h)}</td>
      <td className="last-checked-cell" title={m.lastCheckedAt ? new Date(m.lastCheckedAt).toLocaleString() : 'No checks yet'}>
        {timeAgo(m.lastCheckedAt)}
      </td>
    </tr>
  );
}
