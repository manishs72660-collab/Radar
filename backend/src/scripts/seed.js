// Test ke liye nakli data bharta hai.
//   node src/scripts/seed.js                       10 din, har 10 minute, 3 monitors
//   node src/scripts/seed.js --days=30 --interval=15
// Hatane ke liye: node src/scripts/seed-clean.js
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../modules/auth/user.model');
const Monitor = require('../modules/monitors/monitor.model');
const Check = require('../modules/checks/check.model');
const Incident = require('../modules/incidents/incident.model');
const { generateSeed } = require('./seedData');

const argNum = (name, fallback) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : fallback;
};

(async () => {
  const days = argNum('days', 10);
  const interval = argNum('interval', 10);
  if (!Number.isFinite(days) || days < 1 || days > 45) {
    console.error('--days 1 se 45 ke beech hona chahiye');
    process.exit(1);
  }
  if (![5, 10, 15, 30].includes(interval)) {
    console.error('--interval 5, 10, 15 ya 30 hona chahiye');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOne().sort({ createdAt: 1 });
  if (!user) {
    console.error('Koi user nahi mila. Pehle app mein Register karke ek account banao.');
    process.exit(1);
  }
  if (await Monitor.countDocuments({ name: /^SEED / })) {
    console.error('Seed data pehle se maujood hai. Pehle "npm run seed:clean" chalao.');
    process.exit(1);
  }

  const data = generateSeed({
    userId: user._id,
    days,
    intervalMinutes: interval,
    makeId: () => new mongoose.Types.ObjectId(),
  });

  await Monitor.insertMany(data.monitors);
  for (let i = 0; i < data.checks.length; i += 1000) {
    await Check.insertMany(data.checks.slice(i, i + 1000));
  }
  if (data.incidents.length) await Incident.insertMany(data.incidents);

  const cold = data.checks.filter((c) => c.isColdStart).length;
  const down = data.checks.filter((c) => c.status === 'DOWN').length;
  console.log(`User: ${user.email}`);
  console.log(`Monitors: ${data.monitors.length}, checks: ${data.checks.length} (${days} din, har ${interval} min)`);
  console.log(`Cold starts: ${cold}, DOWN checks: ${down}, incidents: ${data.incidents.length}`);
  console.log('Ye monitors "Paused" dikhenge, jaan-boojhke, taaki worker unhe na chhue. Resume mat dabana.');
  console.log('Hatane ke liye: npm run seed:clean');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});