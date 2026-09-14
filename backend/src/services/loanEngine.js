import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';

/**
 * The one place a book is issued or taken back.
 *
 * Every route goes through here: the desk's own POST /issue and POST /return,
 * and every operation replayed from a counter station's offline queue. There is
 * deliberately not a separate "online" implementation. If there were, the
 * offline path would be the one nobody exercises until the day the internet
 * drops, which is the day it must not be wrong.
 *
 * Two rules the rest of the system depends on:
 *
 * 1. Every operation carries a client-generated `opId`. It is the idempotency
 *    key. A station on a flaky link routinely retries a request whose response
 *    was lost after the write already succeeded; replaying an applied opId must
 *    return the same loan, not make a second one.
 *
 * 2. This layer records what physically happened. It does not enforce policy.
 *    An issue to a student who is now unverified, over their cap or in debt is
 *    ACCEPTED and flagged needsReview - the book has already left the building,
 *    and refusing the record destroys the only trace of it. Policy is enforced
 *    at scan time on the station, the one moment the librarian can still say
 *    "see the office first" and take the book back.
 *
 * The only true rejections are physical impossibilities.
 */

/** The complete set of reasons an operation can be refused. Keep it short. */
export const SYNC_REJECT_REASONS = {
  COPY_NOT_FOUND: 'That barcode is not on record.',
  STUDENT_NOT_FOUND: 'That student is not on record.',
  COPY_WITHDRAWN: 'That copy was withdrawn and cannot be lent again.',
  COPY_ALREADY_ON_LOAN: 'The school\'s records say that copy is already out to someone else.',
  LOAN_CHANGED: 'That copy has since been issued to someone else, so this return was not applied.',
  LATE_ARRIVAL: 'That copy was issued to someone else after this scan was made.',
  NO_ACTIVE_LOAN: 'That copy was not recorded as being out to anyone.',
  NO_CURRENT_TERM: 'No academic term is marked current, so a due date cannot be worked out.',
};

/** A scan stamped more than this far in the past is applied but flagged. */
const STALE_SCAN_DAYS = 14;

const reject = (reason, detail) => ({ status: 'rejected', reason, message: SYNC_REJECT_REASONS[reason], detail });
const applied = (loan, extra = {}) => ({ status: 'applied', duplicate: false, loanId: loan.id, ...extra });
const duplicate = (loan, extra = {}) => ({ status: 'applied', duplicate: true, loanId: loan.id, ...extra });

/**
 * Settle the effective time of an operation.
 *
 * A counter laptop stamps its own clock. It may be wrong, and the librarian may
 * fix it mid-shift. A future timestamp is clamped to now; one implausibly far
 * in the past is kept - it may well be a genuine long outage - but flagged so a
 * human looks. Ordering within a station never depends on this value; that is
 * what the queue's own sequence number is for.
 */
export const resolveEffectiveAt = (clientAt, now = new Date()) => {
  const stamped = clientAt ? new Date(clientAt) : now;
  if (Number.isNaN(stamped.getTime())) return { effectiveAt: now, needsReview: true, reviewReason: 'The scan had no usable timestamp.' };
  if (stamped > now) return { effectiveAt: now, needsReview: false };

  const ageDays = (now - stamped) / 86400000;
  if (ageDays > STALE_SCAN_DAYS) {
    return {
      effectiveAt: stamped,
      needsReview: true,
      reviewReason: `Recorded ${Math.round(ageDays)} days before it reached the school's records.`,
    };
  }
  return { effectiveAt: stamped, needsReview: false };
};

/** The current academic term. Due dates come from here, never from new Date(). */
export const getCurrentTerm = () => prisma.academicTerm.findFirst({ where: { isCurrent: true } });

/**
 * Policy checks, evaluated for information rather than enforcement.
 *
 * Returns the reasons an issue is irregular. The station runs the equivalent of
 * this against its cached snapshot *before* the book is handed over and blocks
 * there; by the time an operation reaches the server the book is already gone,
 * so the answer here only decides whether a human is asked to look at it.
 */
const irregularities = async (studentId, copyId) => {
  const [profile, activeCount, owed] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { verification: true, loanCap: true } }),
    prisma.bookLoan.count({ where: { studentId, status: 'ACTIVE', copyId: { not: copyId } } }),
    prisma.bookCharge.aggregate({ where: { studentId, status: 'OUTSTANDING' }, _sum: { amount: true } }),
  ]);

  const reasons = [];
  if (!profile) reasons.push('The student has no confirmed year or class on record.');
  else if (profile.verification !== 'VERIFIED') reasons.push('The student was not confirmed by the office.');

  const cap = profile?.loanCap ?? Number(process.env.DEFAULT_LOAN_CAP || 8);
  if (activeCount >= cap) reasons.push(`The student already had ${activeCount} books out (limit ${cap}).`);

  const total = Number(owed._sum.amount || 0);
  if (total > 0) reasons.push(`The student owes ${total}.`);

  return reasons;
};

/**
 * Issue one copy to one student.
 *
 * `tx` is a Prisma transaction client. The caller owns the transaction so that
 * a batch of synced operations can commit one at a time - one rejection must
 * not roll back the other 199.
 */
export const applyIssue = async (tx, op, { operatorId, term, now = new Date() }) => {
  const existing = await tx.bookLoan.findUnique({ where: { issueOpId: op.opId } });
  if (existing) return duplicate(existing, { barcode: op.barcode });

  const copy = await tx.bookCopy.findFirst({
    where: op.copyId ? { id: op.copyId } : { barcode: op.barcode },
    include: { book: { select: { title: true } } },
  });
  if (!copy) return reject('COPY_NOT_FOUND', { barcode: op.barcode });
  if (copy.status === 'WITHDRAWN') {
    return reject('COPY_WITHDRAWN', {
      barcode: copy.barcode,
      withdrawnAt: copy.withdrawnAt,
      withdrawnReason: copy.withdrawnReason,
    });
  }

  const student = await tx.user.findUnique({
    where: { id: op.studentId },
    select: { id: true, name: true, role: true, studentProfile: { select: { formClass: true } } },
  });
  if (!student) return reject('STUDENT_NOT_FOUND', { studentId: op.studentId });

  // Is it already out? Checked explicitly so the rejection can name who has it,
  // rather than surfacing a bare P2002 from the partial unique index. The index
  // is still the thing that makes this safe - this is only for the message.
  const live = await tx.bookLoan.findFirst({
    where: { copyId: copy.id, status: 'ACTIVE' },
    include: { student: { select: { name: true, studentProfile: { select: { formClass: true } } } } },
  });
  if (live) {
    const { effectiveAt } = resolveEffectiveAt(op.clientAt, now);
    return reject(effectiveAt < live.issuedAt ? 'LATE_ARRIVAL' : 'COPY_ALREADY_ON_LOAN', {
      barcode: copy.barcode,
      title: copy.book.title,
      heldBy: live.student.name,
      formClass: live.student.studentProfile?.formClass ?? null,
      since: live.issuedAt,
      loanId: live.id,
    });
  }

  const timing = resolveEffectiveAt(op.clientAt, now);
  const policy = await irregularities(student.id, copy.id);
  const needsReview = timing.needsReview || policy.length > 0;
  const reviewReason = [timing.reviewReason, ...policy].filter(Boolean).join(' ') || null;

  try {
    const loan = await tx.bookLoan.create({
      data: {
        copyId: copy.id,
        studentId: student.id,
        academicYear: term.academicYear,
        term: term.term,
        issuedAt: timing.effectiveAt,
        issuedById: operatorId,
        issuedCondition: op.condition || copy.condition,
        // Always from the term, never from the device. A wrong clock on a
        // counter laptop can never produce a wrong due date.
        dueAt: term.endsOn,
        issueOpId: op.opId,
        issueSource: op.source || 'ONLINE',
        stationId: op.stationId || null,
        needsReview,
        reviewReason,
      },
    });
    await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'ON_LOAN' } });

    return applied(loan, {
      barcode: copy.barcode,
      title: copy.book.title,
      student: { id: student.id, name: student.name, formClass: student.studentProfile?.formClass ?? null },
      dueAt: loan.dueAt,
      needsReview,
      reviewReason,
    });
  } catch (error) {
    // The partial unique index is the real guard, and it is what catches two
    // stations that raced past the check above.
    if (error.code === 'P2002') {
      const target = String(error.meta?.target || '');
      if (target.includes('issueOpId')) {
        const again = await tx.bookLoan.findUnique({ where: { issueOpId: op.opId } });
        if (again) return duplicate(again, { barcode: copy.barcode });
      }
      return reject('COPY_ALREADY_ON_LOAN', { barcode: copy.barcode, title: copy.book.title });
    }
    throw error;
  }
};

/**
 * Take one copy back.
 *
 * `expectedLoanId` is the loan the device believed was active when it scanned.
 * It is what distinguishes "this return is stale" from "this return is fine".
 */
export const applyReturn = async (tx, op, { operatorId, now = new Date() }) => {
  const already = op.opId ? await tx.bookLoan.findUnique({ where: { returnOpId: op.opId } }) : null;
  if (already) return duplicate(already, { barcode: op.barcode });

  const copy = await tx.bookCopy.findFirst({
    where: op.copyId ? { id: op.copyId } : { barcode: op.barcode },
    include: { book: { select: { title: true, replacementCost: true } } },
  });
  if (!copy) return reject('COPY_NOT_FOUND', { barcode: op.barcode });

  const live = await tx.bookLoan.findFirst({
    where: { copyId: copy.id, status: 'ACTIVE' },
    include: { student: { select: { id: true, name: true, studentProfile: { select: { formClass: true } } } } },
  });

  const timing = resolveEffectiveAt(op.clientAt, now);

  if (!live) {
    // Nothing active. If the loan the device expected is already closed, this
    // is the same book coming back twice - by two stations, or by a retry that
    // lost its response. A book returned twice is still returned, so it is
    // applied, and the earlier of the two timestamps is kept because that is
    // the one that is fairer to the student on overdue days.
    if (op.expectedLoanId) {
      const expected = await tx.bookLoan.findUnique({ where: { id: op.expectedLoanId } });
      if (expected && expected.status === 'RETURNED') {
        if (expected.returnedAt && timing.effectiveAt < expected.returnedAt) {
          await tx.bookLoan.update({ where: { id: expected.id }, data: { returnedAt: timing.effectiveAt } });
        }
        return duplicate(expected, { barcode: copy.barcode });
      }
    }
    return reject('NO_ACTIVE_LOAN', { barcode: copy.barcode, title: copy.book.title });
  }

  // The copy is out, but to a different loan than the device saw. Someone else
  // has it now; closing their loan would wrongly say they gave it back.
  if (op.expectedLoanId && op.expectedLoanId !== live.id) {
    return reject('LOAN_CHANGED', {
      barcode: copy.barcode,
      title: copy.book.title,
      heldBy: live.student.name,
      formClass: live.student.studentProfile?.formClass ?? null,
      since: live.issuedAt,
      loanId: live.id,
    });
  }

  const condition = op.condition || live.issuedCondition;
  const loan = await tx.bookLoan.update({
    where: { id: live.id },
    data: {
      status: 'RETURNED',
      returnedAt: timing.effectiveAt,
      returnedServerAt: now,
      returnedById: operatorId,
      returnedCondition: condition,
      conditionNote: op.note?.trim() || null,
      returnOpId: op.opId || null,
      returnSource: op.source || 'ONLINE',
      needsReview: live.needsReview || timing.needsReview,
      reviewReason: timing.reviewReason || live.reviewReason,
    },
  });

  // A book that comes back damaged goes to the repair shelf, not back into
  // circulation, and the student is charged. The unique index on
  // (loanId, type) is what stops a replayed operation charging them twice.
  let charge = null;
  if (condition === 'DAMAGED') {
    await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'REPAIR', condition } });
    charge = await tx.bookCharge.upsert({
      where: { loanId_type: { loanId: loan.id, type: 'DAMAGE' } },
      update: {},
      create: {
        studentId: live.student.id,
        loanId: loan.id,
        copyId: copy.id,
        type: 'DAMAGE',
        amount: copy.book.replacementCost,
        academicYear: loan.academicYear,
        term: loan.term,
        reason: op.note?.trim() || 'Returned damaged.',
        raisedById: operatorId,
        opId: op.opId ? `${op.opId}:damage` : null,
      },
    });
  } else {
    await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'AVAILABLE', condition } });
  }

  const overdueDays = Math.max(0, Math.floor((timing.effectiveAt - loan.dueAt) / 86400000));

  return applied(loan, {
    barcode: copy.barcode,
    title: copy.book.title,
    student: {
      id: live.student.id,
      name: live.student.name,
      formClass: live.student.studentProfile?.formClass ?? null,
    },
    condition,
    overdueDays,
    charge: charge ? { id: charge.id, type: charge.type, amount: Number(charge.amount) } : null,
  });
};

/** Dispatch one operation. Used identically by the desk and by sync. */
export const applyOperation = async (tx, op, context) => {
  switch (op.kind) {
    case 'ISSUE':
      return applyIssue(tx, op, context);
    case 'RETURN':
      return applyReturn(tx, op, context);
    default:
      logger.warn('Unknown loan operation kind', { kind: op.kind, opId: op.opId });
      return { status: 'rejected', reason: 'UNKNOWN_KIND', message: `Unknown operation "${op.kind}".` };
  }
};
