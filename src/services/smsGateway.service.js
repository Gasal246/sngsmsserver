const axios = require('axios');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const getUnixTime = (date) => {
  if (date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000).toString();
    }
  }

  return Math.floor(Date.now() / 1000).toString();
};

const requireConfig = (gatewayType, config) => {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new AppError(
      `SMS gateway ${gatewayType} is not configured`,
      500,
      'GATEWAY_NOT_CONFIGURED',
      missing
    );
  }
};

const createGatewayError = (gatewayType, statusCode, durationMs, responseSummary, code = 'GATEWAY_REQUEST_FAILED') => {
  const error = new AppError('SMS gateway request failed', 502, code);
  error.gatewayLog = {
    type: gatewayType,
    statusCode,
    durationMs,
    responseSummary,
    errorCode: code
  };
  return error;
};

const normalizeAxiosError = (gatewayType, error, startedAt) => {
  const durationMs = Date.now() - startedAt;

  if (error.response) {
    return createGatewayError(
      gatewayType,
      error.response.status,
      durationMs,
      error.response.data,
      'GATEWAY_NON_SUCCESS_STATUS'
    );
  }

  if (error.code === 'ECONNABORTED') {
    return createGatewayError(gatewayType, undefined, durationMs, undefined, 'GATEWAY_TIMEOUT');
  }

  return createGatewayError(gatewayType, undefined, durationMs, undefined, 'GATEWAY_NETWORK_ERROR');
};

const sendUsingSmartSms = async ({ phone, text, date }) => {
  const gatewayType = 'smart-sms-uae';
  requireConfig(gatewayType, env.smartSmsUae);

  const formData = new URLSearchParams({
    username: env.smartSmsUae.userName,
    password: env.smartSmsUae.apiPassword,
    senderid: env.smartSmsUae.senderId,
    type: 'text',
    to: phone,
    text,
    datetime: date || ''
  });

  const startedAt = Date.now();

  try {
    const response = await axios.post(env.smartSmsUae.restUrl, formData, {
      timeout: env.gatewayTimeoutMs,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      success: true,
      log: {
        type: gatewayType,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        responseSummary: response.data
      }
    };
  } catch (error) {
    throw normalizeAxiosError(gatewayType, error, startedAt);
  }
};

const sendUsingCmiChinaMobile = async ({ phone, text, date }) => {
  const gatewayType = 'cmi.chinamobile';
  requireConfig(gatewayType, env.cmi);

  const payload = {
    uip_head: {
      METHOD: 'SMS_SEND_REQUEST',
      SERIAL: 1,
      TIME: getUnixTime(date),
      CHANNEL: env.cmi.channel,
      AUTH_KEY: env.cmi.authKey
    },
    uip_body: {
      SMS_CONTENT: text,
      DESTINATION_ADDR: [phone],
      ORIGINAL_ADDR: env.cmi.senderId
    },
    uip_version: 2
  };

  const startedAt = Date.now();

  try {
    const response = await axios.post(env.cmi.restUrl, payload, {
      timeout: env.gatewayTimeoutMs,
      validateStatus: (status) => status >= 200 && status < 300
    });

    return {
      success: true,
      log: {
        type: gatewayType,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        responseSummary: response.data
      }
    };
  } catch (error) {
    throw normalizeAxiosError(gatewayType, error, startedAt);
  }
};

const getSmartSmsBalance = async () => {
  requireConfig('smart-sms-uae', {
    userName: env.smartSmsUae.userName,
    apiPassword: env.smartSmsUae.apiPassword
  });

  let response;
  try {
    response = await axios.get('https://smartsmsgateway.com/api/api_http_balance.php', {
      params: {
        username: env.smartSmsUae.userName,
        password: env.smartSmsUae.apiPassword
      },
      timeout: env.gatewayTimeoutMs,
      validateStatus: (status) => status >= 200 && status < 300
    });
  } catch (_error) {
    throw new AppError('SMS balance request failed', 502, 'BALANCE_REQUEST_FAILED');
  }

  const value = response.data;
  const balance = typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isFinite(balance) || balance < 0) {
    throw new AppError('SMS gateway returned an invalid balance', 502, 'INVALID_BALANCE_RESPONSE');
  }
  return balance;
};

const sendSms = async (message) => {
  switch (message.type) {
    case 'smart-sms-uae':
      return sendUsingSmartSms(message);
    case 'cmi.chinamobile':
      return sendUsingCmiChinaMobile(message);
    default:
      throw new AppError(`Unsupported SMS gateway type: ${message.type}`, 400, 'UNSUPPORTED_GATEWAY');
  }
};

module.exports = {
  sendSms,
  getSmartSmsBalance,
  getUnixTime
};
