require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const { Worker } = require('bullmq');
const connection = require('./config/redis');
const connectDB = require('./config/db');
const Monitor = require('./modules/monitors/monitor.model');
const Check = require('./modules/checks/check.model');
const { checkQueue, scheduleMonitor } = require('./modules/checks/check.queue');
const { syncSchedulers } = require('./modules/checks/schedulerSync');
const { runCheck } = require('./modules/checks/check.engine');
const { detectColdStart } = require('./modules/checks/coldstart.service');
const { shouldRunNow } = require('./modules/checks/schedule.service');
const { runRollup } = require('./modules/checks/rollup.service');
const { runCleanup, isAutoEnabled } = require('./modules/checks/cleanup.service');
const { openIncident, resolveIncident } = require('./modules/incidents/incident.service');
const { notifyUser } = require('./modules/alerts/alert.service');

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function downMessage(monitor, cause) {
  return [
    '🔴 DOWN',
    `${monitor.name} is not responding.`,
    '',
    `URL: ${monitor.url}`,
    `Reason: ${cause || 'Unknown'}`,
    `Since: ${new Date().toLocaleString()}`,
  ].join('\n');
}

function recoveredMessage(monitor, seconds) {
  return [
    '🟢 RECOVERED',
    `${monitor.name} is back up.`,
    '',
    `URL: ${monitor.url}`,
    `It was down for ${formatDuration(seconds)}.`,
  ].join('\n');
}

async function safeNotify(userId, text) {
  try {
    await notifyUser(userId, text);
  } catch (err) {
    console.error('Alert error:', err.message);
  }
}

async function logRollup() {
  const r = await runRollup();
  console.log(`[rollup] ${r.hours} hour(s) checked, ${r.rollups} summary card(s) written`);

  // Purane kachche checks ki safai. Sirf tab jab .env mein AUTO_CLEANUP=true likha ho.
  // Safai fail ho to rollup ka kaam nahi bigadta.
  if (isAutoEnabled()) {
    try {
      const keepDays = Number(process.env.RAW_KEEP_DAYS) || 3;
      const c = await runCleanup({ keepDays });
      console.log(`[cleanup] ${c.checksDeleted} old check(s) removed, ${c.skipped.length} hour(s) skipped, ${c.orphanRollupsDeleted + c.oldRollupsDeleted} old card(s) removed`);
    } catch (err) {
      console.error('[cleanup] failed:', err.message);
    }
  }
}

async function start() {
  await connectDB();

  const worker = new Worker(
    'checks',
    async (job) => {
      // Har ghante ka summary banana. Alag Worker nahi, isi mein, taaki Redis ke commands na badhein.
      if (job.name === 'rollup-hourly') {
        await logRollup();
        return;
      }

      const monitor = await Monitor.findById(job.data.monitorId);

      if (!monitor) {
        console.log('Monitor not found, skipping');
        return;
      }
      if (!monitor.isActive) {
        console.log('Monitor inactive, skipping');
        return;
      }

      // Smart keep-alive: sone ke time (schedule ke bahar) check nahi chalana
      if (monitor.schedule && monitor.schedule.enabled) {
        const last = await Check.findOne({ monitorId: monitor._id })
          .sort({ checkedAt: -1 })
          .select('checkedAt')
          .lean();
        const gate = shouldRunNow(monitor, last && last.checkedAt);
        if (!gate.run) return; // site ko sone do
      }

      const result = await runCheck(monitor);
      const cold = await detectColdStart(monitor._id, result);

      await Check.create({ monitorId: monitor._id, ...result, ...cold });

      if (result.status === 'UP') {
        const resolved = await resolveIncident(monitor._id);
        monitor.failureCount = 0;
        monitor.currentStatus = 'UP';

        if (resolved) {
          console.log(`[${monitor.name}] RECOVERED after ${resolved.durationSeconds}s`);
          await safeNotify(monitor.userId, recoveredMessage(monitor, resolved.durationSeconds));
        }
      } else {
        monitor.failureCount += 1;

        if (monitor.failureCount >= 3) {
          monitor.currentStatus = 'DOWN';
          const { created } = await openIncident(monitor._id, result.error);

          if (created) {
            console.log(`[${monitor.name}] DOWN, incident opened, alert sent`);
            await safeNotify(monitor.userId, downMessage(monitor, result.error));
          }
        }
      }

      await monitor.save();

      if (cold.isColdStart) {
        console.log(`[${monitor.name}] COLD START: ttfb ${result.timings.ttfb}ms (normal ${cold.baselineTtfb}ms)`);
      } else {
        console.log(`[${monitor.name}] ${result.status} - ${result.responseTime}ms`);
      }
    },
    {
      connection,
      concurrency: 5,
      // Redis ko kam chhedna: khali queue mein har 5 second ke bajaye 30 second mein ek baar poochna.
      // Upstash free plan mein commands ginti hoti hain (500K per month).
      drainDelay: 30,
      stalledInterval: 120000,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Job failed: ${err.message}`);
  });

  // MongoDB ki list ke hisaab se Redis ke schedulers barabar karo (Redis ud gaya ho to bhi monitoring wapas chalu)
  try {
    const r = await syncSchedulers({ Monitor, queue: checkQueue, schedule: scheduleMonitor });
    console.log(`[sync] ${r.active} active monitor(s) scheduled, ${r.removed} stale scheduler(s) removed`);
  } catch (err) {
    console.error('[sync] failed:', err.message);
  }

  // Har ghante ke 5 minute baad (UTC): pichla poora ghanta ab band ho chuka hai
  await checkQueue.upsertJobScheduler(
    'rollup-hourly',
    { pattern: '5 * * * *' },
    { name: 'rollup-hourly', data: {}, opts: { removeOnComplete: true, removeOnFail: 20 } }
  );

  // Worker abhi chalu hua hai: jo ghante chhoot gaye ho wo bhi bhar do (peeche se, server ko rokta nahi)
  logRollup().catch((err) => console.error('Rollup failed:', err.message));

  console.log('Worker started, waiting for jobs...');
}

module.exports = { start };

// "npm run worker" se seedha chalane par pehle jaisa hi shuru ho
if (require.main === module) start();