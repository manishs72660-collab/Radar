const QUOTA_MB = 512; // MongoDB Atlas free (M0) ki limit

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

// Har collection ka size. Kisi ek ke liye na mile to baaki chalte rehte hain.
async function collectStats(db, names) {
  const rows = [];
  for (const name of names) {
    try {
      const s = await db.command({ collStats: name });
      rows.push({ name, count: s.count || 0, dataBytes: s.size || 0, storageBytes: s.storageSize || 0, indexBytes: s.totalIndexSize || 0, avgObj: s.avgObjSize || 0 });
    } catch (err) {
      rows.push({ name, error: err.message });
    }
  }
  return rows;
}

function formatStats(rows, title = '') {
  const pad = (v, n) => String(v).padEnd(n);
  const padL = (v, n) => String(v).padStart(n);
  const lines = [];
  if (title) lines.push(title);
  lines.push(`${pad('Collection', 12)}${padL('Documents', 12)}${padL('Data (MB)', 12)}${padL('Disk (MB)', 12)}${padL('Index (MB)', 12)}${padL('Avg doc (B)', 13)}`);
  let used = 0;
  for (const r of rows) {
    if (r.error) {
      lines.push(`${pad(r.name, 12)}  (nahi mila: ${r.error})`);
      continue;
    }
    used += r.storageBytes + r.indexBytes;
    lines.push(`${pad(r.name, 12)}${padL(r.count, 12)}${padL(mb(r.dataBytes), 12)}${padL(mb(r.storageBytes), 12)}${padL(mb(r.indexBytes), 12)}${padL(Math.round(r.avgObj), 13)}`);
  }
  const usedMb = used / 1024 / 1024;
  lines.push(`Kul (disk + index): ${usedMb.toFixed(2)} MB, Atlas free limit ${QUOTA_MB} MB ka ${((usedMb / QUOTA_MB) * 100).toFixed(1)}%`);
  return lines.join('\n');
}

module.exports = { collectStats, formatStats, QUOTA_MB };