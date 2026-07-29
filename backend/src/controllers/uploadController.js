import {
  isStorageConfigured,
  uploadImage,
  sniffImageType,
} from '../services/storageService.js';
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '../middleware/upload.js';
import logger from '../utils/logger.js';

/**
 * Tells the admin UI whether the Upload button should be offered at all.
 */
export const getUploadConfig = (req, res) => {
  res.json({
    enabled: isStorageConfigured(),
    maxSizeBytes: MAX_IMAGE_BYTES,
    acceptedTypes: IMAGE_MIME_TYPES,
  });
};

export const uploadImageHandler = async (req, res, next) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({
        error:
          'Image storage is not configured. Set SUPABASE_URL and ' +
          'SUPABASE_SERVICE_ROLE_KEY, or paste an image path or URL instead.',
        enabled: false,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // multer trusts the client-declared Content-Type; these files are served
    // back to browsers, so confirm the bytes really are an image.
    const sniffed = sniffImageType(req.file.buffer);
    if (!sniffed || !IMAGE_MIME_TYPES.includes(sniffed)) {
      logger.warn('Rejected image upload - content does not match an image format', {
        filename: req.file.originalname,
        declared: req.file.mimetype,
        userId: req.user?.id,
      });
      return res.status(400).json({ error: 'File content is not a valid image' });
    }

    const { url, path } = await uploadImage({
      buffer: req.file.buffer,
      mimetype: sniffed,
      originalname: req.file.originalname,
    });

    res.status(201).json({
      url,
      path,
      provider: 'supabase',
      size: req.file.size,
      mimeType: sniffed,
    });
  } catch (error) {
    next(error);
  }
};
