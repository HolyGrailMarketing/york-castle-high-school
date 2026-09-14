import express from 'express';
import logger from '../utils/logger.js';
import { escalateOverdueRequests } from '../services/overdueRequestService.js';
import { notifyDueSoonLoans, escalateOverdueLoans } from '../services/bookLoanOverdueService.js';

const router = express.Router();

/**
 * Scheduled-job endpoints.
 *
 * Not protected by the normal JWT `authenticate` middleware - there is no user
 * here. Instead the caller must present CRON_SECRET as a bearer token, which is
 * exactly what Vercel Cron sends (see the `crons` block in vercel.json). If
 * CRON_SECRET isn't configured the endpoint refuses to run rather than sitting
 * open to the internet.
 */
const requireCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    logger.error('Cron endpoint called but CRON_SECRET is not configured');
    return res.status(503).json({ error: 'Scheduled jobs are not configured' });
  }

  const header = req.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (provided !== secret) {
    logger.warn('Rejected cron request with bad or missing secret', { ip: req.ip, path: req.originalUrl });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
};

router.use(requireCronSecret);

// Email the principal about document requests that have passed the turnaround
// promised on doc-request.html. Safe to run repeatedly: each request is only
// reported once.
router.get('/overdue-requests', async (req, res, next) => {
  try {
    const result = await escalateOverdueRequests({ req });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Everything the school needs chasing daily, in one endpoint.
 *
 * Deliberately one job rather than three. Vercel's Hobby plan allows two cron
 * entries at once-daily granularity and one is already used by
 * /overdue-requests, so three separate schedules may simply not be available.
 * Folding them keeps the whole thing to a single entry, and each piece stamps
 * its own rows so a partial failure retries only what it missed.
 *
 * /overdue-requests stays as it is, for the manual script that calls it.
 */
router.get('/daily', async (req, res, next) => {
  try {
    const results = {};

    // Each is wrapped on its own: a failure in one must not stop the others.
    try {
      results.overdueRequests = await escalateOverdueRequests({ req });
    } catch (error) {
      logger.error('Daily job: overdue requests failed', { error: error.message });
      results.overdueRequests = { error: error.message };
    }

    try {
      results.booksDueSoon = await notifyDueSoonLoans({});
    } catch (error) {
      logger.error('Daily job: due-soon books failed', { error: error.message });
      results.booksDueSoon = { error: error.message };
    }

    try {
      results.overdueBooks = await escalateOverdueLoans({});
    } catch (error) {
      logger.error('Daily job: overdue books failed', { error: error.message });
      results.overdueBooks = { error: error.message };
    }

    logger.info('Daily job complete', results);
    res.json({ ok: true, ...results });
  } catch (error) {
    next(error);
  }
});

/** The book jobs on their own, for manual runs and for a plan with room. */
router.get('/book-loans-due-soon', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await notifyDueSoonLoans({})) });
  } catch (error) { next(error); }
});

router.get('/overdue-book-loans', async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await escalateOverdueLoans({})) });
  } catch (error) { next(error); }
});

export default router;
