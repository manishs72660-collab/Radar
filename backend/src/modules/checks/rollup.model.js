const mongoose = require('mongoose');

const num = { type: Number, default: 0 };

// Ek monitor ke ek ghante ka summary card.
// Average seedha nahi rakha, sum aur count rakha hai, kyunki averages ka average galat hota hai.
const rollupSchema = new mongoose.Schema(
  {
    monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true },
    hour: { type: Date, required: true }, // ghante ki shuruaat (UTC)

    total: { type: Number, required: true }, // kitne checks hue
    up: num,
    down: num,
    coldStarts: num,

    // Response time (sab checks ka)
    rtSum: num,
    rtMin: { type: Number, default: null },
    rtMax: { type: Number, default: null },
    p95: { type: Number, default: null }, // sirf us ek ghante ka, aage milaya nahi ja sakta

    // Breakdown, sirf "normal" checks ka (UP, cold start nahi, timings maujood)
    normalCount: num,
    dnsSum: num,
    tcpSum: num,
    tlsSum: num,
    ttfbSum: num,
    downloadSum: num,

    // Cold start checks ka TTFB, taaki "itna extra wait" nikal sake
    coldTtfbSum: num,
  },
  { versionKey: false }
);

rollupSchema.index({ monitorId: 1, hour: 1 }, { unique: true });
rollupSchema.index({ hour: 1 });

module.exports = mongoose.model('Rollup', rollupSchema);