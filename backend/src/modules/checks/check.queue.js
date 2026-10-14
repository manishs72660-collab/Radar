const { Queue } = require('bullmq');
const connection = require('../../config/redis');

const checkQueue = new Queue('checks', { connection });

// Monitor ke liye repeating job lagao
async function scheduleMonitor(monitor) {
  await checkQueue.upsertJobScheduler(
    `monitor-${monitor._id}`, // scheduler ka unique id
    { every: monitor.intervalMinutes * 60 * 1000 },
    {
      name: 'run-check',
      data: { monitorId: monitor._id.toString() },
      opts: { removeOnComplete: true, removeOnFail: 100 },
    }
  );
}

// Monitor delete/pause hone pe job hatao
async function unscheduleMonitor(monitor) {
  await checkQueue.removeJobScheduler(`monitor-${monitor._id}`);
}

module.exports = { checkQueue, scheduleMonitor, unscheduleMonitor };