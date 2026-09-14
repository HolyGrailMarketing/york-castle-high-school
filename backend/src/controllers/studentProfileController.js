import crypto from 'crypto';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import {
  classesPayload,
  normaliseFormClass,
  isValidYearGroup,
  formClassMatchesYear,
  yearGroupForFormClass,
} from '../services/schoolClasses.js';

/**
 * Student profiles: the school-specific fields that hang off a student's own
 * account, and the office's confirmation of them.
 *
 * Students sign themselves up, so anyone can claim to be in Grade 13. What they
 * typed is kept in claimedYearGroup/claimedFormClass and never overwritten;
 * yearGroup/formClass are what the office has confirmed against the class
 * register. Only a confirmed student can be given books, and that check happens
 * at the counter.
 */

const VERIFICATIONS = ['UNVERIFIED', 'VERIFIED', 'REJECTED'];

/** What a student is allowed to see and set about themselves. */
const OWN_PROFILE_SELECT = {
  id: true,
  studentNumber: true,
  yearGroup: true,
  formClass: true,
  claimedYearGroup: true,
  claimedFormClass: true,
  guardianName: true,
  guardianPhone: true,
  guardianEmail: true,
  verification: true,
  verifiedAt: true,
  loanCap: true,
  createdAt: true,
  updatedAt: true,
};

/** GET /api/students/classes - year groups and form classes for the dropdowns. */
export const getClasses = async (req, res) => {
  res.json(classesPayload());
};

/**
 * GET /api/students/my - the caller's own profile.
 *
 * Resolved from req.user.id. There is no :id on this route, so there is no IDOR
 * surface, matching the /my routes on sixthForm.
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.id },
      select: OWN_PROFILE_SELECT,
    });
    res.json({ profile });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/students/my - a student corrects their own details.
 *
 * They may set their claimed year and class and their guardian's contact
 * details. They may never set studentNumber or verification - those are the
 * office's, and letting a student write them would make confirmation
 * meaningless.
 *
 * Changing the claimed year or class after being confirmed sends the profile
 * back to unconfirmed, because the thing the office checked is no longer what
 * the record says. The response says so, so it is not a silent surprise.
 */
export const updateMyProfile = async (req, res, next) => {
  try {
    const { yearGroup, formClass, guardianName, guardianPhone, guardianEmail } = req.body;

    const existing = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } });
    if (!existing) return res.status(404).json({ error: 'No student profile on this account' });

    const data = {};
    if (guardianName !== undefined) data.guardianName = guardianName?.trim() || null;
    if (guardianPhone !== undefined) data.guardianPhone = guardianPhone?.trim() || null;
    if (guardianEmail !== undefined) data.guardianEmail = guardianEmail?.trim()?.toLowerCase() || null;

    let classChanged = false;

    if (formClass !== undefined || yearGroup !== undefined) {
      const code = normaliseFormClass(formClass ?? existing.claimedFormClass);
      if (!code) return res.status(400).json({ error: 'That is not one of the school\'s form classes' });

      const year = yearGroup !== undefined ? Number(yearGroup) : yearGroupForFormClass(code);
      if (!isValidYearGroup(year)) return res.status(400).json({ error: 'Year group must be between 7 and 13' });
      if (!formClassMatchesYear(code, year)) {
        return res.status(400).json({ error: `Form class ${code} is not in Grade ${year}` });
      }

      classChanged = code !== existing.claimedFormClass || year !== existing.claimedYearGroup;
      data.claimedFormClass = code;
      data.claimedYearGroup = year;

      if (classChanged) {
        // Overwrite the working fields too, so the desk sees the student's own
        // latest claim rather than a stale confirmed value - but unconfirmed,
        // so it cannot be acted on until someone checks it.
        data.formClass = code;
        data.yearGroup = year;
        data.verification = 'UNVERIFIED';
        data.verifiedAt = null;
        data.verifiedById = null;
      }
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const profile = await prisma.studentProfile.update({
      where: { userId: req.user.id },
      data,
      select: OWN_PROFILE_SELECT,
    });

    res.json({
      profile,
      message: classChanged && existing.verification === 'VERIFIED'
        ? 'Saved. Because your year or class changed, the office needs to confirm it again before you can borrow books.'
        : 'Saved.',
    });
  } catch (error) {
    next(error);
  }
};

/** Shape one profile row for the office's list. */
const listShape = (row) => ({
  id: row.id,
  userId: row.userId,
  name: row.user.name,
  email: row.user.email,
  studentNumber: row.studentNumber,
  yearGroup: row.yearGroup,
  formClass: row.formClass,
  claimedYearGroup: row.claimedYearGroup,
  claimedFormClass: row.claimedFormClass,
  guardianName: row.guardianName,
  guardianPhone: row.guardianPhone,
  verification: row.verification,
  verifiedAt: row.verifiedAt,
  registeredAtDesk: row.registeredAtDesk,
  loanCap: row.loanCap,
  createdAt: row.createdAt,
  activeLoans: row.user._count?.bookLoans ?? 0,
});

/**
 * GET /api/students - the office's list, and the confirmation queue.
 * Filters: q, verification, formClass, yearGroup, owes.
 */
export const listStudents = async (req, res, next) => {
  try {
    const { q, verification, formClass, yearGroup, owes } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const where = {};
    if (verification && VERIFICATIONS.includes(verification)) where.verification = verification;
    if (formClass) where.formClass = normaliseFormClass(formClass) ?? formClass;
    if (yearGroup) where.yearGroup = Number(yearGroup);
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { studentNumber: { contains: term, mode: 'insensitive' } },
        { user: { name: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (owes === 'true') {
      where.user = { ...(where.user || {}), bookCharges: { some: { status: 'OUTSTANDING' } } };
    }

    const [rows, total, unverified] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        orderBy: [{ verification: 'asc' }, { formClass: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { name: true, email: true, _count: { select: { bookLoans: { where: { status: 'ACTIVE' } } } } },
          },
        },
      }),
      prisma.studentProfile.count({ where }),
      // Always reported, whatever the filter, because it is the number the
      // office is working through and the badge in the sidebar.
      prisma.studentProfile.count({ where: { verification: 'UNVERIFIED' } }),
    ]);

    res.json({
      students: rows.map(listShape),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      unverifiedCount: unverified,
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/students/:id - one student, with their books and what they owe. */
export const getStudent = async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Student not found' });

    const [loans, charges] = await Promise.all([
      prisma.bookLoan.findMany({
        where: { studentId: profile.userId },
        orderBy: { issuedAt: 'desc' },
        take: 50,
        include: { copy: { include: { book: { select: { title: true, subject: true } } } } },
      }),
      prisma.bookCharge.findMany({
        where: { studentId: profile.userId },
        orderBy: { raisedAt: 'desc' },
      }),
    ]);

    res.json({
      student: {
        ...listShape({ ...profile, user: { ...profile.user, _count: { bookLoans: loans.filter((l) => l.status === 'ACTIVE').length } } }),
        phone: profile.user.phone,
        notes: profile.notes,
      },
      loans: loans.map((l) => ({
        id: l.id,
        status: l.status,
        issuedAt: l.issuedAt,
        dueAt: l.dueAt,
        returnedAt: l.returnedAt,
        barcode: l.copy.barcode,
        title: l.copy.book.title,
        subject: l.copy.book.subject,
      })),
      charges: charges.map((c) => ({ ...c, amount: Number(c.amount) })),
      outstandingTotal: charges
        .filter((c) => c.status === 'OUTSTANDING')
        .reduce((sum, c) => sum + Number(c.amount), 0),
    });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/students/:id - the office corrects the confirmed fields. */
export const updateStudent = async (req, res, next) => {
  try {
    const { studentNumber, yearGroup, formClass, loanCap, notes } = req.body;
    const data = {};

    if (studentNumber !== undefined) data.studentNumber = studentNumber?.trim() || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (loanCap !== undefined) {
      if (loanCap === null || loanCap === '') data.loanCap = null;
      else {
        const cap = Number(loanCap);
        if (!Number.isInteger(cap) || cap < 0) return res.status(400).json({ error: 'Loan limit must be a whole number' });
        data.loanCap = cap;
      }
    }
    if (formClass !== undefined) {
      const code = normaliseFormClass(formClass);
      if (!code) return res.status(400).json({ error: 'That is not one of the school\'s form classes' });
      data.formClass = code;
      data.yearGroup = yearGroupForFormClass(code);
    }
    if (yearGroup !== undefined && formClass === undefined) {
      if (!isValidYearGroup(yearGroup)) return res.status(400).json({ error: 'Year group must be between 7 and 13' });
      data.yearGroup = Number(yearGroup);
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });

    const profile = await prisma.studentProfile.update({ where: { id: req.params.id }, data });
    res.json({ student: profile });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Student not found' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Another student already has that student number' });
    next(error);
  }
};

/**
 * POST /api/students/:id/verify - the office confirms a student against the
 * class register, correcting the year and class if the student got them wrong.
 */
export const verifyStudent = async (req, res, next) => {
  try {
    const { verification, yearGroup, formClass, studentNumber, note } = req.body;

    if (!VERIFICATIONS.includes(verification)) {
      return res.status(400).json({ error: 'Say whether the student is confirmed or rejected' });
    }

    const data = { verification, notes: note?.trim() || undefined };

    if (verification === 'VERIFIED') {
      const code = normaliseFormClass(formClass);
      if (!code) return res.status(400).json({ error: 'Confirm which form class the student is in' });
      const year = yearGroup !== undefined ? Number(yearGroup) : yearGroupForFormClass(code);
      if (!formClassMatchesYear(code, year)) {
        return res.status(400).json({ error: `Form class ${code} is not in Grade ${year}` });
      }
      data.formClass = code;
      data.yearGroup = year;
      data.verifiedAt = new Date();
      data.verifiedById = req.user.id;
      if (studentNumber !== undefined) data.studentNumber = studentNumber?.trim() || null;
    } else {
      data.verifiedAt = null;
      data.verifiedById = null;
    }

    const profile = await prisma.studentProfile.update({
      where: { id: req.params.id },
      data,
      include: { user: { select: { name: true, email: true } } },
    });

    logger.info('Student verification changed', {
      profileId: profile.id, verification, by: req.user.id,
    });

    res.json({
      student: profile,
      message: verification === 'VERIFIED'
        ? `${profile.user.name} confirmed as ${profile.formClass}. They can be given books now.`
        : `${profile.user.name} marked as ${verification.toLowerCase()}.`,
    });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Student not found' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Another student already has that student number' });
    next(error);
  }
};

/**
 * POST /api/students/desk-register - create and confirm a student at the counter.
 *
 * The school's rule is that a student has an account before they get a book.
 * This keeps that true without making the queue wait for someone to go home,
 * sign up and come back: the librarian creates the account in front of them and
 * confirms it in the same step, because they are standing there with the class
 * register.
 *
 * No password is set. The account exists and can be lent against immediately;
 * the student sets their own password later through the normal forgotten-
 * password flow, so staff never handle a student's password.
 */
export const deskRegisterStudent = async (req, res, next) => {
  try {
    const { name, email, formClass, yearGroup, studentNumber, guardianName, guardianPhone } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Enter the student\'s name' });

    const code = normaliseFormClass(formClass);
    if (!code) return res.status(400).json({ error: 'Choose the student\'s form class' });
    const year = yearGroup !== undefined ? Number(yearGroup) : yearGroupForFormClass(code);
    if (!formClassMatchesYear(code, year)) {
      return res.status(400).json({ error: `Form class ${code} is not in Grade ${year}` });
    }

    const cleanEmail = email?.trim().toLowerCase() || null;
    if (cleanEmail) {
      const clash = await prisma.user.findFirst({ where: { email: { equals: cleanEmail, mode: 'insensitive' } } });
      if (clash) {
        return res.status(409).json({
          error: 'There is already an account with that email address. Search for the student instead of creating them again.',
        });
      }
    }

    // A student with no email still needs a unique value for the column. The
    // .invalid TLD is reserved by RFC 2606 and can never be routed, so a
    // placeholder can never accidentally be mailed.
    const placeholder = !cleanEmail;
    const addressToUse = cleanEmail
      || `${name.trim().toLowerCase().replace(/[^a-z]+/g, '.')}.${crypto.randomBytes(3).toString('hex')}@no-email.invalid`;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: addressToUse, name: name.trim(), role: 'STUDENT' },
      });
      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          studentNumber: studentNumber?.trim() || null,
          yearGroup: year,
          formClass: code,
          claimedYearGroup: year,
          claimedFormClass: code,
          guardianName: guardianName?.trim() || null,
          guardianPhone: guardianPhone?.trim() || null,
          verification: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: req.user.id,
          registeredAtDesk: true,
          // A placeholder address is a loose end someone has to tidy up later,
          // so say so on the record rather than leaving it to be discovered.
          notes: placeholder ? 'Registered at the desk without an email address. Add one so they can sign in.' : null,
        },
      });
      return { user, profile };
    });

    logger.info('Student registered at desk', {
      userId: result.user.id, formClass: code, placeholder, by: req.user.id,
    });

    res.status(201).json({
      student: { ...result.profile, name: result.user.name, email: placeholder ? null : result.user.email },
      needsEmail: placeholder,
      message: placeholder
        ? `${result.user.name} is registered and confirmed. Add an email address later so they can sign in and see their books.`
        : `${result.user.name} is registered and confirmed. They can set a password with "Forgot password" on the sign-in page.`,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'That email address or student number is already in use' });
    }
    next(error);
  }
};
