// Nakli (test) data banane ka logic. Database nahi chhuta, isliye alag se test ho sakta hai.
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

// Har baar ek jaisa "random", taaki seed dobara chale to wahi data bane
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// example.com jaise naam kabhi asli site nahi hote, isliye galti se bhi koi check nahi jayega
const PROFILES = [
  { name: 'SEED Portfolio (fast)', url: 'https://seed-portfolio.example.com/', baseTtfb: 90, jitter: 40, coldEveryHours: 0, outage: null, degrade: false },
  { name: 'SEED Free-tier API (sleepy)', url: 'https://seed-api.example.com/', baseTtfb: 260, jitter: 120, coldEveryHours: 7, outage: null, degrade: false },
  { name: 'SEED Blog (flaky, slowing)', url: 'https://seed-blog.example.com/', baseTtfb: 180, jitter: 80, coldEveryHours: 0, outage: { dayFromStart: 2, hour: 14, minutes: 35 }, degrade: true },
];

function generateSeed({ userId, days = 10, intervalMinutes = 10, now = new Date(), makeId = (i) => `m${i}`, monitors = 3 }) {
  const end = now.getTime();
  const start = end - days * 24 * HOUR;
  const step = intervalMinutes * MIN;

  const monitorDocs = [];
  const checks = [];
  const incidents = [];

  PROFILES.slice(0, monitors).forEach((p, index) => {
    const rand = rng(1000 + index);
    const monitorId = makeId(index);

    monitorDocs.push({
      _id: monitorId,
      userId,
      name: p.name,
      url: p.url,
      method: 'GET',
      intervalMinutes,
      expectedStatus: 200,
      // Band rakha hai: worker inhe kabhi nahi chhuega, aur galti se alert nahi jayega
      isActive: false,
      currentStatus: 'UP',
      failureCount: 0,
    });

    const outageStart = p.outage ? start + p.outage.dayFromStart * 24 * HOUR + p.outage.hour * HOUR : null;
    const outageEnd = p.outage ? outageStart + p.outage.minutes * MIN : null;
    let nextCold = p.coldEveryHours ? start + p.coldEveryHours * HOUR : Infinity;
    let consecutiveDown = 0;
    let openIncident = null;
    let n = 0;

    for (let t = start; t <= end; t += step, n++) {
      const hourOfDay = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
      const dayFactor = 1 + 0.3 * Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI); // shaam ko thoda slow
      const daysFromEnd = (end - t) / (24 * HOUR);
      const degrade = p.degrade && daysFromEnd < 2 ? (1 - daysFromEnd / 2) * 260 : 0; // aakhri 2 din mein dheere dheere slow

      const inOutage = outageStart !== null && t >= outageStart && t < outageEnd;
      const randomFail = !inOutage && n > 12 && rand() < 1 / 500;

      if (inOutage || randomFail) {
        const timeout = inOutage;
        checks.push({
          monitorId,
          status: 'DOWN',
          statusCode: null,
          responseTime: timeout ? 30000 : 15,
          isColdStart: false,
          baselineTtfb: null,
          error: timeout ? 'Timeout (30s)' : 'Connection reset by server',
          checkedAt: new Date(t),
        });
        consecutiveDown += 1;
        if (consecutiveDown === 3 && !openIncident) {
          openIncident = { monitorId, startedAt: new Date(t), cause: 'Timeout (30s)' };
        }
        continue;
      }

      // Pehle DOWN ke baad pehla UP: incident band
      if (openIncident) {
        openIncident.resolvedAt = new Date(t);
        openIncident.durationSeconds = Math.round((t - openIncident.startedAt.getTime()) / 1000);
        openIncident.status = 'RESOLVED';
        incidents.push(openIncident);
        openIncident = null;
      }
      consecutiveDown = 0;

      const dns = Math.round(5 + rand() * 35);
      const tcp = Math.round(10 + rand() * 50);
      const tls = Math.round(20 + rand() * 80);
      const download = Math.round(1 + rand() * 25);
      let ttfb = Math.round((p.baseTtfb + (rand() - 0.5) * 2 * p.jitter) * dayFactor + degrade);
      if (rand() < 0.01) ttfb += Math.round(400 + rand() * 900); // kabhi kabhi achanak spike

      let isCold = false;
      if (t >= nextCold && n > 10) {
        isCold = true;
        ttfb = Math.round(3500 + rand() * 5500); // sone ke baad pehla request
        nextCold = t + (p.coldEveryHours + (rand() - 0.5) * 4) * HOUR;
      }

      checks.push({
        monitorId,
        status: 'UP',
        statusCode: 200,
        responseTime: dns + tcp + tls + ttfb + download + Math.round(rand() * 8),
        timings: { dns, tcp, tls, ttfb, download },
        isColdStart: isCold,
        baselineTtfb: isCold ? p.baseTtfb : null,
        error: null,
        checkedAt: new Date(t),
      });
    }
  });

  return { monitors: monitorDocs, checks, incidents };
}

module.exports = { generateSeed, PROFILES };