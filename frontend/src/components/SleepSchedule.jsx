import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import api, { errorMessage } from '../api';
import { useToast } from '../toast';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`;

const BASE_ZONES = ['Asia/Kolkata', 'UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore', 'Australia/Sydney'];

function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function awakeHoursOf(start, end) {
  return ((end - start + 24) % 24) || 24;
}

function scheduleValues(schedule, zone) {
  const s = schedule || {};
  return {
    enabled: !!s.enabled,
    startHour: s.startHour ?? 9,
    endHour: s.endHour ?? 23,
    timezone: s.enabled ? s.timezone || zone : zone,
    prewarmMinutes: s.prewarmMinutes ?? 5,
    offHoursEveryMinutes: s.offHoursEveryMinutes ?? 0,
  };
}

export default function SleepSchedule({ monitor, onSaved }) {
  const toast = useToast();
  const zone = browserZone();
  const zones = Array.from(new Set([zone, ...BASE_ZONES]));

  const [form, setForm] = useState(null);
  const [base, setBase] = useState(null); // last saved values
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = scheduleValues(monitor.schedule, zone);
    setForm(next);
    setBase(next);
  }, [monitor._id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return null;

  const dirty = JSON.stringify(form) !== JSON.stringify(base);

  const num = (k) => (e) => setForm({ ...form, [k]: Number(e.target.value) });

  const windowHours = awakeHoursOf(form.startHour, form.endHour);
  const dayHours = Math.min(24, windowHours + form.prewarmMinutes / 60);
  const offChecks = form.offHoursEveryMinutes > 0 ? (24 - windowHours) / (form.offHoursEveryMinutes / 60) : 0;
  const monthAwake = Math.round(dayHours * 30);
  const saved = Math.max(0, 720 - monthAwake);
  const savedPct = Math.round((saved / 720) * 100);

  const isAwake = (h) => {
    if (form.startHour === form.endHour) return true;
    return form.startHour < form.endHour ? h >= form.startHour && h < form.endHour : h >= form.startHour || h < form.endHour;
  };

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/monitors/${monitor._id}`, { schedule: form });
      const saved = scheduleValues(data.schedule, zone);
      setForm(saved);
      setBase(saved);
      onSaved(data);
      toast(form.enabled ? 'Sleep schedule saved' : 'Sleep schedule turned off');
    } catch (err) {
      toast(errorMessage(err), 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div className="panel-head">
        <div>
          <h2>Sleep schedule</h2>
          <p className="panel-sub">Keep your site awake only when people use it. Outside the window Radar stops pinging, so a free or cheap host can sleep and save hours.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          <span>{form.enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      <div className={form.enabled ? '' : 'dim'}>
        <div className="hour-strip" role="img" aria-label="Hours when the site is kept awake">
          {HOURS.map((h) => (
            <div key={h} className={isAwake(h) ? 'on' : ''} title={`${hourLabel(h)}: ${isAwake(h) ? 'awake' : 'sleeping'}`} />
          ))}
        </div>
        <div className="hour-strip-labels"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>

        <div className="sched-grid">
          <div className="field">
            <label htmlFor="s-start"><Sun size={13} /> Wake up at</label>
            <select id="s-start" className="select" value={form.startHour} onChange={num('startHour')}>
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-end"><Moon size={13} /> Go to sleep at</label>
            <select id="s-end" className="select" value={form.endHour} onChange={num('endHour')}>
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-zone">Timezone</label>
            <select id="s-zone" className="select" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-pre">Pre-warm before waking</label>
            <select id="s-pre" className="select" value={form.prewarmMinutes} onChange={num('prewarmMinutes')}>
              {[0, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m ? `${m} minutes early` : 'Off'}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="s-off">Check while sleeping</label>
            <select id="s-off" className="select" value={form.offHoursEveryMinutes} onChange={num('offHoursEveryMinutes')}>
              <option value={0}>Never (let it sleep fully)</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
              <option value={180}>Every 3 hours</option>
            </select>
            <span className="hint">Pre-warm makes the first visitor skip the cold start. A check while sleeping wakes the site briefly.</span>
          </div>
        </div>

        <div className="estimate">
          <div>
            <b>{monthAwake}h</b>
            <span>awake per month</span>
          </div>
          <div>
            <b className="is-up">{saved}h</b>
            <span>saved vs 24/7 ({savedPct}%)</span>
          </div>
          <div>
            <b>{windowHours}h</b>
            <span>awake each day</span>
          </div>
        </div>

        {monitor.intervalMinutes > 10 && (
          <div className="verdict" style={{ marginTop: 14 }}>
            This monitor checks every {monitor.intervalMinutes} minutes. Hosts like Render put idle apps to sleep after about 15 minutes, so use 10 minutes or less to keep it awake during the window.
          </div>
        )}
        <p className="hint" style={{ marginTop: 12 }}>
          Saved hours are an estimate for hosts that bill by running time{offChecks ? ` (off-hours checks add about ${Math.round(offChecks)} short wake-ups a day)` : ''}. Check your host&apos;s own usage page for the real number.
        </p>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving || !dirty}>
        {saving ? 'Saving...' : dirty ? 'Save schedule' : 'Saved ✓'}
      </button>
    </div>
  );
}