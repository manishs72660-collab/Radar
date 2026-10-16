// Haath se rollup chalane aur jaanchne ke liye:
//   node src/scripts/rollup.js            (jo ghante baaki hain wo bharta hai)
//   node src/scripts/rollup.js --hours=48 (pichle 48 poore ghante dobara banata hai)
require('dotenv').config();
const connectDB = require('../config/db');
const { runRollup, verify } = require('../modules/checks/rollup.service');

(async () => {
  const arg = process.argv.find((a) => a.startsWith('--hours='));
  const hours = arg ? Number(arg.split('=')[1]) : undefined;
  if (arg && (!Number.isFinite(hours) || hours < 1 || hours > 24 * 30)) {
    console.error('--hours 1 se 720 ke beech hona chahiye');
    process.exit(1);
  }

  await connectDB();

  const result = await runRollup({ hours });
  console.log(`Range: ${result.from.toISOString()} -> ${result.to.toISOString()}`);
  console.log(`Ghante process hue: ${result.hours}, rollups likhe/update hue: ${result.rollups}`);

  const check = await verify(result);
  console.log(`Raw checks: ${check.raw}, rollups ka total: ${check.rolled}`);
  console.log(check.match ? 'MATCH: sab barabar hai' : 'MISMATCH: kuch gadbad hai, safai (delete) mat chalana');

  process.exit(check.match ? 0 : 2);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});