import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import Logo from '../components/Logo';
import { formatDateTime, formatDuration } from '../utils';
import { heatLevel } from '../chartData';

const OVERALL = {
  operational: { cls: 'ok', title: 'All systems operational', sub: 'Everything is running normally.' },
  partial_outage: { cls: 'warn', title: 'Some systems are down', sub: 'We are aware and looking into it.' },
  major_outage: { cls: 'bad', title: 'Major outage', sub: 'Most systems are not responding right now.' },
  unknown: { cls: 'idle', title: 'No data yet', sub: 'This page has no active monitors.' },
};

const STATUS_LABEL = { UP: ['up', 'Operational'], DOWN: ['down', 'Down'], PAUSED: ['', 'Paused'], PENDING: ['', 'Waiting'] };

function dayClass(uptime) {
  const level = heatLevel(uptime);
  if (level === 'l4' || level === 'l3') return 'up';
  if (level === 'l2') return 'warn';
  if (level === 'l1') return 'down';
  return '';
}

function DayBars({ days }) {
  return (
    <div className="day-bars" role="img" aria-label="Uptime for the last 90 days">
      {days.map((d) => (
        <i
          key={d.date}
          className={dayClass(d.uptime)}
          title={`${d.date}: ${d.uptime == null ? 'no data' : `${d.uptime}% uptime`}`}
        />
      ))}
    </div>
  );
}

export default function PublicStatus() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    let timer;
    setData(null);
    setNotFound(false);

    const load = async () => {
      try {
        const { data: page } = await api.get(`/public/status/${slug}`);
        if (active) setData(page);
      } catch (err) {
        if (!active) return;
        if (err?.response?.status === 404) {
          clearInterval(timer);
          setNotFound(true);
        }
      }
    };

    load();
    timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [slug]);

  useEffect(() => {
    if (data?.title) document.title = `${data.title} - Status`;
  }, [data]);

  if (notFound) {
    return (
      <div className="center-screen">
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'var(--text)', marginBottom: 8 }}>Status page not found</h1>
          <p>Check the address and try again.</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="center-screen">Loading...</div>;

  const overall = OVERALL[data.overall] || OVERALL.unknown;

  return (
    <div className="pub">
      <header className="pub-head">
        <h1>{data.title}</h1>
        {data.description && <p>{data.description}</p>}
      </header>

      <div className={`pub-banner ${overall.cls}`} role="status">
        <span className="pub-dot" />
        <div>
          <b>{overall.title}</b>
          <span>{overall.sub}</span>
        </div>
      </div>

      <section className="pub-card">
        {data.monitors.length === 0 ? (
          <p className="panel-sub" style={{ textAlign: 'center', padding: 24 }}>No services are listed on this page yet.</p>
        ) : (
          data.monitors.map((m) => {
            const [cls, label] = STATUS_LABEL[m.status] || ['', m.status];
            return (
              <div key={m.id} className="pub-monitor">
                <div className="pub-monitor-head">
                  <strong>{m.name}</strong>
                  <span className={`pill ${cls}`}>{label}</span>
                </div>
                <DayBars days={m.days} />
                <div className="pub-monitor-foot">
                  <span>90 days ago</span>
                  <b>{m.uptime90 == null ? 'No data' : `${m.uptime90}% uptime`}</b>
                  <span>Today</span>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Past incidents</h2>
        <div className="pub-card">
          {data.incidents.length === 0 ? (
            <p className="panel-sub" style={{ textAlign: 'center', padding: 24 }}>No incidents in the last 30 days.</p>
          ) : (
            data.incidents.map((i) => (
              <div key={i.id} className="pub-incident">
                <div className="pub-monitor-head">
                  <strong>{i.monitorName}</strong>
                  <span className={`pill ${i.status === 'OPEN' ? 'down' : 'up'}`}>{i.status === 'OPEN' ? 'Ongoing' : 'Resolved'}</span>
                </div>
                <p className="panel-sub">
                  {formatDateTime(i.startedAt)}
                  {i.status === 'RESOLVED' && <> · lasted {formatDuration(i.durationSeconds)}</>}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="pub-foot">
        <Logo size={18} /> Powered by Radar · updates every 30 seconds
      </footer>
    </div>
  );
}