/**
 * Cache Service for York Castle High School Application
 *
 * Provides multi-layer caching strategy:
 * 1. In-memory cache (NodeCache) for frequently accessed data
 * 2. Response cache headers for HTTP caching
 * 3. Foundation for Redis/Upstash integration
 */

import logger from '../utils/logger.js';

// In-memory cache configuration - fallback if node-cache not available
let memoryCache = null;

try {
  const NodeCache = (await import('node-cache')).default;
  memoryCache = new NodeCache({
    stdTTL: 300, // 5 minutes default TTL
    checkperiod: 60, // Check for expired keys every 60 seconds
    useClones: false, // Don't clone objects for better performance
  });
  logger.info('NodeCache initialized successfully');
} catch (error) {
  logger.warn('NodeCache not available, falling back to simple in-memory cache', { error: error.message });
  // Simple fallback cache
  const cache = new Map();
  memoryCache = {
    set: (key, value, ttl) => {
      cache.set(key, { value, expires: ttl ? Date.now() + (ttl * 1000) : null });
      return true;
    },
    get: (key) => {
      const item = cache.get(key);
      if (item && (!item.expires || item.expires > Date.now())) {
        return item.value;
      }
      if (item) cache.delete(key); // Remove expired item
      return undefined;
    },
    del: (key) => {
      return cache.delete(key) ? 1 : 0;
    },
    flushAll: () => {
      cache.clear();
      return true;
    },
    getStats: () => ({
      keys: cache.size,
      hits: 0,
      misses: 0,
      ksize: 0,
      vsize: 0
    })
  };
}

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
  // Static content (long-lived)
  COURSES: 3600, // 1 hour
  BLOG_POSTS: 1800, // 30 minutes
  EVENTS: 1800, // 30 minutes
  DOCUMENTS: 3600, // 1 hour

  // User-specific data (shorter)
  USER_PROFILE: 600, // 10 minutes
  APPLICATIONS_LIST: 300, // 5 minutes

  // Analytics (short-lived)
  ANALYTICS_DASHBOARD: 60, // 1 minute
};

// Cache keys
const CACHE_KEYS = {
  courses: (pool) => `courses:${pool || 'all'}`,
  blogPosts: (published = true) => `blog_posts:${published}`,
  events: (publicOnly = true) => `events:${publicOnly}`,
  documents: (category) => `documents:${category || 'all'}`,
  booklist: (schoolYear) => `booklist:${schoolYear || 'current'}`,
  timetable: (scope, schoolYear) => `timetable:${scope || 'public'}:${schoolYear || 'current'}`,
  userProfile: (userId) => `user_profile:${userId}`,
  applicationsList: (filters) => `applications:${JSON.stringify(filters)}`,
  analytics: (type) => `analytics:${type}`,
};

/**
 * Get data from cache
 */
export const getCache = (key) => {
  try {
    const data = memoryCache.get(key);
    if (data) {
      logger.debug('Cache hit', { key });
      return data;
    }
    logger.debug('Cache miss', { key });
    return null;
  } catch (error) {
    logger.error('Cache get error', { error: error.message, key });
    return null;
  }
};

/**
 * Set data in cache
 */
export const setCache = (key, data, ttl = CACHE_TTL.DEFAULT) => {
  try {
    const success = memoryCache.set(key, data, ttl);
    if (success) {
      logger.debug('Cache set', { key, ttl });
    } else {
      logger.warn('Cache set failed', { key });
    }
    return success;
  } catch (error) {
    logger.error('Cache set error', { error: error.message, key });
    return false;
  }
};

/**
 * Delete cache entry
 */
export const deleteCache = (key) => {
  try {
    const deleted = memoryCache.del(key);
    logger.debug('Cache deleted', { key, deleted });
    return deleted;
  } catch (error) {
    logger.error('Cache delete error', { error: error.message, key });
    return false;
  }
};

/**
 * Clear all cache
 */
export const clearCache = () => {
  try {
    memoryCache.flushAll();
    logger.info('Cache cleared');
    return true;
  } catch (error) {
    logger.error('Cache clear error', { error: error.message });
    return false;
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  try {
    return memoryCache.getStats();
  } catch (error) {
    logger.error('Cache stats error', { error: error.message });
    return null;
  }
};

// Specific cache operations for common data

/**
 * Cache courses data
 */
export const getCoursesCache = (pool) => {
  return getCache(CACHE_KEYS.courses(pool));
};

export const setCoursesCache = (courses, pool) => {
  return setCache(CACHE_KEYS.courses(pool), courses, CACHE_TTL.COURSES);
};

export const invalidateCoursesCache = (pool) => {
  const keys = pool ? [CACHE_KEYS.courses(pool)] : [CACHE_KEYS.courses(), CACHE_KEYS.courses(null)];
  return keys.map(key => deleteCache(key)).every(Boolean);
};

/**
 * Cache booklist data
 */
export const booklistCacheKey = (schoolYear) => CACHE_KEYS.booklist(schoolYear);

// Drop the cached "current" view plus the specific year that changed, so an
// admin edit shows up on booklist.html immediately instead of after the TTL.
export const invalidateBooklistCache = (schoolYear) => {
  const keys = [CACHE_KEYS.booklist()];
  if (schoolYear) keys.push(CACHE_KEYS.booklist(schoolYear));
  return keys.map((key) => deleteCache(key)).every(Boolean);
};

/**
 * Cache timetable data
 */
// Scoped by school year as well as by view: /api/timetable takes a `year`
// query, so keying on the scope alone served whichever year was asked for
// first to everyone else for the whole TTL.
export const timetableCacheKey = (scope, schoolYear) => CACHE_KEYS.timetable(scope, schoolYear);

// Drop both the public and staff views, because a single placement move changes
// them together - an admin edit should show on the next request, not after the
// TTL. The unqualified "current" keys go too, since a request without a year
// resolves to whichever version is published.
export const invalidateTimetableCache = (schoolYear) => {
  const keys = ['public', 'staff'].flatMap((scope) => [
    CACHE_KEYS.timetable(scope),
    ...(schoolYear ? [CACHE_KEYS.timetable(scope, schoolYear)] : []),
  ]);
  return keys.map((key) => deleteCache(key)).every(Boolean);
};

export const getBlogPostsCache = (published = true) => {
  return getCache(CACHE_KEYS.blogPosts(published));
};

export const setBlogPostsCache = (posts, published = true) => {
  return setCache(CACHE_KEYS.blogPosts(published), posts, CACHE_TTL.BLOG_POSTS);
};

export const invalidateBlogPostsCache = () => {
  return deleteCache(CACHE_KEYS.blogPosts(true)) && deleteCache(CACHE_KEYS.blogPosts(false));
};

/**
 * Cache events data
 */
export const getEventsCache = (publicOnly = true) => {
  return getCache(CACHE_KEYS.events(publicOnly));
};

export const setEventsCache = (events, publicOnly = true) => {
  return setCache(CACHE_KEYS.events(publicOnly), events, CACHE_TTL.EVENTS);
};

export const invalidateEventsCache = () => {
  return deleteCache(CACHE_KEYS.events(true)) && deleteCache(CACHE_KEYS.events(false));
};

/**
 * Cache user profile data
 */
export const getUserProfileCache = (userId) => {
  return getCache(CACHE_KEYS.userProfile(userId));
};

export const setUserProfileCache = (profile, userId) => {
  return setCache(CACHE_KEYS.userProfile(userId), profile, CACHE_TTL.USER_PROFILE);
};

export const invalidateUserProfileCache = (userId) => {
  return deleteCache(CACHE_KEYS.userProfile(userId));
};

/**
 * HTTP Response Cache Headers
 */
export const setCacheHeaders = (res, options = {}) => {
  const {
    maxAge = 300, // 5 minutes default
    staleWhileRevalidate = 60, // 1 minute
    isPublic = true
  } = options;

  const cacheControl = [
    isPublic ? 'public' : 'private',
    `max-age=${maxAge}`,
    `stale-while-revalidate=${staleWhileRevalidate}`
  ].join(', ');

  res.set('Cache-Control', cacheControl);
  res.set('X-Cache-Status', 'dynamic');
};

/**
 * Static content cache headers (long-lived)
 */
export const setStaticCacheHeaders = (res, options = {}) => {
  const {
    maxAge = 86400, // 24 hours default
    immutable = false
  } = options;

  let cacheControl = `public, max-age=${maxAge}`;

  if (immutable) {
    cacheControl += ', immutable';
  }

  res.set('Cache-Control', cacheControl);
  res.set('X-Cache-Status', 'static');
};

/**
 * No-cache headers for sensitive data
 */
export const setNoCacheHeaders = (res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('X-Cache-Status', 'no-cache');
};

/**
 * Redis/Upstash integration placeholder
 * In production, replace memory cache with Redis for distributed caching
 */
export const initRedisCache = async () => {
  // Placeholder for Redis/Upstash integration
  // When implementing Redis:
  // 1. Install @upstash/redis
  // 2. Configure with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
  // 3. Replace memoryCache operations with Redis operations
  // 4. Add Redis-specific TTL handling

  logger.info('Redis cache initialization placeholder - using memory cache');
  return false;
};

// Initialize cache on module load
initRedisCache().catch(error => {
  logger.error('Failed to initialize Redis cache', { error: error.message });
});

export default {
  get: getCache,
  set: setCache,
  delete: deleteCache,
  clear: clearCache,
  stats: getCacheStats,
  setCacheHeaders,
  setStaticCacheHeaders,
  setNoCacheHeaders,
  // Specific operations
  getCoursesCache,
  setCoursesCache,
  invalidateCoursesCache,
  getBlogPostsCache,
  setBlogPostsCache,
  invalidateBlogPostsCache,
  getEventsCache,
  setEventsCache,
  invalidateEventsCache,
  getUserProfileCache,
  setUserProfileCache,
  invalidateUserProfileCache,
};