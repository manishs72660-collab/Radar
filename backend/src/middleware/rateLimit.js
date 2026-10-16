const redis = require('../config/redis');

const DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';

// ---------- Sliding window counter ----------
// Time ko chhoti fixed windows mein baanto. Abhi ki window ka count + pichli window ka count
// (jitna hissa abhi bhi "pichle window ke andar" hai, utne weight ke saath) = andaza.
// Isse window ki seema pe 2x burst nahi nikal pata.
function slidingEstimate({ prev, cur, elapsed, windowMs, max }) {
  const estimate = prev * (1 - elapsed / windowMs) + cur;
  const toNextWindow = windowMs - elapsed;

  if (estimate <= max) return { count: estimate, resetMs: toNextWindow };

  // Blocked: kitni der baad agli request allowed hogi (agar beech mein aur requests na aayein).
  // Agli request khud bhi ginti hai (cur + 1), isliye hisaab usi ke saath.
  let retryMs;
  const room = max - cur - 1; // abhi wali window mein agli request ke baad kitni jagah bachegi
  if (room > 0) {
    // Abhi wali window mein hi, pichli window ka weight ghatne tak ruko
    const t = windowMs * (1 - room / prev);
    retryMs = t - elapsed;
  } else {
    // Abhi wali window mein jagah nahi: agli window mein jao, jahan ye window "pichli" ban jayegi
    const tNext = cur <= max - 1 ? 0 : windowMs * (1 - (max - 1) / cur);
    retryMs = toNextWindow + tNext;
  }
  return { count: estimate, resetMs: Math.max(1, Math.ceil(retryMs)) };
}

// ---------- Store 1: memory (Redis commands kharch nahi hote) ----------
function createMemoryStore(now = Date.now) {
  const hits = new Map(); // key -> { id, cur, prev, windowMs }

  const cleaner = setInterval(() => {
    const t = now();
    for (const [key, e] of hits) {
      if (Math.floor(t / e.windowMs) > e.id + 1) hits.delete(key);
    }
  }, 60 * 1000);
  cleaner.unref(); // ye timer server band hone se nahi rokta

  return {
    async hit(key, windowMs, max) {
      const t = now();
      const id = Math.floor(t / windowMs);
      const elapsed = t - id * windowMs;

      let e = hits.get(key);
      if (!e) {
        e = { id, cur: 0, prev: 0, windowMs };
      } else if (e.id !== id) {
        e = { id, cur: 0, prev: e.id === id - 1 ? e.cur : 0, windowMs };
      }
      e.cur += 1; // blocked requests bhi ginti hain, isliye hammering se block lamba hota hai
      hits.set(key, e);

      return slidingEstimate({ prev: e.prev, cur: e.cur, elapsed, windowMs, max });
    },
  };
}

// ---------- Store 2: Redis (kai servers ke beech shared, login jaise kam requests ke liye) ----------
function createRedisStore(client, now = Date.now) {
  return {
    async hit(key, windowMs, max) {
      const t = now();
      const id = Math.floor(t / windowMs);
      const elapsed = t - id * windowMs;
      const curKey = `${key}:${id}`;
      const prevKey = `${key}:${id - 1}`;

      const results = await client
        .multi()
        .incr(curKey)
        .get(prevKey)
        .pexpire(curKey, windowMs * 2) // 2 windows tak chahiye, phir khud hat jati hai
        .exec();

      const failed = results.find((r) => r[0]);
      if (failed) throw failed[0];

      const cur = Number(results[0][1]);
      const prev = Number(results[1][1] || 0);
      return slidingEstimate({ prev, cur, elapsed, windowMs, max });
    },
  };
}

function rateLimit({ name, windowMs, max, message, store, keyFn }) {
  return async (req, res, next) => {
    if (DISABLED) return next();

    try {
      const id = keyFn ? keyFn(req) : req.ip;
      const { count, resetMs } = await store.hit(`rl:${name}:${id}`, windowMs, max);
      const resetSec = Math.max(1, Math.ceil(resetMs / 1000));

      res.set({
        'RateLimit-Limit': String(max),
        'RateLimit-Remaining': String(Math.max(0, Math.floor(max - count))),
        'RateLimit-Reset': String(resetSec),
      });

      if (count > max) {
        res.set('Retry-After', String(resetSec));
        return res.status(429).json({ message: message || 'Too many requests. Please slow down.' });
      }
    } catch (err) {
      // Limiter khud kharab ho jaye to app nahi rukni chahiye
      console.error('Rate limiter error (skipped):', err.message);
    }

    next();
  };
}

const memory = createMemoryStore();
const shared = createRedisStore(redis);

// Poore API par: 1 minute mein 300 requests har IP se (dashboard har 15 second mein poll karta hai, ye kaafi hai)
const apiLimiter = rateLimit({ name: 'api', windowMs: 60 * 1000, max: 300, store: memory });

// Login: 15 minute mein 10 koshish (Redis mein, taaki restart ya kai servers pe bhi gine)
const loginLimiter = rateLimit({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  store: shared,
  message: 'Too many login attempts. Try again in a few minutes.',
});

// Register: 1 ghante mein 5 naye account har IP se
const registerLimiter = rateLimit({
  name: 'register',
  windowMs: 60 * 60 * 1000,
  max: 5,
  store: shared,
  message: 'Too many sign-ups from this address. Try again later.',
});

// "Check now" Radar se bahar request bhejta hai, isliye har user ko 1 minute mein 10 tak
const checkNowLimiter = rateLimit({
  name: 'checknow',
  windowMs: 60 * 1000,
  max: 10,
  store: memory,
  keyFn: (req) => (req.user ? String(req.user.id) : req.ip),
  message: 'You are running checks too quickly. Wait a minute and try again.',
});

// Public status page: bina login ke khulta hai, isliye IP se limit
const publicLimiter = rateLimit({ name: 'public', windowMs: 60 * 1000, max: 60, store: memory });

module.exports = {
  rateLimit,
  slidingEstimate,
  createMemoryStore,
  createRedisStore,
  apiLimiter,
  loginLimiter,
  registerLimiter,
  checkNowLimiter,
  publicLimiter,
};