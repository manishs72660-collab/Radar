require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const redis = require('./config/redis');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimit');

const monitorRoutes = require('./modules/monitors/monitor.routes');
const authRoutes = require('./modules/auth/auth.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const alertRoutes = require('./modules/alerts/alert.routes');
const statusPageRoutes = require('./modules/statuspage/statuspage.routes');
const publicRoutes = require('./modules/statuspage/public.routes');

// Crash ki wajah terminal mein dikhe
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

const app = express();

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

const allowed = [
  'https://radar-theta-ivory.vercel.app',
  'http://localhost:5173',
  ...(process.env.CLIENT_URL || '').split(','),
]
  .filter(Boolean)
  .map((s) => s.trim().replace(/\/$/, ''));
allowed.slice().forEach((o) => {
  if (o.includes('localhost')) allowed.push(o.replace('localhost', '127.0.0.1'));
});

app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// ---------- HEALTH CHECK ----------
// Mongo + Redis dono up hain to 200. Warna 503.
// Load balancers / uptime monitors isse "healthy" decide karte hain.
app.get('/health', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;

  let redisOk = false;
  try {
    const pong = await Promise.race([
      redis.ping(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('ping timeout')), 1000)),
    ]);
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  }

  const ok = mongoOk && redisOk;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    mongo: mongoOk ? 'up' : 'down',
    redis: redisOk ? 'up' : 'down',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiLimiter);

if (process.env.DEBUG_IP === 'true') {
  app.get('/api/debug/ip', (req, res) => {
    res.json({ ip: req.ip, forwardedFor: req.headers['x-forwarded-for'] || null, trustProxy: app.get('trust proxy') });
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/monitors', monitorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/status-page', statusPageRoutes);
app.use('/api/public', publicRoutes);

app.use((err, req, res, next) => {
  console.error('Request error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

function startServer() {
  return connectDB().then(
    () =>
      new Promise((resolve) => {
        const server = app.listen(PORT, () => {
          console.log(`Server running on port ${PORT}`);
          resolve(server);
        });
      })
  );
}

module.exports = { app, startServer };

if (require.main === module) startServer();