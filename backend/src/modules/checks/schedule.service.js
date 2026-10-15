// Local time (user ke timezone mein) minutes of day, jaise 9:30 = 570
function localMinutes(date, timeZone) {
  let tz = timeZone || 'UTC';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const h = Number(parts.find((p) => p.type === 'hour').value) % 24;
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

// Kya abhi site ko jagaye rakhna hai? (pre-warm bhi shamil hai)
function isAwakeNow(schedule, now = new Date()) {
  if (!schedule || !schedule.enabled) return true;

  const DAY = 1440;
  const { startHour, endHour, timezone, prewarmMinutes = 0 } = schedule;
  if (startHour === endHour) return true; // same ghanta = poora din jagi rahe

  const start = (startHour * 60 - prewarmMinutes + DAY) % DAY;
  const end = (endHour * 60) % DAY;
  const t = localMinutes(now, timezone);

  if (start < end) return t >= start && t < end;
  return t >= start || t < end; // raat ke beech se guzarne wali window (jaise 22 se 6)
}

// Worker is function se poochta hai: ye check chalana hai ya nahi?
function shouldRunNow(monitor, lastCheckedAt, now = new Date()) {
  const schedule = monitor.schedule;
  if (isAwakeNow(schedule, now)) return { run: true };

  const every = schedule.offHoursEveryMinutes || 0;
  if (every <= 0) return { run: false, reason: 'sleeping' };

  // Window ke bahar bhi kabhi kabhi check (jaise har 60 min), taaki bilkul andhere mein na rahein
  const due = !lastCheckedAt || now - new Date(lastCheckedAt) >= every * 60 * 1000 - 30 * 1000;
  return due ? { run: true, reason: 'off-hours check' } : { run: false, reason: 'sleeping' };
}

module.exports = { isAwakeNow, shouldRunNow };