const Check = require('./check.model');

const MIN_MS = Number(process.env.COLD_START_MIN_MS) || 3000; // itna slow hona zaroori
const RATIO = Number(process.env.COLD_START_RATIO) || 4; // normal se kitna guna
const MIN_SAMPLES = 5; // baseline ke liye kam se kam itne purane checks

async function getBaselineTtfb(monitorId) {
  const recent = await Check.find({
    monitorId,
    status: 'UP',
    isColdStart: { $ne: true },
    'timings.ttfb': { $ne: null },
  })
    .sort({ checkedAt: -1 })
    .limit(20)
    .select('timings.ttfb')
    .lean();

  if (recent.length < MIN_SAMPLES) return null;

  const values = recent.map((c) => c.timings.ttfb).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)]; // median
}

async function detectColdStart(monitorId, result) {
  const none = { isColdStart: false, baselineTtfb: null };

  if (result.status !== 'UP' || !result.timings || result.timings.ttfb == null) return none;

  const baseline = await getBaselineTtfb(monitorId);
  if (baseline == null) return none;

  const ttfb = result.timings.ttfb;
  const isColdStart = ttfb >= MIN_MS && ttfb >= baseline * RATIO;

  return { isColdStart, baselineTtfb: baseline };
}

module.exports = { detectColdStart };