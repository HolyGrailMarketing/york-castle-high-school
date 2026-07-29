import express from 'express';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/eventController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { responseCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Signed-in staff see unpublished events and expect their own edits back
// immediately, so their responses are never cached.
const isAnonymous = (req) => !req.user;

// Public routes with caching
router.get('/', optionalAuth, responseCache({
  ttl: 300, // 5 minutes - also the browser max-age, so new events appear promptly
  condition: isAnonymous,
  keyGenerator: (req) =>
    `events_list_${req.query.search || ''}_${req.query.isPublic || ''}_${req.query.startDate || ''}_${req.query.endDate || ''}_${req.query.page || 1}_${req.query.limit || 20}`
}), getEvents);

router.get('/:id', optionalAuth, responseCache({
  ttl: 300, // 5 minutes for individual events
  condition: isAnonymous,
  keyGenerator: (req) => `event_${req.params.id}`
}), getEvent);

// Protected routes
router.use(authenticate);

router.post('/', authorize('ADMIN', 'STAFF', 'TEACHER'), createEvent);
router.put('/:id', authorize('ADMIN', 'STAFF', 'TEACHER'), updateEvent);
router.delete('/:id', authorize('ADMIN', 'STAFF', 'TEACHER'), deleteEvent);

export default router;





