import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { getBaseUrl, extractRequester } from '../utils/helpers.js';
import { sendAdminRequestNotification, sendRequestAssignmentNotification, getNotificationRecipients, isEmailConfigured } from '../services/emailService.js';

// Field selection reused across request queries. Includes the assigned staff
// member so the admin dashboard can show and filter by assignee.
const requestSelect = {
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
  assignedToId: true,
  assignedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
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
    const { type, status, page = 1, limit = 20, search, assignedTo } = req.query;
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
      filters: { type, status, search, assignedTo },
      isAdmin: ['ADMIN', 'STAFF'].includes(req.user?.role)
    });

    if (type) where.type = type;
    if (status) where.status = status;

    // Filter by assignee. 'me' resolves to the current user so staff can see the
    // requests assigned to them; 'unassigned' finds requests with no assignee;
    // otherwise treat the value as a specific staff user id.
    if (assignedTo) {
      if (assignedTo === 'me') {
        where.assignedToId = req.user?.id;
      } else if (assignedTo === 'unassigned') {
        where.assignedToId = null;
      } else {
        where.assignedToId = assignedTo;
      }
    }

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
        select: requestSelect,
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
      select: requestSelect,
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
      select: requestSelect,
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

// Notify a staff member that a request has been assigned to them. Failures are
// logged, never thrown, so an email problem can't fail the assignment itself.
const notifyStaffOfAssignment = async (req, request, staff, assignedByName) => {
  if (!staff?.email) return;
  if (!isEmailConfigured()) {
    logger.warn('Skipping assignment notification - email service not configured', { requestId: request.id });
    return;
  }
  try {
    const { name, email, phone } = extractRequester(request);
    const requestUrl = `${getBaseUrl(req)}/admin/requests?view=${request.id}`;
    await sendRequestAssignmentNotification(staff.email, {
      staffName: staff.name,
      requestType: request.metadata?.requestType || request.title || request.type,
      requesterName: name,
      requesterEmail: email,
      requesterPhone: phone,
      assignedByName,
      requestId: request.id,
      requestUrl,
      submittedAt: request.createdAt,
    });
    logger.info('Assignment notification sent to staff', { requestId: request.id, staffEmail: staff.email });
  } catch (error) {
    logger.error('Failed to send assignment notification', { requestId: request.id, error: error.message });
  }
};

// Assign (or unassign) a request to a staff member. Admin/staff only.
export const assignRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    const existing = await prisma.request.findUnique({
      where: { id },
      select: { id: true, assignedToId: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Validate the target user (when assigning) is a staff member.
    let staff = null;
    if (assignedToId) {
      staff = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, name: true, email: true, role: true },
      });
      if (!staff) {
        return res.status(404).json({ error: 'Assignee not found' });
      }
      if (staff.role !== 'STAFF') {
        return res.status(400).json({ error: 'Requests can only be assigned to users with the staff role' });
      }
    }

    const request = await prisma.request.update({
      where: { id },
      data: {
        assignedToId: assignedToId || null,
        assignedAt: assignedToId ? new Date() : null,
      },
      select: requestSelect,
    });

    // Only email when the assignee actually changed to a (new) staff member,
    // so re-saving the same assignee or unassigning doesn't send a notice.
    if (assignedToId && assignedToId !== existing.assignedToId) {
      await notifyStaffOfAssignment(req, request, staff, req.user?.name);
    }

    res.json({
      message: assignedToId ? 'Request assigned successfully' : 'Request unassigned successfully',
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

