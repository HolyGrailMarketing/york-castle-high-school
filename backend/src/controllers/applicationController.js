import { PrismaClient } from '@prisma/client';
import { sendApplicationStatusEmail } from '../services/emailService.js';

const prisma = new PrismaClient();

export const getApplications = async (req, res, next) => {
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
      prisma.application.findMany({
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
      prisma.application.count({ where }),
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

export const getApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
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

    // Users can only view their own applications unless they're admin/staff
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

export const createApplication = async (req, res, next) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      previousSchool,
      gradeApplying,
    } = req.body;

    // Check if user is authenticated
    const userId = req.user?.id || null;

    const application = await prisma.application.create({
      data: {
        firstName,
        middleName,
        lastName,
        email,
        phone,
        dateOfBirth: new Date(dateOfBirth),
        address,
        previousSchool,
        gradeApplying: parseInt(gradeApplying),
        userId,
      },
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      application,
    });
  } catch (error) {
    next(error);
  }
};

export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WAITLISTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const application = await prisma.application.update({
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

    // Send email notification if status changed to approved/rejected/waitlisted
    if (['APPROVED', 'REJECTED', 'WAITLISTED'].includes(status)) {
      try {
        const recipientEmail = application.email;
        const recipientName = `${application.firstName} ${application.lastName}`;
        await sendApplicationStatusEmail(recipientEmail, recipientName, status);
      } catch (error) {
        console.error('Failed to send email notification:', error);
        // Don't fail the request if email fails
      }
    }

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

export const deleteApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.application.delete({
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

