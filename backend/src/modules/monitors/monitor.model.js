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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Monitor', monitorSchema);