import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dayTicks, prepareChartData } from '../chartData';
import { formatDateTime, formatMs } from '../utils';

const C = { line: '#f5b042', down: '#ff6b6b', cold: '#b794f6', grid: '#26304a', axis: '#5a6585', avg: '#8c97b5' };

function axisLabel(range, t) {
  const d = new Date(t);
  return range === '7d' || range === '30d'
    ? d.toLocaleDateString([], { day: 'numeric', month: 'short' })
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Tip({ active, payload, kind }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const box = { background: '#1b2338', border: '1px solid #34415f', borderRadius: 10, padding: '9px 12px', fontSize: 13, minWidth: 160 };
  const row = (label, value, color) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
      <span style={{ color: color || '#8c97b5' }}>{label}</span>
      <b>{value}</b>
    </div>
  );

  if (kind === 'series') {
    const end = new Date(d.t + d.bucketMs);
    const when = `${formatDateTime(d.t)} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return (
      <div style={box}>
        <div style={{ color: '#8c97b5', marginBottom: 4 }}>{when}</div>
        {row('Average', formatMs(d.value))}
        {row('Fastest', formatMs(d.min))}
        {row('Slowest', formatMs(d.max))}
        {row('Checks', d.total)}
        {d.down > 0 && row('Failed', d.down, C.down)}
        {d.cold > 0 && row('Cold starts', d.cold, C.cold)}
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ color: '#8c97b5', marginBottom: 4 }}>{formatDateTime(d.t)}</div>
      {d.down ? row('Failed', d.error || 'No response', C.down) : row(d.cold ? 'Cold start' : 'Response', formatMs(d.value), d.cold ? C.cold : undefined)}
      {d.code ? row('Status', d.code) : null}
    </div>
  );
}

// Sirf graph (size bahar se milta hai, isliye alag se test ho sakta hai)
export function ChartBody({ prepared, kind, range, avg, width, height }) {
  const { data, cap, downMarks } = prepared;
  const longRange = range === '7d' || range === '30d';
  const ticks = longRange && data.length ? dayTicks(data[0].t, data[data.length - 1].t) : [];

  const dot = (props) => {
    const { cx, cy, payload, index } = props;
    if (cx == null || cy == null) return <g key={index} />;
    if (payload.cold) return <circle key={index} cx={cx} cy={cy} r={5.5} fill={C.cold} stroke="#0e1320" strokeWidth={2} />;
    return <g key={index} />;
  };

  return (
    <ComposedChart width={width} height={height} data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.line} stopOpacity={0.5} />
          <stop offset="100%" stopColor={C.line} stopOpacity={0.2} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke={C.grid} strokeDasharray="3 6" vertical={false} />
      <XAxis
        dataKey="t"
        type="number"
        scale="time"
        domain={['dataMin', 'dataMax']}
        ticks={ticks.length ? ticks : undefined}
        tickFormatter={(t) => axisLabel(range, t)}
        stroke={C.axis}
        tickLine={false}
        axisLine={false}
        fontSize={12}
        minTickGap={44}
      />
      <YAxis
        domain={[0, cap || 'auto']}
        allowDataOverflow
        stroke={C.axis}
        tickLine={false}
        axisLine={false}
        fontSize={12}
        width={60}
        tickFormatter={(v) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}s` : `${v}ms`)}
      />
      <Tooltip content={<Tip kind={kind} />} cursor={{ stroke: '#34415f' }} />

      {kind === 'series'
        ? downMarks.map((d) => (
            <ReferenceArea key={`a${d.t}`} x1={d.t} x2={d.t + d.bucketMs} fill={C.down} fillOpacity={0.3} stroke="none" ifOverflow="hidden" />
          ))
        : downMarks.map((d) => <ReferenceLine key={`l${d.t}`} x={d.t} stroke={C.down} strokeOpacity={0.6} strokeWidth={2} />)}

      {avg != null && (!cap || avg <= cap) && <ReferenceLine y={avg} stroke={C.avg} strokeDasharray="4 6" />}

      {kind === 'series' && <Area dataKey="band" type="monotone" stroke="none" fill="url(#bandGrad)" isAnimationActive={false} connectNulls={false} />}
      <Line dataKey="plot" type="monotone" stroke={C.line} strokeWidth={2.2} dot={dot} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
    </ComposedChart>
  );
}

export default function ResponseChart({ kind, range, checks, points, bucketMinutes, avg }) {
  const prepared = prepareChartData({ kind, checks, points, bucketMinutes });

  return (
    <div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          {/* ResponsiveContainer size deta hai, ChartBody use bhar leta hai */}
          <SizedChart prepared={prepared} kind={kind} range={range} avg={avg} />
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        {kind === 'series' && <span><i className="lg-band" /> fastest to slowest</span>}
        <span><i className="lg-line" /> {kind === 'series' ? 'average' : 'response time'}</span>
        <span><i className="lg-dot" style={{ background: C.cold }} /> cold start</span>
        <span><i className="lg-dot" style={{ background: C.down }} /> failed check</span>
      </div>
      {prepared.clipped && (
        <p className="chart-note">
          Graph is scaled to normal speed so cold starts do not flatten it. Cold starts sit at the top, hover one for its real time.
        </p>
      )}
    </div>
  );
}

// ResponsiveContainer apne child ko width aur height props deta hai
function SizedChart(props) {
  const { width, height, ...rest } = props;
  return <ChartBody {...rest} width={width} height={height} />;
}