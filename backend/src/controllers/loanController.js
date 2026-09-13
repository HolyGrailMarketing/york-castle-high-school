import { randomUUID } from 'crypto';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { applyOperation, getCurrentTerm, SYNC_REJECT_REASONS } from '../services/loanEngine.js';

/**
 * Issuing and returning books, and the lists staff read.
 *
 * The single-operation routes here are thin wrappers over the same engine the
 * offline sync uses, so there is one implementation of "issue a book" rather
 * than two that drift apart.
 */

const money = (v) => (v === null || v === undefined ? null : Number(v));

/** Run one operation in its own transaction and answer with the engine's verdict. */
const runOne = async (req, res, next, kind) => {
  try {
    const term = await getCurrentTerm();
    if (!term) {
      return res.status(409).json({
        error: SYNC_REJECT_REASONS.NO_CURRENT_TERM,
        reason: 'NO_CURRENT_TERM',
      });
    }

    const op = {
      kind,
      // The desk sends its own opId so a retry is idempotent. One is minted
      // here only for direct API callers that did not supply one.
      opId: req.body.opId || randomUUID(),
      copyId: req.body.copyId,
      barcode: req.body.barcode?.trim(),
      studentId: req.body.studentId,
      expectedLoanId: req.body.expectedLoanId,
      condition: req.body.condition,
      note: req.body.note,
      clientAt: req.body.clientAt,
      stationId: req.body.stationId,
      source: req.body.source === 'OFFLINE_SYNC' ? 'OFFLINE_SYNC' : 'ONLINE',
    };

    if (!op.copyId && !op.barcode) return res.status(400).json({ error: 'Scan a book' });
    if (kind === 'ISSUE' && !op.studentId) return res.status(400).json({ error: 'Choose a student first' });

    const result = await prisma.$transaction((tx) => applyOperation(tx, op, { operatorId: req.user.id, term }));

    // A rejection is a real answer, not a server fault: the desk renders it as
    // "this could not be done, and here is who has the book".
    return res.status(result.status === 'applied' ? 200 : 409).json(result);
  } catch (error) {
    next(error);
  }
};

export const issueLoan = (req, res, next) => runOne(req, res, next, 'ISSUE');
export const returnLoan = (req, res, next) => runOne(req, res, next, 'RETURN');

/**
 * GET /api/loans/lookup?barcode= - what the desk needs about one barcode.
 */
export const lookupBarcode = async (req, res, next) => {
  try {
    const barcode = req.query.barcode?.trim();
    if (!barcode) return res.status(400).json({ error: 'Give a barcode' });

    const copy = await prisma.bookCopy.findUnique({
      where: { barcode },
      include: {
        book: true,
        loans: {
          where: { status: 'ACTIVE' },
          include: { student: { select: { id: true, name: true, studentProfile: { select: { formClass: true, studentNumber: true } } } } },
        },
      },
    });
    if (!copy) return res.status(404).json({ error: 'That barcode is not on record' });

    const loan = copy.loans[0];
    res.json({
      copy: {
        id: copy.id, barcode: copy.barcode, copyNumber: copy.copyNumber,
        condition: copy.condition, status: copy.status,
        withdrawnReason: copy.withdrawnReason,
      },
      book: { ...copy.book, replacementCost: money(copy.book.replacementCost), rentalFee: money(copy.book.rentalFee) },
      currentLoan: loan
        ? {
            id: loan.id, issuedAt: loan.issuedAt, dueAt: loan.dueAt,
            student: {
              id: loan.student.id, name: loan.student.name,
              formClass: loan.student.studentProfile?.formClass ?? null,
              studentNumber: loan.student.studentProfile?.studentNumber ?? null,
            },
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/loans/student-lookup?q= - find a student at the desk, with
 * everything needed to decide whether to hand over a book.
 */
export const lookupStudent = async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.status(400).json({ error: 'Give a student number or a name' });

    const profiles = await prisma.studentProfile.findMany({
      where: {
        OR: [
          { studentNumber: { equals: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { user: { email: { equals: q, mode: 'insensitive' } } },
          // By user id too, so the desk can refresh the card it is already
          // showing after each scan. Without this the "books out" count on the
          // pinned student silently stops moving.
          { userId: q },
        ],
      },
      take: 10,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const results = await Promise.all(profiles.map(async (p) => {
      const [loans, owed] = await Promise.all([
        prisma.bookLoan.findMany({
          where: { studentId: p.userId, status: 'ACTIVE' },
          include: { copy: { include: { book: { select: { title: true } } } } },
        }),
        prisma.bookCharge.aggregate({ where: { studentId: p.userId, status: 'OUTSTANDING' }, _sum: { amount: true } }),
      ]);
      return {
        id: p.userId,
        profileId: p.id,
        name: p.user.name,
        studentNumber: p.studentNumber,
        formClass: p.formClass,
        yearGroup: p.yearGroup,
        verification: p.verification,
        loanCap: p.loanCap,
        outstandingTotal: Number(owed._sum.amount || 0),
        activeLoans: loans.map((l) => ({
          id: l.id, barcode: l.copy.barcode, title: l.copy.book.title,
          dueAt: l.dueAt, overdue: l.dueAt < new Date(),
        })),
      };
    }));

    res.json({ students: results });
  } catch (error) {
    next(error);
  }
};

/** GET /api/loans - the loans list, with filters. */
export const getLoans = async (req, res, next) => {
  try {
    const { status, overdue, formClass, studentId, copyId, needsReview } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const where = {};
    if (status) where.status = status;
    if (studentId) where.studentId = studentId;
    if (copyId) where.copyId = copyId;
    if (needsReview === 'true') where.needsReview = true;
    if (overdue === 'true') {
      where.status = 'ACTIVE';
      where.dueAt = { lt: new Date() };
    }
    if (formClass) where.student = { studentProfile: { formClass } };

    const [loans, total, counts] = await Promise.all([
      prisma.bookLoan.findMany({
        where,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          copy: { include: { book: { select: { title: true, subject: true, replacementCost: true } } } },
          student: { select: { id: true, name: true, studentProfile: { select: { formClass: true, studentNumber: true } } } },
        },
      }),
      prisma.bookLoan.count({ where }),
      Promise.all([
        prisma.bookLoan.count({ where: { status: 'ACTIVE' } }),
        prisma.bookLoan.count({ where: { status: 'ACTIVE', dueAt: { lt: new Date() } } }),
        prisma.bookLoan.count({ where: { needsReview: true } }),
      ]),
    ]);

    res.json({
      loans: loans.map((l) => ({
        id: l.id,
        status: l.status,
        issuedAt: l.issuedAt,
        dueAt: l.dueAt,
        returnedAt: l.returnedAt,
        overdue: l.status === 'ACTIVE' && l.dueAt < new Date(),
        needsReview: l.needsReview,
        reviewReason: l.reviewReason,
        issuedCondition: l.issuedCondition,
        returnedCondition: l.returnedCondition,
        barcode: l.copy.barcode,
        title: l.copy.book.title,
        subject: l.copy.book.subject,
        replacementCost: money(l.copy.book.replacementCost),
        student: {
          id: l.student.id,
          name: l.student.name,
          formClass: l.student.studentProfile?.formClass ?? null,
          studentNumber: l.student.studentProfile?.studentNumber ?? null,
        },
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary: { active: counts[0], overdue: counts[1], needsReview: counts[2] },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/loans/my - the student's own books and charges.
 * Resolved from req.user.id: no :id, no IDOR surface.
 */
export const getMyLoans = async (req, res, next) => {
  try {
    const [loans, charges] = await Promise.all([
      prisma.bookLoan.findMany({
        where: { studentId: req.user.id },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        include: { copy: { include: { book: { select: { title: true, subject: true, author: true } } } } },
      }),
      prisma.bookCharge.findMany({ where: { studentId: req.user.id }, orderBy: { raisedAt: 'desc' } }),
    ]);

    const now = new Date();
    res.json({
      current: loans.filter((l) => l.status === 'ACTIVE').map((l) => ({
        id: l.id,
        barcode: l.copy.barcode,
        title: l.copy.book.title,
        subject: l.copy.book.subject,
        author: l.copy.book.author,
        issuedAt: l.issuedAt,
        dueAt: l.dueAt,
        overdue: l.dueAt < now,
        daysOverdue: l.dueAt < now ? Math.floor((now - l.dueAt) / 86400000) : 0,
      })),
      returned: loans.filter((l) => l.status === 'RETURNED').map((l) => ({
        id: l.id, title: l.copy.book.title, subject: l.copy.book.subject, returnedAt: l.returnedAt,
      })),
      charges: charges.map((c) => ({
        id: c.id, type: c.type, amount: Number(c.amount), currency: c.currency,
        status: c.status, reason: c.reason, raisedAt: c.raisedAt,
      })),
      outstandingTotal: charges
        .filter((c) => c.status === 'OUTSTANDING')
        .reduce((sum, c) => sum + Number(c.amount), 0),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/loans/:id/mark-lost - the book is gone.
 * Closes the loan, retires the copy and raises a replacement charge.
 */
export const markLoanLost = async (req, res, next) => {
  try {
    const loan = await prisma.bookLoan.findUnique({
      where: { id: req.params.id },
      include: { copy: { include: { book: true } } },
    });
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status === 'LOST') return res.status(409).json({ error: 'That loan is already recorded as lost' });
    if (loan.status !== 'ACTIVE') return res.status(409).json({ error: 'That book has already been returned' });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.bookLoan.update({
        where: { id: loan.id },
        data: { status: 'LOST', returnedById: req.user.id, conditionNote: req.body.note?.trim() || null },
      });
      await tx.bookCopy.update({ where: { id: loan.copyId }, data: { status: 'LOST' } });
      const charge = await tx.bookCharge.upsert({
        where: { loanId_type: { loanId: loan.id, type: 'LOST' } },
        update: {},
        create: {
          studentId: loan.studentId,
          loanId: loan.id,
          copyId: loan.copyId,
          type: 'LOST',
          amount: loan.copy.book.replacementCost,
          academicYear: loan.academicYear,
          term: loan.term,
          reason: req.body.note?.trim() || 'Reported lost.',
          raisedById: req.user.id,
        },
      });
      return { updated, charge };
    });

    logger.info('Book marked lost', { loanId: loan.id, by: req.user.id });
    res.json({
      loan: result.updated,
      charge: { ...result.charge, amount: Number(result.charge.amount) },
      message: `${loan.copy.book.title} marked lost. A replacement charge of ${Number(result.charge.amount)} has been recorded.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/loans/bulk-return - the end-of-term collection.
 *
 * Takes a whole form class or a whole title back at once. Supports dryRun so
 * the office can see exactly what it is about to do first: this affects a lot
 * of records in one action and cannot be undone in bulk.
 */
export const bulkReturn = async (req, res, next) => {
  try {
    const { formClass, bookId, condition, dryRun } = req.body;
    if (!formClass && !bookId) return res.status(400).json({ error: 'Choose a form class or a title' });

    const where = { status: 'ACTIVE' };
    if (formClass) where.student = { studentProfile: { formClass } };
    if (bookId) where.copy = { bookId };

    const loans = await prisma.bookLoan.findMany({
      where,
      include: {
        copy: { include: { book: { select: { title: true } } } },
        student: { select: { name: true, studentProfile: { select: { formClass: true } } } },
      },
    });

    if (dryRun) {
      return res.json({
        dryRun: true,
        count: loans.length,
        loans: loans.map((l) => ({
          id: l.id, barcode: l.copy.barcode, title: l.copy.book.title,
          student: l.student.name, formClass: l.student.studentProfile?.formClass ?? null,
          overdue: l.dueAt < new Date(),
        })),
      });
    }

    const now = new Date();
    const returnedCondition = condition || undefined;

    // Chunked rather than one enormous transaction: a class collection is
    // hundreds of rows and a single long transaction would hold locks across
    // the whole thing.
    let returned = 0;
    for (const loan of loans) {
      await prisma.$transaction([
        prisma.bookLoan.update({
          where: { id: loan.id },
          data: {
            status: 'RETURNED',
            returnedAt: now,
            returnedServerAt: now,
            returnedById: req.user.id,
            returnedCondition: returnedCondition || loan.issuedCondition,
            conditionNote: 'End of term collection.',
          },
        }),
        prisma.bookCopy.update({ where: { id: loan.copyId }, data: { status: 'AVAILABLE' } }),
      ]);
      returned++;
    }

    logger.info('Bulk return', { formClass, bookId, returned, by: req.user.id });
    res.json({ returned, message: `${returned} book${returned === 1 ? '' : 's'} taken back.` });
  } catch (error) {
    next(error);
  }
};
