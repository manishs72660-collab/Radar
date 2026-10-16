// SIRF DEKHNE KE LIYE. Ye kuch bhi delete nahi karta.
//   node src/scripts/cleanup-dry-run.js              (3 din raw rakhne ka hisaab)
//   node src/scripts/cleanup-dry-run.js --keep-days=5
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Check = require('../modules/checks/check.model');
const Rollup = require('../modules/checks/rollup.model');
const Monitor = require('../modules/monitors/monitor.model');
const { createCleanupService } = require('../modules/checks/cleanup.service');

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

(async () => {
  const arg = process.argv.find((a) => a.startsWith('--keep-days='));
  const keepDays = arg ? Number(arg.split('=')[1]) : 3;
  if (!Number.isFinite(keepDays) || keepDays < 1 || keepDays > 365) {
    console.error('--keep-days 1 se 365 ke beech hona chahiye');
    process.exit(1);
  }

  await connectDB();

  const service = createCleanupService({
    Check,
    Rollup,
    Monitor,
    getAvgObjSize: async () => {
      const stats = await mongoose.connection.db.command({ collStats: Check.collection.collectionName });
      return stats.avgObjSize;
    },
  });

  const p = await service.plan({ keepDays });

  console.log('--- DRY RUN: kuch delete nahi hua ---');
  console.log(`Raw checks rakhne ke din : ${p.keepDays}`);
  console.log(`Cutoff (isse purane)     : ${p.cutoff.toISOString()}`);
  console.log(`Sabse purana raw check   : ${p.oldest ? p.oldest.toISOString() : '-'}`);
  console.log(`Kul raw checks           : ${p.rawTotal}`);
  console.log(`Hatenge                  : ${p.toDelete}`);
  console.log(`Bachenge                 : ${p.toKeep}`);
  console.log(p.freedBytes != null ? `Andaza: ~${mb(p.freedBytes)} khali hoga (sirf data, indexes alag)` : 'Size ka andaza nahi mil paya');

  console.log('\nHar monitor ka hisaab (purane raw checks vs unke rollups ka total):');
  if (p.perMonitor.length === 0) console.log('  (hatane layak purana data hai hi nahi)');
  p.perMonitor.forEach((m) => {
    console.log(`  ${m.orphan ? 'ORPHAN  ' : m.ok ? 'OK      ' : 'MISMATCH'}  ${m.name}  raw=${m.raw}  rollups=${m.rolled}`);
  });

  if (p.perMonitor.some((m) => m.orphan)) {
    console.log('\nORPHAN = monitor delete ho chuka hai, uske purane summary cards bache hain. Ye safai nahi rokte, aur Part D mein saaf honge.');
  }

  console.log(
    p.safe
      ? '\nSAFE: har purana check ka summary card ban chuka hai. Safai Part D mein chalegi.'
      : '\nNOT SAFE: kuch checks ke summary card nahi bane. Pehle "npm run rollup -- --all" chalao, phir ye dobara.'
  );
  process.exit(p.safe ? 0 : 2);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});