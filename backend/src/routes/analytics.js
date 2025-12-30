import express from 'express';
import {
  getDashboardStats,
  getApplicationAnalytics,
  getUserAnalytics,
  trackEvent,
} from '../controllers/analyticsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Track events (public, but can be authenticated)
router.post('/track', trackEvent);

// All other routes require authentication
router.use(authenticate);

// Dashboard stats (admin/staff only)
router.get('/dashboard', authorize('ADMIN', 'STAFF'), getDashboardStats);

// Application analytics (admin/staff only)
router.get('/applications', authorize('ADMIN', 'STAFF'), getApplicationAnalytics);

// User analytics (admin/staff only)
router.get('/users', authorize('ADMIN', 'STAFF'), getUserAnalytics);

export default router;





