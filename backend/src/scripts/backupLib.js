const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { EJSON } = require('mongoose').mongo.BSON;

// Date aur ObjectId jaise types file mein bhi safe rehte hain (EJSON), isliye restore par bilkul waise hi wapas aate hain
async function backupModels(models, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const counts = {};

  for (const { name, model } of models) {
    const fd = fs.openSync(path.join(dir, `${name}.ndjson`), 'w');
    let n = 0;
    try {
      for await (const doc of model.find().lean().cursor()) {
        fs.writeSync(fd, EJSON.stringify(doc, { relaxed: false }) + '\n');
        n += 1;
      }
    } finally {
      fs.closeSync(fd);
    }
    counts[name] = n;
  }

  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), counts }, null, 2));
  return counts;
}

// Sirf wahi documents wapas daalta hai jo database mein abhi nahi hain (_id se pehchan). Maujooda data nahi chhedta.
async function restoreModels(models, dir, { batchSize = 1000 } = {}) {
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) throw new Error(`${dir} mein manifest.json nahi mila, ye backup folder nahi lagta`);
  const result = {};

  for (const { name, model } of models) {
    const file = path.join(dir, `${name}.ndjson`);
    const stats = { read: 0, inserted: 0, skipped: 0 };
    result[name] = stats;
    if (!fs.existsSync(file)) continue;

    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const size = batch.length;
      try {
        const res = await model.collection.insertMany(batch, { ordered: false });
        stats.inserted += res.insertedCount ?? size;
      } catch (err) {
        // Kuch pehle se maujood the (duplicate key): baaki daal diye gaye
        const isDup = err && (err.code === 11000 || (err.writeErrors && err.writeErrors.length));
        if (!isDup) throw err;
        const inserted = err.insertedCount ?? (err.result && err.result.insertedCount) ?? 0;
        stats.inserted += inserted;
        stats.skipped += size - inserted;
      }
      batch = [];
    };

    const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      batch.push(EJSON.parse(line));
      stats.read += 1;
      if (batch.length >= batchSize) await flush();
    }
    await flush();
  }
  return result;
}

module.exports = { backupModels, restoreModels };