import { Activity, ArrowUpRight, BellRing, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import RadarIllustration from '../components/RadarIllustration';

const features = [
  {
    icon: Activity,
    title: 'Uptime at a glance',
    description: 'See which sites are up and follow response times from one live dashboard.',
  },
  {
    icon: BellRing,
    title: 'Catch incidents early',
    description: 'Spot downtime and keep track of incidents before users report them.',
  },
  {
    icon: Clock3,
    title: 'Understand slowdowns',
    description: 'Review response trends and see when hosted apps take time to wake up.',
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link className="brand landing-brand" to="/" aria-label="Radar home">
          <Logo size={34} />
          Radar
        </Link>
        <nav className="landing-actions" aria-label="Account">
          <Link className="btn" to="/login">Log in</Link>
          <Link className="btn btn-primary" to="/register">Sign up <ArrowUpRight size={16} /></Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="landing-eyebrow"><span /> WEBSITE &amp; API MONITORING</div>
            <h1>Know when your site slows down — or goes offline.</h1>
            <p>
              Radar keeps an eye on your hosted apps, tracks uptime and response times,
              and helps you spot incidents before your users do.
            </p>
            <div className="landing-hero-actions">
              <Link className="btn btn-primary" to="/register">
                Get started <ArrowUpRight size={17} />
              </Link>
              <Link className="landing-login-link" to="/login">Already have an account? Log in</Link>
            </div>
            <div className="landing-proof">
              <span><i /> Live monitoring</span>
              <span><i /> Clear incident history</span>
            </div>
          </div>

          <div className="landing-visual">
            <div className="landing-visual-head">
              <span className="landing-visual-brand"><Logo size={25} /> Radar</span>
              <span className="landing-preview-label"><i /> MONITORING PREVIEW</span>
            </div>
            <RadarIllustration />
            <div className="landing-visual-copy">
              <h2>Know when your site is slow, not just when it is down.</h2>
              <p>A clear view of uptime, response times, and incidents.</p>
            </div>
          </div>
        </section>

        <section className="landing-features" aria-label="Radar features">
          <div className="landing-features-heading">
            <span>BUILT FOR YOUR SERVICES</span>
            <h2>Everything important, in one view.</h2>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article className="landing-feature" key={title}>
                <div className="landing-feature-icon"><Icon size={19} /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Link className="brand landing-brand" to="/">
          <Logo size={22} /> Radar
        </Link>
        <span>Keep an eye on what matters.</span>
      </footer>
    </div>
  );
}
