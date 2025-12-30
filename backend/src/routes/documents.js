import express from 'express';
import {
  getDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
} from '../controllers/documentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public routes
router.get('/', getDocuments);
router.get('/:id', getDocument);
router.get('/:id/download', downloadDocument);

// Protected routes
router.use(authenticate);

router.post('/', authorize('ADMIN', 'STAFF'), upload.single('file'), uploadDocument);
router.put('/:id', authorize('ADMIN', 'STAFF'), updateDocument);
router.delete('/:id', authorize('ADMIN', 'STAFF'), deleteDocument);

export default router;





