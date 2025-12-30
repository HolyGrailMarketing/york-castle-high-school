import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getRequests = async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // Users can only see their own requests unless they're admin/staff
    if (!['ADMIN', 'STAFF'].includes(req.user.role)) {
      where.userId = req.user.id;
    }

    if (type) where.type = type;
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.request.count({ where }),
    ]);

    res.json({
      requests,
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

export const getRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Users can only view their own requests unless they're admin/staff
    if (request.userId !== req.user.id && !['ADMIN', 'STAFF'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ request });
  } catch (error) {
    next(error);
  }
};

export const createRequest = async (req, res, next) => {
  try {
    const { type, title, description, metadata } = req.body;

    if (!['DOCUMENT', 'DEVICE', 'LAB', 'GENERAL'].includes(type)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    const request = await prisma.request.create({
      data: {
        type,
        title,
        description,
        metadata: metadata || {},
        userId: req.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Request submitted successfully',
      request,
    });
  } catch (error) {
    next(error);
  }
};

export const updateRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, response } = req.body;

    if (!['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const request = await prisma.request.update({
      where: { id },
      data: {
        status,
        response,
        respondedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      message: 'Request status updated successfully',
      request,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Request not found' });
    }
    next(error);
  }
};

export const deleteRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await prisma.request.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Users can only delete their own requests unless they're admin
    if (request.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.request.delete({
      where: { id },
    });

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Request not found' });
    }
    next(error);
  }
};

// Public endpoint for document requests (no authentication required)
export const createPublicRequest = async (req, res, next) => {
  try {
    const { type, title, description, metadata } = req.body;

    if (!['DOCUMENT', 'DEVICE', 'LAB', 'GENERAL'].includes(type)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    // Create request without userId (public submission)
    const request = await prisma.request.create({
      data: {
        type,
        title,
        description,
        metadata: metadata || {},
      },
    });

    res.status(201).json({
      message: 'Request submitted successfully',
      request: {
        id: request.id,
        type: request.type,
        title: request.title,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

