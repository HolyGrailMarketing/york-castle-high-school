import express from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateUserRole,
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { adminLimiter, generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all users (admin only)
router.get('/', adminLimiter, authorize('ADMIN', 'STAFF'), getUsers);

// Create user (admin only)
router.post('/', adminLimiter, authorize('ADMIN'), createUser);

// Get single user
router.get('/:id', generalLimiter, getUser);

// Update user
router.put('/:id', generalLimiter, updateUser);

// Delete user (admin only)
router.delete('/:id', adminLimiter, authorize('ADMIN'), deleteUser);

// Update user role (admin only)
router.put('/:id/role', adminLimiter, authorize('ADMIN'), updateUserRole);

export default router;

