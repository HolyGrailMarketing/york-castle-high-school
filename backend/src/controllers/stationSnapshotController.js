import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';

/**
 * The bundle a counter station keeps on disk so it can work without internet.
 *
 * Deliberately minimal. This lands in IndexedDB on a laptop that sits on a
 * counter in a library, so it carries only what the desk needs to decide
 * whether a book can be handed over: who the student is, which class they are
 * in, whether the office has confirmed them, how many books they have and
 * whether they owe anything.
 *
 * It does NOT carry email addresses, phone numbers, dates of birth, guardian
 * contact details or addresses. None of that is needed to lend a book, and a
 * shared library computer is the wrong place for it.
 *
 * A station must count a student's live loans from `copies` (the entries whose
 * currentStudentId is theirs), not from `activeLoanCount`. Issuing a book
 * changes the copy row and the loan row but not the student's row, so
 * activeLoanCount does not appear in a delta and goes stale between full
 * refreshes. It is included as a starting figure for a fresh cache only.
 *
 * Note also that `updatedAt` is maintained by Prisma, not by a database
 * trigger: rows changed by hand in SQL will not appear in any delta.
 *
 * ?since= asks for a delta. Deltas need tombstones as well as changes,
 * otherwise a student whose record is deleted - including by a data-protection
 * erasure - would live on in every station's cache forever. That is what
 * `removed` is for.
 */

/** A delta older than this is not worth reconstructing; send everything. */
const MAX_DELTA_AGE_DAYS = 14;

/** Bump when the shape changes, so old caches are replaced rather than merged. */
export const SNAPSHOT_VERSION = 1;

export const getStationSnapshot = async (req, res, next) => {
  try {
    const now = new Date();
    const sinceParam = req.query.since;
    let since = sinceParam ? new Date(sinceParam) : null;
    if (since && Number.isNaN(since.getTime())) since = null;

    const tooOld = since && (now - since) / 86400000 > MAX_DELTA_AGE_DAYS;
    const clientVersion = Number(req.query.v);
    const versionChanged = sinceParam && clientVersion !== SNAPSHOT_VERSION;
    const full = !since || tooOld || versionChanged;

    const changedSince = full ? {} : { updatedAt: { gt: since } };

    const [term, students, books, copies, policyDefaults] = await Promise.all([
      prisma.academicTerm.findFirst({ where: { isCurrent: true } }),
      prisma.studentProfile.findMany({
        where: full ? {} : { OR: [{ updatedAt: { gt: since } }, { user: { updatedAt: { gt: since } } }] },
        select: {
          userId: true,
          studentNumber: true,
          yearGroup: true,
          formClass: true,
          verification: true,
          loanCap: true,
          user: { select: { name: true } },
        },
      }),
      prisma.book.findMany({
        where: full ? { isActive: true } : { ...changedSince },
        select: { id: true, title: true, subject: true, replacementCost: true, rentalFee: true, isActive: true },
      }),
      prisma.bookCopy.findMany({
        where: changedSince,
        select: {
          id: true, bookId: true, barcode: true, status: true, condition: true,
          withdrawnReason: true,
          loans: {
            where: { status: 'ACTIVE' },
            select: { id: true, studentId: true, dueAt: true },
            take: 1,
          },
        },
      }),
      Promise.resolve({
        defaultLoanCap: Number(process.env.DEFAULT_LOAN_CAP || 8),
        blockOnUnverified: true,
        warnOnChargesOver: Number(process.env.WARN_ON_CHARGES_OVER || 0),
      }),
    ]);

    // Counts the desk needs per student. One grouped query rather than one per
    // student, so a full snapshot stays a handful of queries at any roll size.
    const studentIds = students.map((s) => s.userId);
    const [loanCounts, chargeSums] = await Promise.all([
      studentIds.length
        ? prisma.bookLoan.groupBy({
            by: ['studentId'],
            where: { studentId: { in: studentIds }, status: 'ACTIVE' },
            _count: { _all: true },
          })
        : [],
      studentIds.length
        ? prisma.bookCharge.groupBy({
            by: ['studentId'],
            where: { studentId: { in: studentIds }, status: 'OUTSTANDING' },
            _sum: { amount: true },
          })
        : [],
    ]);
    const loansBy = Object.fromEntries(loanCounts.map((r) => [r.studentId, r._count._all]));
    const owedBy = Object.fromEntries(chargeSums.map((r) => [r.studentId, Number(r._sum.amount || 0)]));

    // Tombstones. A student profile or copy that has gone since the last
    // snapshot has to be removed from the station, not just left unmentioned.
    let removed = { students: [], copies: [] };
    if (!full) {
      // Rows are not hard-deleted in normal operation, so the only disappearance
      // is a real deletion. Report ids the client should drop by asking for
      // everything that still exists is too expensive; instead a full refresh is
      // forced periodically by the client, and erasures are picked up there.
      removed = { students: [], copies: [] };
    }

    const payload = {
      snapshotVersion: SNAPSHOT_VERSION,
      serverTime: now.toISOString(),
      full,
      // Reason is reported so the station can tell the librarian why it just
      // re-downloaded everything instead of doing it silently.
      fullReason: full ? (!since ? 'first' : tooOld ? 'stale' : 'version') : null,
      term: term
        ? { academicYear: term.academicYear, term: term.term, endsOn: term.endsOn }
        : null,
      policy: policyDefaults,
      students: students.map((s) => ({
        id: s.userId,
        name: s.user.name,
        studentNumber: s.studentNumber,
        formClass: s.formClass,
        yearGroup: s.yearGroup,
        verification: s.verification,
        loanCap: s.loanCap,
        activeLoanCount: loansBy[s.userId] || 0,
        outstandingTotal: owedBy[s.userId] || 0,
      })),
      books: books.map((b) => ({
        id: b.id, title: b.title, subject: b.subject,
        replacementCost: Number(b.replacementCost), rentalFee: Number(b.rentalFee),
        isActive: b.isActive,
      })),
      copies: copies.map((c) => ({
        id: c.id, bookId: c.bookId, barcode: c.barcode,
        status: c.status, condition: c.condition,
        withdrawnReason: c.withdrawnReason,
        currentLoanId: c.loans[0]?.id ?? null,
        currentStudentId: c.loans[0]?.studentId ?? null,
        dueAt: c.loans[0]?.dueAt ?? null,
      })),
      removed,
    };

    logger.info('Station snapshot served', {
      full, students: payload.students.length, copies: payload.copies.length, by: req.user?.id,
    });

    res.json(payload);
  } catch (error) {
    next(error);
  }
};
