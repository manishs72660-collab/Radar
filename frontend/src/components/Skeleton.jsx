export default function Skeleton({ height = 20, width = '100%', radius = 10, style }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} aria-hidden="true" />;
}