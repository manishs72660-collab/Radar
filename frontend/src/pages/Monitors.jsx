import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Search, Server } from 'lucide-react';
import api, { errorMessage } from '../api';
import MonitorRow from '../components/MonitorRow';
import MonitorModal from '../components/MonitorModal';

export default function Monitors() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/dashboard/summary');
      setData(response.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const monitors = data?.monitors || [];
  const filtered = useMemo(() => monitors.filter((monitor) => {
    const matchesText = `${monitor.name} ${monitor.url}`.toLowerCase().includes(query.trim().toLowerCase());
    const status = !monitor.isActive ? 'paused' : monitor.currentStatus === 'UP' ? 'up' : monitor.currentStatus === 'DOWN' ? 'down' : 'waiting';
    return matchesText && (statusFilter === 'all' || status === statusFilter);
  }), [monitors, query, statusFilter]);

  if (loading && !data) return <div className="page-state" role="status"><span className="loading-mark" /> Loading monitors…</div>;
  if (!data) {
    return (
      <div className="page-state page-state-error" role="alert">
        <AlertTriangle size={20} /><div><strong>Monitors unavailable</strong><p>{error}</p></div>
        <button className="btn btn-sm" onClick={load}>Try again</button>
      </div>
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow"><Server size={14} /> ENDPOINTS</div>
          <h1>Monitors</h1>
          <p>Manage your monitored websites and APIs.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add monitor</button>
      </header>

      {error && <div className="inline-alert" role="alert"><AlertTriangle size={16} /><span>Refresh failed: {error}</span><button className="text-btn" onClick={load}>Retry</button></div>}

      <section className="panel monitor-panel">
        <div className="list-toolbar">
          <div className="search-control">
            <Search size={16} aria-hidden="true" />
            <input className="input" placeholder="Search by name or URL" aria-label="Search monitors" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="filter-control">
            <label htmlFor="monitor-status">Status</label>
            <select id="monitor-status" className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="up">Operational</option>
              <option value="down">Down</option>
              <option value="paused">Paused</option>
              <option value="waiting">Waiting</option>
            </select>
          </div>
          <span className="result-count">{filtered.length} of {monitors.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <Server size={24} />
            <h3>{monitors.length ? 'No matching monitors' : 'No monitors yet'}</h3>
            <p>{monitors.length ? 'Try another search or status filter.' : 'Add a website or API endpoint to start collecting health data.'}</p>
            {!monitors.length && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add your first monitor</button>}
          </div>
        ) : (
          <div className="table-wrap monitor-table-wrap">
            <table className="table monitor-table">
              <thead><tr><th>Monitor</th><th>Recent checks</th><th>Response · latest / avg</th><th>Uptime · 24h</th><th>Last checked</th></tr></thead>
              <tbody>{filtered.map((monitor) => <MonitorRow key={monitor._id} m={monitor} />)}</tbody>
            </table>
          </div>
        )}
      </section>

      {showAdd && <MonitorModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </>
  );
}
