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

const router = express.Router();

// Public routes
router.get('/', getCourses);
router.get('/:id', getCourse);

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





