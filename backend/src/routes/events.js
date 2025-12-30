import express from 'express';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/eventController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getEvents);
router.get('/:id', getEvent);

// Protected routes
router.use(authenticate);

router.post('/', authorize('ADMIN', 'STAFF'), createEvent);
router.put('/:id', authorize('ADMIN', 'STAFF'), updateEvent);
router.delete('/:id', authorize('ADMIN', 'STAFF'), deleteEvent);

export default router;





