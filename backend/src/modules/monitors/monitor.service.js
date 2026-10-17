const Monitor = require('./monitor.model');
const Check = require('../checks/check.model');
const Rollup = require('../checks/rollup.model');
const series = require('../checks/series.service');
const { scheduleMonitor, unscheduleMonitor } = require('../checks/check.queue');

// Stats: 1h aur 24h kachche checks se, 7d aur 30d ghante ke summary cards se.
const RAW_RANGES = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};
const CARD_RANGES = ['7d', '30d'];

// /checks purani UI ke liye 7d aur 30d bhi deta rehta hai (Part C2 ke baad UI /series use karegi)
const CHECK_RANGES = {
  ...RAW_RANGES,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

// Bahar se aayi schedule ko saaf aur safe banao
function sanitizeSchedule(input, current) {
  const s = { ...(current || {}), ...(input || {}) };
  const int = (v, min, max, fallback) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  let timezone = String(s.timezone || 'UTC');
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
  } catch {
    timezone = 'UTC';
  }

  let every = int(s.offHoursEveryMinutes, 0, 720, 0);
  if (every > 0 && every < 15) every = 15;

  return {
    enabled: !!s.enabled,
    startHour: int(s.startHour, 0, 23, 9),
    endHour: int(s.endHour, 0, 23, 23),
    timezone,
    prewarmMinutes: int(s.prewarmMinutes, 0, 30, 5),
    offHoursEveryMinutes: every,
  };
}

async function createMonitor(userId, data) {
  const { name, url, method, intervalMinutes, expectedStatus } = data;
  const monitor = await Monitor.create({ userId, name, url, method, intervalMinutes, expectedStatus });
  await scheduleMonitor(monitor);
  return monitor;
}

async function getAllMonitors(userId) {
  return Monitor.find({ userId }).sort({ createdAt: -1 });
}

async function getMonitorById(userId, id) {
  return Monitor.findOne({ _id: id, userId });
}

async function updateMonitor(userId, id, data) {
  const monitor = await Monitor.findOne({ _id: id, userId });
  if (!monitor) return null;

  const wasActive = monitor.isActive;
  const oldInterval = monitor.intervalMinutes;

  const allowed = ['name', 'url', 'intervalMinutes', 'expectedStatus', 'isActive'];
  allowed.forEach((key) => {
    if (data[key] !== undefined) monitor[key] = data[key];
  });

  if (data.schedule !== undefined) {
    monitor.schedule = sanitizeSchedule(data.schedule, monitor.toObject().schedule);
  }

  await monitor.save();

  // BullMQ scheduler tabhi badlo jab interval ya pause/resume badla ho.
  // Sleep schedule badalne pe zaroorat nahi, worker use har job pe database se padhta hai.
  const needsReschedule = monitor.isActive !== wasActive || monitor.intervalMinutes !== oldInterval;
  if (needsReschedule) {
    if (monitor.isActive) await scheduleMonitor(monitor);
    else await unscheduleMonitor(monitor);
  }

  return monitor;
}

async function deleteMonitor(userId, id) {
  const monitor = await Monitor.findOneAndDelete({ _id: id, userId });
  if (monitor) {
    await unscheduleMonitor(monitor);
    await Check.deleteMany({ monitorId: monitor._id });
    await Rollup.deleteMany({ monitorId: monitor._id });
  }
  return monitor;
}

// Chart ke liye checks (max ~200 points, DOWN aur cold start points hamesha rakhte hain)
async function getChecks(userId, id, range = '24h') {
  const monitor = await Monitor.findOne({ _id: id, userId });
  if (!monitor) return null;

  const since = new Date(Date.now() - (CHECK_RANGES[range] || CHECK_RANGES['24h']));
  const checks = await Check.find({ monitorId: id, checkedAt: { $gte: since } })
    .sort({ checkedAt: 1 })
    .limit(5000)
    .select('status statusCode responseTime timings isColdStart baselineTtfb error checkedAt')
    .lean();

  const MAX = 200;
  if (checks.length <= MAX) return checks;
  const step = Math.ceil(checks.length / MAX);
  return checks.filter((c, i) => i % step === 0 || c.status === 'DOWN' || c.isColdStart);
}

async function getStats(userId, id, range = '24h') {
  const monitor = await Monitor.findOne({ _id: id, userId });
  if (!monitor) return null;

  if (CARD_RANGES.includes(range)) return series.getStats(id, range);

  const since = new Date(Date.now() - (RAW_RANGES[range] || RAW_RANGES['24h']));
  const checks = await Check.find({ monitorId: id, checkedAt: { $gte: since } })
    .limit(5000)
    .select('status responseTime timings isColdStart')
    .lean();

  return series.computeRawStats(checks);
}

// 7d / 30d ke graph ke points (summary cards se)
async function getSeries(userId, id, range = '7d') {
  const monitor = await Monitor.findOne({ _id: id, userId });
  if (!monitor) return null;
  return series.getSeries(id, range);
}

// 90 din ka din-ba-din uptime
async function getHeatmap(userId, id, days = 90) {
  const monitor = await Monitor.findOne({ _id: id, userId });
  if (!monitor) return null;
  return series.getHeatmap(id, days);
}

module.exports = {
  createMonitor,
  getAllMonitors,
  getMonitorById,
  updateMonitor,
  deleteMonitor,
  getChecks,
  getStats,
  getSeries,
  getHeatmap,
};