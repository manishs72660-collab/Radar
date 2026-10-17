const { buildRollup, hourStart, HOUR } = require('./rollup.service');

// Purana data ghante ke summary cards se aata hai. Aakhri 3 ghante raw checks se,
// taaki hourly job thodi late ho tab bhi graph mein kuch chhoote na aur kuch dubara na gine.
const LIVE_HOURS = 3;

const RANGE_MS = { '7d': 7 * 24 * HOUR, '30d': 30 * 24 * HOUR, '90d': 90 * 24 * HOUR };
const BUCKET_MS = { '7d': HOUR, '30d': 4 * HOUR, '90d': 12 * HOUR }; // graph pe lagbhag 170-180 points

const SUM_FIELDS = [
  'total', 'up', 'down', 'coldStarts', 'rtSum',
  'normalCount', 'dnsSum', 'tcpSum', 'tlsSum', 'ttfbSum', 'downloadSum', 'coldTtfbSum',
];
const CARD_SELECT = ['hour', 'rtMin', 'rtMax', ...SUM_FIELDS].join(' ');

// Kai summary cards ko ek mein jodo. Sum jodte hain, averages nahi.
function mergeCards(cards) {
  const m = { rtMin: null, rtMax: null };
  SUM_FIELDS.forEach((f) => (m[f] = 0));
  for (const c of cards) {
    SUM_FIELDS.forEach((f) => (m[f] += Number(c[f]) || 0));
    if (c.rtMin != null) m.rtMin = m.rtMin == null ? c.rtMin : Math.min(m.rtMin, c.rtMin);
    if (c.rtMax != null) m.rtMax = m.rtMax == null ? c.rtMax : Math.max(m.rtMax, c.rtMax);
  }
  return m;
}

const pct = (up, total) => (total ? Math.round((up / total) * 10000) / 100 : null);
const avgUp = (m) => (m.up ? Math.round(m.rtSum / m.up) : null);

function avgTimings(m) {
  if (!m.normalCount) return null;
  const r = (v) => Math.round(v / m.normalCount);
  return { dns: r(m.dnsSum), tcp: r(m.tcpSum), tls: r(m.tlsSum), ttfb: r(m.ttfbSum), download: r(m.downloadSum) };
}

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// 1h aur 24h ke stats: seedhe kachche checks se. Speed ke numbers sirf UP checks ke.
function computeRawStats(checks) {
  if (!checks.length) {
    return { total: 0, uptime: null, avg: null, min: null, max: null, p95: null, timings: null, coldStarts: 0, coldAvgTtfb: null, normalTtfb: null };
  }
  const hasTtfb = (c) => c.timings && c.timings.ttfb != null;
  const mean = (list, pick) => (list.length ? Math.round(list.reduce((a, c) => a + (Number(pick(c)) || 0), 0) / list.length) : null);

  const ups = checks.filter((c) => c.status === 'UP');
  const times = ups.map((c) => c.responseTime).sort((a, b) => a - b);
  const cold = checks.filter((c) => c.isColdStart && hasTtfb(c));
  const normal = ups.filter((c) => !c.isColdStart && hasTtfb(c));

  return {
    total: checks.length,
    uptime: pct(ups.length, checks.length),
    avg: mean(ups, (c) => c.responseTime),
    min: times.length ? times[0] : null,
    max: times.length ? times[times.length - 1] : null,
    p95: times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] : null,
    timings: normal.length
      ? { dns: mean(normal, (c) => c.timings.dns), tcp: mean(normal, (c) => c.timings.tcp), tls: mean(normal, (c) => c.timings.tls), ttfb: mean(normal, (c) => c.timings.ttfb), download: mean(normal, (c) => c.timings.download) }
      : null,
    coldStarts: cold.length,
    coldAvgTtfb: mean(cold, (c) => c.timings.ttfb),
    normalTtfb: mean(normal, (c) => c.timings.ttfb),
  };
}

function createSeriesService({ Check, Rollup, now = () => new Date() }) {
  // [from, ab tak] ke summary cards: purane ghante Rollup se, aakhri ghante raw checks se banaye hue
  async function loadCards(monitorId, fromMs) {
    const t = now();
    const liveFrom = new Date(hourStart(t).getTime() - LIVE_HOURS * HOUR);
    const start = hourStart(new Date(fromMs));

    let cards = [];
    if (start < liveFrom) {
      cards = await Rollup.find({ monitorId, hour: { $gte: start, $lt: liveFrom } })
        .select(CARD_SELECT)
        .sort({ hour: 1 })
        .lean();
    }

    const rawFrom = new Date(Math.max(start.getTime(), liveFrom.getTime()));
    const raw = await Check.find({ monitorId, checkedAt: { $gte: rawFrom } })
      .select('status responseTime timings isColdStart checkedAt')
      .lean();

    const byHour = new Map();
    raw.forEach((c) => {
      const h = hourStart(c.checkedAt).getTime();
      if (!byHour.has(h)) byHour.set(h, []);
      byHour.get(h).push(c);
    });
    for (const [h, list] of byHour) cards.push({ hour: new Date(h), ...buildRollup(list) });

    return cards.sort((a, b) => new Date(a.hour) - new Date(b.hour));
  }

  // Graph ke points: har point ek bucket (1, 4 ya 12 ghante)
  async function getSeries(monitorId, range = '7d') {
    const span = RANGE_MS[range];
    if (!span) throw new Error('range 7d, 30d ya 90d hona chahiye');
    const bucketMs = BUCKET_MS[range];

    const cards = await loadCards(monitorId, now().getTime() - span);
    const buckets = new Map();
    cards.forEach((c) => {
      const key = Math.floor(new Date(c.hour).getTime() / bucketMs) * bucketMs;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    });

    const points = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, list]) => {
        const m = mergeCards(list);
        return {
          t,
          total: m.total,
          up: m.up,
          down: m.down,
          coldStarts: m.coldStarts,
          uptime: pct(m.up, m.total),
          avg: avgUp(m),
          min: m.rtMin,
          max: m.rtMax,
          timings: avgTimings(m),
        };
      });

    return { range, bucketMinutes: bucketMs / 60000, points };
  }

  // Poore range ke numbers (uptime, average, cold starts, breakdown)
  async function getStats(monitorId, range = '7d') {
    const span = RANGE_MS[range];
    if (!span) throw new Error('range 7d, 30d ya 90d hona chahiye');

    const m = mergeCards(await loadCards(monitorId, now().getTime() - span));
    return {
      total: m.total,
      uptime: pct(m.up, m.total),
      avg: avgUp(m),
      min: m.rtMin,
      max: m.rtMax,
      p95: null, // lambe range ka p95 summary cards se exact nahi nikalta
      timings: avgTimings(m),
      coldStarts: m.coldStarts,
      coldAvgTtfb: m.coldStarts ? Math.round(m.coldTtfbSum / m.coldStarts) : null,
      normalTtfb: m.normalCount ? Math.round(m.ttfbSum / m.normalCount) : null,
    };
  }

  // Har din ka uptime (UTC din), kai monitors ke liye: { monitorId: { 'YYYY-MM-DD': { total, up, cold } } }
  async function getDailyUptime(monitorIds, days = 90) {
    const t = now();
    const startDay = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - (days - 1)));
    const liveFrom = new Date(hourStart(t).getTime() - LIVE_HOURS * HOUR);
    const out = {};

    const add = (id, date, total, up, cold) => {
      const per = (out[String(id)] = out[String(id)] || {});
      const day = (per[dayKey(date)] = per[dayKey(date)] || { total: 0, up: 0, cold: 0 });
      day.total += total;
      day.up += up;
      day.cold += cold;
    };

    if (startDay < liveFrom) {
      const cards = await Rollup.find({ monitorId: { $in: monitorIds }, hour: { $gte: startDay, $lt: liveFrom } })
        .select('monitorId hour total up coldStarts')
        .lean();
      cards.forEach((c) => add(c.monitorId, c.hour, c.total, c.up, c.coldStarts || 0));
    }

    const rawFrom = new Date(Math.max(startDay.getTime(), liveFrom.getTime()));
    const raw = await Check.find({ monitorId: { $in: monitorIds }, checkedAt: { $gte: rawFrom } })
      .select('monitorId status isColdStart checkedAt')
      .lean();
    raw.forEach((c) => add(c.monitorId, c.checkedAt, 1, c.status === 'UP' ? 1 : 0, c.isColdStart ? 1 : 0));

    return out;
  }

  // Din ki list (purane se naya), jin dino ka data nahi unka uptime null
  function daysList(perDay = {}, days = 90) {
    const t = now();
    const start = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - (days - 1));
    return Array.from({ length: days }, (_, i) => {
      const date = dayKey(new Date(start + i * 24 * HOUR));
      const d = perDay[date];
      return {
        date,
        total: d ? d.total : 0,
        down: d ? d.total - d.up : 0,
        coldStarts: d ? d.cold : 0,
        uptime: d ? pct(d.up, d.total) : null,
      };
    });
  }

  async function getHeatmap(monitorId, days = 90) {
    const map = await getDailyUptime([monitorId], days);
    return daysList(map[String(monitorId)], days);
  }

  return { getSeries, getStats, getDailyUptime, daysList, getHeatmap, mergeCards };
}

let defaultService;
function getService() {
  if (!defaultService) {
    defaultService = createSeriesService({
      Check: require('./check.model'),
      Rollup: require('./rollup.model'),
    });
  }
  return defaultService;
}

module.exports = {
  computeRawStats,
  LIVE_HOURS,
  RANGE_MS,
  createSeriesService,
  getSeries: (id, range) => getService().getSeries(id, range),
  getStats: (id, range) => getService().getStats(id, range),
  getHeatmap: (id, days) => getService().getHeatmap(id, days),
  getDailyUptime: (ids, days) => getService().getDailyUptime(ids, days),
  daysList: (perDay, days) => getService().daysList(perDay, days),
};