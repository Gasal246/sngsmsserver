const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, _next) => {
  const normalized = err instanceof AppError
    ? err
    : new AppError('Unexpected server error', 500, 'INTERNAL_ERROR');

  res.locals.error = {
    message: normalized.message,
    code: normalized.code
  };

  const body = {
    success: false,
    requestId: req.id,
    error: {
      code: normalized.code,
      message: normalized.message
    }
  };

  if (normalized.details) {
    body.error.details = normalized.details;
  }

  res.status(normalized.statusCode).json(body);
};

module.exports = errorHandler;
