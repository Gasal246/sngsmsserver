const mongoose = require('mongoose');

const TWO_MONTHS_IN_SECONDS = 60 * 24 * 60 * 60;

const rawRequestLogSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    body: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  {
    collection: 'raw_request_logs',
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

rawRequestLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: TWO_MONTHS_IN_SECONDS }
);

module.exports = mongoose.model('RawRequestLog', rawRequestLogSchema);
