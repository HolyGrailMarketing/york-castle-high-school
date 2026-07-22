import express from 'express';
import { register, login, logout, getMe, updateMe, googleAuth, googleCallback, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { registerValidation, loginValidation, forgotPasswordValidation, resetPasswordValidation, handleValidationErrors, sanitizeBody } from '../utils/validation.js';
import { authLimiter, generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 */
router.post('/register', authLimiter, sanitizeBody, registerValidation, handleValidationErrors, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authLimiter, sanitizeBody, loginValidation, handleValidationErrors, login);

// Password reset
router.post('/forgot-password', authLimiter, sanitizeBody, forgotPasswordValidation, handleValidationErrors, forgotPassword);
router.post('/reset-password', authLimiter, sanitizeBody, resetPasswordValidation, handleValidationErrors, resetPassword);

router.post('/logout', generalLimiter, logout);
router.get('/me', generalLimiter, authenticate, getMe);
router.patch('/me', generalLimiter, authenticate, updateMe);

// Google OAuth routes
router.get('/google', authLimiter, googleAuth);
router.get('/google/callback', authLimiter, googleCallback);

export default router;

