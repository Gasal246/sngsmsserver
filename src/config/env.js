require('dotenv').config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sngsmsserver',
  clientApiKey: process.env.CLIENT_API_KEY || '',
  trustProxy: toBool(process.env.TRUST_PROXY, false),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  gatewayTimeoutMs: toInt(process.env.GATEWAY_TIMEOUT_MS, 15000),
  rateLimitWindowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  rateLimitMax: toInt(process.env.RATE_LIMIT_MAX, 60),
  smartSmsUae: {
    restUrl: process.env.SMART_SMS_UAE_REST_URL || '',
    userName: process.env.SMART_SMS_UAE_USER_NAME || '',
    apiPassword: process.env.SMART_SMS_UAE_API_PASSWORD || '',
    senderId: process.env.SMART_SMS_UAE_SENDER_ID || ''
  },
  cmi: {
    restUrl: process.env.CMI_REST_URL || '',
    channel: process.env.CMI_CHANNEL || '',
    authKey: process.env.CMI_AUTH_KEY || '',
    senderId: process.env.CMI_SENDER_ID || ''
  }
};

module.exports = env;
