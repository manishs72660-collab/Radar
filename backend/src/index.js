require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
require('./config/redis');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

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
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});