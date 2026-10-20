// Redis ka data kabhi bhi ud sakta hai (free Redis ki maintenance, galti se flush, naya Redis).
// Asli list MongoDB mein hai, isliye worker chalu hote hi Redis ko MongoDB ke saath barabar kar deta hai:
//   - jo monitor chalu hain unka scheduler lagao (pehle se ho to update hota hai, duplicate nahi)
//   - jinka monitor ab chalu nahi (delete ya pause), unke bache hue scheduler hatao
const KEEP = ['rollup-hourly']; // ye hamare apne schedulers hain, inhe mat hatao

async function syncSchedulers({ Monitor, queue, schedule }) {
  const monitors = await Monitor.find({ isActive: true }).select('_id intervalMinutes').lean();

  for (const m of monitors) await schedule(m);

  const wanted = new Set([...KEEP, ...monitors.map((m) => `monitor-${m._id}`)]);
  const existing = await queue.getJobSchedulers(0, -1);

  let removed = 0;
  for (const s of existing) {
    if (!wanted.has(s.key)) {
      await queue.removeJobScheduler(s.key);
      removed += 1;
    }
  }
  return { active: monitors.length, removed };
}

module.exports = { syncSchedulers };