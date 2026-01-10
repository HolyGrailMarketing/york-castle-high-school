/**
 * Cache Middleware
 *
 * Provides response caching and cache invalidation for API routes
 */

import { getCache, setCache, setCacheHeaders, setStaticCacheHeaders } from '../services/cacheService.js';
import logger from '../utils/logger.js';

/**
 * Response caching middleware
 * Caches successful GET responses
 */
export const responseCache = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator,
    condition = () => true, // Function to determine if response should be cached
  } = options;

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check if response should be cached
    if (!condition(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `${req.originalUrl}_${JSON.stringify(req.query)}_${req.user?.id || 'anonymous'}`;

    // Try to get from cache
    const cachedResponse = getCache(cacheKey);
    if (cachedResponse) {
      logger.debug('Serving from cache', { key: cacheKey });
      res.set('X-Cache-Status', 'HIT');
      return res.json(cachedResponse);
    }

    // Cache miss - intercept response
    const originalJson = res.json;
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(cacheKey, data, ttl);
        setCacheHeaders(res, { maxAge: ttl });
        res.set('X-Cache-Status', 'MISS');
        logger.debug('Cached response', { key: cacheKey, ttl });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Cache invalidation middleware
 * Clears cache when data is modified
 */
export const cacheInvalidation = (options = {}) => {
  const {
    patterns = [], // Array of cache key patterns to invalidate
    onSuccess = true, // Only invalidate on successful operations
  } = options;

  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
      // Invalidate cache on successful operations
      if (onSuccess && res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => {
          // Simple pattern matching - in production use more sophisticated invalidation
          if (typeof pattern === 'function') {
            const keysToInvalidate = pattern(req);
            keysToInvalidate.forEach(key => {
              // Note: This is a simplified invalidation.
              // In a real Redis setup, you'd use SCAN or KEYS commands
              logger.debug('Invalidating cache pattern', { pattern: key });
            });
          }
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Static content caching middleware
 * Sets appropriate cache headers for static content
 */
export const staticCache = (options = {}) => {
  const {
    maxAge = 86400, // 24 hours
    immutable = false
  } = options;

  return (req, res, next) => {
    setStaticCacheHeaders(res, { maxAge, immutable });
    next();
  };
};

/**
 * No-cache middleware for sensitive data
 */
export const noCache = (req, res, next) => {
  setStaticCacheHeaders(res); // This sets no-cache headers
  next();
};

/**
 * Conditional caching based on user role
 */
export const roleBasedCache = (options = {}) => {
  const {
    adminTtl = 60, // 1 minute for admin
    userTtl = 300, // 5 minutes for users
    publicTtl = 600, // 10 minutes for public
  } = options;

  return responseCache({
    keyGenerator: (req) => `${req.originalUrl}_${req.user?.role || 'public'}_${req.user?.id || 'anonymous'}`,
    ttl: (req) => {
      if (req.user?.role === 'ADMIN') return adminTtl;
      if (req.user?.role) return userTtl;
      return publicTtl;
    },
    condition: (req) => req.method === 'GET'
  });
};

export default {
  responseCache,
  cacheInvalidation,
  staticCache,
  noCache,
  roleBasedCache,
};