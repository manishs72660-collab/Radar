import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CircleCheck, TriangleAlert } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';
import RadarScope from '../components/RadarScope';
import MonitorRow from '../components/MonitorRow';
import MonitorModal from '../components/MonitorModal';
import { formatMs, formatPct } from '../utils';

export function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div>{labelFormatter ? labelFormatter(label) : label}</div>
      <div style={{ fontWeight: 600 }}>{formatMs(payload[0].value)}</div>
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    api.get('/dashboard/summary').then((r) => setData(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // live feel ke liye har 15 second refresh
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <div className="center-screen">Loading...</div>;
  const { totals, monitors, timeline } = data;

  const chartData = timeline.map((t) => ({
    time: t.time,
   label: new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    avg: t.avg,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Live view of every site you monitor. Refreshes every 15 seconds.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={17} /> Add monitor
        </button>
      </div>

      {totals.monitors > 0 &&
        (totals.down > 0 ? (
          <div className="banner" role="alert">
            <TriangleAlert size={20} color="#ff6b6b" />
            <span><b>{totals.down} {totals.down === 1 ? 'monitor is' : 'monitors are'} down.</b> Open the incident to see the cause.</span>
            <Link to="/incidents" className="btn btn-sm" style={{ marginLeft: 'auto' }}>View incidents</Link>
          </div>
        ) : (
          <div className="banner ok">
            <CircleCheck size={20} color="#3dd6a5" />
            <span>All systems operational.</span>
          </div>
        ))}

      <div className="hero">
        <div className="panel scope-panel">
          <RadarScope monitors={monitors} />
          <p className="scope-legend">Each dot is a monitor. Closer to the centre means faster response. Click a dot to open it.</p>
        </div>

        <div className="panel readout">
          <div>
            <h2>Last 24 hours</h2>
            <p className="panel-sub">Across all your monitors</p>
          </div>
          <div className="readout-grid">
            <div className="readout-item">
              <div className="readout-label">Monitors up</div>
              <div className="readout-value is-up">{totals.up}<small>/ {totals.monitors}</small></div>
              <div className="readout-note">{totals.paused ? `${totals.paused} paused` : 'none paused'}</div>
            </div>
            <div className="readout-item">
              <div className="readout-label">Uptime</div>
              <div className="readout-value">{formatPct(totals.uptime24h)}</div>
              <div className="readout-note">of all checks passed</div>
            </div>
            <div className="readout-item">
              <div className="readout-label">Average response</div>
              <div className="readout-value">{formatMs(totals.avgResponse)}</div>
              <div className="readout-note">time to full response</div>
            </div>
            <div className="readout-item">
              <div className="readout-label">Open incidents</div>
              <div className={`readout-value ${totals.openIncidents ? 'is-down' : ''}`}>{totals.openIncidents}</div>
              <div className="readout-note">{totals.openIncidents ? 'need attention' : 'all clear'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <div>
            <h2>Response time</h2>
            <p className="panel-sub">10-minute average over the last 24 hours</p>
          </div>
        </div>
        <div className="chart-box">
          {chartData.length < 2 ? (
            <div className="empty">Not enough data yet. Charts appear after a few checks have run.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8ff2e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#c8ff2e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#252b25" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="label" stroke="#858d84" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#858d84" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}s` : `${v}ms`)} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => `Around ${l}`} />} />
                <Area type="monotone" dataKey="avg" stroke="#c8ff2e" strokeWidth={2} fill="url(#ovGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Monitors</h2>
            <p className="panel-sub">Last 40 checks, response trend and 24-hour uptime</p>
          </div>
          <Link to="/monitors" className="btn btn-sm">See all</Link>
        </div>
        {monitors.length === 0 ? (
          <div className="empty">
            <h3>No monitors yet</h3>
            <p>Add the URL of a site you host and Radar starts checking it right away.</p>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add your first monitor</button>
          </div>
        ) : (
          <div className="mon-list">{monitors.slice(0, 6).map((m) => <MonitorRow key={m._id} m={m} />)}</div>
        )}
      </div>

      {showAdd && <MonitorModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </>
  );
}
