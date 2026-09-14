import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { sendBookChargeRaised } from '../services/emailService.js';

/**
 * What students owe for their textbooks.
 *
 * This records amounts only. No payment is ever taken or recorded here - the
 * bursary collects and keeps its own books, which is why ChargeStatus has
 * OUTSTANDING and WAIVED but deliberately no PAID.
 */

const CHARGE_TYPES = ['RENTAL', 'LOST', 'DAMAGE'];

const money = (v) => (v === null || v === undefined ? null : Number(v));

const shape = (c) => ({
  id: c.id,
  type: c.type,
  amount: money(c.amount),
  currency: c.currency,
  status: c.status,
  reason: c.reason,
  academicYear: c.academicYear,
  term: c.term,
  raisedAt: c.raisedAt,
  waivedAt: c.waivedAt,
  waiveReason: c.waiveReason,
  student: c.student
    ? {
        id: c.student.id,
        name: c.student.name,
        formClass: c.student.studentProfile?.formClass ?? null,
        studentNumber: c.student.studentProfile?.studentNumber ?? null,
      }
    : null,
  book: c.copy?.book ? { title: c.copy.book.title, barcode: c.copy.barcode } : null,
});

/** GET /api/library/charges */
export const getCharges = async (req, res, next) => {
  try {
    const { status, type, formClass, studentId, academicYear } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (studentId) where.studentId = studentId;
    if (academicYear) where.academicYear = academicYear;
    if (formClass) where.student = { studentProfile: { formClass } };

    const include = {
      student: { select: { id: true, name: true, studentProfile: { select: { formClass: true, studentNumber: true } } } },
      copy: { select: { barcode: true, book: { select: { title: true } } } },
    };

    const [charges, total, outstanding] = await Promise.all([
      prisma.bookCharge.findMany({ where, include, orderBy: { raisedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.bookCharge.count({ where }),
      prisma.bookCharge.aggregate({ where: { status: 'OUTSTANDING' }, _sum: { amount: true }, _count: { _all: true } }),
    ]);

    res.json({
      charges: charges.map(shape),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary: {
        outstandingTotal: Number(outstanding._sum.amount || 0),
        outstandingCount: outstanding._count._all,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/library/charges - raise one by hand. */
export const createCharge = async (req, res, next) => {
  try {
    const { studentId, type, amount, reason, loanId, copyId, academicYear, term } = req.body;

    if (!studentId) return res.status(400).json({ error: 'Choose a student' });
    if (!CHARGE_TYPES.includes(type)) return res.status(400).json({ error: 'Choose what the charge is for' });
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'Enter an amount' });

    const currentTerm = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });

    const charge = await prisma.bookCharge.create({
      data: {
        studentId,
        loanId: loanId || null,
        copyId: copyId || null,
        type,
        amount: value,
        academicYear: academicYear || currentTerm?.academicYear || String(new Date().getFullYear()),
        term: term ?? currentTerm?.term ?? null,
        reason: reason?.trim() || null,
        raisedById: req.user.id,
      },
      include: {
        student: { select: { id: true, name: true, email: true, studentProfile: { select: { formClass: true, studentNumber: true } } } },
        copy: { select: { barcode: true, book: { select: { title: true } } } },
      },
    });

    // Telling the student is best-effort: the charge stands whether or not the
    // email goes out, and a mail outage must not fail the request.
    void notifyStudent(charge);

    logger.info('Book charge raised', { chargeId: charge.id, type, amount: value, by: req.user.id });
    res.status(201).json({ charge: shape(charge) });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'That loan already has a charge of this kind' });
    }
    next(error);
  }
};

const notifyStudent = async (charge) => {
  const email = charge.student?.email;
  if (!email || email.endsWith('.invalid')) return;
  try {
    await sendBookChargeRaised({
      email,
      name: charge.student.name,
      type: charge.type,
      amount: Number(charge.amount),
      currency: charge.currency,
      reason: charge.reason,
      title: charge.copy?.book?.title ?? null,
    });
  } catch (error) {
    logger.error('Charge notification failed', { chargeId: charge.id, error: error.message });
  }
};

/** POST /api/library/charges/:id/waive - cancel a charge, with a reason. */
export const waiveCharge = async (req, res, next) => {
  try {
    const reason = req.body.reason?.trim();
    if (!reason) return res.status(400).json({ error: 'Give a reason for cancelling the charge' });

    const existing = await prisma.bookCharge.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Charge not found' });
    if (existing.status === 'WAIVED') return res.status(409).json({ error: 'That charge has already been cancelled' });

    const charge = await prisma.bookCharge.update({
      where: { id: req.params.id },
      data: { status: 'WAIVED', waivedAt: new Date(), waivedById: req.user.id, waiveReason: reason },
      include: {
        student: { select: { id: true, name: true, studentProfile: { select: { formClass: true, studentNumber: true } } } },
        copy: { select: { barcode: true, book: { select: { title: true } } } },
      },
    });

    logger.info('Book charge waived', { chargeId: charge.id, by: req.user.id, reason });
    res.json({ charge: shape(charge), message: 'Charge cancelled.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/library/charges/rental-run - the termly rental charge.
 *
 * A deliberate once-a-term act, not something that happens automatically when a
 * book is handed over: the school decides when the term's rental is due.
 *
 * Idempotent through the unique index on (loanId, type), so running it twice
 * cannot charge a student twice. dryRun returns exactly what would happen,
 * because this touches hundreds of students at once and the office should see
 * the number before it is real.
 */
export const runRentalCharges = async (req, res, next) => {
  try {
    const { dryRun } = req.body;

    const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    if (!term) return res.status(409).json({ error: 'No academic term is marked current, so there is nothing to charge for' });

    const academicYear = req.body.academicYear || term.academicYear;
    const termNumber = req.body.term ?? term.term;

    // Every live loan of a book that actually has a rental fee, that has not
    // already been charged rental.
    const loans = await prisma.bookLoan.findMany({
      where: {
        status: 'ACTIVE',
        academicYear,
        term: termNumber,
        charges: { none: { type: 'RENTAL' } },
        copy: { book: { rentalFee: { gt: 0 } } },
      },
      include: {
        copy: { include: { book: { select: { title: true, rentalFee: true } } } },
        student: { select: { id: true, name: true, studentProfile: { select: { formClass: true } } } },
      },
    });

    const total = loans.reduce((sum, l) => sum + Number(l.copy.book.rentalFee), 0);
    const students = new Set(loans.map((l) => l.studentId)).size;

    if (dryRun) {
      return res.json({
        dryRun: true,
        academicYear,
        term: termNumber,
        loans: loans.length,
        students,
        total,
        sample: loans.slice(0, 25).map((l) => ({
          student: l.student.name,
          formClass: l.student.studentProfile?.formClass ?? null,
          title: l.copy.book.title,
          amount: Number(l.copy.book.rentalFee),
        })),
      });
    }

    // createMany with skipDuplicates so a re-run, or two people pressing the
    // button at once, cannot double-charge: the unique index rejects the
    // duplicates and the rest still land.
    const result = await prisma.bookCharge.createMany({
      data: loans.map((l) => ({
        studentId: l.studentId,
        loanId: l.id,
        copyId: l.copyId,
        type: 'RENTAL',
        amount: l.copy.book.rentalFee,
        academicYear,
        term: termNumber,
        reason: `Book rental for ${l.copy.book.title}, term ${termNumber}.`,
        raisedById: req.user.id,
      })),
      skipDuplicates: true,
    });

    logger.info('Term rental charges raised', {
      academicYear, term: termNumber, created: result.count, by: req.user.id,
    });

    res.json({
      created: result.count,
      students,
      total,
      message: `Recorded ${result.count} rental charge${result.count === 1 ? '' : 's'} totalling ${total.toLocaleString('en-JM')} across ${students} student${students === 1 ? '' : 's'}.`,
    });
  } catch (error) {
    next(error);
  }
};

/** Minimal RFC 4180 quoting. */
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** GET /api/library/charges/export.csv - the list the bursary works from. */
export const exportChargesCsv = async (req, res, next) => {
  try {
    const where = req.query.status ? { status: req.query.status } : { status: 'OUTSTANDING' };
    const charges = await prisma.bookCharge.findMany({
      where,
      orderBy: [{ status: 'asc' }, { raisedAt: 'desc' }],
      include: {
        student: { select: { name: true, studentProfile: { select: { formClass: true, studentNumber: true } } } },
        copy: { select: { barcode: true, book: { select: { title: true } } } },
      },
    });

    const header = ['Student number', 'Student', 'Form class', 'What for', 'Book', 'Barcode', 'Amount', 'Currency', 'Raised', 'Status'];
    const lines = [header.join(',')];
    for (const c of charges) {
      lines.push([
        c.student.studentProfile?.studentNumber ?? '',
        c.student.name,
        c.student.studentProfile?.formClass ?? '',
        c.type,
        c.copy?.book?.title ?? '',
        c.copy?.barcode ?? '',
        Number(c.amount),
        c.currency,
        c.raisedAt.toISOString().slice(0, 10),
        c.status,
      ].map(csvCell).join(','));
    }

    const filename = `book-charges-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  } catch (error) {
    next(error);
  }
};

/** GET /api/library/terms and the small bits of term management. */
export const getTerms = async (req, res, next) => {
  try {
    const terms = await prisma.academicTerm.findMany({ orderBy: [{ academicYear: 'desc' }, { term: 'asc' }] });
    res.json({ terms });
  } catch (error) {
    next(error);
  }
};

export const setCurrentTerm = async (req, res, next) => {
  try {
    // One transaction: two current terms would mean the due date a student is
    // given depends on which row a query happened to return first. The partial
    // unique index enforces it, but clearing first keeps that from ever firing.
    const term = await prisma.$transaction(async (tx) => {
      await tx.academicTerm.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      return tx.academicTerm.update({ where: { id: req.params.id }, data: { isCurrent: true } });
    });
    res.json({ term, message: `Books issued from now on are due ${new Date(term.endsOn).toLocaleDateString('en-JM')}.` });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Term not found' });
    next(error);
  }
};
