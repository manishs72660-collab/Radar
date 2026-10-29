import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, CheckCircle2, Clock3, PauseCircle, Plus, RefreshCw,
  Server, Timer,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api, { errorMessage } from '../api';
import MonitorRow from '../components/MonitorRow';
import MonitorModal from '../components/MonitorModal';
import { formatMs, formatPct } from '../utils';

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ResponseTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{new Date(label).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
      <span>{formatMs(point.avg)} average response</span>
      {point.down > 0 && <span className="text-down">{point.down} failed {point.down === 1 ? 'check' : 'checks'}</span>}
    </div>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone }) {
  return (
    <article className={`metric-card ${tone || ''}`}>
      <div className="metric-card-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function HealthDistribution({ monitors }) {
  const counts = useMemo(() => monitors.reduce((result, monitor) => {
    if (!monitor.isActive) result.paused += 1;
    else if (monitor.currentStatus === 'UP') result.up += 1;
    else if (monitor.currentStatus === 'DOWN') result.down += 1;
    else result.waiting += 1;
    return result;
  }, { up: 0, down: 0, paused: 0, waiting: 0 }), [monitors]);
  const total = monitors.length;
  const segments = [
    { key: 'up', label: 'Operational', value: counts.up, color: 'var(--up)' },
    { key: 'down', label: 'Failing', value: counts.down, color: 'var(--down)' },
    { key: 'paused', label: 'Paused', value: counts.paused, color: 'var(--idle)' },
    { key: 'waiting', label: 'Waiting', value: counts.waiting, color: 'var(--warn)' },
  ];

  return (
    <section className="panel health-panel" aria-labelledby="health-heading">
      <div className="panel-head">
        <div>
          <h2 id="health-heading">Monitor health</h2>
          <p className="panel-sub">{total} {total === 1 ? 'monitor' : 'monitors'} by current state</p>
        </div>
      </div>
      {total ? (
        <>
          <div className="health-track" role="img" aria-label={segments.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}>
            {segments.filter((s) => s.value > 0).map((s) => (
              <span key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
            ))}
          </div>
          <div className="health-legend">
            {segments.map((s) => (
              <div key={s.key}>
                <span className={`health-key ${s.key}`} />
                <span>{s.label}</span>
                <strong>{s.value}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty compact-empty">Add a monitor to start tracking service health.</div>
      )}
    </section>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await api.get('/dashboard/summary');
      setData(response.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !data) {
    return <div className="page-state" role="status"><span className="loading-mark" /> Loading monitoring data…</div>;
  }
  if (!data) {
    return (
      <div className="page-state page-state-error" role="alert">
        <AlertTriangle size={20} />
        <div><strong>Dashboard unavailable</strong><p>{error || 'Could not load monitoring data.'}</p></div>
        <button className="btn btn-sm" onClick={load}>Try again</button>
      </div>
    );
  }

  const { totals, monitors, timeline } = data;
  const operational = monitors.filter((m) => m.isActive && m.currentStatus === 'UP').length;
  const failing = monitors.filter((m) => m.isActive && m.currentStatus === 'DOWN').length;
  const paused = monitors.filter((m) => !m.isActive).length;
  const sortedTimeline = [...timeline].sort((a, b) => Number(a.time) - Number(b.time));
  const chartData = [];
  sortedTimeline.forEach((point, index) => {
    const time = Number(point.time);
    if (index > 0) {
      const previous = Number(sortedTimeline[index - 1].time);
      for (let gap = previous + 10 * 60 * 1000; gap < time; gap += 10 * 60 * 1000) {
        chartData.push({ time: gap, avg: null, down: 0 });
      }
    }
    chartData.push({ time, avg: point.avg, down: point.down || 0 });
  });
  const hasDownPoints = chartData.some((point) => point.down > 0);

  return (
    <>
      <header className="page-head dashboard-head">
        <div>
          <div className="eyebrow"><Activity size={14} /> MONITORING</div>
          <h1>Overview</h1>
          <p>Current health and recent performance across your monitored services.</p>
        </div>
        <div className="dashboard-toolbar">
          <span className="range-control"><Clock3 size={15} /> Last 24 hours</span>
          <div className="refresh-control">
            <button className="icon-btn" type="button" onClick={load} disabled={refreshing} aria-label="Refresh dashboard" title="Refresh dashboard">
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            </button>
            <span>Refreshes every 15s</span>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add monitor</button>
        </div>
      </header>

      {error && (
        <div className="inline-alert" role="alert">
          <AlertTriangle size={16} /><span>Refresh failed: {error}. Showing the last loaded data.</span>
          <button className="text-btn" onClick={load}>Retry</button>
        </div>
      )}

      {failing > 0 ? (
        <div className="system-banner system-banner-down" role="alert">
          <AlertTriangle size={18} />
          <span><strong>{failing} {failing === 1 ? 'service needs' : 'services need'} attention.</strong> Review active incidents and recent checks.</span>
          <Link to="/incidents" className="banner-link">View incidents</Link>
        </div>
      ) : monitors.length > 0 && operational > 0 ? (
        <div className="system-banner system-banner-ok" role="status">
          <CheckCircle2 size={18} /><span>All active monitors are operational.</span>
        </div>
      ) : null}

      <section className="metric-grid" aria-label="Monitoring summary">
        <MetricCard label="Operational" value={operational} note={`of ${monitors.length} total monitors`} icon={CheckCircle2} tone="metric-up" />
        <MetricCard label="Failing" value={failing} note="active monitors reporting down" icon={AlertTriangle} tone={failing ? 'metric-down' : ''} />
        <MetricCard label="Paused" value={paused} note="excluded from operational count" icon={PauseCircle} tone="metric-muted" />
        <MetricCard label="Uptime" value={formatPct(totals.uptime24h)} note="availability from checks · 24h" icon={Activity} />
        <MetricCard label="Avg response" value={formatMs(totals.avgResponse)} note="recorded checks · 24h" icon={Timer} />
        <MetricCard label="Open incidents" value={totals.openIncidents} note={totals.openIncidents ? 'requiring attention' : 'no active incidents'} icon={Server} tone={totals.openIncidents ? 'metric-down' : ''} />
      </section>

      <div className="dashboard-grid">
        <section className="panel response-panel" aria-labelledby="response-heading">
          <div className="panel-head">
            <div>
              <h2 id="response-heading">Response time</h2>
              <p className="panel-sub">10-minute averages across all monitor checks · last 24 hours</p>
            </div>
            <span className="chart-legend-item"><i className="legend-line" /> Average response</span>
          </div>
          {chartData.length < 2 ? (
            <div className="chart-empty">
              <Activity size={20} />
              <strong>Not enough history yet</strong>
              <span>Response trends appear after checks have run.</span>
            </div>
          ) : (
            <div className="chart-box overview-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewResponseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b5ec68" stopOpacity={0.19} />
                      <stop offset="100%" stopColor="#b5ec68" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
                  <XAxis
                    dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']}
                    tickFormatter={formatTime} stroke="var(--chart-axis)" tickLine={false}
                    axisLine={false} fontSize={11} minTickGap={44}
                  />
                  <YAxis
                    stroke="var(--chart-axis)" tickLine={false} axisLine={false} fontSize={11}
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`}
                    width={56}
                  />
                  <Tooltip content={<ResponseTooltip />} cursor={{ stroke: 'var(--chart-cursor)' }} />
                  {hasDownPoints && chartData.filter((point) => point.down > 0).map((point) => (
                    <ReferenceArea
                      key={point.time}
                      x1={point.time - 5 * 60 * 1000}
                      x2={point.time + 5 * 60 * 1000}
                      fill="var(--down)"
                      fillOpacity={0.12}
                      stroke="none"
                    />
                  ))}
                  <Area type="monotone" dataKey="avg" stroke="#b5ec68" strokeWidth={2} fill="url(#overviewResponseFill)" isAnimationActive={false} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {hasDownPoints && <p className="chart-footnote"><i className="legend-down" /> Shaded areas indicate failed checks in the same time bucket.</p>}
        </section>

        <HealthDistribution monitors={monitors} />
      </div>

      <section className="panel monitor-panel">
        <div className="panel-head">
          <div>
            <h2>Monitors</h2>
            <p className="panel-sub">{monitors.length} monitored {monitors.length === 1 ? 'endpoint' : 'endpoints'} · latest status and 24-hour check history</p>
          </div>
          <Link to="/monitors" className="btn btn-sm">View all monitors</Link>
        </div>
        {monitors.length === 0 ? (
          <div className="empty">
            <Server size={24} />
            <h3>No monitors yet</h3>
            <p>Add a website or API endpoint to start collecting uptime and response data.</p>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add your first monitor</button>
          </div>
        ) : (
          <div className="table-wrap monitor-table-wrap">
            <table className="table monitor-table">
              <thead><tr><th>Monitor</th><th>Recent checks</th><th>Response · latest / avg</th><th>Uptime · 24h</th><th>Last checked</th></tr></thead>
              <tbody>{monitors.slice(0, 8).map((monitor) => <MonitorRow key={monitor._id} m={monitor} />)}</tbody>
            </table>
          </div>
        )}
      </section>

      {showAdd && <MonitorModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </>
  );
}
