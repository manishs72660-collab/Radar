
const mongoose = require('mongoose');
const Check = require('../modules/checks/check.model');
const Rollup = require('../modules/checks/rollup.model');
const Monitor = require('../modules/monitors/monitor.model');
const { createCleanupService } = require('../modules/checks/cleanup.service');

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

function buildService() {
  return createCleanupService({
    Check,
    Rollup,
    Monitor,
    getAvgObjSize: async () => {
      const stats = await mongoose.connection.db.command({ collStats: Check.collection.collectionName });
      return stats.avgObjSize;
    },
  });
}

function keepDaysFromArgs(argv) {
  const arg = argv.find((a) => a.startsWith('--keep-days='));
  const keepDays = arg ? Number(arg.split('=')[1]) : 3;
  if (!Number.isFinite(keepDays) || keepDays < 1 || keepDays > 365) {
    console.error('--keep-days 1 se 365 ke beech hona chahiye');
    process.exit(1);
  }
  return keepDays;
}

function printPlan(p, log = console.log) {
  log(`Raw checks rakhne ke din : ${p.keepDays}`);
  log(`Cutoff (isse purane)     : ${p.cutoff.toISOString()}`);
  log(`Sabse purana raw check   : ${p.oldest ? new Date(p.oldest).toISOString() : '-'}`);
  log(`Kul raw checks           : ${p.rawTotal}`);
  log(`Hatenge                  : ${p.toDelete}`);
  if (p.blocked) log(`Nahi hatenge (card nahi) : ${p.blocked}`);
  log(`Bachenge                 : ${p.toKeep}`);
  log(p.freedBytes != null ? `Andaza: ~${mb(p.freedBytes)} khali hoga (sirf data, indexes alag)` : 'Size ka andaza nahi mil paya');

  log('\nHar monitor ka hisaab (purane checks vs unke summary cards):');
  if (p.perMonitor.length === 0) log('  (hatane layak purana data hai hi nahi)');
  p.perMonitor.forEach((m) => log(`  ${m.ok ? 'OK      ' : 'MISMATCH'}  ${m.name}  raw=${m.raw}  cards=${m.rolled}`));

  if (p.skipped.length) {
    log(`\n${p.skipped.length} ghante ruke hue hain (summary card nahi bana ya naya check aaya). Pehle: npm run rollup -- --all`);
  }
  if (p.orphanMonitors) {
    log(`\n${p.orphanMonitors} delete ho chuke monitor ke purane summary cards bache hain, safai inhe bhi hata degi.`);
  }
}

module.exports = { buildService, keepDaysFromArgs, printPlan, mb };