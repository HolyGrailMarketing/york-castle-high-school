/**
 * Data Subject Rights Routes
 *
 * Routes for handling data subject rights under Jamaican Data Protection Act
 */

import express from 'express';
import {
  createDataSubjectRequest,
  getUserDataSubjectRequests,
  getAllDataSubjectRequests,
  getDataSubjectRequest,
  processDataSubjectRequest,
  getPersonalData,
  exportPersonalData,
  requestDataCorrection,
  requestDataDeletion,
  verifyRequestIdentity,
  validateDataSubjectRequest
} from '../controllers/dataSubjectController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public route for submitting data subject requests (no authentication required)
router.post('/request',
  generalLimiter,
  validateDataSubjectRequest,
  createDataSubjectRequest
);

// All other routes require authentication
router.use(authenticate);

// Get user's own data subject requests
router.get('/requests',
  generalLimiter,
  getUserDataSubjectRequests
);

// Get specific data subject request
router.get('/request/:id',
  generalLimiter,
  getDataSubjectRequest
);

// Request data correction (authenticated users)
router.post('/correction',
  generalLimiter,
  requestDataCorrection
);

// Request data deletion (authenticated users)
router.post('/deletion',
  generalLimiter,
  requestDataDeletion
);

// Get personal data for access request (after verification)
router.get('/data/:requestId',
  generalLimiter,
  getPersonalData
);

// Export personal data as file
router.get('/export/:requestId',
  generalLimiter,
  exportPersonalData
);

// Admin-only routes
router.use(authorize('ADMIN'));

// Get all data subject requests (admin)
router.get('/admin/requests',
  generalLimiter,
  getAllDataSubjectRequests
);

// Process a data subject request (admin)
router.put('/admin/request/:id/process',
  generalLimiter,
  processDataSubjectRequest
);

// Verify identity for request processing (admin)
router.post('/admin/request/:id/verify',
  generalLimiter,
  verifyRequestIdentity
);

export default router;