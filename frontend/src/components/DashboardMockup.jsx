export default function DashboardMockup() {
  return (
    <figure className="preview-dashboard" aria-label="Illustrative preview of the Radar monitoring dashboard">
      <div className="preview-topbar">
        <div><span className="preview-brand-mark">R</span><strong>Radar</strong><span className="preview-divider">/</span><span>Overview</span></div>
        <span className="preview-data-label">ILLUSTRATIVE DATA</span>
      </div>
      <div className="preview-toolbar">
        <div><strong>Overview</strong><span>Monitoring summary</span></div>
        <span className="preview-range">Last 24 hours</span>
      </div>
      <div className="preview-metrics">
        <div><span>OPERATIONAL</span><b className="preview-up">08</b><small>active monitors</small></div>
        <div><span>UPTIME</span><b>99.98%</b><small>availability · 24h</small></div>
        <div><span>AVG RESPONSE</span><b>142 <i>ms</i></b><small>recorded checks · 24h</small></div>
      </div>
      <div className="preview-content">
        <section className="preview-chart">
          <div className="preview-panel-head"><strong>Response time</strong><span>10-minute averages</span></div>
          <svg viewBox="0 0 560 130" preserveAspectRatio="none" aria-hidden="true">
            {[22, 53, 84, 115].map((y) => <line key={y} x1="0" x2="560" y1={y} y2={y} className="preview-grid-line" />)}
            <path d="M0 94 C24 89 35 99 57 84 S92 66 112 78 S142 99 166 75 S201 61 220 70 S249 86 274 64 S309 69 328 57 S357 65 378 50 S410 58 429 43 S462 59 482 46 S517 40 535 49 S548 38 560 34 L560 130 L0 130Z" className="preview-area" />
            <path d="M0 94 C24 89 35 99 57 84 S92 66 112 78 S142 99 166 75 S201 61 220 70 S249 86 274 64 S309 69 328 57 S357 65 378 50 S410 58 429 43 S462 59 482 46 S517 40 535 49 S548 38 560 34" className="preview-line" />
          </svg>
          <div className="preview-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span></div>
        </section>
        <section className="preview-services">
          <div className="preview-panel-head"><strong>Monitors</strong><span>Current status</span></div>
          {[
            ['Website', 'example.com', 'Operational', 'ok'],
            ['API', 'api.example.com', 'Operational', 'ok'],
            ['Docs', 'docs.example.com', 'Paused', 'idle'],
          ].map(([name, host, status, tone]) => (
            <div className="preview-service" key={name}>
              <span className={`preview-status ${tone}`} />
              <div><b>{name}</b><small>{host}</small></div>
              <span className={`preview-state ${tone}`}>{status}</span>
            </div>
          ))}
        </section>
      </div>
      <figcaption>Illustrative interface preview · sample values, not live service data</figcaption>
    </figure>
  );
}
