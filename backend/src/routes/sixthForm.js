import express from 'express';
import {
  getSixthFormApplications,
  getSixthFormApplication,
  getMyApplication,
  updateMyApplication,
  createSixthFormApplication,
  updateSixthFormStatus,
  deleteSixthFormApplication,
  sendInterviewInvitations,
} from '../controllers/sixthFormController.js';
import { getInterview, saveInterview } from '../controllers/interviewController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { publicRequestLimiter, adminLimiter, generalLimiter } from '../middleware/rateLimiter.js';
import { sixthFormValidation, sixthFormUpdateValidation, sixthFormBulkInviteValidation, handleValidationErrors, sanitizeBody } from '../utils/validation.js';

const router = express.Router();

// Get all sixth form applications (admin/staff only)
router.get('/', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), getSixthFormApplications);

// Get current student's own application
router.get('/my', generalLimiter, authenticate, getMyApplication);

// Update current student's own application (resolved by user id, no IDOR surface)
router.put('/my', generalLimiter, authenticate, sanitizeBody, sixthFormUpdateValidation, handleValidationErrors, updateMyApplication);

// Get single application
router.get('/:id', generalLimiter, authenticate, getSixthFormApplication);

// Create sixth form application - strict rate limiting
router.post('/', publicRequestLimiter, sanitizeBody, sixthFormValidation, handleValidationErrors, createSixthFormApplication);

// Update application status (admin/staff only)
router.put('/:id/status', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), updateSixthFormStatus);

// Bulk-send the fixed interview-session invitation email to selected applicants (admin/staff only)
router.post('/interview-invitations', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), sanitizeBody, sixthFormBulkInviteValidation, handleValidationErrors, sendInterviewInvitations);

// Delete application (admin only)
router.delete('/:id', adminLimiter, authenticate, authorize('ADMIN'), deleteSixthFormApplication);

// Interview routes (admin/staff only)
router.get('/:id/interview', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), getInterview);
router.post('/:id/interview', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), saveInterview);

export default router;

