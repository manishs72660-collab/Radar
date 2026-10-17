import { heatCells, heatLevel, heatMonths } from '../chartData';

const dateLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function Heatmap({ days }) {
  const { cells, weeks } = heatCells(days);
  const months = heatMonths(cells);
  const withData = days.filter((d) => d.uptime != null).length;

  return (
    <div>
      <div className="heat-scroll">
        <div className="heat" style={{ '--weeks': weeks }}>
          <div className="heat-months">
            {months.map((m) => (
              <span key={m.col} style={{ gridColumn: m.col + 1 }}>{m.label}</span>
            ))}
          </div>
          <div className="heat-grid" role="img" aria-label="Uptime for each of the last 90 days">
            {cells.map((d, i) =>
              d ? (
                <i
                  key={d.date}
                  className={`heat-cell ${heatLevel(d.uptime)}`}
                  title={
                    d.uptime == null
                      ? `${dateLabel(d.date)}: no data`
                      : `${dateLabel(d.date)}: ${d.uptime}% uptime` +
                        (d.down ? `, ${d.down} failed check${d.down > 1 ? 's' : ''}` : '') +
                        (d.coldStarts ? `, ${d.coldStarts} cold start${d.coldStarts > 1 ? 's' : ''}` : '')
                  }
                />
              ) : (
                <i key={`pad-${i}`} className="heat-cell pad" />
              )
            )}
          </div>
        </div>
      </div>

      <div className="heat-legend">
        <span>{withData} of {days.length} days have data</span>
        <span className="heat-key">
          <em>Less</em>
          <i className="heat-cell l1" /><i className="heat-cell l2" /><i className="heat-cell l3" /><i className="heat-cell l4" />
          <em>More uptime</em>
        </span>
      </div>
    </div>
  );
}