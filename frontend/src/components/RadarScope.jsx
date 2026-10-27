import { useNavigate } from 'react-router-dom';
import { hashToUnit, formatMs } from '../utils';

// Radar pe har monitor ek blip hai.
// Center ke paas = fast response, bahar = slow response. Laal pulse = DOWN.
const CX = 180;
const CY = 180;
const R = 150;
const MIN_DISTANCE = 0.18;
const RESPONSE_RANGE_MS = 3000;
const DISTANCE_RANGE = 0.74;

const ringLabels = [0.25, 0.5, 0.75].map((f) => [
  String(f),
  formatMs(Math.round(((f - MIN_DISTANCE) / DISTANCE_RANGE) * RESPONSE_RANGE_MS)),
]);

export default function RadarScope({ monitors }) {
  const navigate = useNavigate();

  const blips = monitors.map((m) => {
    const angle = hashToUnit(m._id) * Math.PI * 2;
    const ms = m.avgResponse ?? m.lastResponse ?? 0;
    // 0ms -> centre ke paas, 3000ms+ -> kinara
    const dist = MIN_DISTANCE + Math.min(ms / RESPONSE_RANGE_MS, 1) * DISTANCE_RANGE;
    return {
      m,
      x: CX + Math.cos(angle) * R * dist,
      y: CY + Math.sin(angle) * R * dist,
      color: !m.isActive ? '#6c7794' : m.currentStatus === 'DOWN' ? '#ff6b6b' : m.currentStatus === 'UP' ? '#3dd6a5' : '#8c97b5',
    };
  });

  return (
    <svg className="scope" viewBox="0 0 360 360" role="img" aria-label="Radar view of your monitors">
      <defs>
        <radialGradient id="scopeBg" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#101610" />
          <stop offset="1" stopColor="#080b08" />
        </radialGradient>
        <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c8ff2e" stopOpacity="0" />
          <stop offset="1" stopColor="#c8ff2e" stopOpacity=".3" />
        </linearGradient>
        <clipPath id="scopeClip">
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
      </defs>

      <circle cx={CX} cy={CY} r={R + 8} fill="none" stroke="#263026" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R} fill="url(#scopeBg)" stroke="#384234" strokeWidth="1.5" />
      {[0.25, 0.5, 0.75].map((f) => (
        <circle key={f} cx={CX} cy={CY} r={R * f} fill="none" stroke="#30392c" strokeDasharray="2 5" />
      ))}
      <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="#30392c" />
      <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#30392c" />

      {/* ring labels */}
      {ringLabels.map(([f, label]) => (
        <text key={f} x={CX + 4} y={CY - R * Number(f) - 4} fontSize="9" fill="#838d7d">
          {label}
        </text>
      ))}

      <g clipPath="url(#scopeClip)">
        <g className="scope-sweep">
          <path d={`M${CX} ${CY} L${CX + R} ${CY} A${R} ${R} 0 0 0 ${CX + R * Math.cos(-0.9)} ${CY + R * Math.sin(-0.9)} Z`} fill="url(#sweepGrad)" />
          <line x1={CX} y1={CY} x2={CX + R} y2={CY} stroke="#c8ff2e" strokeWidth="1.5" />
        </g>
      </g>

      <circle cx={CX} cy={CY} r="3.5" fill="#c8ff2e" />

      {blips.map(({ m, x, y, color }) => (
        <g
          key={m._id}
          className={`blip ${m.currentStatus === 'DOWN' && m.isActive ? 'blip-down' : ''}`}
          onClick={() => navigate(`/monitors/${m._id}`)}
          tabIndex={0}
          role="link"
          onKeyDown={(e) => e.key === 'Enter' && navigate(`/monitors/${m._id}`)}
        >
          <title>{`${m.name}: ${m.currentStatus}${m.avgResponse != null ? `, avg ${formatMs(m.avgResponse)}` : ''}`}</title>
          <circle className="blip-ring" cx={x} cy={y} r="5" fill={color} opacity="0.6" />
          <circle cx={x} cy={y} r="6" fill={color} stroke="#080b08" strokeWidth="2" />
          <text x={x + 11} y={y + 4} fontSize="10.5" fill="#e0e8dc" style={{ pointerEvents: 'none' }}>
            {m.name.length > 14 ? `${m.name.slice(0, 13)}…` : m.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
