import express from 'express';
import {
  getApplications,
  getApplication,
  createApplication,
  updateApplicationStatus,
  deleteApplication,
} from '../controllers/applicationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { applicationValidation, handleValidationErrors, sanitizeBody } from '../utils/validation.js';
import { publicRequestLimiter, adminLimiter, generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Get all applications (admin/staff only)
router.get('/', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), getApplications);

// Get single application
router.get('/:id', generalLimiter, authenticate, getApplication);

// Create application (public, but can be authenticated) - strict rate limiting
router.post('/', publicRequestLimiter, sanitizeBody, applicationValidation, handleValidationErrors, createApplication);

// Update application status (admin/staff only)
router.put('/:id/status', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), updateApplicationStatus);

// Delete application (admin only)
router.delete('/:id', adminLimiter, authenticate, authorize('ADMIN'), deleteApplication);

export default router;

