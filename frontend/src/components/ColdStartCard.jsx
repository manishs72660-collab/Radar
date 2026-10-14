import { Snowflake } from 'lucide-react';
import { formatMs } from '../utils';

export default function ColdStartCard({ stats }) {
  if (!stats) return null;

  const { coldStarts, coldAvgTtfb, normalTtfb } = stats;

  if (!coldStarts) {
    return (
      <div className="panel cold-card" style={{ marginTop: 20 }}>
        <div className="cold-icon quiet"><Snowflake size={20} /></div>
        <div>
          <h2>Cold starts</h2>
          <p className="panel-sub">None detected in this range. Radar needs about 5 normal checks first to learn what “normal” looks like for this site.</p>
        </div>
      </div>
    );
  }

  const times = normalTtfb ? Math.round(coldAvgTtfb / normalTtfb) : null;

  return (
    <div className="panel cold-card" style={{ marginTop: 20 }}>
      <div className="cold-icon"><Snowflake size={20} /></div>
      <div style={{ flex: 1 }}>
        <h2>Cold starts</h2>
        <p style={{ marginTop: 4 }}>
          Your site went to sleep <b>{coldStarts} {coldStarts === 1 ? 'time' : 'times'}</b> in this range. After sleeping, the first visitor waited about <b>{formatMs(coldAvgTtfb)}</b>
          {normalTtfb ? <> instead of the usual <b>{formatMs(normalTtfb)}</b>{times ? ` (${times}x slower)` : ''}</> : null}.
        </p>
        <p className="panel-sub" style={{ marginTop: 8 }}>
          This is not a bug in your code. Free and cheap hosts pause idle apps and wake them on the next request.
          Radar counts these as <b>up</b>, not as downtime.
        </p>
      </div>
      <div className="cold-num">
        <b>{coldStarts}</b>
        <span>cold {coldStarts === 1 ? 'start' : 'starts'}</span>
      </div>
    </div>
  );
}