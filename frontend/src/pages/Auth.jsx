import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errorMessage } from '../api';
import Logo from '../components/Logo';
import RadarIllustration from '../components/RadarIllustration';

function AuthArt() {
  return (
    <div className="auth-art" aria-hidden="true">
      <RadarIllustration />
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
          <p className="sub">
            {isRegister ? 'Start monitoring your first site in a minute.' : 'Log in to see how your sites are doing.'}
          </p>

          {isRegister && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name" className="input" required autoComplete="name"
                placeholder="Your name" value={form.name} onChange={set('name')}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" className="input" required autoComplete="email"
              placeholder="you@example.com" value={form.email} onChange={set('email')}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password" type="password" className="input" required minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="••••••••" value={form.password} onChange={set('password')}
            />
            {isRegister && <span className="hint">At least 6 characters.</span>}
          </div>

          {error && <p className="error-text" role="alert">{error}</p>}
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