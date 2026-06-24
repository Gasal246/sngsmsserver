const morgan = require('morgan');
const RequestLog = require('../models/requestLog.model');
const { sha256 } = require('../utils/hash');

const summarizeGatewayResponse = (value) => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }

  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    if (json.length <= 1000) return value;
    return `${json.slice(0, 1000)}...`;
  }

  return value;
};

const requestLogger = () => {
  morgan.token('request-id', (req) => req.id);
  morgan.token('api-key-id', (req) => req.apiKeyId);
  morgan.token('gateway-status', (_req, res) => res.locals.gateway?.statusCode);
  morgan.token('gateway-duration', (_req, res) => res.locals.gateway?.durationMs);

  return morgan((tokens, req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';

    return JSON.stringify({
      requestId: tokens['request-id'](req, res),
      method: tokens.method(req, res),
      path: tokens.url(req, res),
      statusCode: Number(tokens.status(req, res)),
      responseTimeMs: Number(tokens['response-time'](req, res)),
      ip: req.ip,
      userAgent: req.get('user-agent'),
      apiKeyId: tokens['api-key-id'](req, res),
      request: {
        type: req.body?.type,
        phone: req.body?.phone,
        campId: req.body?.campId,
        date: req.body?.date,
        textLength: text ? text.length : undefined,
        textHash: text ? sha256(text) : undefined
      },
      gateway: res.locals.gateway
        ? {
            type: res.locals.gateway.type,
            statusCode: res.locals.gateway.statusCode,
            durationMs: res.locals.gateway.durationMs,
            responseSummary: summarizeGatewayResponse(res.locals.gateway.responseSummary),
            errorCode: res.locals.gateway.errorCode
          }
        : undefined,
      error: res.locals.error
    });
  }, {
    stream: {
      write: (line) => {
        let payload;

        try {
          payload = JSON.parse(line);
        } catch (_error) {
          return;
        }

        RequestLog.create(payload).catch((error) => {
          if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to write request log', error.message);
          }
        });
      }
    }
  });
};

module.exports = requestLogger;
