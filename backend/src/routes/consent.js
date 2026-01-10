/**
 * Consent Management Routes
 *
 * Routes for managing user consent under Jamaican Data Protection Act
 */

import express from 'express';
import {
  recordConsent,
  withdrawConsent,
  getUserConsentHistory,
  getUserConsents,
  withdrawAllConsents,
  getConsentByEmail,
  getAllConsents,
  checkConsentStatus,
  bulkConsentOperation
} from '../controllers/consentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public route for recording consent (cookie banner, forms)
router.post('/record',
  generalLimiter,
  recordConsent
);

// All other routes require authentication
router.use(authenticate);

// Withdraw specific consent
router.delete('/:id',
  generalLimiter,
  withdrawConsent
);

// Get user's own consent history
router.get('/history',
  generalLimiter,
  getUserConsentHistory
);

// Check consent status for specific type
router.get('/status/:consentType',
  generalLimiter,
  checkConsentStatus
);

// Get current user's consents (for privacy policy consent management)
router.get('/user',
  generalLimiter,
  getUserConsents
);

// Withdraw all consents for current user
router.post('/withdraw-all',
  generalLimiter,
  withdrawAllConsents
);

// Admin-only routes
router.use(authorize('ADMIN'));

// Get consent records by email (for cookie tracking)
router.get('/email/:email',
  generalLimiter,
  getConsentByEmail
);

// Get all consent records (admin)
router.get('/admin/all',
  generalLimiter,
  getAllConsents
);

// Bulk consent operations (admin)
router.post('/admin/bulk',
  generalLimiter,
  bulkConsentOperation
);

export default router;