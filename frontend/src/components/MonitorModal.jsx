import { useState } from 'react';
import api, { errorMessage } from '../api';
import { useToast } from '../toast';

const INTERVALS = [1, 5, 10, 15, 30, 60];

export default function MonitorModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', url: 'https://', intervalMinutes: 5, expectedStatus: 200 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/monitors', {
        name: form.name.trim(),
        url: form.url.trim(),
        intervalMinutes: Number(form.intervalMinutes),
        expectedStatus: Number(form.expectedStatus),
      });
      toast('Monitor added');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Add monitor">
        <h2>Add monitor</h2>
        <p className="panel-sub" style={{ marginBottom: 20 }}>Radar will check this URL on a schedule and tell you when it fails.</p>

        <div className="field">
          <label htmlFor="m-name">Name</label>
          <input id="m-name" className="input" required autoFocus placeholder="My portfolio" value={form.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="m-url">URL</label>
          <input id="m-url" className="input" required value={form.url} onChange={set('url')} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="m-int">Check every</label>
            <select id="m-int" className="select" value={form.intervalMinutes} onChange={set('intervalMinutes')}>
              {INTERVALS.map((i) => (
                <option key={i} value={i}>{i} {i === 1 ? 'minute' : 'minutes'}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-status">Expected status</label>
            <input id="m-status" type="number" className="input" min="100" max="599" step="1" required value={form.expectedStatus} onChange={set('expectedStatus')} />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add monitor'}</button>
        </div>
      </form>
    </div>
  );
}
