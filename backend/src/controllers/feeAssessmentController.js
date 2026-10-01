import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { auditLog } from '../middleware/auditLog.js';
import {
  shapeAssessment, shapePayment, shapeVoucher,
  recomputeAssessment, money, toCents, balanceOf, termLabel,
} from '../services/feeBalances.js';

/**
 * Charging students, and what they still owe.
 *
 * An assessment is the moment a named student is told what a fee costs them.
 * The figures are copied off the schedule and frozen, so editing next year's
 * numbers never restates what a family was handed on paper.
 */

/** The student rows a charge run can reach. Confirmed students only. */
const studentInclude = {
  student: {
    select: {
      id: true, name: true, email: true,
      studentProfile: { select: { formClass: true, studentNumber: true, yearGroup: true } },
    },
  },
};

/** Copy the schedule onto the student. The snapshot. */
const snapshotFrom = (schedule, studentId, issuedById) => ({
  studentId,
  scheduleId: schedule.id,
  kind: schedule.kind,
  academicYear: schedule.academicYear,
  term: schedule.term,
  yearGroup: schedule.yearGroup,
  currency: schedule.currency,
  totalAmount: schedule.totalAmount,
  lines: schedule.items.map((i) => ({ label: i.label, amount: money(i.amount) })),
  issuedById,
});

/** POST /api/fees/assessments - charge one student. */
export const createAssessment = async (req, res, next) => {
  try {
    const { studentId, scheduleId } = req.body;
    if (!studentId || !scheduleId) return res.status(400).json({ error: 'Choose a student and a fee' });

    const schedule = await prisma.feeSchedule.findUnique({
      where: { id: scheduleId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!schedule) return res.status(404).json({ error: 'Fee not found' });
    if (!schedule.isPublished) {
      return res.status(409).json({ error: 'That fee is still a draft. Publish it before charging anyone.' });
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const assessment = await prisma.feeAssessment.create({
      data: snapshotFrom(schedule, studentId, req.user.id),
      include: { ...studentInclude, schedule: { select: { label: true } } },
    });

    await auditLog('create', 'FeeAssessment', assessment.id, req.user.id, req.user.email, {
      studentId, scheduleId, totalAmount: money(schedule.totalAmount),
    });

    res.status(201).json({
      assessment: shapeAssessment(assessment),
      message: `${student.name} has been charged ${money(schedule.totalAmount).toLocaleString('en-JM')} for ${schedule.label}.`,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'That student has already been charged this fee.' });
    }
    next(error);
  }
};

/**
 * POST /api/fees/assessments/run - charge a whole year group.
 *
 * Follows runRentalCharges: a dry run says exactly what would happen, and the
 * real run uses createMany with skipDuplicates so that re-running it, or two
 * people pressing the button at once, cannot charge anybody twice. The unique
 * index on (studentId, scheduleId) is what makes that true.
 */
export const runAssessments = async (req, res, next) => {
  try {
    const { scheduleId, formClass, studentIds, dryRun } = req.body;

    const schedule = await prisma.feeSchedule.findUnique({
      where: { id: scheduleId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!schedule) return res.status(404).json({ error: 'Fee not found' });
    if (!schedule.isPublished) {
      return res.status(409).json({ error: 'That fee is still a draft. Publish it before charging anyone.' });
    }

    // An incidental fee belongs to its grade; a school fee covers whatever the
    // office selects, because it is the same for both sixth form years.
    const yearGroup = req.body.yearGroup ?? schedule.yearGroup;

    const profileWhere = { verification: 'VERIFIED' };
    if (formClass) profileWhere.formClass = formClass;
    else if (yearGroup) profileWhere.yearGroup = Number(yearGroup);

    const where = {
      role: 'STUDENT',
      studentProfile: { is: profileWhere },
      // Anyone already charged this fee drops out of the run entirely, so the
      // preview count matches what actually happens.
      feeAssessments: { none: { scheduleId: schedule.id } },
    };
    if (Array.isArray(studentIds) && studentIds.length) where.id = { in: studentIds };

    const students = await prisma.user.findMany({
      where,
      select: { id: true, name: true, studentProfile: { select: { formClass: true, studentNumber: true } } },
      orderBy: { name: 'asc' },
    });

    const each = money(schedule.totalAmount);
    const total = toCents(each * students.length);

    if (dryRun) {
      return res.json({
        dryRun: true,
        schedule: { label: schedule.label, kind: schedule.kind, term: schedule.term, termLabel: termLabel(schedule.term) },
        students: students.length,
        each,
        total,
        sample: students.slice(0, 25).map((s) => ({
          name: s.name,
          formClass: s.studentProfile?.formClass ?? null,
          studentNumber: s.studentProfile?.studentNumber ?? null,
        })),
      });
    }

    if (students.length === 0) {
      return res.json({ created: 0, total: 0, message: 'Everyone in that group has already been charged this fee.' });
    }

    const result = await prisma.feeAssessment.createMany({
      data: students.map((s) => snapshotFrom(schedule, s.id, req.user.id)),
      skipDuplicates: true,
    });

    logger.info('Fee assessments raised', {
      scheduleId: schedule.id, created: result.count, by: req.user.id,
    });
    await auditLog('create', 'FeeAssessment', null, req.user.id, req.user.email, {
      via: 'bulk-run', scheduleId: schedule.id, created: result.count, total,
    });

    const termWord = schedule.term ? ` ${termLabel(schedule.term)} term` : '';
    res.json({
      created: result.count,
      each,
      total: toCents(each * result.count),
      message: `Charged ${result.count} student${result.count === 1 ? '' : 's'} ${each.toLocaleString('en-JM')} each for${termWord} ${schedule.label} — ${toCents(each * result.count).toLocaleString('en-JM')} in total.`,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/fees/assessments */
export const listAssessments = async (req, res, next) => {
  try {
    const { status, academicYear, term, kind, formClass, yearGroup, studentId, q } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));

    const where = {};
    if (status) where.status = status;
    if (academicYear) where.academicYear = academicYear;
    if (term) where.term = Number(term);
    if (kind) where.kind = kind;
    if (yearGroup) where.yearGroup = Number(yearGroup);
    if (studentId) where.studentId = studentId;
    if (formClass) where.student = { studentProfile: { is: { formClass } } };
    if (q) {
      where.student = {
        ...(where.student || {}),
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { studentProfile: { is: { studentNumber: { contains: q, mode: 'insensitive' } } } },
        ],
      };
    }

    const [assessments, totalCount, sums] = await Promise.all([
      prisma.feeAssessment.findMany({
        where,
        include: { ...studentInclude, schedule: { select: { label: true } } },
        orderBy: [{ status: 'asc' }, { issuedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feeAssessment.count({ where }),
      prisma.feeAssessment.aggregate({
        where,
        _sum: { totalAmount: true, paidAmount: true, waivedAmount: true },
      }),
    ]);

    const charged = toCents(money(sums._sum.totalAmount) || 0);
    const paid = toCents(money(sums._sum.paidAmount) || 0);
    const waived = toCents(money(sums._sum.waivedAmount) || 0);

    const owing = await prisma.feeAssessment.findMany({
      where: { ...where, status: 'OUTSTANDING' },
      select: { studentId: true },
      distinct: ['studentId'],
    });

    res.json({
      assessments: assessments.map(shapeAssessment),
      pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) },
      summary: {
        charged,
        paid,
        // Kept apart from `paid` all the way to the screen: rolled together,
        // a waiver reads as money received and someone goes looking for it.
        waived,
        outstanding: toCents(charged - paid - waived),
        studentsOwing: owing.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/fees/students/:studentId/ledger */
export const getStudentLedger = async (req, res, next) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.params.studentId },
      select: {
        id: true, name: true, email: true,
        studentProfile: { select: { formClass: true, yearGroup: true, studentNumber: true } },
      },
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const assessments = await prisma.feeAssessment.findMany({
      where: { studentId: student.id },
      include: {
        schedule: { select: { label: true } },
        payments: { include: { voucher: { select: { serial: true } } }, orderBy: { paidOn: 'desc' } },
        vouchers: { orderBy: { issuedAt: 'desc' } },
      },
      orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
    });

    const shaped = assessments.map(shapeAssessment);
    res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        formClass: student.studentProfile?.formClass ?? null,
        yearGroup: student.studentProfile?.yearGroup ?? null,
        studentNumber: student.studentProfile?.studentNumber ?? null,
      },
      assessments: shaped,
      totals: {
        charged: toCents(shaped.reduce((s, a) => s + a.totalAmount, 0)),
        paid: toCents(shaped.reduce((s, a) => s + a.paidAmount, 0)),
        waived: toCents(shaped.reduce((s, a) => s + a.waivedAmount, 0)),
        // A cancelled charge is not owed, so it must not be counted.
        balance: toCents(shaped.filter((a) => a.status !== 'CANCELLED').reduce((s, a) => s + a.balance, 0)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/fees/assessments/:id/waive */
export const waiveAssessment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Say why this fee is being written off' });

    const assessment = await prisma.feeAssessment.findUnique({ where: { id: req.params.id } });
    if (!assessment) return res.status(404).json({ error: 'Charge not found' });
    if (assessment.cancelledAt) return res.status(409).json({ error: 'That charge has been cancelled.' });

    // No amount means write off whatever is left.
    const outstanding = balanceOf(assessment);
    const amount = req.body.amount === undefined || req.body.amount === null
      ? outstanding
      : toCents(req.body.amount);

    if (amount <= 0) return res.status(400).json({ error: 'There is nothing left to write off on this charge' });
    if (amount > outstanding) {
      return res.status(400).json({
        error: `Only ${outstanding.toLocaleString('en-JM')} is outstanding, so ${amount.toLocaleString('en-JM')} cannot be written off.`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.feeAssessment.update({
        where: { id: assessment.id },
        data: {
          waivedAmount: toCents(money(assessment.waivedAmount) + amount),
          waivedAt: new Date(),
          waivedById: req.user.id,
          waiveReason: reason.trim(),
        },
      });
      return recomputeAssessment(tx, assessment.id);
    });

    logger.info('Fee waived', { id: assessment.id, amount, by: req.user.id });
    await auditLog('update', 'FeeAssessment', assessment.id, req.user.id, req.user.email, {
      action: 'waive', amount, reason: reason.trim(),
    });

    res.json({
      assessment: shapeAssessment(updated),
      message: `${amount.toLocaleString('en-JM')} written off. This is recorded against your name and cannot be undone here.`,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/fees/assessments/:id/cancel */
export const cancelAssessment = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Say why this charge is being cancelled' });

    const assessment = await prisma.feeAssessment.findUnique({
      where: { id: req.params.id },
      include: { payments: { where: { reversedAt: null } } },
    });
    if (!assessment) return res.status(404).json({ error: 'Charge not found' });

    // Cancelling a charge money has been paid against would leave that money
    // attached to something that no longer exists.
    if (assessment.payments.length > 0) {
      return res.status(409).json({
        error: 'Money has been paid against this charge. Reverse the payments first, then cancel it.',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.feeAssessment.update({
        where: { id: assessment.id },
        data: { cancelledAt: new Date(), cancelledById: req.user.id, cancelReason: reason.trim() },
      });
      return recomputeAssessment(tx, assessment.id);
    });

    await auditLog('update', 'FeeAssessment', assessment.id, req.user.id, req.user.email, {
      action: 'cancel', reason: reason.trim(),
    });

    res.json({ assessment: shapeAssessment(updated), message: 'Charge cancelled.' });
  } catch (error) {
    next(error);
  }
};

/** Minimal RFC 4180 quoting, as in libraryChargeController. */
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** GET /api/fees/assessments/export.csv - the list the office works from. */
export const exportAssessmentsCsv = async (req, res, next) => {
  try {
    const { status, academicYear, term, kind, formClass, yearGroup } = req.query;
    const where = {};
    if (status) where.status = status;
    if (academicYear) where.academicYear = academicYear;
    if (term) where.term = Number(term);
    if (kind) where.kind = kind;
    if (yearGroup) where.yearGroup = Number(yearGroup);
    if (formClass) where.student = { studentProfile: { is: { formClass } } };

    const assessments = await prisma.feeAssessment.findMany({
      where,
      include: {
        ...studentInclude,
        schedule: { select: { label: true } },
        vouchers: { orderBy: { issuedAt: 'desc' }, take: 1 },
        payments: { where: { reversedAt: null }, orderBy: { paidOn: 'desc' }, take: 1 },
      },
      orderBy: [{ student: { name: 'asc' } }],
    });

    const headers = [
      'Student number', 'Student', 'Form class', 'Fee', 'Kind', 'Year', 'Term',
      'Charged', 'Paid', 'Written off', 'Balance', 'Status', 'Last payment', 'Last voucher',
    ];

    const rows = assessments.map((a) => {
      const s = shapeAssessment(a);
      return [
        s.student?.studentNumber, s.student?.name, s.student?.formClass,
        a.schedule?.label, a.kind, a.academicYear, termLabel(a.term),
        s.totalAmount, s.paidAmount, s.waivedAmount, s.balance, s.status,
        a.payments[0]?.paidOn ? new Date(a.payments[0].paidOn).toISOString().slice(0, 10) : '',
        a.vouchers[0]?.serial ?? '',
      ].map(csvCell).join(',');
    });

    // BOM so Excel on the office machines reads it as UTF-8.
    const csv = `﻿${[headers.join(','), ...rows].join('\r\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="school-fees-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/** GET /api/fees/my - a student's own fees. Resolved from the token, no :id. */
export const getMyFees = async (req, res, next) => {
  try {
    const assessments = await prisma.feeAssessment.findMany({
      where: { studentId: req.user.id, cancelledAt: null },
      include: {
        schedule: { select: { label: true } },
        payments: { where: { reversedAt: null }, orderBy: { paidOn: 'desc' } },
      },
      orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
    });

    const shaped = assessments.map(shapeAssessment);
    res.json({
      fees: shaped.map((f) => ({ ...f, student: undefined })),
      totals: {
        charged: toCents(shaped.reduce((s, a) => s + a.totalAmount, 0)),
        paid: toCents(shaped.reduce((s, a) => s + a.paidAmount, 0)),
        waived: toCents(shaped.reduce((s, a) => s + a.waivedAmount, 0)),
        balance: toCents(shaped.reduce((s, a) => s + a.balance, 0)),
      },
      // The slip is the only way to pay, so the page has to say where.
      bank: { name: 'Bank of Nova Scotia', branch: "Brown's Town", account: '39-13' },
    });
  } catch (error) {
    next(error);
  }
};
