// seed.js ka bhara hua nakli data hatata hai (sirf jinke naam "SEED " se shuru hote hain).
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const connectDB = require('../config/db');
const Monitor = require('../modules/monitors/monitor.model');
const Check = require('../modules/checks/check.model');
const Incident = require('../modules/incidents/incident.model');
const Rollup = require('../modules/checks/rollup.model');

(async () => {
  await connectDB();

  const monitors = await Monitor.find({ name: /^SEED / }).select('_id name').lean();
  if (monitors.length === 0) {
    console.log('Koi seed data nahi mila, kuch hatana nahi hai.');
    process.exit(0);
  }
  const ids = monitors.map((m) => m._id);

  const checks = await Check.deleteMany({ monitorId: { $in: ids } });
  const rollups = await Rollup.deleteMany({ monitorId: { $in: ids } });
  const incidents = await Incident.deleteMany({ monitorId: { $in: ids } });
  const removed = await Monitor.deleteMany({ _id: { $in: ids } });

  console.log(`Hata diye: ${removed.deletedCount} monitors, ${checks.deletedCount} checks, ${rollups.deletedCount} rollups, ${incidents.deletedCount} incidents`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});