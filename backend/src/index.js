require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
require('./config/redis');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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

// Render, Railway jaise hosts ke peeche asli IP X-Forwarded-For mein aata hai.
// .env mein TRUST_PROXY=<number> daalo jab deploy karo, warna sab users ek hi IP lagenge.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// Allowed addresses: .env ka CLIENT_URL (comma se alag karke kai bhi de sakte ho)
const allowed = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiLimiter);

// Deploy ke baad dekhne ke liye ki server tumhara asli IP dekh raha hai ya nahi (rate limit isi par chalta hai).
// Sirf tab chalu jab DEBUG_IP=true ho. Kaam khatam hone par wo variable hata do.
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

// Koi bhi bacha hua error JSON mein jaye
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

// "npm run dev" se seedha chalane par pehle jaisa hi shuru ho
if (require.main === module) startServer();