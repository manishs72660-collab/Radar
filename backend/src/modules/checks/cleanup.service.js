const { hourStart, HOUR } = require('./rollup.service');

const DEFAULT_KEEP_DAYS = 3; // kachche checks kitne din
const DEFAULT_ROLLUP_KEEP_DAYS = 95; // dashboard 90 din dikhata hai, 5 din ka margin

function isAutoEnabled(env = process.env) {
  return env.AUTO_CLEANUP === 'true';
}

function createCleanupService({ Check, Rollup, Monitor, getAvgObjSize, now = () => new Date() }) {
  const cutoffFor = (keepDays) => hourStart(new Date(now().getTime() - keepDays * 24 * HOUR));

  function checkKeepDays(keepDays) {
    if (!Number.isFinite(keepDays) || keepDays < 1) throw new Error('keepDays kam se kam 1 hona chahiye');
  }

  // Dry-run aur asli safai DONO yahi ek function chalate hain, isliye dry-run jo kehta hai wahi safai karti hai.
  // Har (ghanta, monitor) ke liye: kachche checks ki ginti summary card ke total se zyada na ho. Tabhi "safe".
  // remove=false: sirf dekho. remove=true: safe wale checks hatao, baaki chhod do.
  async function walkOldHours(cutoff, { remove, onProgress } = {}) {
    const out = { hoursChecked: 0, hoursDeleted: 0, checksDeleted: 0, deletable: 0, blocked: 0, skipped: [], perMonitor: new Map() };

    const oldest = await Check.findOne().sort({ checkedAt: 1 }).select('checkedAt').lean();
    if (!oldest || new Date(oldest.checkedAt) >= cutoff) return out;

    const start = hourStart(oldest.checkedAt).getTime();
    const total = Math.ceil((cutoff.getTime() - start) / HOUR);

    for (let h = start; h < cutoff.getTime(); h += HOUR) {
      const from = new Date(h);
      const to = new Date(h + HOUR);
      out.hoursChecked += 1;
      if (onProgress && out.hoursChecked % 24 === 0) onProgress({ done: out.hoursChecked, total });

      const rawRows = await Check.aggregate([
        { $match: { checkedAt: { $gte: from, $lt: to } } },
        { $group: { _id: '$monitorId', n: { $sum: 1 } } },
      ]);
      if (rawRows.length === 0) continue; // is ghante mein kuch hai hi nahi

      const cards = await Rollup.find({ hour: from }).select('monitorId total').lean();
      const rolled = new Map(cards.map((c) => [String(c.monitorId), c.total]));
      const isSafe = (r) => r.n <= (rolled.get(String(r._id)) || 0);

      for (const r of rawRows) {
        const id = String(r._id);
        const row = out.perMonitor.get(id) || { raw: 0, rolled: 0, ok: true };
        row.raw += r.n;
        row.rolled += rolled.get(id) || 0;
        if (isSafe(r)) out.deletable += r.n;
        else {
          row.ok = false;
          out.blocked += r.n;
        }
        out.perMonitor.set(id, row);
      }

      // Har monitor alag: ek ka card na ho to doosron ke checks nahi rukte
      const bad = rawRows.filter((r) => !isSafe(r));
      const good = rawRows.filter(isSafe).map((r) => r._id);
      if (bad.length) out.skipped.push({ hour: from, monitors: bad.length });

      if (remove && good.length) {
        const res = await Check.deleteMany({ monitorId: { $in: good }, checkedAt: { $gte: from, $lt: to } });
        out.hoursDeleted += 1;
        out.checksDeleted += res.deletedCount || 0;
      }
    }
    return out;
  }

  // Wo monitors jinke summary cards bache hain par monitor khud delete ho chuka hai
  async function findOrphanMonitorIds() {
    if (!Monitor) return [];
    const ids = await Rollup.distinct('monitorId');
    if (!ids.length) return [];
    const alive = new Set((await Monitor.find({ _id: { $in: ids } }).select('_id').lean()).map((m) => String(m._id)));
    return ids.filter((id) => !alive.has(String(id)));
  }

  // ---------- Dry-run: sirf dekhta hai, kuch delete nahi karta ----------
  async function plan({ keepDays = DEFAULT_KEEP_DAYS } = {}) {
    checkKeepDays(keepDays);
    // Cutoff ghante pe baitha hai, taaki kisi ghante ke aadhe checks na hatein
    const cutoff = cutoffFor(keepDays);

    const rawTotal = await Check.countDocuments({});
    const oldest = await Check.findOne().sort({ checkedAt: 1 }).select('checkedAt').lean();
    const walk = await walkOldHours(cutoff, { remove: false });
    const orphans = await findOrphanMonitorIds();

    const ids = [...walk.perMonitor.keys()];
    const names = {};
    if (Monitor && ids.length) {
      const list = await Monitor.find({ _id: { $in: ids } }).select('name').lean();
      list.forEach((m) => (names[String(m._id)] = m.name));
    }
    const perMonitor = ids
      .map((id) => ({ monitorId: id, name: names[id] || '(deleted monitor)', ...walk.perMonitor.get(id) }))
      .sort((a, b) => b.raw - a.raw);

    let avgObjSize = null;
    if (getAvgObjSize) {
      try {
        avgObjSize = await getAvgObjSize();
      } catch {
        avgObjSize = null;
      }
    }

    return {
      keepDays,
      cutoff,
      oldest: oldest ? oldest.checkedAt : null,
      rawTotal,
      toDelete: walk.deletable, // jitna asli safai mein sach mein hatega
      blocked: walk.blocked, // jise summary card na hone ki wajah se haath nahi lagayenge
      toKeep: rawTotal - walk.deletable,
      skipped: walk.skipped,
      perMonitor,
      orphanMonitors: orphans.length,
      safe: walk.skipped.length === 0,
      freedBytes: avgObjSize ? Math.round(walk.deletable * avgObjSize) : null,
    };
  }

  // ---------- Asli safai ----------
  async function pruneOrphanRollups() {
    const dead = await findOrphanMonitorIds();
    if (!dead.length) return 0;
    const res = await Rollup.deleteMany({ monitorId: { $in: dead } });
    return res.deletedCount || 0;
  }

  async function pruneOldRollups(rollupKeepDays) {
    const res = await Rollup.deleteMany({ hour: { $lt: cutoffFor(rollupKeepDays) } });
    return res.deletedCount || 0;
  }

  async function apply({ keepDays = DEFAULT_KEEP_DAYS, rollupKeepDays = DEFAULT_ROLLUP_KEEP_DAYS, onProgress } = {}) {
    checkKeepDays(keepDays);
    if (!Number.isFinite(rollupKeepDays) || rollupKeepDays < 90) {
      throw new Error('rollupKeepDays kam se kam 90 hona chahiye (dashboard 90 din dikhata hai)');
    }

    const cutoff = cutoffFor(keepDays);
    const walk = await walkOldHours(cutoff, { remove: true, onProgress });
    const orphanRollupsDeleted = await pruneOrphanRollups();
    const oldRollupsDeleted = await pruneOldRollups(rollupKeepDays);

    return {
      cutoff,
      hoursChecked: walk.hoursChecked,
      hoursDeleted: walk.hoursDeleted,
      checksDeleted: walk.checksDeleted,
      skipped: walk.skipped,
      orphanRollupsDeleted,
      oldRollupsDeleted,
    };
  }

  return { plan, apply };
}

// Asli models ke saath (worker aur scripts ke liye)
let defaultService;
function getService() {
  if (!defaultService) {
    defaultService = createCleanupService({
      Check: require('./check.model'),
      Rollup: require('./rollup.model'),
      Monitor: require('../monitors/monitor.model'),
    });
  }
  return defaultService;
}

module.exports = {
  DEFAULT_KEEP_DAYS,
  DEFAULT_ROLLUP_KEEP_DAYS,
  isAutoEnabled,
  createCleanupService,
  runCleanup: (opts) => getService().apply(opts),
};