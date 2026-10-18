// Purane kachche checks hatata hai (jinke summary card ban chuke hain).
//   node src/scripts/cleanup.js                  sirf dikhata hai (dry-run), kuch nahi hatata
//   node src/scripts/cleanup.js --apply          asli safai
//   node src/scripts/cleanup.js --apply --keep-days=5
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const connectDB = require('../config/db');
const { buildService, keepDaysFromArgs, printPlan } = require('./cleanupCommon');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const keepDays = keepDaysFromArgs(process.argv);
  const apply = process.argv.includes('--apply');
  await connectDB();

  const service = buildService();
  const p = await service.plan({ keepDays });
  console.log(apply ? '--- SAFAI ---' : '--- DRY RUN: kuch delete nahi hoga ---');
  printPlan(p);

  if (!apply) {
    console.log('\nYe sirf dry-run tha. Asli safai ke liye: npm run cleanup -- --apply');
    process.exit(0);
  }
  if (!p.safe) {
    console.log('\nNOT SAFE, isliye kuch delete nahi kiya. Pehle: npm run rollup -- --all, phir dobara try karo.');
    process.exit(2);
  }

  console.log('\nYe delete WAPAS NAHI HOTA. Backup liya hai? (npm run backup)');
  for (let i = 5; i >= 1; i--) {
    process.stdout.write(`  ${i}... (rokne ke liye Ctrl+C)\r`);
    await sleep(1000);
  }
  console.log('\nShuru...');

  const r = await service.apply({
    keepDays,
    onProgress: ({ done, total }) => console.log(`  ... ${done}/${total} ghante dekhe`),
  });
  console.log(`Ghante dekhe: ${r.hoursChecked}, jin ghanto mein delete hua: ${r.hoursDeleted}`);
  console.log(`Kachche checks hataye: ${r.checksDeleted}`);
  console.log(`Delete ho chuke monitors ke cards hataye: ${r.orphanRollupsDeleted}`);
  console.log(`95 din se purane cards hataye: ${r.oldRollupsDeleted}`);
  if (r.skipped.length) console.log(`Ruke hue ghante: ${r.skipped.length} (card nahi bana tha, inhe haath nahi lagaya)`);
  console.log('Ho gaya. Ab: npm run db:stats');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});