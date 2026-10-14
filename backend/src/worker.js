require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const { Worker } = require('bullmq');
const connection = require('./config/redis');
const connectDB = require('./config/db');
const Monitor = require('./modules/monitors/monitor.model');
const Check = require('./modules/checks/check.model');
const { runCheck } = require('./modules/checks/check.engine');
const { detectColdStart } = require('./modules/checks/coldstart.service');
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

// Alert fail ho to bhi check ka kaam nahi rukna chahiye
async function safeNotify(userId, text) {
  try {
    await notifyUser(userId, text);
  } catch (err) {
    console.error('Alert error:', err.message);
  }
}

async function start() {
  await connectDB();

  const worker = new Worker(
    'checks',
    async (job) => {
      const monitor = await Monitor.findById(job.data.monitorId);

      if (!monitor) {
        console.log('Monitor not found, skipping');
        return;
      }
      if (!monitor.isActive) {
        console.log('Monitor inactive, skipping');
        return;
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
    { connection, concurrency: 5 }
  );

  worker.on('failed', (job, err) => {
    console.error(`Job failed: ${err.message}`);
  });

  console.log('Worker started, waiting for jobs...');
}

start();