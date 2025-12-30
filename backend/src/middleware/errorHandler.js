import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export const errorHandler = (err, req, res, next) => {
  // Generate error ID for tracking
  const errorId = uuidv4();
  
  // Use request logger if available, otherwise use default logger
  const log = req.logger || logger;
  
  // Log error with full details
  log.error('Request error', {
    errorId,
    method: req.method,
    path: req.path,
    statusCode: err.statusCode || 500,
    errorName: err.name,
    errorMessage: err.message,
    errorCode: err.code,
    stack: err.stack,
    userId: req.user?.id || null,
    ip: req.ip || req.connection.remoteAddress,
  });

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Duplicate entry',
      message: 'A record with this information already exists',
      errorId,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Not found',
      message: 'The requested record was not found',
      errorId,
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
      details: err.errors,
      errorId,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication token is invalid',
      errorId,
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Authentication token has expired',
      errorId,
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Sanitize error message for client (don't expose internal details in production)
  const clientMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'An internal server error occurred'
    : message;

  res.status(statusCode).json({
    error: err.name || 'Server error',
    message: clientMessage,
    errorId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

