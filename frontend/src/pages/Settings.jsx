import { useEffect, useState } from 'react';
import { Send, Unplug, CircleCheck, Copy, ExternalLink } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useToast } from '../toast';

function StatusPageSection() {
  const toast = useToast();
  const [monitors, setMonitors] = useState([]);
  const [saved, setSaved] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState({ slug: '', title: '', description: '', monitorIds: [], isPublic: true });

  useEffect(() => {
    setReady(false);
    Promise.all([api.get('/monitors'), api.get('/status-page')])
      .then(([m, p]) => {
        setMonitors(m.data);
        setLoadError('');
        if (p.data) {
          setSaved(p.data);
          setForm({
            slug: p.data.slug,
            title: p.data.title,
            description: p.data.description || '',
            monitorIds: (p.data.monitorIds || []).map(String),
            isPublic: p.data.isPublic,
          });
        }
      })
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setReady(true));
  }, [attempt]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function toggleMonitor(id) {
    setForm((f) => ({
      ...f,
      monitorIds: f.monitorIds.includes(id) ? f.monitorIds.filter((x) => x !== id) : [...f.monitorIds, id],
    }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/status-page', { ...form, slug: form.slug.trim().toLowerCase() });
      setSaved(data);
      toast('Status page saved');
    } catch (err) {
      toast(errorMessage(err), 'err');
    } finally {
      setSaving(false);
    }
  }

  const link = saved ? `${window.location.origin}/status/${saved.slug}` : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied');
    } catch {
      toast('Could not copy. Select the link and copy it manually.', 'err');
    }
  }

  if (!ready) return <div className="settings-loading">Loading status page settings…</div>;
  if (loadError) {
    return (
      <div className="panel settings-state" role="alert">
        <p className="error-text">{loadError}</p>
        <button className="btn btn-sm" onClick={() => { setLoadError(''); setAttempt((value) => value + 1); }}>Try again</button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 680, marginBottom: 20 }}>
      <div className="panel-head">
        <div>
          <h2>Public status page</h2>
          <p className="panel-sub">A page anyone can open without logging in. Your site URLs are never shown on it.</p>
        </div>
        {saved && <span className={`pill ${saved.isPublic ? 'up' : ''}`}>{saved.isPublic ? 'Live' : 'Hidden'}</span>}
      </div>

      {saved && (
        <div className="link-box">
          <code>{link}</code>
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={copyLink}><Copy size={14} /> Copy</button>
            <a className="btn btn-sm" href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
          </div>
        </div>
      )}

      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="sp-slug">Page address</label>
          <div className="prefix-input">
            <span>{window.location.host}/status/</span>
            <input id="sp-slug" required minLength={3} maxLength={40} placeholder="my-projects" value={form.slug} onChange={set('slug')} />
          </div>
          <span className="hint">Lowercase letters, numbers and hyphens.</span>
        </div>

        <div className="field">
          <label htmlFor="sp-title">Title</label>
          <input id="sp-title" className="input" required maxLength={80} placeholder="Manish's Projects" value={form.title} onChange={set('title')} />
        </div>

        <div className="field">
          <label htmlFor="sp-desc">Description (optional)</label>
          <input id="sp-desc" className="input" maxLength={300} placeholder="Live status of my apps" value={form.description} onChange={set('description')} />
        </div>

        <div className="field">
          <label>Monitors to show</label>
          {monitors.length === 0 ? (
            <span className="hint">You have no monitors yet. Add one first.</span>
          ) : (
            <div className="check-list">
              {monitors.map((m) => (
                <label key={m._id} className="check-item">
                  <input type="checkbox" checked={form.monitorIds.includes(String(m._id))} onChange={() => toggleMonitor(String(m._id))} />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="check-item" style={{ marginBottom: 18 }}>
          <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
          <span>Make this page public</span>
        </label>

        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : saved ? 'Save changes' : 'Create status page'}</button>
      </form>
    </div>
  );
}

function TelegramSection() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    api
      .get('/alerts/settings')
      .then((r) => {
        setSettings(r.data);
        setChatId(r.data.telegramChatId || '');
        setLoadError('');
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [attempt]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/alerts/settings', { telegramChatId: chatId.trim() });
      setSettings(data);
      toast('Telegram connected');
    } catch (err) {
      toast(errorMessage(err), 'err');
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    try {
      const { data } = await api.put('/alerts/settings', { telegramChatId: null });
      setSettings(data);
      setChatId('');
      toast('Telegram disconnected');
    } catch (err) {
      toast(errorMessage(err), 'err');
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      await api.post('/alerts/test');
      toast('Test alert sent. Check Telegram.');
    } catch (err) {
      toast(errorMessage(err), 'err');
    } finally {
      setTesting(false);
    }
  }

  if (!settings) {
    return (
      <div className="panel settings-state" role={loadError ? 'alert' : 'status'}>
        {loadError ? <><p className="error-text">{loadError}</p><button className="btn btn-sm" onClick={() => { setLoadError(''); setAttempt((value) => value + 1); }}>Try again</button></> : <p className="settings-loading">Loading Telegram settings…</p>}
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 680 }}>
      <div className="panel-head">
        <div>
          <h2>Telegram alerts</h2>
          <p className="panel-sub">You get one message when a site goes down and one when it recovers.</p>
        </div>
        {settings.telegramConnected ? (
          <span className="pill up"><CircleCheck size={14} /> Connected</span>
        ) : (
          <span className="pill">Not connected</span>
        )}
      </div>

      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="chat">Your Telegram chat id</label>
          <input id="chat" className="input" inputMode="numeric" placeholder="e.g. 5571820213" value={chatId} onChange={(e) => setChatId(e.target.value)} required />
          <span className="hint">A number, not your username.</span>
        </div>

        <div className="row">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : settings.telegramConnected ? 'Update' : 'Connect Telegram'}
          </button>
          {settings.telegramConnected && (
            <>
              <button type="button" className="btn" onClick={sendTest} disabled={testing}>
                <Send size={15} /> {testing ? 'Sending...' : 'Send test alert'}
              </button>
              <button type="button" className="btn btn-danger" onClick={disconnect}>
                <Unplug size={15} /> Disconnect
              </button>
            </>
          )}
        </div>
      </form>

      <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>How to find your chat id</h2>
        <ol style={{ paddingLeft: 20, color: 'var(--muted)', display: 'grid', gap: 6 }}>
          <li>Open the Radar bot in Telegram, press <b style={{ color: 'var(--text)' }}>Start</b>, then send it a message.</li>
          <li>Open <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> in your browser with the bot token filled in.</li>
          <li>Find <code>"chat":&#123;"id":...</code> in the response. That number is your chat id.</li>
        </ol>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Share your status publicly and choose where Radar sends alerts.</p>
        </div>
      </div>
      <StatusPageSection />
      <TelegramSection />
    </>
  );
}