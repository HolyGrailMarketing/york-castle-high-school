import express from 'express';
import {
  getRequests,
  getRequest,
  createRequest,
  updateRequestStatus,
  assignRequest,
  deleteRequest,
  createPublicRequest,
} from '../controllers/requestController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { publicRequestLimiter, adminLimiter, generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public endpoint for document requests (no authentication) - strict rate limiting
router.post('/public', publicRequestLimiter, createPublicRequest);

// All other routes require authentication
router.use(authenticate);

// Get all requests (admin/staff can see all, users see only their own)
router.get('/', adminLimiter, getRequests);

// Get single request
router.get('/:id', generalLimiter, getRequest);

// Create request
router.post('/', generalLimiter, createRequest);

// Update request status (admin/staff only)
router.put('/:id/status', adminLimiter, authorize('ADMIN', 'STAFF'), updateRequestStatus);

// Assign request to a staff member (admin only)
router.put('/:id/assign', adminLimiter, authorize('ADMIN'), assignRequest);

// Delete request
router.delete('/:id', adminLimiter, deleteRequest);

export default router;

