const mongoose = require('mongoose');
const StatusPage = require('./statuspage.model');
const Monitor = require('../monitors/monitor.model');
const Incident = require('../incidents/incident.model');
const series = require('../checks/series.service');

const DAYS = 90;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CACHE_MS = 30 * 1000;

// Public page bina login ke khulta hai, isliye har slug ka jawab 30 second yaad rakhte hain
const cache = new Map();

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

  const old = await StatusPage.findOne({ userId }).select('slug').lean();
  const page = await StatusPage.findOneAndUpdate(
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

  cache.delete(slug);
  if (old) cache.delete(old.slug);
  return page;
}

async function buildPublicPage(page) {
  const monitors = await Monitor.find({ _id: { $in: page.monitorIds }, userId: page.userId })
    .select('name currentStatus isActive')
    .sort({ name: 1 })
    .lean();
  const ids = monitors.map((m) => m._id);

  // 90 din ka uptime: purane din summary cards se, aakhri ghante kachche checks se
  const daily = ids.length ? await series.getDailyUptime(ids, DAYS) : {};

  const items = monitors.map((m) => {
    const perDay = daily[String(m._id)] || {};
    const days = series.daysList(perDay, DAYS).map((d) => ({ date: d.date, uptime: d.uptime }));

    let totalAll = 0;
    let upAll = 0;
    Object.values(perDay).forEach((d) => {
      totalAll += d.total;
      upAll += d.up;
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

async function getPublicPage(slug) {
  const key = String(slug).toLowerCase();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const page = await StatusPage.findOne({ slug: key, isPublic: true }).lean();
  if (!page) {
    cache.delete(key);
    return null;
  }

  const data = await buildPublicPage(page);
  cache.set(key, { at: Date.now(), data });
  return data;
}

module.exports = { getPageForUser, savePage, getPublicPage };