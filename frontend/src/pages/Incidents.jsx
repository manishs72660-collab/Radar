import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { formatDateTime, formatDuration } from '../utils';

export function IncidentTable({ incidents, showMonitor = true }) {
  if (!incidents.length) {
    return (
      <div className="empty compact-empty">
        <CheckCircle2 size={22} />
        <h3>No incidents in this view</h3>
        <p>Incidents are recorded after repeated failed checks and resolved when service recovers.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table incident-table">
        <thead>
          <tr><th>Status</th>{showMonitor && <th>Monitor</th>}<th>Started</th><th>Duration</th><th>Cause</th></tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident._id}>
              <td><span className={`pill ${incident.status === 'OPEN' ? 'down' : 'up'}`}>{incident.status === 'OPEN' ? 'Ongoing' : 'Resolved'}</span></td>
              {showMonitor && <td><Link to={`/monitors/${incident.monitorId}`} className="table-link">{incident.monitorName}</Link></td>}
              <td className="incident-time">{formatDateTime(incident.startedAt)}</td>
              <td className="mono-cell">{incident.status === 'OPEN' ? formatDuration(Math.max(0, Math.round((Date.now() - new Date(incident.startedAt)) / 1000))) : formatDuration(incident.durationSeconds)}</td>
              <td className="incident-cause">{incident.cause || 'Cause not recorded'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Incidents() {
  const [incidents, setIncidents] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.get('/dashboard/incidents');
        if (active) {
          setIncidents(data);
          setError('');
        }
      } catch (err) {
        if (active) setError(errorMessage(err));
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const openCount = incidents?.filter((incident) => incident.status === 'OPEN').length || 0;
  const filtered = useMemo(() => (incidents || []).filter((incident) => filter === 'all' || incident.status === filter.toUpperCase()), [incidents, filter]);

  if (!incidents && !error) return <div className="page-state" role="status"><span className="loading-mark" /> Loading incidents…</div>;
  if (!incidents) {
    return <div className="page-state page-state-error" role="alert"><AlertTriangle size={20} /><div><strong>Incidents unavailable</strong><p>{error}</p></div></div>;
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow"><AlertTriangle size={14} /> EVENT HISTORY</div>
          <h1>Incidents</h1>
          <p>{openCount ? `${openCount} ongoing · ${incidents.length} total recorded` : `${incidents.length} recorded · no active incidents`}</p>
        </div>
      </header>
      {error && <div className="inline-alert" role="alert"><AlertTriangle size={16} /><span>Refresh failed: {error}</span></div>}
      <section className="panel incident-panel">
        <div className="list-toolbar">
          <div className="incident-filter" role="tablist" aria-label="Filter incidents">
            {[
              ['all', 'All', incidents.length],
              ['open', 'Ongoing', openCount],
              ['resolved', 'Resolved', incidents.length - openCount],
            ].map(([key, label, count]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key)}>
                {label}<span>{count}</span>
              </button>
            ))}
          </div>
          <span className="result-count"><Clock3 size={14} /> Auto-refresh · 15s</span>
        </div>
        <IncidentTable incidents={filtered} />
      </section>
    </>
  );
}
