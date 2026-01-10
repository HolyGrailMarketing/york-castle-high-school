/**
 * Data Subject Rights Controller
 *
 * Implements Jamaican Data Protection Act data subject rights:
 * - Right to access personal data
 * - Right to correction
 * - Right to deletion
 * - Right to data portability
 * - Right to restrict processing
 * - Right to object to processing
 *
 * All requests must be processed within 30 days per Jamaican DPA.
 */

import prisma from '../utils/prisma.js';
import pkg from 'express-validator';
const { body, validationResult } = pkg;
import { auditLog } from '../middleware/auditLog.js';

// Validation rules for data subject requests
export const validateDataSubjectRequest = [
  body('requestType').isIn(['access', 'correction', 'deletion', 'portability', 'restriction', 'objection'])
    .withMessage('Invalid request type'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('name').optional().isLength({ min: 1 }).withMessage('Name cannot be empty'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number format'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description too long')
];

// Submit a new data subject request
export const createDataSubjectRequest = async (req, res, next) => {
  try {
    const { requestType, email, name, phone, description, userId } = req.body;

    // If user is authenticated, verify they own the email
    if (userId && req.user && req.user.id !== userId) {
      return res.status(403).json({ error: 'Cannot submit request for another user' });
    }

    // If user is authenticated and email doesn't match, use user's email
    const finalEmail = userId ? req.user.email : email;
    const finalUserId = userId || (req.user ? req.user.id : null);

    const request = await prisma.dataSubjectRequest.create({
      data: {
        requestType,
        email: finalEmail,
        name,
        phone,
        description,
        userId: finalUserId
      }
    });

    // Log the request creation
    await auditLog('create', 'DataSubjectRequest', request.id, req.user?.id, req.user?.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestType
    });

    // Send confirmation email (to be implemented)
    // await sendDataSubjectRequestConfirmation(finalEmail, request.id);

    res.status(201).json({
      message: 'Data subject request submitted successfully',
      request: {
        id: request.id,
        requestType: request.requestType,
        status: request.status,
        createdAt: request.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user's own data subject requests (authenticated users)
export const getUserDataSubjectRequests = async (req, res, next) => {
  try {
    const requests = await prisma.dataSubjectRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        requestType: true,
        status: true,
        createdAt: true,
        completedAt: true,
        response: true
      }
    });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
};

// Get all data subject requests (admin only)
export const getAllDataSubjectRequests = async (req, res, next) => {
  try {
    const { status, requestType, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (requestType) where.requestType = requestType;

    const requests = await prisma.dataSubjectRequest.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const total = await prisma.dataSubjectRequest.count({ where });

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get specific data subject request by ID
export const getDataSubjectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await prisma.dataSubjectRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if user owns this request or is admin
    if (request.userId && req.user && req.user.id !== request.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ request });
  } catch (error) {
    next(error);
  }
};

// Process a data subject request (admin only)
export const processDataSubjectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, response, rejectionReason, responseData } = req.body;

    if (!['IN_PROGRESS', 'COMPLETED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = {
      status,
      completedBy: req.user.id,
      completedAt: status === 'COMPLETED' || status === 'REJECTED' ? new Date() : null
    };

    if (response) updateData.response = response;
    if (rejectionReason) updateData.rejectionReason = rejectionReason;
    if (responseData) updateData.responseData = responseData;

    const request = await prisma.dataSubjectRequest.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Log the processing action
    await auditLog('update', 'DataSubjectRequest', id, req.user.id, req.user.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      newStatus: status,
      previousStatus: request.status
    });

    // Send notification email to user (to be implemented)
    // await sendDataSubjectRequestUpdate(request.email, request);

    res.json({
      message: 'Request processed successfully',
      request
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Request not found' });
    }
    next(error);
  }
};

// Get all personal data for access requests
export const getPersonalData = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    // Verify the request belongs to authenticated user or admin
    const request = await prisma.dataSubjectRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.userId && req.user && req.user.id !== request.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow access to verified requests
    if (request.status !== 'IN_PROGRESS' || !request.verifiedAt) {
      return res.status(400).json({ error: 'Request must be verified before data access' });
    }

    // Gather all personal data for this user
    const userId = request.userId;
    const email = request.email;

    const data = {};

    if (userId) {
      // Get user account data
      data.user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          provider: true,
          createdAt: true,
          updatedAt: true
          // Note: password is never included in exports
        }
      });

      // Get applications
      data.applications = await prisma.application.findMany({
        where: { userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          address: true,
          previousSchool: true,
          gradeApplying: true,
          status: true,
          submittedAt: true
        }
      });

      // Get sixth form applications
      data.sixthFormApplications = await prisma.sixthFormApplication.findMany({
        where: { userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          address: true,
          previousSchool: true,
          subjectChoices: true,
          status: true,
          submittedAt: true
        }
      });

      // Get enrollments
      data.enrollments = await prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            select: {
              name: true,
              code: true,
              description: true
            }
          }
        }
      });

      // Get requests
      data.requests = await prisma.request.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          respondedAt: true,
          response: true
        }
      });

      // Get blog posts (if author)
      data.blogPosts = await prisma.blogPost.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          published: true,
          publishedAt: true,
          createdAt: true
        }
      });

      // Get events (if creator)
      data.events = await prisma.event.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          title: true,
          description: true,
          startDate: true,
          endDate: true,
          location: true,
          isPublic: true,
          createdAt: true
        }
      });
    }

    // Get consent records by email
    data.consentRecords = await prisma.consentRecord.findMany({
      where: { email },
      select: {
        id: true,
        consentType: true,
        purpose: true,
        granted: true,
        withdrawnAt: true,
        consentMethod: true,
        createdAt: true
      }
    });

    // Get data subject requests by email
    data.dataSubjectRequests = await prisma.dataSubjectRequest.findMany({
      where: { email },
      select: {
        id: true,
        requestType: true,
        status: true,
        createdAt: true,
        completedAt: true,
        response: true
      }
    });

    // Log the data access
    await auditLog('export', 'PersonalData', requestId, req.user?.id, req.user?.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      email: email,
      userId: userId,
      requestType: 'access'
    });

    res.json({
      message: 'Personal data retrieved successfully',
      exportDate: new Date().toISOString(),
      data
    });
  } catch (error) {
    next(error);
  }
};

// Export personal data as JSON file
export const exportPersonalData = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    // Get the data (reuse the logic from getPersonalData)
    const { requestId: _, ...request } = req;
    req.params.requestId = requestId;

    // This would call the getPersonalData logic
    // For now, return a placeholder response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="personal-data-${requestId}.json"`);

    // In a real implementation, you'd get the data and send it
    res.json({
      message: 'Data export functionality to be implemented',
      requestId,
      exportDate: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Request data correction
export const requestDataCorrection = async (req, res, next) => {
  try {
    const { field, currentValue, requestedValue, reason } = req.body;

    // Create a correction request
    const request = await prisma.dataSubjectRequest.create({
      data: {
        requestType: 'correction',
        email: req.user.email,
        name: req.user.name,
        userId: req.user.id,
        description: `Correction request: ${field} - Current: ${currentValue} - Requested: ${requestedValue} - Reason: ${reason}`
      }
    });

    // Log the correction request
    await auditLog('create', 'DataSubjectRequest', request.id, req.user.id, req.user.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestType: 'correction',
      field
    });

    res.status(201).json({
      message: 'Correction request submitted successfully',
      request: {
        id: request.id,
        requestType: 'correction',
        status: request.status,
        createdAt: request.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Request data deletion
export const requestDataDeletion = async (req, res, next) => {
  try {
    const { reason } = req.body;

    // Create a deletion request
    const request = await prisma.dataSubjectRequest.create({
      data: {
        requestType: 'deletion',
        email: req.user.email,
        name: req.user.name,
        userId: req.user.id,
        description: `Deletion request - Reason: ${reason}`
      }
    });

    // Log the deletion request
    await auditLog('create', 'DataSubjectRequest', request.id, req.user.id, req.user.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestType: 'deletion'
    });

    res.status(201).json({
      message: 'Deletion request submitted successfully. Your data will be deleted after verification and retention period review.',
      request: {
        id: request.id,
        requestType: 'deletion',
        status: request.status,
        createdAt: request.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verify identity for request processing
export const verifyRequestIdentity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { verificationMethod } = req.body; // 'email', 'document', 'phone', etc.

    // In a real implementation, you'd send verification emails, check documents, etc.
    // For now, we'll mark as verified for demo purposes

    const request = await prisma.dataSubjectRequest.update({
      where: { id },
      data: {
        verifiedAt: new Date()
      }
    });

    // Log the verification
    await auditLog('update', 'DataSubjectRequest', id, req.user?.id, req.user?.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      action: 'verified',
      verificationMethod
    });

    res.json({
      message: 'Identity verified successfully',
      request
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Request not found' });
    }
    next(error);
  }
};