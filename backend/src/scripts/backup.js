// Safai se pehle apne data ki copy file mein rakh lo.
//   node src/scripts/backup.js
// Folder: backend/backups/<tareekh>/  (checks, rollups, incidents)
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const path = require('path');
const connectDB = require('../config/db');
const Check = require('../modules/checks/check.model');
const Rollup = require('../modules/checks/rollup.model');
const Incident = require('../modules/incidents/incident.model');
const { backupModels } = require('./backupLib');

(async () => {
  await connectDB();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(__dirname, '..', '..', 'backups', stamp);

  const counts = await backupModels(
    [
      { name: 'checks', model: Check },
      { name: 'rollups', model: Rollup },
      { name: 'incidents', model: Incident },
    ],
    dir
  );

  console.log(`Backup ban gaya: ${dir}`);
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v} documents`));
  console.log(`Wapas laane ke liye: npm run restore -- --dir="${dir}"`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});