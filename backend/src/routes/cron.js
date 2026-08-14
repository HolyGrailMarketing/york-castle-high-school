import express from 'express';
import logger from '../utils/logger.js';
import { escalateOverdueRequests } from '../services/overdueRequestService.js';

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

export default router;
