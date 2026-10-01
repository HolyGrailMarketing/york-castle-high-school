import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { auditLog } from '../middleware/auditLog.js';
import { shapeSchedule, toCents, money } from '../services/feeBalances.js';

/**
 * What the school charges.
 *
 * A schedule is the fee as printed on the slip: a heading, a list of lines, and
 * the total they add up to. The office enters this year's figures; nothing here
 * carries an amount of its own, because last year's numbers on a slip a parent
 * takes to a bank would be worse than no system at all.
 *
 * Editing a schedule that has already been assessed is allowed and deliberately
 * does NOT restate what those students were told - that is what the snapshot on
 * FeeAssessment is for. The response says how many are affected so the office
 * can see the edit applies from here on.
 */

const KINDS = ['INCIDENTAL', 'SCHOOL_FEE'];

/** The year to file a new schedule under, from the term the school is in. */
const currentAcademicYear = async () => {
  const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
  return term?.academicYear ?? null;
};

/**
 * Validate the shape of a schedule, including the rules that make its two
 * nullable columns mean something.
 */
const validateSchedule = ({ kind, academicYear, yearGroup, term, label, items }) => {
  if (!KINDS.includes(kind)) return 'Choose whether this is an incidental fee or a school fee';
  if (!academicYear?.trim()) return 'Choose the academic year';
  if (!label?.trim()) return 'Give the fee a name, as it should appear on the slip';

  if (kind === 'INCIDENTAL') {
    if (!yearGroup) return 'An incidental fee is set per grade, so choose a grade';
    if (term) return 'An incidental fee is charged once a year, not per term';
  } else {
    if (!term || ![1, 2, 3].includes(Number(term))) return 'A school fee is charged per term, so choose a term';
  }

  if (!Array.isArray(items) || items.length === 0) return 'Add at least one line to the fee';
  for (const item of items) {
    if (!item.label?.trim()) return 'Every line needs a name';
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount < 0) return `"${item.label}" needs an amount`;
  }
  const labels = items.map((i) => i.label.trim().toUpperCase());
  if (new Set(labels).size !== labels.length) {
    return 'Two lines have the same name. The slip lists them separately, so give them different names.';
  }
  return null;
};

/** GET /api/fees/schedules */
export const listSchedules = async (req, res, next) => {
  try {
    const { academicYear, kind, yearGroup, published } = req.query;
    const where = {};
    if (academicYear) where.academicYear = academicYear;
    if (kind) where.kind = kind;
    if (yearGroup) where.yearGroup = Number(yearGroup);
    if (published !== undefined) where.isPublished = published === 'true';

    const schedules = await prisma.feeSchedule.findMany({
      where,
      orderBy: [{ academicYear: 'desc' }, { kind: 'asc' }, { yearGroup: 'asc' }, { term: 'asc' }],
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { assessments: true } },
      },
    });

    res.json({
      schedules: schedules.map(shapeSchedule),
      currentAcademicYear: await currentAcademicYear(),
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/fees/schedules/:id */
export const getSchedule = async (req, res, next) => {
  try {
    const schedule = await prisma.feeSchedule.findUnique({
      where: { id: req.params.id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { assessments: true } },
      },
    });
    if (!schedule) return res.status(404).json({ error: 'Fee not found' });
    res.json({ schedule: shapeSchedule(schedule) });
  } catch (error) {
    next(error);
  }
};

/** POST /api/fees/schedules */
export const createSchedule = async (req, res, next) => {
  try {
    const academicYear = req.body.academicYear || (await currentAcademicYear());
    const payload = { ...req.body, academicYear };

    const problem = validateSchedule(payload);
    if (problem) return res.status(400).json({ error: problem });

    const { kind, yearGroup, term, label, items, notes, currency } = payload;
    // The total is always summed here. It is the figure printed on a slip a
    // parent takes to a bank, so it is never taken from the client.
    const totalAmount = toCents(items.reduce((sum, i) => sum + Number(i.amount), 0));

    const schedule = await prisma.feeSchedule.create({
      data: {
        kind,
        academicYear,
        yearGroup: kind === 'INCIDENTAL' ? Number(yearGroup) : null,
        term: kind === 'SCHOOL_FEE' ? Number(term) : null,
        label: label.trim(),
        currency: currency || 'JMD',
        totalAmount,
        notes: notes?.trim() || null,
        items: {
          create: items.map((i, index) => ({
            label: i.label.trim(),
            amount: toCents(i.amount),
            sortOrder: i.sortOrder ?? index,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await auditLog('create', 'FeeSchedule', schedule.id, req.user.id, req.user.email, {
      kind, academicYear, yearGroup, term, totalAmount,
    });

    res.status(201).json({
      schedule: shapeSchedule(schedule),
      message: `${label.trim()} saved, totalling ${totalAmount.toLocaleString('en-JM')}. Publish it when the figures are final.`,
    });
  } catch (error) {
    if (error.code === 'P2002' || error.message?.includes('FeeSchedule_identity')) {
      return res.status(409).json({
        error: 'That fee already exists for this year. Edit the existing one instead of creating a second.',
      });
    }
    next(error);
  }
};

/**
 * PUT /api/fees/schedules/:id
 *
 * Items are replaced wholesale rather than patched. The office edits this as a
 * list on screen, and reconciling adds, edits, removals and reorders one by one
 * is a great deal of code for a table that is never more than a dozen rows.
 */
export const updateSchedule = async (req, res, next) => {
  try {
    const existing = await prisma.feeSchedule.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { assessments: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Fee not found' });

    const payload = {
      kind: req.body.kind ?? existing.kind,
      academicYear: req.body.academicYear ?? existing.academicYear,
      yearGroup: req.body.yearGroup ?? existing.yearGroup,
      term: req.body.term ?? existing.term,
      label: req.body.label ?? existing.label,
      items: req.body.items,
    };
    const problem = validateSchedule(payload);
    if (problem) return res.status(400).json({ error: problem });

    const totalAmount = toCents(payload.items.reduce((sum, i) => sum + Number(i.amount), 0));

    const schedule = await prisma.$transaction(async (tx) => {
      await tx.feeScheduleItem.deleteMany({ where: { scheduleId: existing.id } });
      return tx.feeSchedule.update({
        where: { id: existing.id },
        data: {
          kind: payload.kind,
          academicYear: payload.academicYear,
          yearGroup: payload.kind === 'INCIDENTAL' ? Number(payload.yearGroup) : null,
          term: payload.kind === 'SCHOOL_FEE' ? Number(payload.term) : null,
          label: payload.label.trim(),
          totalAmount,
          notes: req.body.notes?.trim() ?? existing.notes,
          items: {
            create: payload.items.map((i, index) => ({
              label: i.label.trim(),
              amount: toCents(i.amount),
              sortOrder: i.sortOrder ?? index,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    await auditLog('update', 'FeeSchedule', schedule.id, req.user.id, req.user.email, {
      totalAmount, previousTotal: money(existing.totalAmount),
    });

    const alreadyIssued = existing._count.assessments;
    res.json({
      schedule: shapeSchedule(schedule),
      // Say this out loud. The snapshot behaviour is correct but surprising,
      // and an office that expects an edit to fix slips already handed out will
      // otherwise discover it from a parent.
      affectedFutureIssues: alreadyIssued,
      message: alreadyIssued
        ? `Saved. ${alreadyIssued} student${alreadyIssued === 1 ? ' has' : 's have'} already been charged the old amount and ${alreadyIssued === 1 ? 'keeps' : 'keep'} it — this applies to anyone charged from now on.`
        : 'Saved.',
    });
  } catch (error) {
    if (error.code === 'P2002' || error.message?.includes('FeeSchedule_identity')) {
      return res.status(409).json({ error: 'Another fee of this kind already exists for that year and term.' });
    }
    next(error);
  }
};

/** POST /api/fees/schedules/:id/publish  |  /unpublish */
export const setSchedulePublished = (isPublished) => async (req, res, next) => {
  try {
    const schedule = await prisma.feeSchedule.findUnique({
      where: { id: req.params.id },
      include: { items: true, _count: { select: { assessments: true } } },
    });
    if (!schedule) return res.status(404).json({ error: 'Fee not found' });

    if (isPublished && schedule.items.length === 0) {
      return res.status(400).json({ error: 'Add at least one line before publishing this fee' });
    }
    if (!isPublished && schedule._count.assessments > 0) {
      return res.status(409).json({
        error: 'Students have already been charged this fee, so it cannot be unpublished. Edit it instead.',
      });
    }

    const updated = await prisma.feeSchedule.update({
      where: { id: schedule.id },
      data: { isPublished },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    logger.info('Fee schedule publication changed', { id: schedule.id, isPublished, by: req.user.id });
    await auditLog('update', 'FeeSchedule', schedule.id, req.user.id, req.user.email, { isPublished });

    res.json({
      schedule: shapeSchedule(updated),
      message: isPublished
        ? `${updated.label} is published. You can now charge students for it.`
        : `${updated.label} is back to draft and cannot be charged.`,
    });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/fees/schedules/:id */
export const deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await prisma.feeSchedule.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { assessments: true } } },
    });
    if (!schedule) return res.status(404).json({ error: 'Fee not found' });

    if (schedule._count.assessments > 0) {
      return res.status(409).json({
        error: `${schedule._count.assessments} student${schedule._count.assessments === 1 ? ' has' : 's have'} been charged this fee, so it cannot be deleted. Unpublish it if it should not be used again.`,
      });
    }

    await prisma.feeSchedule.delete({ where: { id: schedule.id } });
    await auditLog('delete', 'FeeSchedule', schedule.id, req.user.id, req.user.email, { label: schedule.label });

    res.json({ message: `${schedule.label} deleted.` });
  } catch (error) {
    next(error);
  }
};

/** GET /api/fees/serial  |  PUT /api/fees/serial - the voucher numbering. */
export const getSerialCounter = async (req, res, next) => {
  try {
    const counter = await prisma.feeSerialCounter.findUnique({ where: { id: 'voucher' } });
    res.json({ counter: counter ?? { id: 'voucher', prefix: '', nextValue: 50000 } });
  } catch (error) {
    next(error);
  }
};

export const updateSerialCounter = async (req, res, next) => {
  try {
    const nextValue = Number(req.body.nextValue);
    if (!Number.isInteger(nextValue) || nextValue < 1) {
      return res.status(400).json({ error: 'The next voucher number must be a whole number above zero' });
    }

    const highest = await prisma.feeVoucher.aggregate({ _max: { serial: true } });
    if (highest._max.serial && nextValue <= highest._max.serial) {
      return res.status(409).json({
        error: `Voucher ${highest._max.serial} has already been issued. Choose a number above it so two slips cannot share one.`,
      });
    }

    const counter = await prisma.feeSerialCounter.upsert({
      where: { id: 'voucher' },
      create: { id: 'voucher', prefix: req.body.prefix ?? '', nextValue },
      update: { nextValue, ...(req.body.prefix !== undefined ? { prefix: req.body.prefix } : {}) },
    });

    await auditLog('update', 'FeeSerialCounter', 'voucher', req.user.id, req.user.email, { nextValue });
    res.json({ counter, message: `The next voucher printed will be number ${nextValue}.` });
  } catch (error) {
    next(error);
  }
};
