const mongoose = require('mongoose');
const StatusPage = require('./statuspage.model');
const Monitor = require('../monitors/monitor.model');
const Check = require('../checks/check.model');
const Incident = require('../incidents/incident.model');

const DAYS = 90;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function getPageForUser(userId) {
  return StatusPage.findOne({ userId }).lean();
}

async function savePage(userId, data) {
  const slug = String(data.slug || '').trim().toLowerCase();
  const title = String(data.title || '').trim();

  if (slug.length < 3 || slug.length > 40 || !SLUG_RE.test(slug)) {
    throw httpError(400, 'Address must be 3-40 characters: lowercase letters, numbers and single hyphens');
  }
  if (!title) throw httpError(400, 'Title is required');

  const taken = await StatusPage.findOne({ slug, userId: { $ne: userId } });
  if (taken) throw httpError(409, 'That address is already taken');

  // Sirf wahi monitors jo is user ke hain
  const requested = (data.monitorIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const owned = await Monitor.find({ _id: { $in: requested }, userId }).select('_id');

  return StatusPage.findOneAndUpdate(
    { userId },
    {
      userId,
      slug,
      title,
      description: String(data.description || '').trim().slice(0, 300),
      monitorIds: owned.map((m) => m._id),
      isPublic: data.isPublic !== false,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
}

async function getPublicPage(slug) {
  const page = await StatusPage.findOne({ slug: String(slug).toLowerCase(), isPublic: true }).lean();
  if (!page) return null;

  const monitors = await Monitor.find({ _id: { $in: page.monitorIds }, userId: page.userId })
    .select('name currentStatus isActive')
    .sort({ name: 1 })
    .lean();
  const ids = monitors.map((m) => m._id);

  // Pichle 90 din ke date keys (UTC)
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (DAYS - 1));
  const dateKeys = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const rows = ids.length
    ? await Check.aggregate([
        { $match: { monitorId: { $in: ids }, checkedAt: { $gte: start } } },
        {
          $group: {
            _id: {
              m: '$monitorId',
              d: { $dateToString: { format: '%Y-%m-%d', date: '$checkedAt' } },
            },
            total: { $sum: 1 },
            up: { $sum: { $cond: [{ $eq: ['$status', 'UP'] }, 1, 0] } },
          },
        },
      ])
    : [];

  const byMonitor = {};
  rows.forEach((r) => {
    const key = String(r._id.m);
    (byMonitor[key] = byMonitor[key] || {})[r._id.d] = { total: r.total, up: r.up };
  });

  const items = monitors.map((m) => {
    const perDay = byMonitor[String(m._id)] || {};
    let totalAll = 0;
    let upAll = 0;

    const days = dateKeys.map((date) => {
      const d = perDay[date];
      if (!d) return { date, uptime: null };
      totalAll += d.total;
      upAll += d.up;
      return { date, uptime: Math.round((d.up / d.total) * 10000) / 100 };
    });

    return {
      id: String(m._id),
      name: m.name,
      status: !m.isActive ? 'PAUSED' : m.currentStatus,
      uptime90: totalAll ? Math.round((upAll / totalAll) * 10000) / 100 : null,
      days,
    };
  });

  // Overall status
  const active = items.filter((i) => i.status !== 'PAUSED');
  const down = active.filter((i) => i.status === 'DOWN').length;
  let overall = 'operational';
  if (active.length === 0) overall = 'unknown';
  else if (down === active.length) overall = 'major_outage';
  else if (down > 0) overall = 'partial_outage';

  // Pichle 30 din ke incidents
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const incidents = ids.length
    ? await Incident.find({ monitorId: { $in: ids }, startedAt: { $gte: since30 } })
        .sort({ startedAt: -1 })
        .limit(30)
        .lean()
    : [];
  const names = {};
  monitors.forEach((m) => (names[String(m._id)] = m.name));

  return {
    title: page.title,
    description: page.description,
    overall,
    updatedAt: new Date(),
    monitors: items,
    incidents: incidents.map((i) => ({
      id: String(i._id),
      monitorName: names[String(i.monitorId)],
      status: i.status,
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      durationSeconds: i.durationSeconds,
      cause: i.cause,
    })),
  };
}

module.exports = { getPageForUser, savePage, getPublicPage };