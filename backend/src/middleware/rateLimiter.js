import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

// Environment-based configuration
const isProduction = process.env.NODE_ENV === 'production';
const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Admin IP whitelist (can be set via environment variable)
const adminIPWhitelist = process.env.ADMIN_IP_WHITELIST
  ? process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim())
  : [];

// Base rate limit configuration
const createRateLimitConfig = (options) => ({
  windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
  max: options.max,
  message: options.message || 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: options.skipSuccessfulRequests || false,
  skip: (req) => {
    // Skip rate limiting for admin IPs
    if (adminIPWhitelist.includes(req.ip)) {
      logger.debug('Rate limit skipped for admin IP', { ip: req.ip });
      return true;
    }
    return false;
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    res.status(429).json({
      error: 'Too many requests',
      message: options.message || 'Too many requests, please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

// General API rate limiter (more lenient for public endpoints)
export const generalLimiter = rateLimit(createRateLimitConfig({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 50 : 100, // Stricter in production
  message: 'Too many requests from this IP, please try again later.'
}));

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit(createRateLimitConfig({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 3 : 5, // Stricter in production
  message: 'Too many login attempts, please try again after 15 minutes.',
  skipSuccessfulRequests: true
}));

// Moderate rate limiter for admin endpoints
export const adminLimiter = rateLimit(createRateLimitConfig({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 30 : 50, // Stricter in production
  message: 'Too many admin requests, please try again later.'
}));

// Very strict limiter for public request submissions
export const publicRequestLimiter = rateLimit(createRateLimitConfig({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 3 : 5, // Stricter in production
  message: 'Too many requests submitted, please try again later.'
}));

// User-based rate limiter (for authenticated requests)
export const userLimiter = rateLimit({
  ...createRateLimitConfig({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 200 : 500, // Per user limits
    message: 'Too many requests from your account, please try again later.'
  }),
  keyGenerator: (req) => {
    // Use user ID for authenticated requests, fall back to IP
    return req.user?.id ? `user_${req.user.id}` : req.ip;
  }
});

// API-specific rate limiter with sliding window
export const apiLimiter = rateLimit({
  ...createRateLimitConfig({
    windowMs: 60 * 1000, // 1 minute sliding window
    max: isProduction ? 20 : 50, // Burst limit
    message: 'API rate limit exceeded, please slow down your requests.'
  }),
  // Use IP-based limiting for API endpoints
  keyGenerator: (req) => req.ip
});





