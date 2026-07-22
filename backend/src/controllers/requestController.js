import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { getBaseUrl } from '../utils/helpers.js';
import { sendAdminRequestNotification, getNotificationRecipients, isEmailConfigured } from '../services/emailService.js';

// Pull a human-friendly requester name/contact out of a request's metadata or linked user.
const extractRequester = (request) => {
  const student = request.metadata?.studentInfo;
  const name =
    request.user?.name ||
    [student?.firstName, student?.middleName, student?.lastName].filter(Boolean).join(' ') ||
    'Unknown';
  const email = request.user?.email || student?.email || null;
  const phone = student?.phone || student?.phoneNumber || null;
  return { name, email, phone };
};

// Notify staff that a new request was submitted. Failures are logged, never thrown,
// so a notification problem can't break the submission itself.
const notifyAdminOfNewRequest = async (req, request) => {
  if (!isEmailConfigured()) {
    logger.warn('Skipping new-request notification - email service not configured', { requestId: request.id });
    return;
  }
  try {
    const { name, email, phone } = extractRequester(request);
    const requestUrl = `${getBaseUrl(req)}/admin/requests?view=${request.id}`;
    const to = await getNotificationRecipients('notifyGeneralRequests');
    await sendAdminRequestNotification({
      requestType: request.metadata?.requestType || request.title || request.type,
      requesterName: name,
      requesterEmail: email,
      requesterPhone: phone,
      requestId: request.id,
      requestUrl,
      submittedAt: request.createdAt,
    }, to);
    logger.info('New-request notification sent to staff', { requestId: request.id, requestUrl });
  } catch (error) {
    logger.error('Failed to send new-request notification', { requestId: request.id, error: error.message });
  }
};

export const getRequests = async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    // Users can only see their own requests unless they're admin/staff
    // Admin and staff can see all requests (including those without userId)
    if (!req.user || !['ADMIN', 'STAFF'].includes(req.user.role)) {
      where.userId = req.user?.id;
    }
    // Admin/staff see all requests - no userId filter needed (can be null for public requests)
    
    logger.info('Fetching requests', { 
      userRole: req.user?.role, 
      userId: req.user?.id,
      filters: { type, status, search },
      isAdmin: ['ADMIN', 'STAFF'].includes(req.user?.role)
    });

    if (type) where.type = type;
    if (status) where.status = status;

    // Add search functionality using PostgreSQL JSONB operators
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const searchLower = `%${searchTerm.toLowerCase()}%`;
      
      // Use raw SQL for efficient JSONB metadata search
      const metadataSearchIds = await prisma.$queryRaw`
        SELECT id FROM "Request"
        WHERE 
          metadata::text ILIKE ${searchLower}
          OR metadata->'studentInfo'->>'firstName' ILIKE ${searchLower}
          OR metadata->'studentInfo'->>'lastName' ILIKE ${searchLower}
          OR metadata->'studentInfo'->>'middleName' ILIKE ${searchLower}
          OR metadata->'studentInfo'->>'email' ILIKE ${searchLower}
          OR metadata->'studentInfo'->>'phoneNumber' ILIKE ${searchLower}
          OR metadata->>'requestType' ILIKE ${searchLower}
      `;
      
      const metadataIds = metadataSearchIds.map((r) => r.id);
      
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { email: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        },
        ...(metadataIds.length > 0 ? [{ id: { in: metadataIds } }] : []),
      ];
    }

    // Fetch requests from database with optimized query
    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          status: true,
          metadata: true, // Include metadata for frontend display
          response: true, // Include response for display
          createdAt: true,
          updatedAt: true,
          respondedAt: true,
          userId: true,
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

    logger.info('Requests fetched successfully', { 
      count: requests.length, 
      total, 
      userRole: req.user?.role,
      whereClause: JSON.stringify(where)
    });

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
    logger.error('Error fetching requests', { error: error.message, stack: error.stack });
    next(error);
  }
};

export const getRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await prisma.request.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        status: true,
        metadata: true,
        response: true,
        createdAt: true,
        updatedAt: true,
        respondedAt: true,
        userId: true,
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

    await notifyAdminOfNewRequest(req, request);

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
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        status: true,
        metadata: true,
        response: true,
        createdAt: true,
        updatedAt: true,
        respondedAt: true,
        userId: true,
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

    await notifyAdminOfNewRequest(req, request);

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

