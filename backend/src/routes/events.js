import express from 'express';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/eventController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { responseCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public routes with caching
router.get('/', responseCache({
  ttl: 1800, // 30 minutes for events list
  keyGenerator: (req) => `events_list_${req.query.search || ''}_${req.query.page || 1}`
}), getEvents);

router.get('/:id', responseCache({
  ttl: 3600, // 1 hour for individual events
  keyGenerator: (req) => `event_${req.params.id}`
}), getEvent);

// Protected routes
router.use(authenticate);

router.post('/', authorize('ADMIN', 'STAFF'), createEvent);
router.put('/:id', authorize('ADMIN', 'STAFF'), updateEvent);
router.delete('/:id', authorize('ADMIN', 'STAFF'), deleteEvent);

export default router;





