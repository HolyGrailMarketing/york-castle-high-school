import express from 'express';
import {
  getBlogPosts,
  getBlogPost,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  publishBlogPost,
} from '../controllers/blogController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { responseCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public routes with caching
router.get('/', responseCache({
  ttl: 1800, // 30 minutes for blog posts list
  keyGenerator: (req) => `blog_posts_${req.query.published !== 'false'}_${req.query.search || ''}_${req.query.page || 1}`
}), getBlogPosts);

router.get('/:id', responseCache({
  ttl: 3600, // 1 hour for individual blog posts
  keyGenerator: (req) => `blog_post_${req.params.id}`
}), getBlogPost);

// Protected routes
router.use(authenticate);

router.post('/', authorize('ADMIN', 'STAFF'), createBlogPost);
router.put('/:id', authorize('ADMIN', 'STAFF'), updateBlogPost);
router.delete('/:id', authorize('ADMIN', 'STAFF'), deleteBlogPost);
router.put('/:id/publish', authorize('ADMIN', 'STAFF'), publishBlogPost);

export default router;





