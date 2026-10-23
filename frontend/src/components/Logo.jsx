import logoImage from '../public/logo.png';

export default function Logo({ size = 28 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img src={logoImage} alt="" />
    </span>
  );
}
