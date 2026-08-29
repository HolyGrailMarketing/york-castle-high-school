import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { getBaseUrl } from '../utils/helpers.js';
import {
  sendAdminSixthFormNotification,
  getNotificationRecipients,
  isEmailConfigured,
  sendEmail,
} from '../services/emailService.js';
import { auditLog } from '../middleware/auditLog.js';
import { NOTIFICATION_TYPES } from '../services/notificationTypes.js';
import { readInvite, markInviteUsed } from '../utils/inviteToken.js';

// Sixth Form applications closed on this date. Jamaica does not observe DST,
// so a fixed -05:00 offset is always correct. Kept in sync with the deadline
// shown on sixth-form-application.html.
const SIXTH_FORM_APPLICATION_DEADLINE = new Date('2026-07-20T23:59:59-05:00');

// Applicants who only completed the paper form finish the online application
// at their interview, so the form reopens for that day alone. A time window
// rather than an access code: there is no secret to hand out, leak, or
// remember to revoke afterwards, and it closes itself. Kept in sync with the
// matching window in sixth-form-application.html.
const SIXTH_FORM_INTERVIEW_WINDOW = {
  start: new Date('2026-08-25T06:00:00-05:00'),
  end: new Date('2026-08-25T18:00:00-05:00'),
};

const isWithinInterviewWindow = (now = Date.now()) =>
  now >= SIXTH_FORM_INTERVIEW_WINDOW.start.getTime() &&
  now <= SIXTH_FORM_INTERVIEW_WINDOW.end.getTime();

// Until interview day every application sits at PENDING, so `status` says
// nothing useful about an applicant. What staff actually chase is these two:
// whether the applicant has come back with their real CXC grades, and whether
// they have completed Section D (the CAPE subject stream selection). Both are
// derivable from what is already stored, so they need no extra columns.

// The application form saves subjects not yet graded with the sentinel grade
// `Sitting`; the applicant replaces it via cxc-update.html once results are
// released. A row still marked `Sitting` is therefore a grade the school does
// not have. Kept in step with csecReadiness() in the admin dashboard.
const RESULTS_OUTSTANDING = {
  OR: [
    { csecResults: { equals: Prisma.DbNull } },
    { csecResults: { equals: Prisma.JsonNull } },
    { csecResults: { equals: [] } },
    // jsonb @> — true when *any* element of the array carries that grade.
    { csecResults: { array_contains: [{ grade: 'Sitting' }] } },
  ],
};

// Applications submitted before the subject-stream section existed have no
// `stream` key at all; one saved from the status page with nothing chosen has
// it as an empty string. Both mean Section D still has to be collected.
const SECTION_D_OUTSTANDING = {
  OR: [
    { NOT: { subjectChoices: { path: ['stream'], not: Prisma.DbNull } } },
    { subjectChoices: { path: ['stream'], equals: '' } },
  ],
};

const READINESS_FILTERS = {
  'results-outstanding': RESULTS_OUTSTANDING,
  'section-d-outstanding': SECTION_D_OUTSTANDING,
  'either-outstanding': { OR: [RESULTS_OUTSTANDING, SECTION_D_OUTSTANDING] },
  ready: { AND: [{ NOT: RESULTS_OUTSTANDING }, { NOT: SECTION_D_OUTSTANDING }] },
};

// One application per applicant. Addresses are matched case-insensitively so
// "John@x.com" and "john@x.com" are the same person, and stored lower-cased so
// the lower(email) unique index and this lookup always agree.
const normaliseEmail = (email) => (email || '').trim().toLowerCase();

const findApplicationByEmail = (email) =>
  prisma.sixthFormApplication.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });

// Notify staff that a new sixth-form application was submitted. Failures are
// logged, never thrown, so a notification problem can't break the submission.
const notifyAdminOfNewSixthForm = async (req, application) => {
  if (!isEmailConfigured()) {
    logger.warn('Skipping sixth-form notification - email service not configured', { applicationId: application.id });
    return;
  }
  try {
    const applicationUrl = `${getBaseUrl(req)}/admin/sixth-form?view=${application.id}`;
    const to = await getNotificationRecipients('notifySixthFormApps');
    await sendAdminSixthFormNotification({
      applicantName: [application.firstName, application.lastName].filter(Boolean).join(' ') || 'Unknown',
      applicantEmail: application.email,
      applicantPhone: application.phone,
      applicationId: application.id,
      applicationUrl,
      submittedAt: application.createdAt,
    }, to);
    logger.info('New sixth-form application notification sent to staff', { applicationId: application.id });
  } catch (error) {
    logger.error('Failed to send sixth-form notification', { applicationId: application.id, error: error.message });
  }
};

export const getSixthFormApplications = async (req, res, next) => {
  try {
    const { status, search, readiness, page = 1 } = req.query;
    // Clamped rather than left uncapped so the admin dashboard's "select all
    // matching this filter" action (which asks for limit = total) can't be
    // used to pull an unbounded result set.
    const limit = Math.min(parseInt(req.query.limit) || 20, 1000);
    const skip = (parseInt(page) - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // The readiness summary is counted against everything *except* the
    // readiness filter, so the figures staff are working through stay put
    // instead of collapsing to the bucket they just clicked.
    const summaryWhere = { ...where };

    // Nested under AND so it composes with the search clause's own OR.
    // hasOwn so a query string of `?readiness=constructor` can't reach an
    // inherited property and end up in the where clause.
    if (readiness && Object.hasOwn(READINESS_FILTERS, readiness)) {
      where.AND = [...(where.AND || []), READINESS_FILTERS[readiness]];
    }

    const [
      applications,
      total,
      resultsOutstanding,
      sectionDOutstanding,
      ready,
      summaryTotal,
    ] = await Promise.all([
      prisma.sixthFormApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          notifications: {
            select: { type: true, subject: true, sentAt: true },
            orderBy: { sentAt: 'desc' },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.sixthFormApplication.count({ where }),
      prisma.sixthFormApplication.count({
        where: { ...summaryWhere, AND: [...(summaryWhere.AND || []), RESULTS_OUTSTANDING] },
      }),
      prisma.sixthFormApplication.count({
        where: { ...summaryWhere, AND: [...(summaryWhere.AND || []), SECTION_D_OUTSTANDING] },
      }),
      prisma.sixthFormApplication.count({
        where: { ...summaryWhere, AND: [...(summaryWhere.AND || []), READINESS_FILTERS.ready] },
      }),
      prisma.sixthFormApplication.count({ where: summaryWhere }),
    ]);

    res.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      readiness: {
        total: summaryTotal,
        resultsOutstanding,
        sectionDOutstanding,
        ready,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSixthFormApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await prisma.sixthFormApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (
      application.userId &&
      application.userId !== req.user?.id &&
      !['ADMIN', 'STAFF'].includes(req.user?.role)
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ application });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve an invite link. Public: the token is the credential, and the form
 * cannot check a signature in the browser, so it asks here on load.
 *
 * Returns { valid: false } rather than an error status for an expired or
 * tampered token — the form has a specific screen for that, and a 4xx here
 * would be indistinguishable from the endpoint being broken.
 */
export const resolveSixthFormInvite = async (req, res, next) => {
  try {
    const invite = await readInvite(req.query.token);
    if (!invite) return res.json({ valid: false });

    // An invite already spent is worse than useless: it would walk the student
    // through ten screens only to 409 at submit. Say so up front.
    const existing = await findApplicationByEmail(invite.email);
    if (existing) {
      return res.json({ valid: false, reason: 'already_applied', email: invite.email });
    }

    return res.json({
      valid: true,
      email: invite.email,
      firstName: invite.firstName,
      lastName: invite.lastName,
      faculty: invite.faculty,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Does an application already exist for this address?
 *
 * The form calls this when the applicant leaves the Personal screen, so
 * someone who has already applied is told at screen 3 of 10 rather than after
 * filling the whole form — which is how a batch of duplicate submissions came
 * to exist before createSixthFormApplication started rejecting them.
 *
 * Returns nothing but a boolean: the endpoint is public, so it must not
 * confirm anything about the applicant beyond what they already typed.
 */
export const checkSixthFormEmail = async (req, res, next) => {
  try {
    // sixthFormCheckEmailValidation has already validated this and applied the
    // same normalizeEmail() the submit path uses, so the two agree exactly.
    const existing = await findApplicationByEmail(normaliseEmail(req.query.email));
    res.json({ exists: Boolean(existing) });
  } catch (error) {
    next(error);
  }
};

export const createSixthFormApplication = async (req, res, next) => {
  // Set when this submission came in on a late-applicant invite, so the invite
  // can be marked as answered once the application actually exists.
  let acceptedInviteToken = null;
  try {
    const now = Date.now();
    if (now > SIXTH_FORM_APPLICATION_DEADLINE.getTime() && !isWithinInterviewWindow(now)) {
      // Candidates interviewed and accepted on August 25 who never submitted the
      // online form are invited back individually. The token names the address
      // it was issued to, and only that address may apply on it — otherwise one
      // leaked link would reopen the form for anybody.
      // The limiter ahead of this already resolved it; re-read rather than trust
      // middleware ordering, so the rule holds wherever this handler is reached.
      const invite = req.sixthFormInvite || (await readInvite(req.body.inviteToken));
      if (!invite || invite.email !== normaliseEmail(req.body.email)) {
        return res.status(403).json({
          error: 'Sixth Form applications closed on July 20, 2026 and are no longer being accepted.',
        });
      }
      logger.info('Late Sixth Form application accepted on an invite', { email: invite.email });
      acceptedInviteToken = invite.token;
    }

    const {
      firstName,
      middleName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      gender,
      religion,
      nationality,
      yearsOfResidence,
      previousSchool,
      positionsHeld,
      guardianInfo,
      careerGoals,
      strengthsWeaknesses,
      reasonForAttending,
      csecResults,
      subjectChoices,
    } = req.body;

    const applicantEmail = normaliseEmail(email);

    // Prevent a student from applying twice, matched by their account (if
    // signed in) or their email. checkSixthFormEmail below runs the same
    // lookup so the form can say this at the Personal screen rather than
    // after ten screens of typing.
    const duplicate = req.user?.id
      ? await prisma.sixthFormApplication.findFirst({
          where: {
            OR: [{ userId: req.user.id }, { email: { equals: applicantEmail, mode: 'insensitive' } }],
          },
          select: { id: true },
        })
      : await findApplicationByEmail(applicantEmail);
    if (duplicate) {
      return res.status(409).json({
        error: 'An application already exists for this email. Please sign in to view or update your application.',
      });
    }

    // Resolve userId: prefer logged-in user, else look up by email
    let userId = req.user?.id || null;
    let generatedPassword = null;

    if (!userId) {
      // Case-insensitive lookup so a different-cased email doesn't create a
      // duplicate account for an applicant who already has one.
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: applicantEmail, mode: 'insensitive' } },
      });
      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Auto-create a STUDENT account for this applicant
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        generatedPassword = Array.from({ length: 10 }, () =>
          chars[Math.floor(Math.random() * chars.length)]
        ).join('');
        const hashed = await bcrypt.hash(generatedPassword, 10);
        const newUser = await prisma.user.create({
          data: {
            email: applicantEmail,
            password: hashed,
            name: [firstName, lastName].filter(Boolean).join(' '),
            role: 'STUDENT',
          },
        });
        userId = newUser.id;
      }
    }

    const application = await prisma.sixthFormApplication.create({
      data: {
        firstName,
        middleName,
        lastName,
        email: applicantEmail,
        phone,
        dateOfBirth: new Date(dateOfBirth),
        address,
        gender: gender || null,
        religion: religion || null,
        nationality: nationality || null,
        yearsOfResidence: yearsOfResidence ? parseInt(yearsOfResidence) : null,
        previousSchool,
        positionsHeld: positionsHeld || null,
        guardianInfo: guardianInfo || null,
        careerGoals: careerGoals || null,
        strengthsWeaknesses: strengthsWeaknesses || null,
        reasonForAttending: reasonForAttending || null,
        csecResults: csecResults || null,
        subjectChoices: subjectChoices || {},
        userId,
      },
    });

    // Best-effort, and after the application exists: an invite left unmarked is
    // a chase-up list that is slightly wrong, whereas failing here would lose an
    // application that was successfully submitted.
    if (acceptedInviteToken) await markInviteUsed(acceptedInviteToken);

    await notifyAdminOfNewSixthForm(req, application);

    res.status(201).json({
      message: 'Sixth form application submitted successfully',
      application,
      ...(generatedPassword && { credentials: { email: applicantEmail, password: generatedPassword } }),
    });
  } catch (error) {
    next(error);
  }
};

export const updateSixthFormStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WAITLISTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (status === 'APPROVED') {
      const interview = await prisma.sixthFormInterview.findUnique({ where: { applicationId: id } });
      if (!interview) {
        return res.status(400).json({ error: 'An interview must be completed before approving this application.' });
      }
    }

    const application = await prisma.sixthFormApplication.update({
      where: { id },
      data: {
        status,
        notes,
        reviewedAt: new Date(),
        reviewedBy: req.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    res.json({
      message: 'Application status updated successfully',
      application,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Application not found' });
    }
    next(error);
  }
};

// How many notification emails to send concurrently per batch. Keeps a large
// selection from hammering Resend or the request timeout, without the
// overhead of a real job queue for what's expected to be at most a few dozen
// (occasionally a few hundred) recipients at a time.
const NOTIFY_BATCH_SIZE = 5;

// Send a bulk notification (a fixed template, or an admin-composed custom
// announcement) to a batch of selected Sixth Form applicants. Unlike the
// best-effort admin-notification emails elsewhere in this file, sending the
// email IS the point of this action, so a misconfigured email service is a
// hard error rather than a silent no-op.
export const sendSixthFormNotifications = async (req, res, next) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(503).json({
        error: 'Email service is not configured. Notifications cannot be sent right now.',
      });
    }

    const { applicationIds, type, subject, message, acceptance } = req.body;
    const notificationType = NOTIFICATION_TYPES[type];

    const found = await prisma.sixthFormApplication.findMany({
      where: { id: { in: applicationIds } },
      select: { id: true, firstName: true, lastName: true, email: true, status: true, faculty: true },
    });

    const foundIds = new Set(found.map((a) => a.id));
    const failed = applicationIds
      .filter((id) => !foundIds.has(id))
      .map((id) => ({ id, email: null, reason: 'Application not found' }));

    // Telling someone the wrong decision is the one mistake here that cannot be
    // taken back, so a decision letter's recipients are checked against the
    // recorded status at the point of sending rather than trusted from whatever
    // was selected. Mismatches are reported alongside other failures; the rest
    // still go.
    let applications = found;
    const required = notificationType.requiresStatus;
    if (required) {
      applications = found.filter((a) => a.status === required);
      for (const a of found) {
        if (a.status !== required) {
          failed.push({
            id: a.id,
            email: a.email,
            reason: `Status is ${a.status}, not ${required} — "${notificationType.label}" not sent`,
          });
        }
      }
    }

    const ctx = { loginUrl: getBaseUrl(req), subject, message, acceptance };
    // Every recipient gets the same subject for a given send (fixed per
    // preset template, or the admin's own `subject` for a custom one) — build
    // once up front rather than recomputing it per recipient below.
    const sentSubject = notificationType.build('Applicant', ctx).subject;

    let notifiedCount = 0;
    const notifiedIds = [];

    for (let i = 0; i < applications.length; i += NOTIFY_BATCH_SIZE) {
      const batch = applications.slice(i, i + NOTIFY_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((app) => {
          const name = [app.firstName, app.lastName].filter(Boolean).join(' ') || 'Applicant';
          const template = notificationType.build(name, ctx, app);
          return sendEmail(app.email, template.subject, template.text, template.html);
        })
      );
      results.forEach((result, idx) => {
        const app = batch[idx];
        if (result.status === 'fulfilled') {
          notifiedCount += 1;
          notifiedIds.push(app.id);
        } else {
          logger.error('Failed to send sixth-form notification', {
            applicationId: app.id,
            email: app.email,
            type,
            error: result.reason?.message,
          });
          failed.push({
            id: app.id,
            email: app.email,
            reason: result.reason?.message || 'Failed to send email',
          });
        }
      });
    }

    if (notifiedIds.length > 0) {
      await prisma.sixthFormNotification.createMany({
        data: notifiedIds.map((applicationId) => ({
          applicationId,
          type,
          subject: sentSubject,
          sentBy: req.user.id,
        })),
      });

      // One audit entry per notified application (real entityId), matching the
      // AuditLog schema's required entityId and its [entityType, entityId]
      // index — so each notification is individually traceable for DPA compliance.
      await Promise.all(
        notifiedIds.map((id) =>
          auditLog('update', 'SixthFormApplication', id, req.user.id, req.user.email, {
            action: 'bulk_notification',
            type,
            batchRequestedCount: applicationIds.length,
            batchNotifiedCount: notifiedCount,
          })
        )
      );
    }

    logger.info('Sixth-form notifications sent', {
      type,
      requestedCount: applicationIds.length,
      notifiedCount,
      failedCount: failed.length,
    });

    res.json({
      message: `${notificationType.label} sent to ${notifiedCount} of ${applicationIds.length} selected applicant(s).`,
      notifiedCount,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyApplication = async (req, res, next) => {
  try {
    const application = await prisma.sixthFormApplication.findFirst({
      where: { userId: req.user.id },
      orderBy: { submittedAt: 'desc' },
      include: {
        interview: {
          select: {
            decision: true,
            comments: true,
            createdAt: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'No application found for this account.' });
    }

    res.json({ application });
  } catch (error) {
    next(error);
  }
};

// Allow a student to edit their own application, but only while it is still
// editable (PENDING or UNDER_REVIEW). Once a decision has been recorded the
// application is locked. Protected fields (status, notes, reviewedAt,
// reviewedBy, userId, email) are never taken from the request body.
const EDITABLE_STATUSES = ['PENDING', 'UNDER_REVIEW'];

export const updateMyApplication = async (req, res, next) => {
  try {
    const application = await prisma.sixthFormApplication.findFirst({
      where: { userId: req.user.id },
      orderBy: { submittedAt: 'desc' },
    });

    if (!application) {
      return res.status(404).json({ error: 'No application found for this account.' });
    }

    if (!EDITABLE_STATUSES.includes(application.status)) {
      return res.status(403).json({
        error: 'Your application can no longer be edited because it has been reviewed.',
      });
    }

    const {
      firstName,
      middleName,
      lastName,
      phone,
      dateOfBirth,
      address,
      gender,
      religion,
      nationality,
      yearsOfResidence,
      previousSchool,
      positionsHeld,
      guardianInfo,
      careerGoals,
      strengthsWeaknesses,
      reasonForAttending,
      csecResults,
      subjectChoices,
    } = req.body;

    // Only set fields the client actually provided so a partial update never
    // wipes existing values.
    const data = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (middleName !== undefined) data.middleName = middleName || null;
    if (lastName !== undefined) data.lastName = lastName;
    if (phone !== undefined) data.phone = phone;
    if (dateOfBirth !== undefined) data.dateOfBirth = new Date(dateOfBirth);
    if (address !== undefined) data.address = address || null;
    if (gender !== undefined) data.gender = gender || null;
    if (religion !== undefined) data.religion = religion || null;
    if (nationality !== undefined) data.nationality = nationality || null;
    if (yearsOfResidence !== undefined) {
      data.yearsOfResidence = yearsOfResidence ? parseInt(yearsOfResidence) : null;
    }
    if (previousSchool !== undefined) data.previousSchool = previousSchool || null;
    if (positionsHeld !== undefined) data.positionsHeld = positionsHeld || null;
    if (guardianInfo !== undefined) data.guardianInfo = guardianInfo || null;
    if (careerGoals !== undefined) data.careerGoals = careerGoals || null;
    if (strengthsWeaknesses !== undefined) data.strengthsWeaknesses = strengthsWeaknesses || null;
    if (reasonForAttending !== undefined) data.reasonForAttending = reasonForAttending || null;
    if (csecResults !== undefined) data.csecResults = csecResults || null;
    if (subjectChoices !== undefined) data.subjectChoices = subjectChoices || {};

    const updated = await prisma.sixthFormApplication.update({
      where: { id: application.id },
      data,
      include: {
        interview: {
          select: {
            decision: true,
            comments: true,
            createdAt: true,
          },
        },
      },
    });

    res.json({
      message: 'Application updated successfully',
      application: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSixthFormApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.sixthFormApplication.delete({
      where: { id },
    });

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Application not found' });
    }
    next(error);
  }
};





