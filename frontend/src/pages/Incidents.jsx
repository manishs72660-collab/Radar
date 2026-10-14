import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatDateTime, formatDuration } from '../utils';

export function IncidentTable({ incidents, showMonitor = true }) {
  if (!incidents.length) {
    return (
      <div className="empty">
        <h3>No incidents</h3>
        <p>When a site fails 3 checks in a row, Radar records it here.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Status</th>
            {showMonitor && <th>Monitor</th>}
            <th>Started</th>
            <th>Duration</th>
            <th>Cause</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i._id}>
              <td><span className={`pill ${i.status === 'OPEN' ? 'down' : 'up'}`}>{i.status === 'OPEN' ? 'Ongoing' : 'Resolved'}</span></td>
              {showMonitor && <td><Link to={`/monitors/${i.monitorId}`} style={{ fontWeight: 600 }}>{i.monitorName}</Link></td>}
              <td>{formatDateTime(i.startedAt)}</td>
              <td>{i.status === 'OPEN' ? formatDuration(Math.round((Date.now() - new Date(i.startedAt)) / 1000)) : formatDuration(i.durationSeconds)}</td>
              <td>{i.cause || 'Unknown'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Incidents() {
  const [incidents, setIncidents] = useState(null);

  useEffect(() => {
    const load = () => api.get('/dashboard/incidents').then((r) => setIncidents(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!incidents) return <div className="center-screen">Loading...</div>;

  const open = incidents.filter((i) => i.status === 'OPEN').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Incidents</h1>
          <p>{open ? `${open} ongoing` : 'Nothing is down right now'}</p>
        </div>
      </div>
      <div className="panel">
        <IncidentTable incidents={incidents} />
      </div>
    </>
  );
}
