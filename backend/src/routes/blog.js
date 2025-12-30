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

const router = express.Router();

// Public routes
router.get('/', getBlogPosts);
router.get('/:id', getBlogPost);

// Protected routes
router.use(authenticate);

router.post('/', authorize('ADMIN', 'STAFF'), createBlogPost);
router.put('/:id', authorize('ADMIN', 'STAFF'), updateBlogPost);
router.delete('/:id', authorize('ADMIN', 'STAFF'), deleteBlogPost);
router.put('/:id/publish', authorize('ADMIN', 'STAFF'), publishBlogPost);

export default router;





