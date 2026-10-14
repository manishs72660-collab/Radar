export default function Logo({ size = 28 }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="none" stroke="#f5b042" strokeWidth="7" />
      <circle cx="50" cy="50" r="24" fill="none" stroke="#f5b042" strokeWidth="5" opacity=".55" />
      <path d="M50 50 L86 28" stroke="#f5b042" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="50" r="6" fill="#f5b042" />
    </svg>
  );
}
