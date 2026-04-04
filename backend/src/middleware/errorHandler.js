const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error(`${err.message} | ${req.method} ${req.path}`);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : err.message;
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
