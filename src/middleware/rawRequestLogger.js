const RawRequestLog = require('../models/rawRequestLog.model');

const snapshotBody = (body) => {
  if (body === undefined) return null;
  return JSON.parse(JSON.stringify(body));
};

const rawRequestLogger = () => (req, res, next) => {
  // Capture before validation or route handlers can normalize req.body.
  const body = snapshotBody(req.body);

  res.once('finish', () => {
    RawRequestLog.create({
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      body
    }).catch((error) => {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to write raw request log', error.message);
      }
    });
  });

  next();
};

module.exports = rawRequestLogger;
