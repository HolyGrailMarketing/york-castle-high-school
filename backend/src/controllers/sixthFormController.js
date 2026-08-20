import bcrypt from 'bcryptjs';
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
    const { status, search, page = 1 } = req.query;
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

    const [applications, total] = await Promise.all([
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
    ]);

    res.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        pages: Math.ceil(total / limit),
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

export const createSixthFormApplication = async (req, res, next) => {
  try {
    const now = Date.now();
    if (now > SIXTH_FORM_APPLICATION_DEADLINE.getTime() && !isWithinInterviewWindow(now)) {
      return res.status(403).json({
        error: 'Sixth Form applications closed on July 20, 2026 and are no longer being accepted.',
      });
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

    // Prevent a student from applying twice. One application per applicant,
    // matched by their account (if signed in) or their email (case-insensitive,
    // so "John@x.com" and "john@x.com" count as the same person).
    const duplicate = await prisma.sixthFormApplication.findFirst({
      where: {
        OR: [
          ...(req.user?.id ? [{ userId: req.user.id }] : []),
          { email: { equals: email, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
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
        where: { email: { equals: email, mode: 'insensitive' } },
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
            email,
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
        email,
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

    await notifyAdminOfNewSixthForm(req, application);

    res.status(201).json({
      message: 'Sixth form application submitted successfully',
      application,
      ...(generatedPassword && { credentials: { email, password: generatedPassword } }),
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

// "Kayla", "Kayla and Andre", "Kayla, Andre and Shanice"
const formatNames = (names) => {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

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

    const { applicationIds, type, subject, message } = req.body;
    const notificationType = NOTIFICATION_TYPES[type];

    const applications = await prisma.sixthFormApplication.findMany({
      where: { id: { in: applicationIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const foundIds = new Set(applications.map((a) => a.id));
    const failed = applicationIds
      .filter((id) => !foundIds.has(id))
      .map((id) => ({ id, email: null, reason: 'Application not found' }));

    const ctx = { loginUrl: getBaseUrl(req), subject, message };
    // Every recipient gets the same subject for a given send (fixed per
    // preset template, or the admin's own `subject` for a custom one) — build
    // once up front rather than recomputing it per recipient below.
    const sentSubject = notificationType.build('Applicant', ctx).subject;

    // Siblings routinely apply on one parent's email address. Sending per
    // application would drop two or three identical messages into that inbox,
    // so group by address and send once, addressed to every applicant it
    // covers. Each application is still logged as notified individually.
    const groups = new Map();
    applications.forEach((app) => {
      const key = (app.email || '').trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(app);
    });
    const recipients = [...groups.values()];

    let notifiedCount = 0;
    let emailCount = 0;
    const notifiedIds = [];

    for (let i = 0; i < recipients.length; i += NOTIFY_BATCH_SIZE) {
      const batch = recipients.slice(i, i + NOTIFY_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((group) => {
          const names = group.map(
            (app) => [app.firstName, app.lastName].filter(Boolean).join(' ') || 'Applicant'
          );
          const template = notificationType.build(formatNames(names), {
            ...ctx,
            applicantCount: group.length,
          });
          return sendEmail(group[0].email, template.subject, template.text, template.html);
        })
      );
      results.forEach((result, idx) => {
        const group = batch[idx];
        if (result.status === 'fulfilled') {
          // One email covered every application on that address.
          emailCount += 1;
          notifiedCount += group.length;
          group.forEach((app) => notifiedIds.push(app.id));
        } else {
          logger.error('Failed to send sixth-form notification', {
            applicationIds: group.map((app) => app.id),
            email: group[0].email,
            type,
            error: result.reason?.message,
          });
          group.forEach((app) => {
            failed.push({
              id: app.id,
              email: app.email,
              reason: result.reason?.message || 'Failed to send email',
            });
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
      emailCount,
      failedCount: failed.length,
    });

    // Mention the email count only when it differs, so the usual send reads
    // exactly as it did before.
    const shared = notifiedCount !== emailCount ? ` in ${emailCount} email(s) — addresses shared by siblings received one message covering each applicant.` : '.';

    res.json({
      message: `${notificationType.label} sent to ${notifiedCount} of ${applicationIds.length} selected applicant(s)${shared}`,
      notifiedCount,
      emailCount,
      failed,
    });
  } catch (error) {
    next(error);
  }
};

// Siblings frequently apply using the same parent's email address, which means
// one login account can own several applications. Return all of them so the
// portal can offer a choice; `application` stays in the response as the newest
// one so older clients keep working.
export const getMyApplication = async (req, res, next) => {
  try {
    const applications = await prisma.sixthFormApplication.findMany({
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

    if (applications.length === 0) {
      return res.status(404).json({ error: 'No application found for this account.' });
    }

    res.json({ application: applications[0], applications });
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
    // An account may own several applications (siblings sharing an email), so
    // the client says which one it is saving. The lookup is always scoped to
    // req.user.id, so an id belonging to someone else simply isn't found.
    // Without an id we fall back to the newest, preserving the old behaviour.
    const { applicationId } = req.body;
    const application = await prisma.sixthFormApplication.findFirst({
      where: applicationId
        ? { id: applicationId, userId: req.user.id }
        : { userId: req.user.id },
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





