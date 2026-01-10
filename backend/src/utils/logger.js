import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Use PROJECT_ROOT if set (for Vercel), otherwise calculate
const projectRoot = process.env.PROJECT_ROOT || path.join(__dirname, '../../');

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Create logs directory if it doesn't exist (only in non-serverless environments)
let logsDir = null;
if (!isServerless) {
  logsDir = path.join(projectRoot, 'logs');
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (err) {
    // If we can't create logs directory, just log to console
    console.warn('[Logger] Could not create logs directory, falling back to console only:', err.message);
    logsDir = null;
  }
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const transports = [];

// In serverless mode, only use console transport
if (isServerless || !logsDir) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  // In non-serverless mode, use file transports
  transports.push(
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  
  // Add console transport for development
  if (process.env.NODE_ENV !== 'production') {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { service: 'york-castle-api' },
  transports: transports,
});

// Add exception and rejection handlers (only if we can write files)
if (!isServerless && logsDir) {
  logger.exceptionHandlers = [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
    }),
  ];
  logger.rejectionHandlers = [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
    }),
  ];
} else {
  // In serverless, log exceptions/rejections to console
  logger.exceptionHandlers = [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ];
  logger.rejectionHandlers = [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ];
}

// Helper function to generate request ID
let requestIdCounter = 0;
export const generateRequestId = () => {
  return `req-${Date.now()}-${++requestIdCounter}`;
};

// Create child logger with request ID
export const createRequestLogger = (requestId) => {
  return logger.child({ requestId });
};

export default logger;





