import express from 'express';
import {
  getPublicTimetable,
  getStaffTimetable,
  listVersions,
  createVersion,
  movePlacement,
  validateVersion,
  publishVersion,
} from '../controllers/timetableController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { responseCache } from '../middleware/cacheMiddleware.js';
import { timetableCacheKey } from '../services/cacheService.js';

const router = express.Router();

// Public: the published class timetable, including the teachers taking each
// lesson. Cached like the booklist, and invalidated by the controller on every
// mutation so an admin change shows immediately rather than after the TTL.
router.get('/', responseCache({
  ttl: 3600,
  keyGenerator: () => timetableCacheKey('public'),
}), getPublicTimetable);

// Everything below needs a login.
router.use(authenticate);

// Teacher and room views, plus the lunch-duty roster. Teachers can read these -
// looking up your own week and your duty is the main reason to open the page -
// but only ADMIN and STAFF can change anything.
router.get('/staff', authorize('ADMIN', 'STAFF', 'TEACHER'), getStaffTimetable);

router.get('/versions', authorize('ADMIN', 'STAFF'), listVersions);
router.post('/versions', authorize('ADMIN', 'STAFF'), createVersion);
router.put('/placements/:id', authorize('ADMIN', 'STAFF'), movePlacement);
router.post('/validate/:id', authorize('ADMIN', 'STAFF'), validateVersion);
router.post('/publish/:id', authorize('ADMIN'), publishVersion);

export default router;
