const mongoose = require('mongoose');

const monitorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    method: { type: String, default: 'GET', enum: ['GET', 'HEAD', 'POST'] },
    intervalMinutes: { type: Number, default: 5, min: 1 },
    expectedStatus: { type: Number, default: 200 },
    isActive: { type: Boolean, default: true },
    currentStatus: {
      type: String,
      enum: ['UP', 'DOWN', 'PENDING'],
      default: 'PENDING',
    },
    failureCount: { type: Number, default: 0 },
    schedule: {
      enabled: { type: Boolean, default: false },
      startHour: { type: Number, default: 9, min: 0, max: 23 },
      endHour: { type: Number, default: 23, min: 0, max: 23 },
      timezone: { type: String, default: 'UTC' },
      prewarmMinutes: { type: Number, default: 5, min: 0, max: 30 },
      offHoursEveryMinutes: { type: Number, default: 0, min: 0, max: 720 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Monitor', monitorSchema);