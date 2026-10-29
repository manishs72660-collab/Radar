import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth';
import { errorMessage } from '../api';
import Logo from '../components/Logo';

function AuthArt() {
  return (
    <aside className="auth-art">
      <Link className="auth-brand" to="/" aria-label="Radar home">
        <Logo size={30} /> <span>Radar</span>
      </Link>
      <div className="auth-art-content">
        <div className="auth-art-icon"><Activity size={21} /></div>
        <p className="auth-kicker">SERVICE HEALTH, IN FOCUS</p>
        <h2>See the signals.<br />Know what needs attention.</h2>
        <p className="auth-art-description">A clear view of your websites and APIs, from routine checks to incidents.</p>
        <ul className="auth-benefits">
          <li><Check size={15} /> Uptime and response history</li>
          <li><Check size={15} /> Incident status at a glance</li>
          <li><Check size={15} /> Alerts when a service needs attention</li>
        </ul>
      </div>
      <span className="auth-art-foot">Monitoring for the services you run.</span>
    </aside>
  );
}

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form.name.trim(), form.email.trim(), form.password);
      else await login(form.email.trim(), form.password);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <AuthArt />
      <div className="auth-form">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-mobile-brand">
            <Link className="auth-brand" to="/" aria-label="Radar home"><Logo size={27} /><span>Radar</span></Link>
            <Link className="auth-back-link" to="/"><ArrowLeft size={14} /> Home</Link>
          </div>
          <div className="auth-heading">
            <span className="auth-kicker">{isRegister ? 'GET STARTED' : 'YOUR MONITORING WORKSPACE'}</span>
            <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
            <p className="sub">
              {isRegister
                ? 'Create an account to start monitoring your services.'
                : 'Sign in to continue to your Radar dashboard.'}
            </p>
          </div>

          {isRegister && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name" className="input" required autoComplete="name" autoFocus
                placeholder="Your name" value={form.name} onChange={set('name')}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" className="input" required autoComplete="email" autoFocus={!isRegister}
              placeholder="name@example.com" value={form.email} onChange={set('email')}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password" type={passwordVisible ? 'text' : 'password'} className="input" required minLength={6}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder="Enter your password" value={form.password} onChange={set('password')}
                aria-invalid={Boolean(error)}
              />
              <button type="button" className="password-toggle" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-pressed={passwordVisible}>
                {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {isRegister && <span className="hint">Use at least 6 characters.</span>}
          </div>

          {error && <p className="error-text auth-error" role="alert">{error}</p>}
          <button className="btn btn-primary auth-submit" disabled={busy} aria-busy={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          <p className="auth-switch">
            {isRegister ? (
              <>Already have a Radar account? <Link to="/login">Sign in</Link></>
            ) : (
              <>New to Radar? <Link to="/register">Create an account</Link></>
            )}
          </p>
          <p className="auth-form-foot">By continuing, you’ll access your monitors, history, and alert settings.</p>
        </form>
      </div>
    </div>
  );
}