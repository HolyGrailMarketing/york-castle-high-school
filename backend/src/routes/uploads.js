import express from 'express';
import multer from 'multer';
import { getUploadConfig, uploadImageHandler } from '../controllers/uploadController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { imageUpload, MAX_IMAGE_BYTES } from '../middleware/upload.js';
import { adminLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(authenticate);

router.get('/config', getUploadConfig);

// Same roles that may author blog posts (see routes/blog.js).
router.post(
  '/image',
  adminLimiter,
  authorize('ADMIN', 'STAFF', 'TEACHER'),
  imageUpload.single('file'),
  uploadImageHandler
);

// A rejected file is the caller's mistake, not a server fault - without this
// multer's errors reach the global handler and surface as a 500.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `Image is too large. Maximum size is ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB.`,
      });
    }
    return res.status(400).json({ error: err.message });
  }
  // fileFilter rejections arrive as plain Errors from multer.
  if (err && /Invalid image type|Invalid filename|File extension/.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

export default router;
