import express from 'express';
import {
  getBooklist,
  getAllBooklistEntries,
  createBooklistEntry,
  updateBooklistEntry,
  deleteBooklistEntry,
} from '../controllers/booklistController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadBooklistFile } from '../middleware/upload.js';
import { responseCache } from '../middleware/cacheMiddleware.js';
import { booklistCacheKey } from '../services/cacheService.js';

const router = express.Router();

// Public route with caching - this is what booklist.html reads on every visit.
// Cache is invalidated by the controller on every mutation, so an admin change
// shows up immediately rather than after the TTL.
router.get('/', responseCache({
  ttl: 3600, // 1 hour
  keyGenerator: (req) => booklistCacheKey(req.query.year?.trim()),
}), getBooklist);

// Protected routes
router.use(authenticate);

router.get('/all', authorize('ADMIN', 'STAFF'), getAllBooklistEntries);
router.post('/', authorize('ADMIN', 'STAFF'), uploadBooklistFile.single('file'), createBooklistEntry);
router.put('/:id', authorize('ADMIN', 'STAFF'), updateBooklistEntry);
router.delete('/:id', authorize('ADMIN', 'STAFF'), deleteBooklistEntry);

export default router;
