// SIRF DEKHNE KE LIYE. Ye kuch bhi delete nahi karta.
//   node src/scripts/cleanup-dry-run.js              (3 din raw rakhne ka hisaab)
//   node src/scripts/cleanup-dry-run.js --keep-days=5
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
// SIRF DEKHNE KE LIYE. Ye kuch bhi delete nahi karta.
//   node src/scripts/cleanup-dry-run.js              (3 din raw rakhne ka hisaab)
//   node src/scripts/cleanup-dry-run.js --keep-days=5
require('dotenv').config();
const connectDB = require('../config/db');
const { buildService, keepDaysFromArgs, printPlan } = require('./cleanupCommon');

(async () => {
  const keepDays = keepDaysFromArgs(process.argv);
  await connectDB();

  const p = await buildService().plan({ keepDays });
  console.log('--- DRY RUN: kuch delete nahi hua ---');
  printPlan(p);
  console.log(
    p.safe
      ? '\nSAFE: har purane check ka summary card ban chuka hai. Asli safai: npm run cleanup -- --apply'
      : '\nNOT SAFE: kuch ghanto ke summary card nahi bane. Pehle "npm run rollup -- --all" chalao, phir ye dobara.'
  );
  process.exit(p.safe ? 0 : 2);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});