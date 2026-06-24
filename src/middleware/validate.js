const AppError = require('../utils/AppError');

const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));

    return next(new AppError('Invalid request body', 400, 'VALIDATION_ERROR', details));
  }

  req.body = result.data;
  return next();
};

module.exports = {
  validateBody
};
