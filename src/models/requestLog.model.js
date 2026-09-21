const mongoose = require('mongoose');

const requestLogSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    responseTimeMs: { type: Number },
    ip: { type: String },
    userAgent: { type: String },
    apiKeyId: { type: String },
    request: {
      type: { type: String },
      sms_type: { type: String }, // 'verification' or 'existing' or 'purchase' or 'no_nid'
      phone: { type: String },
      campId: { type: String },
      date: { type: String },
      textLength: { type: Number },
      textHash: { type: String }
    },
    gateway: {
      type: { type: String },
      statusCode: { type: Number },
      durationMs: { type: Number },
      responseSummary: { type: mongoose.Schema.Types.Mixed },
      errorCode: { type: String }
    },
    error: {
      message: { type: String },
      code: { type: String }
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

module.exports = mongoose.model('RequestLog', requestLogSchema);
