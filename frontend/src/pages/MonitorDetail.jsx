import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Trash2, RefreshCw, Pencil, AlertTriangle } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useToast } from '../toast';
import StatusPill from '../components/StatusPill';
import UptimeBar from '../components/UptimeBar';
import ResponseChart from '../components/ResponseChart';
import Heatmap from '../components/Heatmap';
import Skeleton from '../components/Skeleton';
import TimingBreakdown from '../components/TimingBreakdown';
import ColdStartCard from '../components/ColdStartCard';
import SleepSchedule from '../components/SleepSchedule';
import MonitorModal from '../components/MonitorModal';
import { IncidentTable } from './Incidents';
import { formatMs, formatPct, timeAgo } from '../utils';
import { heatLevel, heatLevelColorClass } from '../chartData';

const RANGES = ['1h', '24h', '7d', '30d'];
const isSeriesRange = (r) => r === '7d' || r === '30d';

export default function MonitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [monitor, setMonitor] = useState(null);
  const [range, setRange] = useState('24h');
  const [chart, setChart] = useState(null); // { range, kind, checks | points, bucketMinutes }
  const [stats, setStats] = useState(null); // { range, data }
  const [recent, setRecent] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [heatmapError, setHeatmapError] = useState('');
  const [heatmapAttempt, setHeatmapAttempt] = useState(0);
  const [checking, setChecking] = useState(false);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const latest = useRef(0); // purana jawab naye jawab ko na dabaye

  const load = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const series = isSeriesRange(range);
      const rawRange = series ? '24h' : range;
      const [m, s, i, raw, ser] = await Promise.all([
        api.get(`/monitors/${id}`),
        api.get(`/monitors/${id}/stats`, { params: { range } }),
        api.get('/dashboard/incidents', { params: { monitorId: id } }),
        api.get(`/monitors/${id}/checks`, { params: { range: rawRange } }),
        series ? api.get(`/monitors/${id}/series`, { params: { range } }) : Promise.resolve(null),
      ]);
      if (mine !== latest.current) return;

      setMonitor(m.data);
      setLoadError('');
      setStats({ range, data: s.data });
      setIncidents(i.data);
      setRecent(raw.data);
      setChart(
        series
          ? { range, kind: 'series', points: ser.data.points, bucketMinutes: ser.data.bucketMinutes }
          : { range, kind: 'raw', checks: raw.data }
      );
    } catch (err) {
      if (mine === latest.current && err?.response?.status === 404) setMissing(true);
      else if (mine === latest.current) setLoadError(errorMessage(err));
    }
  }, [id, range]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // Heatmap kam badalta hai, isliye 5 minute mein ek baar
  useEffect(() => {
    let alive = true;
    const fetchHeatmap = () =>
      api
        .get(`/monitors/${id}/heatmap`)
        .then((r) => {
          if (alive) {
            setHeatmap(r.data);
            setHeatmapError('');
          }
        })
        .catch((err) => alive && setHeatmapError(errorMessage(err)));
    fetchHeatmap();
    const t = setInterval(fetchHeatmap, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, heatmapAttempt]);

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
  if (!monitor) {
    if (loadError) {
      return (
        <div className="page-state page-state-error" role="alert">
          <AlertTriangle size={20} /><div><strong>Monitor details unavailable</strong><p>{loadError}</p></div>
          <button className="btn btn-sm" onClick={load}>Try again</button>
        </div>
      );
    }
    return (
      <>
        <Skeleton height={34} width={260} style={{ marginBottom: 12 }} />
        <Skeleton height={18} width={380} style={{ marginBottom: 28 }} />
        <Skeleton height={420} radius={16} />
      </>
    );
  }

  // Range badalte hi purana graph nahi, skeleton dikhao
  const chartReady = chart && chart.range === range;
  const statsReady = stats && stats.range === range;
  const s = statsReady ? stats.data : null;
  const series = isSeriesRange(range);

  const history = recent.slice(-60).map((c) => c.status);
  const recentRows = [...recent].reverse().slice(0, 12);

  // "Where the time goes" ke chart ke liye: normal checks ka breakdown
  let timeline = [];
  if (chartReady) {
    timeline =
      chart.kind === 'series'
        ? chart.points.filter((p) => p.timings).map((p) => ({ t: p.t, ...p.timings }))
        : chart.checks
            .filter((c) => c.status === 'UP' && !c.isColdStart && c.timings && c.timings.ttfb != null)
            .map((c) => ({ t: new Date(c.checkedAt).getTime(), ...c.timings }));
  }

  const enough = chartReady && (chart.kind === 'series' ? chart.points.length >= 2 : chart.checks.length >= 2);

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
          <button className="btn" onClick={() => setShowEdit(true)}><Pencil size={15} /> Edit</button>
          <button className="btn" onClick={checkNow} disabled={checking}>
            <RefreshCw size={16} className={checking ? 'spin' : ''} /> {checking ? 'Checking...' : 'Check now'}
          </button>
          <button className="btn" onClick={togglePause}>
            {monitor.isActive ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Resume</>}
          </button>
          <button className="btn btn-danger" onClick={remove}><Trash2 size={16} /> Delete</button>
        </div>
      </div>

      {loadError && <div className="inline-alert" role="alert"><AlertTriangle size={16} /><span>Could not refresh monitor data: {loadError}</span><button className="text-btn" onClick={load}>Retry</button></div>}

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Response time</h2>
            <p className="panel-sub">
              {series ? 'Each point is the average for a few hours, the shaded band is fastest to slowest' : 'Each point is one check'}
            </p>
          </div>
          <div className="tabs" role="tablist" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r} role="tab" aria-selected={range === r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>

        {statsReady ? (
          <div className="stat-strip">
            <div><b className={heatLevelColorClass(heatLevel(s.uptime))}>{formatPct(s.uptime)}</b><span>Uptime</span></div>
            <div><b>{formatMs(s.avg)}</b><span>Average</span></div>
            {s.p95 != null ? (
              <div><b>{formatMs(s.p95)}</b><span>Slowest 5% (p95)</span></div>
            ) : (
              <div><b>{s.total}</b><span>Checks</span></div>
            )}
            <div><b>{formatMs(s.min)}</b><span>Fastest</span></div>
            <div><b>{formatMs(s.max)}</b><span>Slowest</span></div>
          </div>
        ) : (
          <div className="stat-strip">
            {[0, 1, 2, 3, 4].map((n) => <div key={n}><Skeleton height={30} width={90} style={{ marginBottom: 8 }} /><Skeleton height={14} width={60} /></div>)}
          </div>
        )}

        {!chartReady ? (
          <Skeleton height={300} radius={12} />
        ) : !enough ? (
          <div className="chart-box">
            <div className="empty">
              {series
                ? 'No history in this range yet. Hourly summaries build up as checks run, so a new monitor needs a few hours.'
                : 'Not enough checks in this range yet. Use “Check now” to add one.'}
            </div>
          </div>
        ) : (
          <ResponseChart
            kind={chart.kind}
            range={range}
            checks={chart.checks}
            points={chart.points}
            bucketMinutes={chart.bucketMinutes}
            avg={s ? s.avg : null}
          />
        )}

        <div style={{ marginTop: 18 }}>
          <p className="panel-sub" style={{ marginBottom: 8 }}>Last {history.length} checks</p>
          <UptimeBar history={history} slots={60} />
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head">
          <div>
            <h2>Last 90 days</h2>
            <p className="panel-sub">One square per day (UTC). Hover for details.</p>
          </div>
        </div>
        {heatmap ? <Heatmap days={heatmap} /> : heatmapError ? (
          <div className="empty compact-empty" role="alert">
            <p>Uptime history could not be loaded: {heatmapError}</p>
            <button className="btn btn-sm" onClick={() => setHeatmapAttempt((value) => value + 1)}>Retry</button>
          </div>
        ) : <Skeleton height={130} radius={12} />}
      </div>

      <ColdStartCard stats={s} />

      <TimingBreakdown stats={s} timeline={timeline} />

      <SleepSchedule monitor={monitor} onSaved={setMonitor} />

      <div className="two-col">
        <div className="panel">
          <h2 style={{ marginBottom: 12 }}>Recent checks</h2>
          {recentRows.length === 0 ? (
            <div className="empty">No checks yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Result</th><th>Code</th><th>Time</th><th>When</th></tr></thead>
                <tbody>
                  {recentRows.map((c, i) => (
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
                      <td title={c.error || ''}>
                        {timeAgo(c.checkedAt)}
                        {c.status === 'DOWN' && c.error && <small className="check-error">{c.error}</small>}
                      </td>
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
      {showEdit && <MonitorModal monitor={monitor} onClose={() => setShowEdit(false)} onSaved={load} />}
    </>
  );
}