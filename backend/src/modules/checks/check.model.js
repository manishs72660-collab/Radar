const mongoose = require('mongoose');

const checkSchema = new mongoose.Schema({
  monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true, index: true },
  status: { type: String, enum: ['UP', 'DOWN'], required: true },
  statusCode: { type: Number, default: null },
  responseTime: { type: Number, required: true },
  timings: {
    dns: { type: Number, default: null },
    tcp: { type: Number, default: null },
    tls: { type: Number, default: null },
    ttfb: { type: Number, default: null },
    download: { type: Number, default: null },
  },
  isColdStart: { type: Boolean, default: false },
  baselineTtfb: { type: Number, default: null },
  error: { type: String, default: null },
  checkedAt: { type: Date, default: Date.now, index: true },
});

checkSchema.index({ monitorId: 1, checkedAt: 1 });
module.exports = mongoose.model('Check', checkSchema);