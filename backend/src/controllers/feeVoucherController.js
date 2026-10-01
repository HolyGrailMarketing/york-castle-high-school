import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { auditLog } from '../middleware/auditLog.js';
import { shapeVoucher, money, toCents, balanceOf, termLabel } from '../services/feeBalances.js';

/**
 * The paying-in vouchers.
 *
 * A voucher is the three-part slip the student takes to the bank: BANK'S COPY,
 * SCHOOL'S COPY, STUDENT'S COPY. The school prints it, the bank stamps it, and
 * the stamped school's copy comes back as the proof of payment.
 *
 * The serial is the number printed on the slip, and it has to be unique across
 * everything the bank will ever see - including the pre-printed paper books the
 * school already uses. It is allocated from FeeSerialCounter inside the issuing
 * transaction, exactly as BarcodeCounter allocates copy barcodes, because
 * MAX(serial)+1 races and two slips sharing a number is unrecoverable.
 */

const BANK = { name: 'Bank of Nova Scotia', branch: "Brown's Town", account: '39-13' };

/**
 * Everything the printed slip needs. The server owns every number on it; the
 * client only decides how it is laid out on the page.
 */
const printPayload = (voucher, assessment) => ({
  id: voucher.id,
  serial: voucher.serial,
  amountShown: money(voucher.amountShown),
  issuedAt: voucher.issuedAt,
  printedCount: voucher.printedCount,
  kind: assessment.kind,
  label: assessment.schedule?.label ?? null,
  academicYear: assessment.academicYear,
  term: assessment.term,
  termLabel: termLabel(assessment.term),
  currency: assessment.currency,
  lines: Array.isArray(assessment.lines) ? assessment.lines : [],
  total: money(assessment.totalAmount),
  alreadyPaid: money(assessment.paidAmount),
  balance: balanceOf(assessment),
  student: {
    id: assessment.student?.id,
    name: assessment.student?.name ?? '',
    formClass: assessment.student?.studentProfile?.formClass ?? null,
    studentNumber: assessment.student?.studentProfile?.studentNumber ?? null,
  },
  bank: BANK,
});

const assessmentForPrint = {
  schedule: { select: { label: true } },
  student: {
    select: {
      id: true, name: true,
      studentProfile: { select: { formClass: true, studentNumber: true } },
    },
  },
};

/**
 * Take `count` serials in one write.
 *
 * One update, not one per voucher: `increment` is atomic, so the block that
 * comes back is ours alone even if another admin is printing at the same
 * moment. The returned nextValue is the number *after* the block, so the block
 * runs backwards from it.
 */
const allocateSerials = async (tx, count) => {
  const counter = await tx.feeSerialCounter.upsert({
    where: { id: 'voucher' },
    create: { id: 'voucher', nextValue: 50000 + count },
    update: { nextValue: { increment: count } },
  });
  const after = counter.nextValue;
  const first = after - count;
  return Array.from({ length: count }, (_, i) => first + i);
};

/** POST /api/fees/assessments/:id/vouchers */
export const issueVoucher = async (req, res, next) => {
  try {
    const assessment = await prisma.feeAssessment.findUnique({
      where: { id: req.params.id },
      include: assessmentForPrint,
    });
    if (!assessment) return res.status(404).json({ error: 'Charge not found' });
    if (assessment.cancelledAt) {
      return res.status(409).json({ error: 'That charge has been cancelled, so no slip can be printed for it.' });
    }

    const amountShown = req.body.amountShown === undefined || req.body.amountShown === null || req.body.amountShown === ''
      ? null
      : toCents(req.body.amountShown);

    const voucher = await prisma.$transaction(async (tx) => {
      const [serial] = await allocateSerials(tx, 1);
      return tx.feeVoucher.create({
        data: { serial, assessmentId: assessment.id, amountShown, issuedById: req.user.id },
      });
    });

    await auditLog('create', 'FeeVoucher', voucher.id, req.user.id, req.user.email, {
      serial: voucher.serial, assessmentId: assessment.id,
    });

    res.status(201).json({
      voucher: printPayload(voucher, assessment),
      message: `Voucher ${voucher.serial} ready to print.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/fees/vouchers/bulk
 *
 * A print run for a whole form class. Allocates the serials as one contiguous
 * block so the slips come off the printer in order and the office can file them
 * by number.
 */
export const bulkIssueVouchers = async (req, res, next) => {
  try {
    const { assessmentIds, scheduleId, formClass, dryRun } = req.body;

    const where = { cancelledAt: null };
    if (Array.isArray(assessmentIds) && assessmentIds.length) {
      where.id = { in: assessmentIds };
    } else if (scheduleId) {
      where.scheduleId = scheduleId;
      if (formClass) where.student = { studentProfile: { is: { formClass } } };
    } else {
      return res.status(400).json({ error: 'Choose a fee, or select the students to print for' });
    }

    // Nothing is owed on a settled charge, so printing a slip for it would only
    // invite a second payment.
    where.status = { in: ['OUTSTANDING'] };

    const assessments = await prisma.feeAssessment.findMany({
      where,
      include: assessmentForPrint,
      orderBy: [{ student: { name: 'asc' } }],
    });

    if (dryRun) {
      return res.json({
        dryRun: true,
        willPrint: assessments.length,
        sample: assessments.slice(0, 25).map((a) => ({
          name: a.student?.name,
          formClass: a.student?.studentProfile?.formClass ?? null,
          balance: balanceOf(a),
        })),
      });
    }

    if (assessments.length === 0) {
      return res.json({ vouchers: [], message: 'Nothing outstanding to print a slip for.' });
    }

    const amountShown = req.body.amountShown === undefined || req.body.amountShown === null || req.body.amountShown === ''
      ? null
      : toCents(req.body.amountShown);

    const created = await prisma.$transaction(async (tx) => {
      const serials = await allocateSerials(tx, assessments.length);
      const rows = [];
      for (let i = 0; i < assessments.length; i += 1) {
        rows.push(await tx.feeVoucher.create({
          data: {
            serial: serials[i],
            assessmentId: assessments[i].id,
            amountShown,
            issuedById: req.user.id,
          },
        }));
      }
      return rows;
    });

    logger.info('Fee vouchers issued', { count: created.length, by: req.user.id });
    await auditLog('create', 'FeeVoucher', null, req.user.id, req.user.email, {
      via: 'bulk', count: created.length,
      from: created[0]?.serial, to: created[created.length - 1]?.serial,
    });

    res.status(201).json({
      vouchers: created.map((v, i) => printPayload(v, assessments[i])),
      message: `${created.length} voucher${created.length === 1 ? '' : 's'} ready to print, numbered ${created[0].serial} to ${created[created.length - 1].serial}.`,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/fees/vouchers/:id - reprint. No side effects. */
export const getVoucher = async (req, res, next) => {
  try {
    const voucher = await prisma.feeVoucher.findUnique({
      where: { id: req.params.id },
      include: { assessment: { include: assessmentForPrint } },
    });
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    res.json({ voucher: printPayload(voucher, voucher.assessment) });
  } catch (error) {
    next(error);
  }
};

/** POST /api/fees/vouchers/:id/printed */
export const markVoucherPrinted = async (req, res, next) => {
  try {
    const voucher = await prisma.feeVoucher.update({
      where: { id: req.params.id },
      data: { printedCount: { increment: 1 }, lastPrintedAt: new Date() },
    });
    res.json({ voucher: shapeVoucher(voucher) });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Voucher not found' });
    next(error);
  }
};

/** POST /api/fees/vouchers/:id/void */
export const voidVoucher = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Say why this slip is being voided' });

    const voucher = await prisma.feeVoucher.findUnique({
      where: { id: req.params.id },
      include: { payments: { where: { reversedAt: null } } },
    });
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.payments.length > 0) {
      return res.status(409).json({ error: 'A payment has been recorded against this slip, so it cannot be voided.' });
    }

    const updated = await prisma.feeVoucher.update({
      where: { id: voucher.id },
      data: { voidedAt: new Date(), voidedById: req.user.id, voidReason: reason.trim() },
    });

    await auditLog('update', 'FeeVoucher', voucher.id, req.user.id, req.user.email, {
      action: 'void', serial: voucher.serial, reason: reason.trim(),
    });

    res.json({
      voucher: shapeVoucher(updated),
      // The number is deliberately not reused: a voided slip may already be in
      // someone's hand, and the bank must never see two of the same number.
      message: `Voucher ${voucher.serial} voided. That number will not be used again.`,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/fees/vouchers */
export const listVouchers = async (req, res, next) => {
  try {
    const { assessmentId, from, to } = req.query;
    const where = {};
    if (assessmentId) where.assessmentId = assessmentId;
    if (from || to) {
      where.issuedAt = {};
      if (from) where.issuedAt.gte = new Date(from);
      if (to) where.issuedAt.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const vouchers = await prisma.feeVoucher.findMany({
      where,
      include: { assessment: { include: assessmentForPrint } },
      orderBy: { serial: 'desc' },
      take: 500,
    });

    res.json({ vouchers: vouchers.map((v) => printPayload(v, v.assessment)) });
  } catch (error) {
    next(error);
  }
};
