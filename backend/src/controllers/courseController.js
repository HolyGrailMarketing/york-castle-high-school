import prisma from '../utils/prisma.js';
import { invalidateCoursesCache } from '../services/cacheService.js';

export const getCourses = async (req, res, next) => {
  try {
    const { pool, isActive, search, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (pool) where.pool = parseInt(pool);
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy: [{ pool: 'asc' }, { name: 'asc' }],
      }),
      prisma.course.count({ where }),
    ]);

    res.json({
      courses,
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

export const getCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ course });
  } catch (error) {
    next(error);
  }
};

export const createCourse = async (req, res, next) => {
  try {
    const { name, code, description, pool, teacher, passRate, capacity } = req.body;

    const course = await prisma.course.create({
      data: {
        name,
        code,
        description,
        pool: pool ? parseInt(pool) : null,
        teacher,
        passRate: passRate ? parseFloat(passRate) : null,
        capacity: capacity ? parseInt(capacity) : null,
      },
    });

    // Invalidate cache for courses list
    invalidateCoursesCache();

    res.status(201).json({
      message: 'Course created successfully',
      course,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A course with this code already exists' });
    }
    next(error);
  }
};

export const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, pool, teacher, passRate, capacity, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (code) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (pool !== undefined) updateData.pool = pool ? parseInt(pool) : null;
    if (teacher !== undefined) updateData.teacher = teacher;
    if (passRate !== undefined) updateData.passRate = passRate ? parseFloat(passRate) : null;
    if (capacity !== undefined) updateData.capacity = capacity ? parseInt(capacity) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const course = await prisma.course.update({
      where: { id },
      data: updateData,
    });

    // Invalidate cache for courses list
    invalidateCoursesCache();

    res.json({
      message: 'Course updated successfully',
      course,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A course with this code already exists' });
    }
    next(error);
  }
};

export const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.course.delete({
      where: { id },
    });

    // Invalidate cache for courses list
    invalidateCoursesCache();

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Course not found' });
    }
    next(error);
  }
};

export const getEnrollments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    res.json({ enrollments });
  } catch (error) {
    next(error);
  }
};

export const enrollStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // Students can only enroll themselves, admins/staff can enroll anyone
    const targetUserId = userId || req.user.id;
    if (targetUserId !== req.user.id && !['ADMIN', 'STAFF'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if course exists and has capacity
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!course.isActive) {
      return res.status(400).json({ error: 'Course is not active' });
    }

    if (course.capacity && course._count.enrollments >= course.capacity) {
      return res.status(400).json({ error: 'Course is full' });
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: targetUserId,
          courseId: id,
        },
      },
    });

    if (existingEnrollment) {
      return res.status(409).json({ error: 'Already enrolled in this course' });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: targetUserId,
        courseId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Update course enrollment count
    await prisma.course.update({
      where: { id },
      data: {
        enrolled: {
          increment: 1,
        },
      },
    });

    res.status(201).json({
      message: 'Enrolled successfully',
      enrollment,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Already enrolled in this course' });
    }
    next(error);
  }
};

export const unenrollStudent = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    await prisma.enrollment.delete({
      where: {
        userId_courseId: {
          userId,
          courseId: id,
        },
      },
    });

    // Update course enrollment count
    await prisma.course.update({
      where: { id },
      data: {
        enrolled: {
          decrement: 1,
        },
      },
    });

    res.json({ message: 'Unenrolled successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    next(error);
  }
};





