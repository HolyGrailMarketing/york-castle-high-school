import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { auditLog } from '../middleware/auditLog.js';
import { money, toCents, balanceOf, termLabel } from '../services/feeBalances.js';
import { normaliseFormClass, formClassMatchesYear } from '../services/schoolClasses.js';

/**
 * The sixth form cohort, as one record per student.
 *
 * Everything the office knows about a sixth former already exists somewhere:
 * the application they submitted, the interview that was scored, the faculty
 * they were placed in, the fees they have been charged, the textbooks they are
 * holding. It was spread across five screens, so answering "where is this
 * student up to" meant opening five of them and remembering the answers.
 *
 * This assembles it. The unit is the student, not the application - which is
 * the whole difference between the admissions screen and this one.
 *
 * Deliberately NOT attendance, grades or report cards. Those belong to the
 * ministry's system, which the school is already required to keep current, and
 * a second copy here would be a second answer to a question that is audited.
 */

const SIXTH_FORM_YEARS = [12, 13];

/** The faculties the school places sixth formers into. */
export const FACULTIES = ['Business', 'Humanities', 'Science', 'Technical'];

const profileSelect = {
  id: true,
  studentNumber: true,
  yearGroup: true,
  formClass: true,
  guardianName: true,
  guardianPhone: true,
  guardianEmail: true,
  verification: true,
  verifiedAt: true,
  loanCap: true,
  notes: true,
};

/**
 * One row in the cohort list.
 *
 * The three figures that decide whether the office needs to do something -
 * what they owe, how many books they are holding, how many are overdue - are
 * computed here rather than being left for the page to total up, so the list
 * can be sorted and filtered on them.
 */
const shapeStudent = (user, { feeTotals, loanCounts, application }) => ({
  id: user.id,
  name: user.name,
  email: user.email?.endsWith('@no-email.invalid') ? null : user.email,
  phone: user.phone ?? null,
  profile: user.studentProfile
    ? {
        ...user.studentProfile,
        loanCap: user.studentProfile.loanCap,
      }
    : null,
  formClass: user.studentProfile?.formClass ?? null,
  yearGroup: user.studentProfile?.yearGroup ?? null,
  studentNumber: user.studentProfile?.studentNumber ?? null,
  guardianName: user.studentProfile?.guardianName ?? null,
  guardianPhone: user.studentProfile?.guardianPhone ?? null,
  verification: user.studentProfile?.verification ?? null,
  faculty: application?.faculty ?? null,
  applicationId: application?.id ?? null,
  interviewDecision: application?.interview?.decision ?? null,
  enrolledAt: application?.enrolledAt ?? null,
  fees: feeTotals,
  books: loanCounts,
});

/**
 * GET /api/sixth-form/students
 *
 * The cohort. Filters: yearGroup, formClass, faculty, q, and `owing` for the
 * chase-up list.
 */
export const listSixthFormStudents = async (req, res, next) => {
  try {
    const { yearGroup, formClass, faculty, q, owing } = req.query;

    const profileWhere = {
      yearGroup: yearGroup ? Number(yearGroup) : { in: SIXTH_FORM_YEARS },
    };
    if (formClass) profileWhere.formClass = formClass;

    const where = { role: 'STUDENT', studentProfile: { is: profileWhere } };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { studentProfile: { is: { studentNumber: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true,
        studentProfile: { select: profileSelect },
      },
      orderBy: { name: 'asc' },
    });

    if (users.length === 0) {
      return res.json({ students: [], total: 0, summary: emptySummary(), faculties: FACULTIES });
    }

    const ids = users.map((u) => u.id);

    // Three grouped queries rather than a join per student: the cohort is a few
    // hundred rows and this keeps it to four round trips however large it gets.
    const [applications, feeRows, activeLoans, bookCharges] = await Promise.all([
      prisma.sixthFormApplication.findMany({
        where: { enrolledUserId: { in: ids } },
        select: { id: true, faculty: true, enrolledAt: true, enrolledUserId: true,
                  interview: { select: { decision: true } } },
      }),
      prisma.feeAssessment.findMany({
        where: { studentId: { in: ids }, cancelledAt: null },
        select: { studentId: true, totalAmount: true, paidAmount: true, waivedAmount: true, status: true },
      }),
      prisma.bookLoan.findMany({
        where: { studentId: { in: ids }, status: 'ACTIVE' },
        select: { studentId: true, dueAt: true },
      }),
      prisma.bookCharge.findMany({
        where: { studentId: { in: ids }, status: 'OUTSTANDING' },
        select: { studentId: true, amount: true },
      }),
    ]);

    const appByUser = new Map(applications.map((a) => [a.enrolledUserId, a]));

    const feeByUser = new Map();
    for (const f of feeRows) {
      const t = feeByUser.get(f.studentId) || { charged: 0, paid: 0, waived: 0, balance: 0, unpaidCount: 0 };
      t.charged = toCents(t.charged + money(f.totalAmount));
      t.paid = toCents(t.paid + money(f.paidAmount));
      t.waived = toCents(t.waived + money(f.waivedAmount));
      t.balance = toCents(t.balance + balanceOf(f));
      if (f.status === 'OUTSTANDING') t.unpaidCount += 1;
      feeByUser.set(f.studentId, t);
    }

    const now = new Date();
    const loanByUser = new Map();
    for (const l of activeLoans) {
      const t = loanByUser.get(l.studentId) || { out: 0, overdue: 0, owes: 0 };
      t.out += 1;
      if (l.dueAt < now) t.overdue += 1;
      loanByUser.set(l.studentId, t);
    }
    for (const c of bookCharges) {
      const t = loanByUser.get(c.studentId) || { out: 0, overdue: 0, owes: 0 };
      t.owes = toCents(t.owes + money(c.amount));
      loanByUser.set(c.studentId, t);
    }

    let students = users.map((u) => shapeStudent(u, {
      feeTotals: feeByUser.get(u.id) || { charged: 0, paid: 0, waived: 0, balance: 0, unpaidCount: 0 },
      loanCounts: loanByUser.get(u.id) || { out: 0, overdue: 0, owes: 0 },
      application: appByUser.get(u.id),
    }));

    if (faculty) students = students.filter((s) => s.faculty === faculty);
    if (owing === 'true') students = students.filter((s) => s.fees.balance > 0);

    res.json({
      students,
      total: students.length,
      summary: summarise(students),
      faculties: FACULTIES,
    });
  } catch (error) {
    next(error);
  }
};

const emptySummary = () => ({
  students: 0, owing: 0, outstanding: 0, booksOut: 0, overdue: 0, unplaced: 0, unverified: 0,
});

/** What the office needs to see at a glance, above the list. */
const summarise = (students) => ({
  students: students.length,
  owing: students.filter((s) => s.fees.balance > 0).length,
  outstanding: toCents(students.reduce((sum, s) => sum + Math.max(0, s.fees.balance), 0)),
  booksOut: students.reduce((sum, s) => sum + s.books.out, 0),
  overdue: students.reduce((sum, s) => sum + s.books.overdue, 0),
  // A sixth former with no faculty has not been placed, which is a loose end
  // rather than a normal state once term has started.
  unplaced: students.filter((s) => !s.faculty).length,
  unverified: students.filter((s) => s.verification !== 'VERIFIED').length,
});

/**
 * GET /api/sixth-form/students/:userId
 *
 * One student, in full: who they are, what they applied with, how the interview
 * went, what they owe and what they are holding.
 */
export const getSixthFormStudent = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, createdAt: true,
        studentProfile: { select: profileSelect },
      },
    });
    if (!user) return res.status(404).json({ error: 'Student not found' });

    const [application, assessments, loans, charges] = await Promise.all([
      prisma.sixthFormApplication.findFirst({
        where: { OR: [{ enrolledUserId: userId }, { userId }] },
        include: { interview: true, notifications: { orderBy: { sentAt: 'desc' } } },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.feeAssessment.findMany({
        where: { studentId: userId },
        include: {
          schedule: { select: { label: true } },
          payments: { include: { voucher: { select: { serial: true } } }, orderBy: { paidOn: 'desc' } },
          vouchers: { orderBy: { issuedAt: 'desc' } },
        },
        orderBy: [{ academicYear: 'desc' }, { term: 'asc' }],
      }),
      prisma.bookLoan.findMany({
        where: { studentId: userId },
        include: { copy: { include: { book: { select: { title: true, subject: true } } } } },
        orderBy: { issuedAt: 'desc' },
        take: 50,
      }),
      prisma.bookCharge.findMany({
        where: { studentId: userId },
        orderBy: { raisedAt: 'desc' },
      }),
    ]);

    const now = new Date();
    res.json({
      student: {
        id: user.id,
        name: user.name,
        email: user.email?.endsWith('@no-email.invalid') ? null : user.email,
        phone: user.phone,
        joinedAt: user.createdAt,
        profile: user.studentProfile,
        faculty: application?.faculty ?? null,
      },
      application: application
        ? {
            id: application.id,
            status: application.status,
            faculty: application.faculty,
            submittedAt: application.submittedAt,
            enrolledAt: application.enrolledAt,
            previousSchool: application.previousSchool,
            csecResults: application.csecResults,
            subjectChoices: application.subjectChoices,
            careerGoals: application.careerGoals,
            guardianInfo: application.guardianInfo,
            notes: application.notes,
            notifications: application.notifications?.map((n) => ({
              type: n.type, subject: n.subject, sentAt: n.sentAt,
            })),
          }
        : null,
      interview: application?.interview ?? null,
      fees: {
        assessments: assessments.map((a) => ({
          id: a.id,
          label: a.schedule?.label ?? null,
          kind: a.kind,
          academicYear: a.academicYear,
          term: a.term,
          termLabel: termLabel(a.term),
          totalAmount: money(a.totalAmount),
          paidAmount: money(a.paidAmount),
          waivedAmount: money(a.waivedAmount),
          balance: balanceOf(a),
          status: a.status,
          lines: Array.isArray(a.lines) ? a.lines : [],
          payments: a.payments.map((p) => ({
            id: p.id, amount: money(p.amount), method: p.method, paidOn: p.paidOn,
            voucherSerial: p.voucher?.serial ?? null, reversedAt: p.reversedAt,
          })),
          vouchers: a.vouchers.map((v) => ({ id: v.id, serial: v.serial, issuedAt: v.issuedAt })),
        })),
        totals: {
          charged: toCents(assessments.reduce((s, a) => s + money(a.totalAmount), 0)),
          paid: toCents(assessments.reduce((s, a) => s + money(a.paidAmount), 0)),
          waived: toCents(assessments.reduce((s, a) => s + money(a.waivedAmount), 0)),
          balance: toCents(assessments.filter((a) => !a.cancelledAt).reduce((s, a) => s + balanceOf(a), 0)),
        },
      },
      books: {
        loans: loans.map((l) => ({
          id: l.id, status: l.status, issuedAt: l.issuedAt, dueAt: l.dueAt,
          returnedAt: l.returnedAt, overdue: l.status === 'ACTIVE' && l.dueAt < now,
          barcode: l.copy.barcode, title: l.copy.book.title, subject: l.copy.book.subject,
        })),
        charges: charges.map((c) => ({
          id: c.id, type: c.type, amount: money(c.amount), status: c.status,
          reason: c.reason, raisedAt: c.raisedAt,
        })),
        owed: toCents(charges.filter((c) => c.status === 'OUTSTANDING')
          .reduce((s, c) => s + money(c.amount), 0)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/sixth-form/students/:userId
 *
 * The office correcting the record: form class, student number, guardian
 * contacts, and the faculty placement.
 *
 * Faculty lives on the application rather than the profile, because it is a
 * decision about this intake. Until now it could only be set by a script
 * (scripts/set-faculty.js), which meant a placement corrected after the lists
 * were applied could not be recorded at all.
 */
export const updateSixthFormStudent = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { formClass, studentNumber, guardianName, guardianPhone, guardianEmail, faculty, notes, loanCap } = req.body;

    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Student not found' });

    const data = {};

    if (formClass !== undefined) {
      const code = normaliseFormClass(formClass);
      if (!code) return res.status(400).json({ error: 'That is not a form class' });
      const year = Number(code);
      if (!SIXTH_FORM_YEARS.includes(year) || !formClassMatchesYear(code, year)) {
        return res.status(400).json({ error: 'Sixth form is Grade 12 or Grade 13' });
      }
      data.formClass = code;
      data.yearGroup = year;
    }

    if (studentNumber !== undefined) data.studentNumber = studentNumber?.trim() || null;
    if (guardianName !== undefined) data.guardianName = guardianName?.trim() || null;
    if (guardianPhone !== undefined) data.guardianPhone = guardianPhone?.trim() || null;
    if (guardianEmail !== undefined) data.guardianEmail = guardianEmail?.trim() || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (loanCap !== undefined) data.loanCap = loanCap === null || loanCap === '' ? null : Number(loanCap);

    if (faculty !== undefined && faculty !== null && faculty !== '' && !FACULTIES.includes(faculty)) {
      return res.status(400).json({ error: `Faculty must be one of: ${FACULTIES.join(', ')}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = Object.keys(data).length
        ? await tx.studentProfile.update({ where: { userId }, data, select: profileSelect })
        : await tx.studentProfile.findUnique({ where: { userId }, select: profileSelect });

      let placedFaculty = null;
      if (faculty !== undefined) {
        const application = await tx.sixthFormApplication.findFirst({
          where: { OR: [{ enrolledUserId: userId }, { userId }] },
          orderBy: { submittedAt: 'desc' },
        });
        if (application) {
          await tx.sixthFormApplication.update({
            where: { id: application.id },
            data: { faculty: faculty || null },
          });
          placedFaculty = faculty || null;
        }
      }
      return { profile: p, faculty: placedFaculty };
    });

    logger.info('Sixth form student record updated', { userId, by: req.user.id });
    await auditLog('update', 'StudentProfile', profile.id, req.user.id, req.user.email, {
      via: 'sixth-form-students', fields: Object.keys(data), faculty: faculty ?? undefined,
    });

    res.json({
      profile: updated.profile,
      faculty: updated.faculty,
      message: 'Record updated.',
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'That student number is already in use' });
    }
    next(error);
  }
};

/** Minimal RFC 4180 quoting, as elsewhere. */
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** GET /api/sixth-form/students/export.csv - the cohort as a working list. */
export const exportSixthFormStudentsCsv = async (req, res, next) => {
  try {
    // Reuse the list endpoint's assembly by calling it with a capturing res.
    const captured = {};
    await listSixthFormStudents(req, { json: (body) => Object.assign(captured, body) }, next);
    const students = captured.students || [];

    const headers = [
      'Student number', 'Name', 'Grade', 'Form class', 'Faculty', 'Email', 'Phone',
      'Guardian', 'Guardian phone', 'Fees charged', 'Fees paid', 'Fees owing',
      'Books out', 'Books overdue', 'Book charges owing', 'Confirmed',
    ];
    const rows = students.map((s) => [
      s.studentNumber, s.name, s.yearGroup, s.formClass, s.faculty, s.email, s.phone,
      s.guardianName, s.guardianPhone,
      s.fees.charged, s.fees.paid, s.fees.balance,
      s.books.out, s.books.overdue, s.books.owes,
      s.verification === 'VERIFIED' ? 'Yes' : 'No',
    ].map(csvCell).join(','));

    const csv = `﻿${[headers.join(','), ...rows].join('\r\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sixth-form-students-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
