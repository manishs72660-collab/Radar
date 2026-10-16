const { hourStart, HOUR } = require('./rollup.service');

// Safai ki yojana banata hai. Ye file kuch bhi delete NAHI karti.
// Raw check tabhi hatane layak hai jab uska ghante ka summary card ban chuka ho.
function createCleanupService({ Check, Rollup, Monitor, getAvgObjSize, now = () => new Date() }) {
  async function plan({ keepDays = 3 } = {}) {
    if (!Number.isFinite(keepDays) || keepDays < 1) throw new Error('keepDays kam se kam 1 hona chahiye');

    // Cutoff ghante pe baitha hai, taaki kisi ghante ke aadhe checks na hatein
    const cutoff = hourStart(new Date(now().getTime() - keepDays * 24 * HOUR));

    const rawTotal = await Check.countDocuments({});
    const toDelete = await Check.countDocuments({ checkedAt: { $lt: cutoff } });
    const oldest = await Check.findOne().sort({ checkedAt: 1 }).select('checkedAt').lean();

    const rawRows = await Check.aggregate([
      { $match: { checkedAt: { $lt: cutoff } } },
      { $group: { _id: '$monitorId', n: { $sum: 1 } } },
    ]);
    const rolledRows = await Rollup.aggregate([
      { $match: { hour: { $lt: cutoff } } },
      { $group: { _id: '$monitorId', n: { $sum: '$total' } } },
    ]);

    const raw = new Map(rawRows.map((r) => [String(r._id), r.n]));
    const rolled = new Map(rolledRows.map((r) => [String(r._id), r.n]));
    const ids = [...new Set([...raw.keys(), ...rolled.keys()])];

    const names = {};
    if (Monitor && ids.length) {
      const list = await Monitor.find({ _id: { $in: ids } }).select('name').lean();
      list.forEach((m) => (names[String(m._id)] = m.name));
    }

    // Har monitor ke liye: purane raw checks ki ginti == unke rollups ka total?
    const perMonitor = ids
      .map((id) => {
        const r = raw.get(id) || 0;
        const c = rolled.get(id) || 0;
        // Monitor delete ho chuka hai aur uska koi raw check nahi bacha, sirf purane summary cards bache hain.
        // Ye safai ko nahi rokte, bas alag dikhte hain.
        const orphan = Boolean(Monitor) && !names[id] && r === 0;
        return {
          monitorId: id,
          name: names[id] || '(deleted monitor)',
          raw: r,
          rolled: c,
          orphan,
          ok: orphan ? true : r === c,
        };
      })
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
      toDelete,
      toKeep: rawTotal - toDelete,
      perMonitor,
      safe: perMonitor.every((m) => m.ok),
      freedBytes: avgObjSize ? Math.round(toDelete * avgObjSize) : null,
    };
  }

  return { plan };
}

module.exports = { createCleanupService };