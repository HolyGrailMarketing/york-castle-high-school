import express from 'express';
import {
  getSixthFormApplications,
  getSixthFormApplication,
  createSixthFormApplication,
  updateSixthFormStatus,
  deleteSixthFormApplication,
} from '../controllers/sixthFormController.js';
import { getInterview, saveInterview } from '../controllers/interviewController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { publicRequestLimiter, adminLimiter, generalLimiter } from '../middleware/rateLimiter.js';
import { sixthFormValidation, handleValidationErrors, sanitizeBody } from '../utils/validation.js';

const router = express.Router();

// Get all sixth form applications (admin/staff only)
router.get('/', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), getSixthFormApplications);

// Get single application
router.get('/:id', generalLimiter, authenticate, getSixthFormApplication);

// Create sixth form application - strict rate limiting
router.post('/', publicRequestLimiter, sanitizeBody, sixthFormValidation, handleValidationErrors, createSixthFormApplication);

// Update application status (admin/staff only)
router.put('/:id/status', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), updateSixthFormStatus);

// Delete application (admin only)
router.delete('/:id', adminLimiter, authenticate, authorize('ADMIN'), deleteSixthFormApplication);

// Interview routes (admin/staff only)
router.get('/:id/interview', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), getInterview);
router.post('/:id/interview', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), saveInterview);

export default router;

