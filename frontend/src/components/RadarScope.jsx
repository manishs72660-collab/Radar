import { useNavigate } from 'react-router-dom';
import { hashToUnit, formatMs } from '../utils';

// Radar pe har monitor ek blip hai.
// Center ke paas = fast response, bahar = slow response. Laal pulse = DOWN.
const CX = 180;
const CY = 180;
const R = 150;

export default function RadarScope({ monitors }) {
  const navigate = useNavigate();

  const blips = monitors.map((m) => {
    const angle = hashToUnit(m._id) * Math.PI * 2;
    const ms = m.avgResponse ?? m.lastResponse ?? 0;
    // 0ms -> centre ke paas, 3000ms+ -> kinara
    const dist = 0.18 + Math.min(ms / 3000, 1) * 0.74;
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
          <stop offset="0" stopColor="#1b2640" />
          <stop offset="1" stopColor="#0e1424" />
        </radialGradient>
        <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f5b042" stopOpacity="0" />
          <stop offset="1" stopColor="#f5b042" stopOpacity=".38" />
        </linearGradient>
        <clipPath id="scopeClip">
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
      </defs>

      <circle cx={CX} cy={CY} r={R + 8} fill="none" stroke="#26304a" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R} fill="url(#scopeBg)" stroke="#34415f" strokeWidth="1.5" />
      {[0.25, 0.5, 0.75].map((f) => (
        <circle key={f} cx={CX} cy={CY} r={R * f} fill="none" stroke="#2b3756" strokeDasharray="2 5" />
      ))}
      <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="#2b3756" />
      <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#2b3756" />

      {/* ring labels */}
      {[['0.25', '750ms'], ['0.5', '1.5s'], ['0.75', '2.2s']].map(([f, label]) => (
        <text key={f} x={CX + 4} y={CY - R * Number(f) - 4} fontSize="9" fill="#5a6585">
          {label}
        </text>
      ))}

      <g clipPath="url(#scopeClip)">
        <g className="scope-sweep">
          <path d={`M${CX} ${CY} L${CX + R} ${CY} A${R} ${R} 0 0 0 ${CX + R * Math.cos(-0.9)} ${CY + R * Math.sin(-0.9)} Z`} fill="url(#sweepGrad)" />
          <line x1={CX} y1={CY} x2={CX + R} y2={CY} stroke="#f5b042" strokeWidth="1.5" />
        </g>
      </g>

      <circle cx={CX} cy={CY} r="3.5" fill="#f5b042" />

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
          <circle cx={x} cy={y} r="6" fill={color} stroke="#0e1424" strokeWidth="2" />
          <text x={x + 11} y={y + 4} fontSize="10.5" fill="#cfd6ea" style={{ pointerEvents: 'none' }}>
            {m.name.length > 14 ? `${m.name.slice(0, 13)}…` : m.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
