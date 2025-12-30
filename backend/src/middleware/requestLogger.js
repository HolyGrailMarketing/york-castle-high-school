import logger, { generateRequestId, createRequestLogger } from '../utils/logger.js';

/**
 * Request logging middleware
 * Logs all API requests with method, path, status code, response time, user ID, and IP
 */
export const requestLogger = (req, res, next) => {
  const requestId = generateRequestId();
  req.requestId = requestId;
  req.logger = createRequestLogger(requestId);

  const startTime = Date.now();

  // Log request
  req.logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || null,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;

    // Log response
    req.logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || null,
    });

    // Log slow requests as warnings
    if (duration > 1000) {
      req.logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
      });
    }

    // Log errors
    if (res.statusCode >= 400) {
      req.logger.error('Request error', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: req.user?.id || null,
      });
    }

    return originalSend.call(this, body);
  };

  next();
};





