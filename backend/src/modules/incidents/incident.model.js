const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    monitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Monitor', required: true, index: true },
    startedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
    cause: { type: String, default: null },
    status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Incident', incidentSchema);