import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { auditLog } from '../middleware/auditLog.js';
import {
  shapePayment, shapeAssessment, recomputeAssessment,
  money, toCents, balanceOf, termLabel,
} from '../services/feeBalances.js';

/**
 * Recording the stamped slips that come back.
 *
 * The school never takes this money - the bank does. What arrives at the office
 * is a SCHOOL'S COPY with the bank's stamp on it, and recording it here is what
 * turns "charged" into "paid". The date on the stamp and the date the office
 * keyed it in are both kept: the bank reconciles on the first, and the office
 * answers "when did you record mine?" with the second.
 */

const METHODS = ['CASH', 'CERTIFIED_CHEQUE'];

const paymentInclude = {
  voucher: { select: { serial: true } },
  assessment: {
    include: {
      student: {
        select: {
          id: true, name: true,
          studentProfile: { select: { formClass: true, studentNumber: true } },
        },
      },
    },
  },
};

/** POST /api/fees/payments */
export const recordPayment = async (req, res, next) => {
  try {
    const { assessmentId, voucherId, amount, paidOn, method, bankReference, paidInBy, slipSeen, opId } = req.body;

    if (!assessmentId) return res.status(400).json({ error: 'Choose the charge this slip is for' });
    if (!METHODS.includes(method)) {
      return res.status(400).json({ error: 'The slip says cash or certified cheque only' });
    }
    const value = toCents(amount);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'Enter the amount written on the slip' });
    }
    if (!paidOn) return res.status(400).json({ error: "Enter the date on the bank's stamp" });

    const paidOnDate = new Date(paidOn);
    if (Number.isNaN(paidOnDate.getTime())) return res.status(400).json({ error: 'That is not a date' });
    // A stamp cannot be dated in the future. Usually a typo in the year.
    if (paidOnDate > new Date(Date.now() + 86400000)) {
      return res.status(400).json({ error: "The date on the stamp cannot be in the future. Check the year." });
    }

    const assessment = await prisma.feeAssessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return res.status(404).json({ error: 'Charge not found' });
    if (assessment.cancelledAt) {
      return res.status(409).json({ error: 'That charge was cancelled. Reinstate it before recording a payment.' });
    }

    // A replayed form submission must not record the money twice.
    if (opId) {
      const already = await prisma.feePayment.findUnique({ where: { opId }, include: paymentInclude });
      if (already) return res.json({ payment: shapePayment(already), duplicate: true });
    }

    const outstandingBefore = balanceOf(assessment);

    const { payment, updated } = await prisma.$transaction(async (tx) => {
      const created = await tx.feePayment.create({
        data: {
          assessmentId,
          voucherId: voucherId || null,
          amount: value,
          currency: assessment.currency,
          method,
          paidOn: paidOnDate,
          recordedById: req.user.id,
          bankReference: bankReference?.trim() || null,
          paidInBy: paidInBy?.trim() || null,
          slipSeen: slipSeen === undefined ? true : Boolean(slipSeen),
          opId: opId || null,
        },
        include: paymentInclude,
      });
      return { payment: created, updated: await recomputeAssessment(tx, assessmentId) };
    });

    logger.info('Fee payment recorded', { assessmentId, amount: value, by: req.user.id });
    await auditLog('create', 'FeePayment', payment.id, req.user.id, req.user.email, {
      assessmentId, amount: value, method, paidOn: paidOnDate.toISOString(),
    });

    const balanceAfter = balanceOf(updated);
    res.status(201).json({
      payment: shapePayment(payment),
      assessment: shapeAssessment(updated),
      // The school holds none of this money, so there is nothing to refund an
      // overpayment from. Say so at the moment it happens rather than leaving a
      // negative balance for someone to find later.
      overpaid: balanceAfter < 0,
      message: balanceAfter < 0
        ? `Recorded. That is ${Math.abs(balanceAfter).toLocaleString('en-JM')} more than was owed — the school does not hold this money, so send the parent to the bursary about the difference.`
        : balanceAfter === 0
          ? 'Recorded. This charge is now paid in full.'
          : `Recorded. ${balanceAfter.toLocaleString('en-JM')} still outstanding of ${outstandingBefore.toLocaleString('en-JM')}.`,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'That payment has already been recorded.' });
    }
    next(error);
  }
};

/** POST /api/fees/payments/:id/reverse */
export const reversePayment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Say why this payment is being reversed' });

    const payment = await prisma.feePayment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.reversedAt) return res.status(409).json({ error: 'That payment has already been reversed.' });

    const { reversed, updated } = await prisma.$transaction(async (tx) => {
      // Never deleted: the slip existed and the record of it has to survive.
      const r = await tx.feePayment.update({
        where: { id: payment.id },
        data: { reversedAt: new Date(), reversedById: req.user.id, reverseReason: reason.trim() },
        include: paymentInclude,
      });
      return { reversed: r, updated: await recomputeAssessment(tx, payment.assessmentId) };
    });

    logger.info('Fee payment reversed', { id: payment.id, by: req.user.id });
    await auditLog('update', 'FeePayment', payment.id, req.user.id, req.user.email, {
      action: 'reverse', amount: money(payment.amount), reason: reason.trim(),
    });

    res.json({
      payment: shapePayment(reversed),
      assessment: shapeAssessment(updated),
      message: `${money(payment.amount).toLocaleString('en-JM')} reversed. The payment stays on the record with your reason.`,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/fees/payments */
export const listPayments = async (req, res, next) => {
  try {
    const { from, to, method, assessmentId, studentId, includeReversed } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));

    const where = {};
    if (method) where.method = method;
    if (assessmentId) where.assessmentId = assessmentId;
    if (studentId) where.assessment = { studentId };
    if (includeReversed !== 'true') where.reversedAt = null;
    if (from || to) {
      where.paidOn = {};
      if (from) where.paidOn.gte = new Date(from);
      if (to) where.paidOn.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const [payments, total, sum] = await Promise.all([
      prisma.feePayment.findMany({
        where, include: paymentInclude,
        orderBy: [{ paidOn: 'desc' }, { recordedAt: 'desc' }],
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.feePayment.count({ where }),
      prisma.feePayment.aggregate({ where: { ...where, reversedAt: null }, _sum: { amount: true } }),
    ]);

    res.json({
      payments: payments.map(shapePayment),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary: { received: toCents(money(sum._sum.amount) || 0), count: total },
    });
  } catch (error) {
    next(error);
  }
};

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * GET /api/fees/payments/export.csv
 *
 * What the office checks against the bank statement: one row per slip, dated by
 * the bank's stamp.
 */
export const exportPaymentsCsv = async (req, res, next) => {
  try {
    const { from, to, method } = req.query;
    const where = { reversedAt: null };
    if (method) where.method = method;
    if (from || to) {
      where.paidOn = {};
      if (from) where.paidOn.gte = new Date(from);
      if (to) where.paidOn.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const payments = await prisma.feePayment.findMany({
      where, include: paymentInclude, orderBy: { paidOn: 'asc' },
    });

    const headers = [
      'Paid on', 'Student number', 'Student', 'Form class', 'Fee', 'Term',
      'Amount', 'Method', 'Voucher', 'Bank reference', 'Paid in by', 'Recorded on',
    ];
    const rows = payments.map((p) => [
      new Date(p.paidOn).toISOString().slice(0, 10),
      p.assessment?.student?.studentProfile?.studentNumber,
      p.assessment?.student?.name,
      p.assessment?.student?.studentProfile?.formClass,
      p.assessment?.kind,
      termLabel(p.assessment?.term),
      money(p.amount),
      p.method,
      p.voucher?.serial ?? '',
      p.bankReference,
      p.paidInBy,
      new Date(p.recordedAt).toISOString().slice(0, 10),
    ].map(csvCell).join(','));

    const csv = `﻿${[headers.join(','), ...rows].join('\r\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fee-payments-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
