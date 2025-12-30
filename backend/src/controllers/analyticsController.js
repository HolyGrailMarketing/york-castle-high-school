import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const trackEvent = async (req, res, next) => {
  try {
    const { eventType, entityType, entityId, metadata } = req.body;
    const userId = req.user?.id || null;

    await prisma.analytics.create({
      data: {
        eventType,
        entityType,
        entityId,
        userId,
        metadata: metadata || {},
      },
    });

    res.status(201).json({ message: 'Event tracked successfully' });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalApplications,
      totalSixthFormApplications,
      pendingApplications,
      approvedApplications,
      totalBlogPosts,
      totalEvents,
      totalDocuments,
      recentApplications,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.application.count(),
      prisma.sixthFormApplication.count(),
      prisma.application.count({ where: { status: 'PENDING' } }),
      prisma.application.count({ where: { status: 'APPROVED' } }),
      prisma.blogPost.count({ where: { published: true } }),
      prisma.event.count({ where: { isPublic: true } }),
      prisma.document.count({ where: { isPublic: true } }),
      prisma.application.findMany({
        take: 5,
        orderBy: { submittedAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    res.json({
      stats: {
        totalUsers,
        totalApplications,
        totalSixthFormApplications,
        pendingApplications,
        approvedApplications,
        totalBlogPosts,
        totalEvents,
        totalDocuments,
      },
      recentApplications,
    });
  } catch (error) {
    next(error);
  }
};

export const getApplicationAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) where.submittedAt.gte = new Date(startDate);
      if (endDate) where.submittedAt.lte = new Date(endDate);
    }

    const byStatus = await prisma.application.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    // Get monthly application counts
    const applications = await prisma.application.findMany({
      where,
      select: {
        submittedAt: true,
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // Group by month
    const byMonth = applications.reduce((acc, app) => {
      const month = new Date(app.submittedAt).toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const byMonthArray = Object.entries(byMonth)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);

    res.json({
      byStatus,
      byMonth,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserAnalytics = async (req, res, next) => {
  try {
    const [byRole, recentRegistrations] = await Promise.all([
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({
      byRole,
      recentRegistrations,
    });
  } catch (error) {
    next(error);
  }
};

