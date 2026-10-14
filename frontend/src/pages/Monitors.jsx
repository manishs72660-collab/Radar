import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import api from '../api';
import MonitorRow from '../components/MonitorRow';
import MonitorModal from '../components/MonitorModal';

export default function Monitors() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    api.get('/dashboard/summary').then((r) => setData(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <div className="center-screen">Loading...</div>;

  const list = data.monitors.filter((m) => `${m.name} ${m.url}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Monitors</h1>
          <p>{data.monitors.length} {data.monitors.length === 1 ? 'monitor' : 'monitors'} in total</p>
        </div>
        <div className="row">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: '#8c97b5' }} />
            <input className="input" style={{ paddingLeft: 34, width: 220 }} placeholder="Search monitors" aria-label="Search monitors" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={17} /> Add monitor
          </button>
        </div>
      </div>

      <div className="panel">
        {list.length === 0 ? (
          <div className="empty">
            <h3>{data.monitors.length ? 'No match' : 'No monitors yet'}</h3>
            <p>{data.monitors.length ? 'Try a different name or URL.' : 'Add a URL and Radar starts checking it right away.'}</p>
          </div>
        ) : (
          <div className="mon-list">{list.map((m) => <MonitorRow key={m._id} m={m} />)}</div>
        )}
      </div>

      {showAdd && <MonitorModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </>
  );
}
