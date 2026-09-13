import express from 'express';
import {
  getNetwork,
  updatePort,
  resetPort,
  exportNetworkCsv,
} from '../controllers/networkController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// No public route on this one, unlike booklist. The map names every switch, its
// uplinks and which ports are free, so it stays behind a login and the ADMIN
// role - the same bar as the audit log.
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', getNetwork);
router.get('/export.csv', exportNetworkCsv);
router.put('/ports/:id', updatePort);
router.post('/ports/:id/reset', resetPort);

export default router;
