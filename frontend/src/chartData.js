// Graph aur heatmap ka hisaab-kitaab. Screen se alag rakha hai, taaki akele test ho sake.

// Scale ke liye ek saaf number tak upar le jao (ms mein)
export function niceCap(v) {
  const steps = [100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 4000, 5000];
  return steps.find((s) => s >= v) || Math.ceil(v / 1000) * 1000;
}

// kind 'raw'    -> har check ek point (1h, 24h)
// kind 'series' -> har point ek bucket, jisme average, sabse tez, sabse dheema (7d, 30d)
export function prepareChartData({ kind, checks = [], points = [], bucketMinutes = 60 }) {
  let data;
  if (kind === 'series') {
    data = points.map((p) => ({
      t: p.t,
      value: p.avg,
      min: p.min,
      max: p.max,
      down: p.down || 0,
      cold: p.coldStarts || 0,
      total: p.total,
      uptime: p.uptime,
      bucketMs: bucketMinutes * 60000,
    }));
  } else {
    data = checks.map((c) => ({
      t: new Date(c.checkedAt).getTime(),
      value: c.status === 'DOWN' ? null : c.responseTime, // down check ka 30s timeout speed nahi hai
      down: c.status === 'DOWN' ? 1 : 0,
      cold: c.status === 'UP' && c.isColdStart ? 1 : 0,
      error: c.error || null,
      code: c.statusCode ?? null,
    }));
  }

  // Cold start ek do point ke liye poore graph ko dabaa na de: normal speed ke hisaab se scale
  const high = (d) => (kind === 'series' ? (d.max ?? d.value) : d.value);
  const normalHigh = Math.max(0, ...data.filter((d) => !d.cold).map(high).filter((v) => v != null));
  const coldHigh = Math.max(0, ...data.filter((d) => d.cold).map(high).filter((v) => v != null));
  const clipped = normalHigh > 0 && coldHigh > normalHigh * 2.5;
  const cap = clipped ? niceCap(normalHigh * 1.25) : null;

  const clip = (v) => (v == null ? null : cap ? Math.min(v, cap) : v);
  data = data.map((d) => ({
    ...d,
    plot: clip(d.value),
    band: kind === 'series' && d.min != null && d.max != null ? [clip(d.min), clip(d.max)] : null,
  }));

  return {
    data,
    cap,
    clipped,
    downMarks: data.filter((d) => d.down > 0).slice(-80),
    hasEnough: data.length >= 2,
  };
}

// ---------- heatmap ----------
export function heatLevel(uptime) {
  if (uptime == null) return 'none';
  if (uptime >= 99.9) return 'l4';
  if (uptime >= 99) return 'l3';
  if (uptime >= 95) return 'l2';
  return 'l1';
}

export function heatLevelColorClass(level) {
  if (level === 'l4') return 'is-up';
  if (level === 'l3') return 'is-up';
  if (level === 'l2') return 'is-warn';
  if (level === 'l1') return 'is-down';
  return '';
}

// Hafta Monday se shuru. Pehle hafte mein khaali jagah chhodni padti hai.
export function heatCells(days) {
  if (!days || !days.length) return { cells: [], weeks: 0 };
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...days];
  return { cells, weeks: Math.ceil(cells.length / 7) };
}

// Mahine ke naam, us hafte ke upar jahan mahina badalta hai
export function heatMonths(cells) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const out = [];
  let last = -1;
  for (let w = 0; w * 7 < cells.length; w++) {
    const day = cells.slice(w * 7, w * 7 + 7).find(Boolean);
    if (!day) continue;
    const month = new Date(`${day.date}T00:00:00Z`).getUTCMonth();
    if (month !== last) {
      out.push({ col: w, label: names[month] });
      last = month;
    }
  }
  return out;
}

// Graph ke neeche tareekhon ke label: har label raat 12 baje pe, taaki ek hi din do baar na likha aaye
export function dayTicks(minT, maxT, maxTicks = 8) {
  if (!Number.isFinite(minT) || !Number.isFinite(maxT) || maxT <= minT) return [];
  const all = [];
  const d = new Date(minT);
  d.setUTCHours(24, 0, 0, 0);
  while (d.getTime() <= maxT) {
    all.push(d.getTime());
    d.setUTCDate(d.getUTCDate() + 1);
  }
  if (all.length <= maxTicks) return all;
  const step = Math.ceil(all.length / maxTicks);
  return all.filter((_, i) => i % step === 0);
}