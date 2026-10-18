// Database ka size dikhata hai. Safai se pehle aur baad dono baar chalao, aur numbers apne paas likh lo.
//   node src/scripts/db-stats.js
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { collectStats, formatStats } = require('./statsLib');

(async () => {
  await connectDB();
  const rows = await collectStats(mongoose.connection.db, ['checks', 'rollups', 'incidents', 'monitors']);
  console.log(formatStats(rows, `Database stats (${new Date().toISOString()})`));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});