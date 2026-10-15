import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Trash2, RefreshCw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errorMessage } from '../api';
import { useToast } from '../toast';
import StatusPill from '../components/StatusPill';
import UptimeBar from '../components/UptimeBar';
import TimingBreakdown from '../components/TimingBreakdown';
import ColdStartCard from '../components/ColdStartCard';
import SleepSchedule from '../components/SleepSchedule';
import { IncidentTable } from './Incidents';
import { ChartTooltip } from './Overview';
import { formatDateTime, formatMs, formatPct, timeAgo } from '../utils';

const RANGES = ['1h', '24h', '7d', '30d'];

function axisLabel(range, t) {
  const d = new Date(t);
  return range === '7d' || range === '30d'
    ? d.toLocaleDateString([], { day: 'numeric', month: 'short' })
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [monitor, setMonitor] = useState(null);
  const [range, setRange] = useState('24h');
  const [checks, setChecks] = useState([]);
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [checking, setChecking] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, c, s, i] = await Promise.all([
        api.get(`/monitors/${id}`),
        api.get(`/monitors/${id}/checks`, { params: { range } }),
        api.get(`/monitors/${id}/stats`, { params: { range } }),
        api.get('/dashboard/incidents', { params: { monitorId: id } }),
      ]);
      setMonitor(m.data);
      setChecks(c.data);
      setStats(s.data);
      setIncidents(i.data);
    } catch (err) {
      if (err?.response?.status === 404) setMissing(true);
    }
  }, [id, range]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function checkNow() {
    setChecking(true);
    try {
      const { data } = await api.post(`/monitors/${id}/check`);
      toast(data.status === 'UP' ? `Up, responded in ${formatMs(data.responseTime)}` : `Down: ${data.error}`, data.status === 'UP' ? 'ok' : 'err');
      await load();
    } catch (err) {
      toast(errorMessage(err), 'err');
    } finally {
      setChecking(false);
    }
  }

  async function togglePause() {
    try {
      const { data } = await api.patch(`/monitors/${id}`, { isActive: !monitor.isActive });
      setMonitor(data);
      toast(data.isActive ? 'Monitor resumed' : 'Monitor paused');
    } catch (err) {
      toast(errorMessage(err), 'err');
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${monitor.name}" and all its history?`)) return;
    try {
      await api.delete(`/monitors/${id}`);
      toast('Monitor deleted');
      navigate('/monitors');
    } catch (err) {
      toast(errorMessage(err), 'err');
    }
  }

  if (missing) {
    return (
      <div className="empty">
        <h3>Monitor not found</h3>
        <p>It may have been deleted.</p>
        <Link to="/monitors" className="btn">Back to monitors</Link>
      </div>
    );
  }
  if (!monitor) return <div className="center-screen">Loading...</div>;

  const data = checks.map((c) => ({
    t: new Date(c.checkedAt).getTime(),
    ms: c.responseTime,
    status: c.status,
    cold: !!c.isColdStart,
  }));
  const history = checks.slice(-60).map((c) => c.status);
  const recent = [...checks].reverse().slice(0, 12);

  // DOWN = laal dot, cold start = purple dot
  const dotRenderer = (props) => {
    const { cx, cy, payload, index } = props;
    if (payload.status === 'DOWN') {
      return <circle key={index} cx={cx} cy={cy} r={5} fill="#ff6b6b" stroke="#0e1320" strokeWidth={2} />;
    }
    if (payload.cold) {
      return <circle key={index} cx={cx} cy={cy} r={6} fill="#b794f6" stroke="#0e1320" strokeWidth={2} />;
    }
    return <circle key={index} r={0} cx={cx} cy={cy} />;
  };

  return (
    <>
      <Link to="/monitors" className="back"><ArrowLeft size={16} /> All monitors</Link>

      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 12 }}>
            <h1>{monitor.name}</h1>
            <StatusPill status={monitor.currentStatus} paused={!monitor.isActive} />
          </div>
          <p>
            <a href={monitor.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{monitor.url}</a>
            {' '}· every {monitor.intervalMinutes} min · expects {monitor.expectedStatus}
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={checkNow} disabled={checking}>
            <RefreshCw size={16} className={checking ? 'spin' : ''} /> {checking ? 'Checking...' : 'Check now'}
          </button>
          <button className="btn" onClick={togglePause}>
            {monitor.isActive ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Resume</>}
          </button>
          <button className="btn btn-danger" onClick={remove}><Trash2 size={16} /> Delete</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Response time</h2>
            <p className="panel-sub">
              <span className="legend-dot" style={{ background: '#ff6b6b' }} /> failed check
              <span className="legend-dot" style={{ background: '#b794f6', marginLeft: 14 }} /> cold start
            </p>
          </div>
          <div className="tabs" role="tablist" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r} role="tab" aria-selected={range === r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>

        {stats && (
          <div className="stat-strip">
            <div><b className={stats.uptime != null && stats.uptime < 99 ? 'is-down' : 'is-up'}>{formatPct(stats.uptime)}</b><span>Uptime</span></div>
            <div><b>{formatMs(stats.avg)}</b><span>Average</span></div>
            <div><b>{formatMs(stats.p95)}</b><span>Slowest 5% (p95)</span></div>
            <div><b>{formatMs(stats.min)}</b><span>Fastest</span></div>
            <div><b>{formatMs(stats.max)}</b><span>Slowest</span></div>
          </div>
        )}

        <div className="chart-box">
          {data.length < 2 ? (
            <div className="empty">Not enough checks in this range yet. Use “Check now” to add one.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#26304a" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => axisLabel(range, t)} stroke="#5a6585" tickLine={false} axisLine={false} fontSize={12} minTickGap={40} />
                <YAxis stroke="#5a6585" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}s` : `${v}ms`)} />
                {stats?.avg != null && <ReferenceLine y={stats.avg} stroke="#8c97b5" strokeDasharray="4 6" />}
                <Tooltip content={<ChartTooltip labelFormatter={(t) => formatDateTime(t)} />} />
                <Line type="monotone" dataKey="ms" stroke="#f5b042" strokeWidth={2.2} dot={dotRenderer} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <p className="panel-sub" style={{ marginBottom: 8 }}>Last {history.length} checks</p>
          <UptimeBar history={history} slots={60} />
        </div>
      </div>

      <ColdStartCard stats={stats} />

      <TimingBreakdown stats={stats} checks={checks} />

      <SleepSchedule monitor={monitor} onSaved={setMonitor} />

      <div className="two-col">
        <div className="panel">
          <h2 style={{ marginBottom: 12 }}>Recent checks</h2>
          {recent.length === 0 ? (
            <div className="empty">No checks yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Result</th><th>Code</th><th>Time</th><th>When</th></tr></thead>
                <tbody>
                  {recent.map((c, i) => (
                    <tr key={i}>
                      <td>
                        {c.isColdStart ? (
                          <span className="pill cold">Cold start</span>
                        ) : (
                          <span className={`pill ${c.status === 'UP' ? 'up' : 'down'}`}>{c.status === 'UP' ? 'Up' : 'Down'}</span>
                        )}
                      </td>
                      <td>{c.statusCode ?? '-'}</td>
                      <td>{formatMs(c.responseTime)}</td>
                      <td title={c.error || ''}>{timeAgo(c.checkedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h2 style={{ marginBottom: 12 }}>Incidents</h2>
          <IncidentTable incidents={incidents} showMonitor={false} />
        </div>
      </div>
    </>
  );
}