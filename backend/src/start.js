// Render ke free plan mein alag "worker" service nahi milti, isliye API aur worker ek hi process mein chalte hain.
// Local mein pehle jaisa hi: npm run dev (API) aur npm run worker (worker) alag-alag.
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const connectDB = require('./config/db');
const { startServer } = require('./index');
const { start: startWorker } = require('./worker');

(async () => {
  await connectDB(); // pehle ek baar. Neeche dono dobara connectDB bulate hain, par wo turant lautta hai.
  await startServer();
  await startWorker();
})().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});