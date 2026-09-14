import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import {
  getOverdueBookRecipients,
  sendBookDueSoon,
  sendBookOverdueStudent,
  sendBookOverdueStaffDigest,
} from './emailService.js';

/**
 * Chasing textbooks that are due back, and ones that already are.
 *
 * Modelled on overdueRequestService.js, and keeping its two best properties:
 *
 *   - A cheap prefilter. Loans already notified are excluded in the query, so
 *     the daily run is a couple of indexed reads rather than a scan.
 *
 *   - The stamp is written only AFTER the send succeeds. If email is down the
 *     run does nothing and tries again tomorrow, rather than marking everyone
 *     as told and silently never telling them.
 *
 * Reminders are grouped by student: one email listing all their late books, not
 * one email per book. A student with five overdue textbooks who gets five
 * separate emails learns to ignore them.
 */

/** How far ahead of the due date to warn, in days. */
const DUE_SOON_DAYS = 3;

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-JM', { day: 'numeric', month: 'long', year: 'numeric' });

/** Group loan rows by the student holding them. */
const byStudent = (loans) => {
  const groups = new Map();
  for (const loan of loans) {
    const existing = groups.get(loan.studentId) ?? { student: loan.student, loans: [] };
    existing.loans.push(loan);
    groups.set(loan.studentId, existing);
  }
  return [...groups.values()];
};

const loanShape = (loan) => ({
  id: loan.id,
  title: loan.copy.book.title,
  barcode: loan.copy.barcode,
  dueAt: loan.dueAt,
  dueLabel: formatDate(loan.dueAt),
  replacementCost: Number(loan.copy.book.replacementCost),
});

const withBookAndStudent = {
  copy: { include: { book: { select: { title: true, replacementCost: true } } } },
  student: {
    select: {
      id: true, name: true, email: true,
      studentProfile: { select: { formClass: true } },
    },
  },
};

/** Books due within the next few days that the student has not been warned about. */
export const findDueSoonLoans = async (now = new Date()) => {
  const horizon = new Date(now.getTime() + DUE_SOON_DAYS * 86400000);
  return prisma.bookLoan.findMany({
    where: {
      status: 'ACTIVE',
      dueSoonNotifiedAt: null,
      dueAt: { gt: now, lte: horizon },
    },
    include: withBookAndStudent,
    orderBy: { dueAt: 'asc' },
  });
};

/** Books already past their due date that the student has not been chased about. */
export const findOverdueLoans = async (now = new Date()) => {
  return prisma.bookLoan.findMany({
    where: {
      status: 'ACTIVE',
      overdueNotifiedAt: null,
      dueAt: { lt: now },
    },
    include: withBookAndStudent,
    orderBy: { dueAt: 'asc' },
  });
};

/** A gentle warning a few days before the books are due. */
export const notifyDueSoonLoans = async ({ now = new Date() } = {}) => {
  const loans = await findDueSoonLoans(now);
  if (loans.length === 0) return { students: 0, loans: 0, failed: 0 };

  let notified = 0;
  let failed = 0;

  for (const group of byStudent(loans)) {
    // A student registered at the counter may have a placeholder address that
    // can never be delivered to. Skip rather than pile up bounces, but still
    // stamp so the job does not retry them forever.
    const undeliverable = !group.student.email || group.student.email.endsWith('.invalid');
    try {
      if (!undeliverable) {
        await sendBookDueSoon({
          name: group.student.name,
          email: group.student.email,
          formClass: group.student.studentProfile?.formClass ?? null,
          books: group.loans.map(loanShape),
        });
      }
      await prisma.bookLoan.updateMany({
        where: { id: { in: group.loans.map((l) => l.id) } },
        data: { dueSoonNotifiedAt: now },
      });
      if (!undeliverable) notified += 1;
    } catch (error) {
      // Deliberately not stamped, so tomorrow's run tries again.
      failed += 1;
      logger.error('Due-soon reminder failed', { studentId: group.student.id, error: error.message });
    }
  }

  logger.info('Due-soon reminders sent', { students: notified, loans: loans.length, failed });
  return { students: notified, loans: loans.length, failed };
};

/**
 * Chase overdue books: the student, and one digest for whoever the school has
 * asked to see them.
 *
 * The two are stamped separately. `overdueNotifiedAt` means the student was
 * told; `escalatedAt` means staff were. One field would conflate them, and a
 * failed staff digest would then suppress the student's reminder.
 */
export const escalateOverdueLoans = async ({ now = new Date() } = {}) => {
  const loans = await findOverdueLoans(now);
  if (loans.length === 0) return { students: 0, loans: 0, failed: 0, staffNotified: false };

  let notified = 0;
  let failed = 0;
  const stamped = [];

  for (const group of byStudent(loans)) {
    const undeliverable = !group.student.email || group.student.email.endsWith('.invalid');
    try {
      if (!undeliverable) {
        await sendBookOverdueStudent({
          name: group.student.name,
          email: group.student.email,
          formClass: group.student.studentProfile?.formClass ?? null,
          books: group.loans.map((l) => ({
            ...loanShape(l),
            daysLate: Math.max(1, Math.floor((now - l.dueAt) / 86400000)),
          })),
        });
      }
      await prisma.bookLoan.updateMany({
        where: { id: { in: group.loans.map((l) => l.id) } },
        data: { overdueNotifiedAt: now },
      });
      stamped.push(...group.loans);
      if (!undeliverable) notified += 1;
    } catch (error) {
      failed += 1;
      logger.error('Overdue reminder failed', { studentId: group.student.id, error: error.message });
    }
  }

  // One digest for staff covering everything newly overdue.
  let staffNotified = false;
  if (stamped.length > 0) {
    try {
      const recipients = await getOverdueBookRecipients();
      if (recipients.length > 0) {
        await sendBookOverdueStaffDigest(
          {
            total: stamped.length,
            students: byStudent(stamped).length,
            rows: stamped.map((l) => ({
              ...loanShape(l),
              student: l.student.name,
              formClass: l.student.studentProfile?.formClass ?? null,
              daysLate: Math.max(1, Math.floor((now - l.dueAt) / 86400000)),
            })),
          },
          recipients
        );
        await prisma.bookLoan.updateMany({
          where: { id: { in: stamped.map((l) => l.id) } },
          data: { escalatedAt: now },
        });
        staffNotified = true;
      }
    } catch (error) {
      // Not stamped, so the digest is retried tomorrow. The students have
      // already been told, and that stamp stands.
      logger.error('Overdue staff digest failed', { error: error.message });
    }
  }

  logger.info('Overdue book reminders sent', { students: notified, loans: loans.length, failed, staffNotified });
  return { students: notified, loans: loans.length, failed, staffNotified };
};
