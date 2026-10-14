import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errorMessage } from '../api';
import Logo from '../components/Logo';

function AuthArt() {
  return (
    <div className="auth-art" aria-hidden="true">
      <svg viewBox="0 0 400 400">
        <defs>
          <linearGradient id="aSweep" x1="0" x2="1">
            <stop offset="0" stopColor="#f5b042" stopOpacity="0" />
            <stop offset="1" stopColor="#f5b042" stopOpacity=".35" />
          </linearGradient>
        </defs>
        {[190, 140, 90, 40].map((r) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="#26304a" strokeWidth="1.5" strokeDasharray={r === 190 ? '0' : '3 7'} />
        ))}
        <line x1="10" y1="200" x2="390" y2="200" stroke="#26304a" />
        <line x1="200" y1="10" x2="200" y2="390" stroke="#26304a" />
        <g style={{ transformOrigin: '200px 200px', animation: 'sweep 7s linear infinite' }}>
          <path d="M200 200 L390 200 A190 190 0 0 0 365 120 Z" fill="url(#aSweep)" />
          <line x1="200" y1="200" x2="390" y2="200" stroke="#f5b042" strokeWidth="2" />
        </g>
        <circle cx="262" cy="130" r="7" fill="#3dd6a5" />
        <circle cx="130" cy="250" r="7" fill="#3dd6a5" />
        <circle cx="300" cy="270" r="7" fill="#ff6b6b" />
        <circle cx="160" cy="120" r="7" fill="#3dd6a5" />
        <circle cx="200" cy="200" r="5" fill="#f5b042" />
      </svg>
      <div className="auth-art-copy">
        <h2>Know when your site is slow, not just when it is down.</h2>
        <p>Radar watches the apps you host on Render, Railway and other free or cheap platforms.</p>
      </div>
    </div>
  );
}

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
          <div className="brand" style={{ padding: 0, marginBottom: 28 }}>
            <Logo /> Radar
          </div>
          <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p className="sub">{isRegister ? 'Start monitoring your first site in a minute.' : 'Log in to see how your sites are doing.'}</p>

          {isRegister && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" className="input" required autoComplete="name" value={form.name} onChange={set('name')} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" required autoComplete="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password" type="password" className="input" required minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={form.password} onChange={set('password')}
            />
            {isRegister && <span className="hint">At least 6 characters.</span>}
          </div>

          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'}
          </button>

          <p className="auth-switch">
            {isRegister ? (
              <>Already have an account? <Link to="/login">Log in</Link></>
            ) : (
              <>New to Radar? <Link to="/register">Create an account</Link></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
