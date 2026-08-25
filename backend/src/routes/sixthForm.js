import express from 'express';
import {
  getSixthFormApplications,
  checkSixthFormEmail,
  getSixthFormApplication,
  getMyApplication,
  updateMyApplication,
  createSixthFormApplication,
  updateSixthFormStatus,
  deleteSixthFormApplication,
  sendSixthFormNotifications,
} from '../controllers/sixthFormController.js';
import { getInterview, saveInterview } from '../controllers/interviewController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { publicRequestLimiter, adminLimiter, generalLimiter } from '../middleware/rateLimiter.js';
import { sixthFormValidation, sixthFormUpdateValidation, sixthFormBulkNotifyValidation, sixthFormCheckEmailValidation, handleValidationErrors, sanitizeBody } from '../utils/validation.js';

const router = express.Router();

// Get all sixth form applications (admin/staff only)
router.get('/', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), getSixthFormApplications);

// Get current student's own application
router.get('/my', generalLimiter, authenticate, getMyApplication);

// Update current student's own application (resolved by user id, no IDOR surface)
router.put('/my', generalLimiter, authenticate, sanitizeBody, sixthFormUpdateValidation, handleValidationErrors, updateMyApplication);

// Has this address already applied? Called by the application form as the
// applicant leaves the Personal screen, so a repeat applicant is told early
// instead of after filling in all ten screens. Public, so it returns only a
// boolean. Declared before '/:id' so 'check-email' isn't captured as an id.
//
// Deliberately NOT publicRequestLimiter: that instance allows three requests
// per IP per hour and is shared with POST '/' below, so a few checks would
// lock the applicant out of actually submitting — and a whole school shares
// one address. generalLimiter is a separate budget sized for lookups.
router.get('/check-email', generalLimiter, sixthFormCheckEmailValidation, handleValidationErrors, checkSixthFormEmail);

// Get single application
router.get('/:id', generalLimiter, authenticate, getSixthFormApplication);

// Create sixth form application - strict rate limiting
router.post('/', publicRequestLimiter, sanitizeBody, sixthFormValidation, handleValidationErrors, createSixthFormApplication);

// Update application status (admin/staff only)
router.put('/:id/status', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), updateSixthFormStatus);

// Bulk-send a notification/announcement (interview invitation, CXC results released,
// or a custom one-off message) to selected applicants (admin/staff only).
// Deliberately skips `sanitizeBody`: its blanket HTML-entity escaping would
// corrupt the plain-text email body and double-escape the HTML body, since
// `customAnnouncement` (emailTemplates.js) already escapes `subject`/`message`
// itself at the one place that needs it. `applicationIds` and `type` are
// validated against a UUID/enum shape below regardless.
router.post('/notifications', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), sixthFormBulkNotifyValidation, handleValidationErrors, sendSixthFormNotifications);

// Delete application (admin only)
router.delete('/:id', adminLimiter, authenticate, authorize('ADMIN'), deleteSixthFormApplication);

// Interview routes (admin/staff only)
router.get('/:id/interview', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), getInterview);
router.post('/:id/interview', adminLimiter, authenticate, authorize('ADMIN', 'STAFF', 'TEACHER'), saveInterview);

export default router;

