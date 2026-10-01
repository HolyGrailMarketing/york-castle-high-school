import express from 'express';
import {
  listSchedules, getSchedule, createSchedule, updateSchedule,
  setSchedulePublished, deleteSchedule, getSerialCounter, updateSerialCounter,
} from '../controllers/feeScheduleController.js';
import {
  createAssessment, runAssessments, listAssessments, getStudentLedger,
  waiveAssessment, cancelAssessment, exportAssessmentsCsv, getMyFees,
} from '../controllers/feeAssessmentController.js';
import {
  issueVoucher, bulkIssueVouchers, getVoucher, markVoucherPrinted,
  voidVoucher, listVouchers,
} from '../controllers/feeVoucherController.js';
import {
  recordPayment, reversePayment, listPayments, exportPaymentsCsv,
} from '../controllers/feePaymentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { adminLimiter, generalLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(authenticate);

// The office does the work; anything that changes what is owed, writes money
// off, or cannot be undone is narrowed to an administrator. Same split as
// routes/library.js.
const OFFICE = authorize('ADMIN', 'STAFF');
const ADMIN = authorize('ADMIN');

// A student's own fees. No :id, so there is no IDOR surface - same pattern as
// /api/students/my and /api/loans/my. Declared first so nothing below can
// capture it.
router.get('/my', generalLimiter, getMyFees);

// Literal paths before every /:id route, so "export.csv", "run" and "bulk" are
// not read as ids. Same reason library.js declares /charges/export.csv ahead of
// /charges/:id.
router.get('/assessments/export.csv', OFFICE, exportAssessmentsCsv);
router.get('/payments/export.csv', OFFICE, exportPaymentsCsv);
router.post('/assessments/run', ADMIN, adminLimiter, runAssessments);
router.post('/vouchers/bulk', ADMIN, adminLimiter, bulkIssueVouchers);

// What the school charges. Only an administrator sets the figures that end up
// printed on a slip a parent takes to a bank.
router.get('/schedules', OFFICE, listSchedules);
router.post('/schedules', ADMIN, adminLimiter, createSchedule);
router.get('/schedules/:id', OFFICE, getSchedule);
router.put('/schedules/:id', ADMIN, adminLimiter, updateSchedule);
router.delete('/schedules/:id', ADMIN, adminLimiter, deleteSchedule);
router.post('/schedules/:id/publish', ADMIN, adminLimiter, setSchedulePublished(true));
router.post('/schedules/:id/unpublish', ADMIN, adminLimiter, setSchedulePublished(false));

// The voucher numbering. Shares the /schedules guard because setting it wrong
// is how two slips end up with the same number.
router.get('/serial', OFFICE, getSerialCounter);
router.put('/serial', ADMIN, adminLimiter, updateSerialCounter);

// What each student has been charged.
router.get('/assessments', OFFICE, listAssessments);
router.post('/assessments', OFFICE, createAssessment);
router.post('/assessments/:id/waive', ADMIN, adminLimiter, waiveAssessment);
router.post('/assessments/:id/cancel', ADMIN, adminLimiter, cancelAssessment);
router.post('/assessments/:id/vouchers', OFFICE, issueVoucher);

router.get('/students/:studentId/ledger', OFFICE, getStudentLedger);

// Slips. Printing and reprinting is office work; voiding a number is not.
router.get('/vouchers', OFFICE, listVouchers);
router.get('/vouchers/:id', OFFICE, getVoucher);
router.post('/vouchers/:id/printed', OFFICE, markVoucherPrinted);
router.post('/vouchers/:id/void', ADMIN, adminLimiter, voidVoucher);

// Stamped slips coming back.
router.get('/payments', OFFICE, listPayments);
router.post('/payments', OFFICE, recordPayment);
router.post('/payments/:id/reverse', ADMIN, adminLimiter, reversePayment);

export default router;
