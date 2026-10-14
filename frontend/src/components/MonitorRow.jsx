import { Link } from 'react-router-dom';
import { StatusDot } from './StatusPill';
import UptimeBar from './UptimeBar';
import Sparkline from './Sparkline';
import { formatMs, formatPct, hostOf } from '../utils';

export default function MonitorRow({ m }) {
  return (
    <Link to={`/monitors/${m._id}`} className="mon-row">
      <div className="mon-name">
        <StatusDot status={m.currentStatus} paused={!m.isActive} />
        <div style={{ minWidth: 0 }}>
          <strong>{m.name}</strong>
          <span className="sub">{hostOf(m.url)}</span>
        </div>
      </div>
      <div className="hide-sm">
        <UptimeBar history={m.history} />
      </div>
      <div className="hide-md hide-sm">
        <Sparkline values={m.spark} />
      </div>
      <div className="num hide-md hide-sm">
        {formatMs(m.avgResponse)}
        <small>avg</small>
      </div>
      <div className="num">
        {formatPct(m.uptime24h)}
        <small>24h</small>
      </div>
    </Link>
  );
}
