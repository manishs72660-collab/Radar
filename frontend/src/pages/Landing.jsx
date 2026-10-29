import { Activity, ArrowUpRight, BellRing, Clock3, Globe2, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import DashboardMockup from '../components/DashboardMockup';
import './landing.css';

const features = [
  {
    icon: Activity,
    title: 'Uptime at a glance',
    description: 'See which sites are up and follow response times from one live dashboard.',
  },
  {
    icon: BellRing,
    title: 'Catch incidents early',
    description: 'Spot downtime and keep a record of every incident before users report it.',
  },
  {
    icon: Clock3,
    title: 'Understand slowdowns',
    description: 'Review response-time trends and check history to investigate slow or cold starts.',
  },
  {
    icon: Globe2,
    title: 'Share service status',
    description: 'Publish a status page with uptime history and incident updates for your users.',
  },
  {
    icon: Send,
    title: 'Get Telegram alerts',
    description: 'Connect Telegram to receive notifications when a service goes down or recovers.',
  },
];

export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-header">
        <Link className="brand" to="/" aria-label="Radar home">
          <Logo size={30} />
          Radar
        </Link>
        <nav className="lp-actions" aria-label="Account">
          <a className="lp-feature-link" href="#features">Features</a>
          <Link className="btn" to="/login">Log in</Link>
          <Link className="btn btn-primary" to="/register">Sign up <ArrowUpRight size={16} /></Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-copy">
            <div className="landing-eyebrow"> WEBSITE &amp; API MONITORING</div>
            <h1>Know when your site slows down — or goes offline.</h1>
            <p>
              Monitor uptime and response times, investigate check history, and get alerted when an endpoint fails.
              Radar brings service health and incident context into one clear view.
            </p>
            <div className="lp-cta">
              <Link className="btn btn-primary" to="/register">
                Get started <ArrowUpRight size={17} />
              </Link>
              <Link className="lp-login" to="/login">Already have an account? Log in</Link>
            </div>
          </div>
          <DashboardMockup />
        </section>

        <section className="lp-stats" aria-label="Radar capabilities">
          <div><b>HTTP</b><span>website and API checks</span></div>
          <div><b>History</b><span>uptime and response trends</span></div>
          <div><b>Status</b><span>public status pages</span></div>
        </section>

        <section className="lp-features" id="features" aria-label="Features">
          <div className="landing-features-heading">
            <span>BUILT FOR YOUR SERVICES</span>
            <h2>Everything important, in one view.</h2>
          </div>
          <div className="lp-feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title}>
                <Icon size={20} />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-final">
          <h2>Get a clearer view of your service health.</h2>
          <Link className="btn btn-primary" to="/register">
            Create an account <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>

      <footer className="lp-footer">
        <Link className="brand" to="/"><Logo size={22} /> Radar</Link>
        <nav aria-label="Footer">
          <a href="#features">Features</a>
          <Link to="/login">Log in</Link>
          <Link to="/register">Get started</Link>
        </nav>
        <span>Keep an eye on what matters.</span>
      </footer>
    </div>
  );
}