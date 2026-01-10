import express from 'express';
import {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getEnrollments,
  enrollStudent,
  unenrollStudent,
} from '../controllers/courseController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { responseCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Public routes with caching
router.get('/', responseCache({
  ttl: 3600, // 1 hour for courses list
  keyGenerator: (req) => `courses_list_${req.query.pool || 'all'}`
}), getCourses);

router.get('/:id', responseCache({
  ttl: 1800, // 30 minutes for individual courses
  keyGenerator: (req) => `course_${req.params.id}`
}), getCourse);

// Protected routes
router.use(authenticate);

router.post('/', authorize('ADMIN', 'STAFF'), createCourse);
router.put('/:id', authorize('ADMIN', 'STAFF'), updateCourse);
router.delete('/:id', authorize('ADMIN', 'STAFF'), deleteCourse);

// Enrollment routes
router.get('/:id/enrollments', authorize('ADMIN', 'STAFF'), getEnrollments);
router.post('/:id/enroll', enrollStudent);
router.delete('/:id/enroll/:userId', authorize('ADMIN', 'STAFF'), unenrollStudent);

export default router;





