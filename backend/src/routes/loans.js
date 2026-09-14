import express from 'express';
import {
  issueLoan,
  returnLoan,
  lookupBarcode,
  lookupStudent,
  getLoans,
  getMyLoans,
  markLoanLost,
  bulkReturn,
} from '../controllers/loanController.js';
import { syncOperations, resolveConflict } from '../controllers/loanSyncController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { syncLimiter, adminLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(authenticate);

const READ = authorize('ADMIN', 'STAFF', 'TEACHER');
const DESK = authorize('ADMIN', 'STAFF');

// A student's own books. Declared first so "my" is not read as an id, and
// resolved from req.user.id so there is nothing to tamper with.
router.get('/my', getMyLoans);

// Desk lookups
router.get('/lookup', DESK, lookupBarcode);
router.get('/student-lookup', DESK, lookupStudent);

// Single operations. These run the same engine as /sync, so the online path
// and the offline path cannot drift apart.
router.post('/issue', DESK, issueLoan);
router.post('/return', DESK, returnLoan);

// Draining a station's offline queue. The limit is generous because a station
// coming back from a long outage legitimately sends several chunks in a row.
router.post('/sync', DESK, syncLimiter, syncOperations);
router.post('/sync/resolve', DESK, resolveConflict);

router.post('/bulk-return', DESK, adminLimiter, bulkReturn);
router.post('/:id/mark-lost', DESK, markLoanLost);

router.get('/', READ, getLoans);

export default router;
