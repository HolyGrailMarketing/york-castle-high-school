import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { getBaseUrl } from '../utils/helpers.js';
import { sendAdminSixthFormNotification, getNotificationRecipients, isEmailConfigured } from '../services/emailService.js';

// Sixth Form applications closed on this date. Jamaica does not observe DST,
// so a fixed -05:00 offset is always correct. Kept in sync with the deadline
// shown on sixth-form-application.html.
const SIXTH_FORM_APPLICATION_DEADLINE = new Date('2026-07-20T23:59:59-05:00');

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
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

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
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
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
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
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
    if (Date.now() > SIXTH_FORM_APPLICATION_DEADLINE.getTime()) {
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





