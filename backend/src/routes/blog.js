import express from 'express';
import {
  getBlogPosts,
  getBlogPost,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  publishBlogPost,
} from '../controllers/blogController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { responseCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Signed-in staff see unpublished drafts and expect their own edits back
// immediately, so their responses are never cached.
const isAnonymous = (req) => !req.user;

// Public routes with caching
router.get('/', optionalAuth, responseCache({
  ttl: 300, // 5 minutes - also the browser max-age, so new posts appear promptly
  condition: isAnonymous,
  keyGenerator: (req) =>
    `blog_posts_${req.query.published || ''}_${req.query.search || ''}_${req.query.page || 1}_${req.query.limit || 20}`
}), getBlogPosts);

router.get('/:id', optionalAuth, responseCache({
  ttl: 300, // 5 minutes for individual blog posts
  condition: isAnonymous,
  keyGenerator: (req) => `blog_post_${req.params.id}`
}), getBlogPost);

// Protected routes
router.use(authenticate);

router.post('/', authorize('ADMIN', 'STAFF', 'TEACHER'), createBlogPost);
router.put('/:id', authorize('ADMIN', 'STAFF', 'TEACHER'), updateBlogPost);
router.delete('/:id', authorize('ADMIN', 'STAFF', 'TEACHER'), deleteBlogPost);
router.put('/:id/publish', authorize('ADMIN', 'STAFF', 'TEACHER'), publishBlogPost);

export default router;





