const Monitor = require('../monitors/monitor.model');
const Check = require('../checks/check.model');
const Incident = require('../incidents/incident.model');

const DAY = 24 * 60 * 60 * 1000;

async function getSummary(userId) {
  const monitors = await Monitor.find({ userId }).sort({ createdAt: -1 }).lean();
  const ids = monitors.map((m) => m._id);

  const since = new Date(Date.now() - DAY);
  const checks = ids.length
    ? await Check.find({ monitorId: { $in: ids }, checkedAt: { $gte: since } })
        .sort({ checkedAt: 1 })
        .select('monitorId status responseTime checkedAt')
        .lean()
    : [];

  const byMonitor = {};
  checks.forEach((c) => {
    const key = String(c.monitorId);
    (byMonitor[key] = byMonitor[key] || []).push(c);
  });

  let totalUp = 0;
  let totalChecks = 0;
  let totalTime = 0;

  const items = monitors.map((m) => {
    const list = byMonitor[String(m._id)] || [];
    const up = list.filter((c) => c.status === 'UP').length;
    const sum = list.reduce((a, c) => a + c.responseTime, 0);

    totalUp += up;
    totalChecks += list.length;
    totalTime += sum;

    return {
      _id: m._id,
      name: m.name,
      url: m.url,
      intervalMinutes: m.intervalMinutes,
      isActive: m.isActive,
      currentStatus: m.currentStatus,
      uptime24h: list.length ? Math.round((up / list.length) * 10000) / 100 : null,
      avgResponse: list.length ? Math.round(sum / list.length) : null,
      lastResponse: list.length ? list[list.length - 1].responseTime : null,
      lastCheckedAt: list.length ? list[list.length - 1].checkedAt : null,
      history: list.slice(-40).map((c) => c.status),
      spark: list.slice(-30).map((c) => c.responseTime),
    };
  });

  // Pichle 24 ghante ka hourly average (sab monitors ka)
  const buckets = {};
  checks.forEach((c) => {
    const d = new Date(c.checkedAt);
   d.setMinutes(Math.floor(d.getMinutes() / 10) * 10, 0, 0);
    const key = d.getTime();
    buckets[key] = buckets[key] || { sum: 0, n: 0, down: 0 };
    buckets[key].sum += c.responseTime;
    buckets[key].n += 1;
    if (c.status === 'DOWN') buckets[key].down += 1;
  });
  const timeline = Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => ({ time: k, avg: Math.round(buckets[k].sum / buckets[k].n), down: buckets[k].down }));

  const openIncidents = ids.length
    ? await Incident.countDocuments({ monitorId: { $in: ids }, status: 'OPEN' })
    : 0;

  return {
    totals: {
      monitors: monitors.length,
      up: monitors.filter((m) => m.currentStatus === 'UP').length,
      down: monitors.filter((m) => m.currentStatus === 'DOWN').length,
      paused: monitors.filter((m) => !m.isActive).length,
      uptime24h: totalChecks ? Math.round((totalUp / totalChecks) * 10000) / 100 : null,
      avgResponse: totalChecks ? Math.round(totalTime / totalChecks) : null,
      openIncidents,
    },
    monitors: items,
    timeline,
  };
}

async function getIncidents(userId, monitorId) {
  const monitors = await Monitor.find({ userId }).select('name').lean();
  const names = {};
  monitors.forEach((m) => (names[String(m._id)] = m.name));

  const filter = { monitorId: { $in: monitors.map((m) => m._id) } };
  if (monitorId) filter.monitorId = monitorId;

  const incidents = await Incident.find(filter).sort({ startedAt: -1 }).limit(100).lean();
  return incidents.map((i) => ({ ...i, monitorName: names[String(i.monitorId)] || 'Deleted monitor' }));
}

module.exports = { getSummary, getIncidents };
