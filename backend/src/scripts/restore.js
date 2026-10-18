// Backup se data wapas daalta hai. Jo pehle se database mein hai use nahi chhedta, sirf jo gayab hai wo daalta hai.
//   node src/scripts/restore.js --dir=backups/2026-10-16T10-00-00
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const path = require('path');
const connectDB = require('../config/db');
const Check = require('../modules/checks/check.model');
const Rollup = require('../modules/checks/rollup.model');
const Incident = require('../modules/incidents/incident.model');
const { restoreModels } = require('./backupLib');

(async () => {
  const arg = process.argv.find((a) => a.startsWith('--dir='));
  if (!arg) {
    console.error('Backup folder batao: npm run restore -- --dir=backups/<folder>');
    process.exit(1);
  }
  const dir = path.resolve(arg.slice('--dir='.length).replace(/^"|"$/g, ''));

  await connectDB();
  const result = await restoreModels(
    [
      { name: 'checks', model: Check },
      { name: 'rollups', model: Rollup },
      { name: 'incidents', model: Incident },
    ],
    dir
  );

  Object.entries(result).forEach(([k, v]) => console.log(`${k}: file mein ${v.read}, wapas daale ${v.inserted}, pehle se the ${v.skipped}`));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});