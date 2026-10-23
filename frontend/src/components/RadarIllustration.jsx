export default function RadarIllustration() {
  return (
    <svg className="radar-illustration" viewBox="0 0 400 400" role="img" aria-label="Radar scanning active monitors">
      <defs>
        <linearGradient id="radarSweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c8ff2e" stopOpacity="0" />
          <stop offset="1" stopColor="#c8ff2e" stopOpacity=".22" />
        </linearGradient>
        <clipPath id="radarClip">
          <circle cx="200" cy="200" r="162" />
        </clipPath>
      </defs>
      <circle cx="200" cy="200" r="162" fill="#050705" stroke="#252a24" strokeWidth="1.5" />
      {[125, 75, 28].map((radius) => (
        <circle key={radius} cx="200" cy="200" r={radius} fill="none" stroke="#30362d" strokeDasharray="3 8" />
      ))}
      <line x1="38" y1="200" x2="362" y2="200" stroke="#242a24" />
      <line x1="200" y1="38" x2="200" y2="362" stroke="#242a24" />
      <g clipPath="url(#radarClip)">
        <g className="radar-illustration-sweep">
          <path d="M200 200 L362 200 A162 162 0 0 0 301 84 Z" fill="url(#radarSweep)" />
          <line x1="200" y1="200" x2="362" y2="200" stroke="#c8ff2e" strokeWidth="2" />
        </g>
      </g>
      <circle cx="173" cy="120" r="7" fill="#c8ff2e" />
      <circle cx="251" cy="132" r="7" fill="#c8ff2e" />
      <circle cx="145" cy="245" r="7" fill="#c8ff2e" />
      <circle cx="286" cy="270" r="7" fill="#ff5c5c" />
      <circle cx="200" cy="200" r="5" fill="#c8ff2e" />
    </svg>
  );
}
