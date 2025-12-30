import express from 'express';
import {
  getSixthFormApplications,
  getSixthFormApplication,
  createSixthFormApplication,
  updateSixthFormStatus,
  deleteSixthFormApplication,
} from '../controllers/sixthFormController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { publicRequestLimiter, adminLimiter, generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Get all sixth form applications (admin/staff only)
router.get('/', adminLimiter, authenticate, authorize('ADMIN', 'STAFF'), getSixthFormApplications);

// Get single application
router.get('/:id', generalLimiter, authenticate, getSixthFormApplication);

// Create sixth form application - strict rate limiting
router.post('/', publicRequestLimiter, createSixthFormApplication);

// Update application status (admin/staff only)
router.put('/:id/status', adminLimiter, authenticate, authorize('ADMIN', 'STAFF'), updateSixthFormStatus);

// Delete application (admin only)
router.delete('/:id', adminLimiter, authenticate, authorize('ADMIN'), deleteSixthFormApplication);

export default router;

