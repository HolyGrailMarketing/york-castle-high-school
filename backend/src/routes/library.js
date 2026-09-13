import express from 'express';
import {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  getBookCopies,
  generateCopies,
  updateCopy,
  getCopyLabels,
  exportCopiesCsv,
  getSubjects,
} from '../controllers/libraryCatalogController.js';
import { getStationSnapshot } from '../controllers/stationSnapshotController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { adminLimiter, snapshotLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Nothing here is public. The catalogue says what the school owns and what it
// is worth, and the copy list says which student is holding which book.
router.use(authenticate);

// Teachers can look the catalogue up but not change it - they need to know
// which book a class is on, not to run the stock.
const READ = authorize('ADMIN', 'STAFF', 'TEACHER');
const OFFICE = authorize('ADMIN', 'STAFF');

// The offline bundle a counter station caches. Never responseCache'd: it is
// per-caller and staleness here is exactly what it must not have.
router.get('/station/snapshot', OFFICE, snapshotLimiter, getStationSnapshot);

// Catalogue
router.get('/books', READ, getBooks);
router.get('/subjects', READ, getSubjects);
router.post('/books', OFFICE, createBook);

// Copies. Declared before /books/:id so "copies" and "labels" cannot be
// swallowed by the :id parameter.
router.get('/copies/labels', OFFICE, getCopyLabels);
router.get('/copies/export.csv', OFFICE, exportCopiesCsv);
router.patch('/copies/:id', OFFICE, updateCopy);

router.get('/books/:id', READ, getBook);
router.put('/books/:id', OFFICE, updateBook);
router.delete('/books/:id', authorize('ADMIN'), deleteBook);
router.get('/books/:id/copies', READ, getBookCopies);

// Bulk generation writes up to 500 rows per call, so it gets the stricter
// limiter rather than the general one.
router.post('/books/:id/copies', OFFICE, adminLimiter, generateCopies);

export default router;
