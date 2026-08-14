/**
 * Overdue document request escalation.
 *
 * doc-request.html promises the requester a processing time per document type.
 * Nothing enforced that promise: a request could sit at PENDING indefinitely and
 * nobody was told. This job finds document requests that have run past their
 * promised turnaround and emails the principal a digest, once per request.
 *
 * Invoked from GET /api/cron/overdue-requests (Vercel Cron) and from
 * scripts/check-overdue-requests.js for manual runs.
 */

import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { getBaseUrl, extractRequester } from '../utils/helpers.js';
import {
  isEmailConfigured,
  getOverdueEscalationRecipients,
  sendOverdueRequestsEscalation,
} from './emailService.js';
import {
  MIN_SLA_WORKING_DAYS,
  documentTypeOf,
  dueDateFor,
  slaLabelFor,
  workingDaysBetween,
} from './requestSla.js';

// Statuses that still count as outstanding work. COMPLETED and REJECTED are done with.
const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS'];

const formatDate = (date) =>
  date.toLocaleDateString('en-JM', { dateStyle: 'medium' });

/**
 * Find document requests that are past their promised turnaround and haven't
 * been escalated yet.
 */
export const findOverdueRequests = async (now = new Date()) => {
  // Cheap prefilter: nothing can be overdue before the shortest promise on the
  // form has elapsed. N working days always span at least N calendar days, so
  // treating the shortest SLA as calendar days is a strict lower bound - the
  // query is guaranteed to be a superset of the truly overdue rows, and the
  // exact per-type due dates are applied below.
  const earliestPossible = new Date(now.getTime());
  earliestPossible.setUTCDate(earliestPossible.getUTCDate() - MIN_SLA_WORKING_DAYS);

  const candidates = await prisma.request.findMany({
    where: {
      type: 'DOCUMENT',
      status: { in: OPEN_STATUSES },
      escalatedAt: null,
      createdAt: { lte: earliestPossible },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  return candidates.filter((request) => dueDateFor(request) < now);
};

/**
 * Escalate every newly-overdue document request to the principal.
 *
 * Sends a single digest rather than one email per request, and only stamps
 * escalatedAt once the send succeeds - so an email outage retries on the next
 * run instead of losing the alert.
 */
export const escalateOverdueRequests = async ({ req = null, now = new Date() } = {}) => {
  const overdue = await findOverdueRequests(now);

  if (overdue.length === 0) {
    logger.info('Overdue request check: nothing to escalate');
    return { checked: 0, escalated: 0, recipients: [] };
  }

  if (!isEmailConfigured()) {
    logger.warn('Overdue request check: email service not configured, skipping escalation', {
      overdue: overdue.length,
    });
    return { checked: overdue.length, escalated: 0, recipients: [], skipped: 'email-not-configured' };
  }

  const items = overdue.map((request) => {
    const { name } = extractRequester(request);
    const dueAt = dueDateFor(request);
    return {
      requestId: request.id,
      documentType: documentTypeOf(request) || request.title || 'Document request',
      requesterName: name,
      submittedStr: formatDate(new Date(request.createdAt)),
      dueStr: formatDate(dueAt),
      promisedTurnaround: slaLabelFor(request),
      workingDaysOverdue: workingDaysBetween(dueAt, now),
    };
  });

  const recipients = await getOverdueEscalationRecipients();
  const dashboardUrl = `${getBaseUrl(req)}/admin/requests?status=PENDING`;

  await sendOverdueRequestsEscalation({ items, dashboardUrl }, recipients);

  const { count } = await prisma.request.updateMany({
    where: { id: { in: overdue.map((r) => r.id) } },
    data: { escalatedAt: now },
  });

  logger.info('Overdue request escalation sent', {
    escalated: count,
    recipients,
  });

  return { checked: overdue.length, escalated: count, recipients };
};
