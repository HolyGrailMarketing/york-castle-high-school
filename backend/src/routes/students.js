import express from 'express';
import {
  getClasses,
  getMyProfile,
  updateMyProfile,
  listStudents,
  getStudent,
  updateStudent,
  verifyStudent,
  deskRegisterStudent,
} from '../controllers/studentProfileController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { responseCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

router.use(authenticate);

const OFFICE = authorize('ADMIN', 'STAFF');

// The year groups and form classes. Changes about once a decade, so it is
// cached for a day; sign-up.html also carries a hardcoded fallback list.
router.get('/classes', responseCache({ ttl: 86400 }), getClasses);

// A student's own record. Resolved from req.user.id - no :id, no IDOR surface.
// Declared before /:id so "my" cannot be read as an id.
router.get('/my', getMyProfile);
router.put('/my', updateMyProfile);

// Creating a student at the counter writes a User as a side effect, so it gets
// the stricter limiter.
router.post('/desk-register', OFFICE, adminLimiter, deskRegisterStudent);

router.get('/', OFFICE, listStudents);
router.get('/:id', OFFICE, getStudent);
router.put('/:id', OFFICE, updateStudent);
router.post('/:id/verify', OFFICE, verifyStudent);

export default router;
