const Monitor = require('../monitors/monitor.model');
const Check = require('../checks/check.model');
const Incident = require('../incidents/incident.model');

const DAY = 24 * 60 * 60 * 1000;

// ---------- CACHE ----------
// Frontend har 15s mein call karta hai. 20s TTL.
//
// Do patterns yahan combine hain:
// 1) Stampede protection: agar 5 users ek saath cache expiry pe aayein,
//    sirf pehla compute karta hai, baaki uska result wait karte hain.
// 2) Stale-while-revalidate: agar cache stale hai (20s+ purana),
//    purana data turant serve karo + background mein fresh compute karo.
//    Isse KABHI BHI koi request 500ms wait nahi karti.
//
// Trade-off: user ko max 40s tak purana dashboard dikh sakta hai.
// Monitoring ke liye theek hai (frontend 15s pe poll karta hai).
const CACHE_TTL_MS = 20000;
const summaryCache = new Map(); // userId -> { data, expiresAt }
const inflight = new Map();     // userId -> Promise (stampede protection)

function clearSummaryCache(userId) {
  if (userId) {
    summaryCache.delete(String(userId));
    inflight.delete(String(userId));
  } else {
    summaryCache.clear();
    inflight.clear();
  }
}

// ---------- ACTUAL KAAM ----------
async function computeSummary(userId) {
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

// Background refresh: cache ko naye data se update karta hai, caller ko nahi rokta
function startBackgroundRefresh(key, userId) {
  if (inflight.has(key)) return;

  const promise = computeSummary(userId)
    .then((data) => {
      summaryCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      console.error('Dashboard background refresh failed:', err.message);
      inflight.delete(key);
      // Purana data serve karte rahenge
    });

  inflight.set(key, promise);
}

// ---------- CACHE WRAPPER (stale-while-revalidate) ----------
async function getSummary(userId) {
  const key = String(userId);
  const now = Date.now();
  const cached = summaryCache.get(key);

  // 1) Fresh cache — turant serve
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 2) Stale cache — purana data turant serve + background refresh
  if (cached && cached.data) {
    startBackgroundRefresh(key, userId);
    return cached.data;
  }

  // 3) No cache at all — pehli baar. Compute karo, baaki wait karein (stampede protection)
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = computeSummary(userId)
    .then((data) => {
      summaryCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
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

module.exports = { getSummary, getIncidents, clearSummaryCache };