import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { auditLog } from '../middleware/auditLog.js';
import {
  resolveStudentUser,
  upsertStudentProfile,
  guardianFromSixthForm,
  formClassForUndividedYear,
} from '../services/studentEnrolment.js';

/**
 * Enrolling sixth form applicants as students.
 *
 * Approving an application records a decision. It does not make anyone a
 * student: until this runs there is no StudentProfile, so an approved sixth
 * former cannot be found on the student register, cannot be lent a textbook and
 * cannot be assessed a fee.
 *
 * Kept out of sixthFormController.js, which is already long and is about
 * applications and the emails sent to applicants. This file is about the moment
 * they stop being applicants.
 */

/** Sixth form is years 12 and 13. Nothing else can be enrolled through here. */
const SIXTH_FORM_YEARS = [12, 13];

const candidateShape = (a) => ({
  id: a.id,
  name: [a.firstName, a.lastName].filter(Boolean).join(' '),
  email: a.email,
  faculty: a.faculty,
  status: a.status,
  enrolledAt: a.enrolledAt,
  enrolledUserId: a.enrolledUserId,
  interviewDecision: a.interview?.decision ?? null,
});

/**
 * GET /api/sixth-form/enrolment-candidates
 *
 * Everyone who has been approved, including those already enrolled. Hiding the
 * done ones would leave the office unable to tell "nobody is left" from
 * "something is broken".
 */
export const getEnrolmentCandidates = async (req, res, next) => {
  try {
    const applications = await prisma.sixthFormApplication.findMany({
      where: { status: 'APPROVED' },
      orderBy: [{ enrolledAt: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      include: { interview: { select: { decision: true } } },
    });

    const candidates = applications.map(candidateShape);
    res.json({
      candidates,
      total: candidates.length,
      enrolled: candidates.filter((c) => c.enrolledAt).length,
      remaining: candidates.filter((c) => !c.enrolledAt).length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enrol one application. Returns a result object rather than throwing, so a
 * bulk run can report a bad row and carry on with the rest.
 *
 * One transaction per application, deliberately not one around the whole batch:
 * a single bad row must not roll back the thirty that worked.
 */
const enrolOne = async (application, { yearGroup, formClass, actorId }) => {
  if (application.status !== 'APPROVED') {
    return { id: application.id, ok: false, reason: 'Not approved' };
  }

  // Already done. Not an error: bulk runs have to be safe to repeat after a
  // timeout, so this is the path that makes pressing the button twice harmless.
  if (application.enrolledAt) {
    return {
      id: application.id,
      ok: true,
      alreadyEnrolled: true,
      userId: application.enrolledUserId,
    };
  }

  const name = [application.firstName, application.lastName].filter(Boolean).join(' ').trim();
  if (!name) return { id: application.id, ok: false, reason: 'Application has no name' };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { user, created, placeholderEmail } = await resolveStudentUser(tx, {
        name,
        email: application.email,
        userId: application.userId,
      });

      const profile = await upsertStudentProfile(tx, {
        userId: user.id,
        yearGroup,
        formClass,
        guardian: guardianFromSixthForm(application.guardianInfo),
        // They sat an interview and were approved, which is a stronger check
        // than the class register the desk verifies against.
        verifiedById: actorId,
        registeredAtDesk: false,
        notes: placeholderEmail
          ? 'Enrolled from a sixth form application with no email address. Add one so they can sign in.'
          : null,
      });

      await tx.sixthFormApplication.update({
        where: { id: application.id },
        data: {
          enrolledAt: new Date(),
          enrolledById: actorId,
          enrolledUserId: user.id,
          // An application submitted before the applicant had an account gets
          // the link now, so their own status page keeps working.
          ...(application.userId ? {} : { userId: user.id }),
        },
      });

      return { user, profile, created, placeholderEmail };
    });

    return {
      id: application.id,
      ok: true,
      alreadyEnrolled: false,
      userId: result.user.id,
      name: result.user.name,
      accountCreated: result.created,
      needsEmail: result.placeholderEmail,
    };
  } catch (error) {
    logger.error('Sixth form enrolment failed', {
      applicationId: application.id,
      error: error.message,
    });
    return {
      id: application.id,
      ok: false,
      reason: error.code === 'P2002' ? 'That email address or student number is already in use' : error.message,
    };
  }
};

/** Shared validation for the year group both endpoints take. */
const resolveYear = (raw) => {
  const yearGroup = Number(raw);
  if (!SIXTH_FORM_YEARS.includes(yearGroup)) {
    return { error: 'Choose Grade 12 or Grade 13' };
  }
  const formClass = formClassForUndividedYear(yearGroup);
  if (!formClass) return { error: `Grade ${yearGroup} has no form class` };
  return { yearGroup, formClass };
};

/** POST /api/sixth-form/:id/enrol */
export const enrolApplicant = async (req, res, next) => {
  try {
    const { yearGroup, formClass, error } = resolveYear(req.body.yearGroup);
    if (error) return res.status(400).json({ error });

    const application = await prisma.sixthFormApplication.findUnique({ where: { id: req.params.id } });
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const result = await enrolOne(application, { yearGroup, formClass, actorId: req.user.id });
    if (!result.ok) return res.status(400).json({ error: result.reason });

    if (result.alreadyEnrolled) {
      return res.json({
        alreadyEnrolled: true,
        student: { id: result.userId },
        message: 'That applicant is already enrolled as a student.',
      });
    }

    await auditLog('create', 'StudentProfile', result.userId, req.user.id, req.user.email, {
      via: 'sixth-form-enrolment',
      applicationId: application.id,
      yearGroup,
    });

    res.status(201).json({
      alreadyEnrolled: false,
      student: { id: result.userId, name: result.name, yearGroup, formClass },
      needsEmail: result.needsEmail,
      message: result.needsEmail
        ? `${result.name} is now a Grade ${yearGroup} student. Add an email address so they can sign in.`
        : `${result.name} is now a Grade ${yearGroup} student.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sixth-form/enrol
 *
 * Bulk. Follows runRentalCharges: a dry run says what would happen, the real
 * run is safe to repeat, and a row that cannot be enrolled is reported rather
 * than taking the batch down with it.
 */
export const enrolApplicants = async (req, res, next) => {
  try {
    const { applicationIds, dryRun } = req.body;
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one applicant' });
    }

    const { yearGroup, formClass, error } = resolveYear(req.body.yearGroup);
    if (error) return res.status(400).json({ error });

    const applications = await prisma.sixthFormApplication.findMany({
      where: { id: { in: applicationIds } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const eligible = applications.filter((a) => a.status === 'APPROVED' && !a.enrolledAt);
    const alreadyEnrolled = applications.filter((a) => a.enrolledAt).length;
    const notApproved = applications
      .filter((a) => a.status !== 'APPROVED' && !a.enrolledAt)
      .map((a) => ({
        id: a.id,
        name: [a.firstName, a.lastName].filter(Boolean).join(' '),
        reason: `Status is ${a.status}, not approved`,
      }));

    if (dryRun) {
      return res.json({
        dryRun: true,
        yearGroup,
        formClass,
        willEnrol: eligible.length,
        alreadyEnrolled,
        skipped: notApproved,
        missing: applicationIds.length - applications.length,
        sample: eligible.slice(0, 25).map((a) => ({
          name: [a.firstName, a.lastName].filter(Boolean).join(' '),
          email: a.email,
          faculty: a.faculty,
        })),
      });
    }

    const results = [];
    for (const application of eligible) {
      // Sequential, not Promise.all: each enrolment opens a transaction, and a
      // hundred at once would exhaust the connection pool.
      results.push(await enrolOne(application, { yearGroup, formClass, actorId: req.user.id }));
    }

    const enrolled = results.filter((r) => r.ok && !r.alreadyEnrolled);
    const failed = results.filter((r) => !r.ok);

    logger.info('Sixth form bulk enrolment', {
      yearGroup,
      enrolled: enrolled.length,
      failed: failed.length,
      by: req.user.id,
    });

    await auditLog('create', 'StudentProfile', null, req.user.id, req.user.email, {
      via: 'sixth-form-bulk-enrolment',
      yearGroup,
      enrolled: enrolled.length,
      failed: failed.length,
    });

    res.json({
      enrolled: enrolled.length,
      alreadyEnrolled,
      failed: failed.map((f) => ({ id: f.id, reason: f.reason })),
      skipped: notApproved,
      needsEmail: enrolled.filter((e) => e.needsEmail).length,
      message: `Enrolled ${enrolled.length} student${enrolled.length === 1 ? '' : 's'} into Grade ${yearGroup}.`
        + (alreadyEnrolled ? ` ${alreadyEnrolled} were already enrolled.` : '')
        + (failed.length ? ` ${failed.length} could not be enrolled.` : ''),
    });
  } catch (error) {
    next(error);
  }
};
