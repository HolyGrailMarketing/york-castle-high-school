import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';
import { readInvite } from '../utils/inviteToken.js';

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
  // In serverless environments (Vercel), disable trust proxy validation
  // Vercel uses a single proxy layer, and trust proxy is set to 1 in server.js
  // This prevents express-rate-limit validation errors
  validate: isServerless ? { trustProxy: false } : undefined,
  skip: (req) => {
    // Skip rate limiting for admin IPs
    if (adminIPWhitelist.includes(req.ip)) {
      logger.debug('Rate limit skipped for admin IP', { ip: req.ip });
      return true;
    }
    return options.skip ? options.skip(req) : false;
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
  message: 'Too many requests submitted, please try again later.',
  // An invited Sixth Form applicant is metered per invite instead — see
  // invitedApplicationLimiter below. The flag is only ever set on that route.
  skip: (req) => Boolean(req.sixthFormInvite)
}));

// Per-invite budget for late Sixth Form applications.
//
// publicRequestLimiter allows three submissions per IP per hour, and a whole
// school shares one address: the fourth invited student to apply from the
// computer lab would be turned away for an hour, having been told by email to
// apply today. A valid invite is proof of who is asking, so meter it by the
// address the invite was issued to. That still stops one link being replayed
// while leaving classmates independent of each other.
const perInviteLimiter = rateLimit({
  ...createRateLimitConfig({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Too many submissions for this invite, please try again later.'
  }),
  keyGenerator: (req) => `sfinvite_${req.sixthFormInvite.email}`
});

export const invitedApplicationLimiter = async (req, res, next) => {
  // A database lookup, so only ever done when a token is actually presented.
  const invite = req.body?.inviteToken ? await readInvite(req.body.inviteToken) : null;
  // No invite: leave it to publicRequestLimiter, which does not skip.
  if (!invite) return next();
  req.sixthFormInvite = invite;
  return perInviteLimiter(req, res, next);
};

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





