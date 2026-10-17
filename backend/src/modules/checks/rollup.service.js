const HOUR = 60 * 60 * 1000;
const FIRST_RUN_HOURS = 24; // pehli baar chalne par kitne ghante peeche tak
const MAX_CATCHUP_HOURS = 72; // worker band raha ho to bhi itne se zyada peeche nahi jayenge (raw data 3 din ka hai)

function hourStart(date) {
  return new Date(Math.floor(new Date(date).getTime() / HOUR) * HOUR);
}

// Ek monitor ke ek ghante ke checks se summary card banao. Database nahi chhuta.
function buildRollup(checks) {
  if (!checks || checks.length === 0) return null;

  const sum = (list, pick) => list.reduce((a, c) => a + (Number(pick(c)) || 0), 0);
  const hasTtfb = (c) => c.timings && c.timings.ttfb != null;

  // Speed ke numbers sirf kamyab (UP) checks se. Down hue check ka 30 second ka timeout speed nahi hai.
  const upChecks = checks.filter((c) => c.status === 'UP');
  const times = upChecks.map((c) => c.responseTime).sort((a, b) => a - b);
  const cold = checks.filter((c) => c.isColdStart && hasTtfb(c));
  const normal = checks.filter((c) => c.status === 'UP' && !c.isColdStart && hasTtfb(c));

  return {
    total: checks.length,
    up: upChecks.length,
    down: checks.filter((c) => c.status === 'DOWN').length,
    coldStarts: cold.length,

    rtSum: sum(upChecks, (c) => c.responseTime),
    rtMin: times.length ? times[0] : null,
    rtMax: times.length ? times[times.length - 1] : null,
    p95: times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] : null,

    normalCount: normal.length,
    dnsSum: sum(normal, (c) => c.timings.dns),
    tcpSum: sum(normal, (c) => c.timings.tcp),
    tlsSum: sum(normal, (c) => c.timings.tls),
    ttfbSum: sum(normal, (c) => c.timings.ttfb),
    downloadSum: sum(normal, (c) => c.timings.download),

    coldTtfbSum: sum(cold, (c) => c.timings.ttfb),
  };
}

function createRollupService({ Check, Rollup, now = () => new Date() }) {
  // Ek monitor, ek ghanta. Dobara chalane se duplicate nahi banta, purana update ho jata hai.
  async function rollupHour(monitorId, hour) {
    const from = new Date(hour);
    const to = new Date(from.getTime() + HOUR);

    const checks = await Check.find({ monitorId, checkedAt: { $gte: from, $lt: to } })
      .select('status responseTime timings isColdStart')
      .lean();

    const doc = buildRollup(checks);
    if (!doc) return false;

    const write = () => Rollup.updateOne({ monitorId, hour: from }, { $set: doc }, { upsert: true });
    try {
      await write();
    } catch (err) {
      if (err && err.code === 11000) await write(); // do jagah ek saath upsert hua, ek baar dobara
      else throw err;
    }
    return true;
  }

  async function rollupHourForAll(hour) {
    const from = new Date(hour);
    const to = new Date(from.getTime() + HOUR);
    const ids = await Check.distinct('monitorId', { checkedAt: { $gte: from, $lt: to } });

    let written = 0;
    for (const id of ids) {
      if (await rollupHour(id, from)) written += 1;
    }
    return written;
  }

  // Poore ho chuke ghante hi rollup hote hain. Abhi chal raha ghanta kabhi nahi.
  //   (kuch nahi)  -> jo ghante baaki hain (pichhla rollup se ab tak)
  //   hours: N     -> pichle N ghante dobara
  //   all: true    -> sabse purane raw check se ab tak (backfill)
  async function runRollup({ hours, all, onProgress } = {}) {
    const end = hourStart(now());
    let start;

    if (all) {
      const first = await Check.findOne().sort({ checkedAt: 1 }).select('checkedAt').lean();
      if (!first) return { from: end, to: end, hours: 0, rollups: 0 };
      start = hourStart(first.checkedAt);
    } else if (hours) {
      start = new Date(end.getTime() - hours * HOUR);
    } else {
      const last = await Rollup.findOne().sort({ hour: -1 }).select('hour').lean();
      // Aakhri rollup wala ghanta dobara bhi chalta hai (safe, kyunki update hota hai, duplicate nahi)
      start = last ? hourStart(last.hour) : new Date(end.getTime() - FIRST_RUN_HOURS * HOUR);
      const earliest = new Date(end.getTime() - MAX_CATCHUP_HOURS * HOUR);
      if (start < earliest) start = earliest;
    }

    const totalHours = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / HOUR));
    let hoursDone = 0;
    let rollups = 0;
    for (let h = start.getTime(); h < end.getTime(); h += HOUR) {
      rollups += await rollupHourForAll(new Date(h));
      hoursDone += 1;
      if (onProgress && hoursDone % 24 === 0) onProgress({ done: hoursDone, total: totalHours });
    }

    return { from: start, to: end, hours: hoursDone, rollups };
  }

  // Jaanch: is range ke raw checks ki ginti aur rollups ke total ka jod barabar hona chahiye
  async function verify({ from, to }) {
    const raw = await Check.countDocuments({ checkedAt: { $gte: from, $lt: to } });
    const docs = await Rollup.find({ hour: { $gte: from, $lt: to } }).select('total').lean();
    const rolled = docs.reduce((a, d) => a + d.total, 0);
    return { raw, rolled, match: raw === rolled };
  }

  return { rollupHour, rollupHourForAll, runRollup, verify };
}

// Asli models ke saath, sirf tab jab pehli baar maanga jaye (test mein models nahi chahiye)
let defaultService;
function getService() {
  if (!defaultService) {
    defaultService = createRollupService({
      Check: require('./check.model'),
      Rollup: require('./rollup.model'),
    });
  }
  return defaultService;
}

module.exports = {
  HOUR,
  hourStart,
  buildRollup,
  createRollupService,
  runRollup: (opts) => getService().runRollup(opts),
  verify: (range) => getService().verify(range),
};