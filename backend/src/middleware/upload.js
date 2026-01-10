import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we're in a serverless environment (Vercel)
const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Use /tmp for uploads in serverless environments (Vercel allows writes to /tmp)
// Determine upload directory based on environment
let uploadsDir;
if (isServerless) {
  // In serverless environments, use /tmp for writable storage
  uploadsDir = path.join(os.tmpdir(), 'york-castle-uploads');
  // Ensure tmp directory exists
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (error) {
    logger.error('Failed to create serverless upload directory:', { error: error.message });
    // Fallback to default tmp
    uploadsDir = os.tmpdir();
  }
} else {
  // In traditional server environments, use backend/uploads
  uploadsDir = path.join(__dirname, '../../uploads');
}

// Ensure uploads directory exists (only if not serverless or if using /tmp)
if (!isServerless || uploadsDir.startsWith(os.tmpdir())) {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    // If we can't create the directory, log warning but continue
    // In serverless, /tmp should always be writable
    logger.warn('Could not create uploads directory:', { error: err.message });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  // Comprehensive file type validation
  const allowedMimes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    // Images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  // Check MIME type
  if (!allowedMimes.includes(file.mimetype)) {
    logger.warn('Rejected file upload - invalid MIME type', {
      filename: file.originalname,
      mimetype: file.mimetype,
      ip: req.ip
    });
    return cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, DOC, DOCX, TXT, JPEG, PNG, WEBP, GIF, XLS, XLSX`), false);
  }

  // Validate file name (prevent path traversal and malicious names)
  const filename = file.originalname;
  if (!filename || filename.length > 255) {
    return cb(new Error('Invalid filename: too long or empty'), false);
  }

  // Check for dangerous characters in filename
  const dangerousChars = /[<>:"\/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(filename)) {
    logger.warn('Rejected file upload - dangerous filename', {
      filename: file.originalname,
      ip: req.ip
    });
    return cb(new Error('Invalid filename: contains dangerous characters'), false);
  }

  // Check file extension matches MIME type for additional security
  const ext = path.extname(filename).toLowerCase();
  const mimeToExt = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  };

  const expectedExts = mimeToExt[file.mimetype] || [];
  if (!expectedExts.includes(ext)) {
    logger.warn('Rejected file upload - extension/mime mismatch', {
      filename: file.originalname,
      mimetype: file.mimetype,
      extension: ext,
      ip: req.ip
    });
    return cb(new Error('File extension does not match file type'), false);
  }

  logger.info('File upload validated', {
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    ip: req.ip
  });

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
});





