const env = require('../config/env');
const AppError = require('../utils/AppError');
const { sha256 } = require('../utils/hash');

const authenticateApiKey = (req, _res, next) => {
  if (!env.clientApiKey) {
    return next(new AppError('Server API key is not configured', 500, 'API_KEY_NOT_CONFIGURED'));
  }

  const apiKey = req.get('x-api-key');
  if (!apiKey || apiKey !== env.clientApiKey) {
    return next(new AppError('Invalid API key', 401, 'INVALID_API_KEY'));
  }

  req.apiKeyId = sha256(apiKey).slice(0, 12);
  return next();
};

module.exports = authenticateApiKey;
