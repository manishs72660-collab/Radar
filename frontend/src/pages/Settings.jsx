import { useEffect, useState } from 'react';
import { Send, Unplug, CircleCheck } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useToast } from '../toast';

export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api
      .get('/alerts/settings')
      .then((r) => {
        setSettings(r.data);
        setChatId(r.data.telegramChatId || '');
      })
      .catch(() => {});
  }, []);

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

  if (!settings) return <div className="center-screen">Loading...</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Choose where Radar sends alerts when a site goes down or comes back.</p>
        </div>
      </div>

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
            <input
              id="chat"
              className="input"
              inputMode="numeric"
              placeholder="e.g. 5571820213"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              required
            />
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
            <li>Open the Radar bot in Telegram and press <b style={{ color: 'var(--text)' }}>Start</b>, then send it a message.</li>
            <li>Open <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> in your browser with the bot token filled in.</li>
            <li>Find <code>"chat":&#123;"id":...</code> in the response. That number is your chat id.</li>
          </ol>
        </div>
      </div>
    </>
  );
}