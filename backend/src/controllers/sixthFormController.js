import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';

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

    // Resolve userId: prefer logged-in user, else look up by email
    let userId = req.user?.id || null;
    let generatedPassword = null;

    if (!userId) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
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





