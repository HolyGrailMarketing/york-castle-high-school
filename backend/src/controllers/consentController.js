/**
 * Consent Management Controller
 *
 * Manages user consent for data processing activities under Jamaican Data Protection Act
 * Tracks cookie consent, data processing consent, and marketing consent
 */

import prisma from '../utils/prisma.js';
import { auditLog } from '../middleware/auditLog.js';

// Record consent (for cookie banners, forms, etc.)
export const recordConsent = async (req, res, next) => {
  try {
    const {
      consentType,    // 'cookie_analytics', 'cookie_necessary', 'data_processing', 'marketing', etc.
      purpose,        // Description of what consent is for
      granted,        // boolean
      email,          // For anonymous consent tracking
      userId,         // For authenticated users
      consentMethod,  // 'banner', 'form', 'api', 'verbal', etc.
      ipAddress,
      userAgent,
      expiryDate      // Optional expiry date for consent
    } = req.body;

    // Validate required fields
    if (!consentType || typeof granted !== 'boolean') {
      return res.status(400).json({
        error: 'consentType and granted are required fields'
      });
    }

    // If user is authenticated, use their userId and email
    const finalUserId = userId || (req.user ? req.user.id : null);
    const finalEmail = email || (req.user ? req.user.email : email);

    // Check for existing consent of same type
    const existingConsent = await prisma.consentRecord.findFirst({
      where: {
        consentType,
        OR: [
          finalUserId ? { userId: finalUserId } : { email: finalEmail }
        ],
        granted: true // Only check active consents
      }
    });

    let consentRecord;

    if (existingConsent) {
      // Update existing consent
      consentRecord = await prisma.consentRecord.update({
        where: { id: existingConsent.id },
        data: {
          purpose,
          consentMethod,
          ipAddress: ipAddress || req.ip,
          userAgent: userAgent || req.get('User-Agent')
        }
      });
    } else {
      // Create new consent record
      consentRecord = await prisma.consentRecord.create({
        data: {
          consentType,
          purpose,
          granted,
          email: finalEmail,
          userId: finalUserId,
          consentMethod,
          ipAddress: ipAddress || req.ip,
          userAgent: userAgent || req.get('User-Agent')
        }
      });
    }

    // Log the consent action
    await auditLog(granted ? 'create' : 'update', 'ConsentRecord', consentRecord.id,
      req.user?.id, req.user?.email, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        consentType,
        granted,
        consentMethod
      });

    res.status(201).json({
      message: granted ? 'Consent recorded successfully' : 'Consent preference updated',
      consent: {
        id: consentRecord.id,
        consentType: consentRecord.consentType,
        granted: consentRecord.granted,
        createdAt: consentRecord.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Withdraw consent
export const withdrawConsent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Find the consent record
    const consent = await prisma.consentRecord.findUnique({
      where: { id }
    });

    if (!consent) {
      return res.status(404).json({ error: 'Consent record not found' });
    }

    // Check if user owns this consent or is admin
    if (consent.userId && req.user && req.user.id !== consent.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Withdraw consent
    const updatedConsent = await prisma.consentRecord.update({
      where: { id },
      data: {
        granted: false,
        withdrawnAt: new Date()
      }
    });

    // Log the withdrawal
    await auditLog('update', 'ConsentRecord', id, req.user?.id, req.user?.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      action: 'withdrawn',
      reason
    });

    res.json({
      message: 'Consent withdrawn successfully',
      consent: updatedConsent
    });
  } catch (error) {
    next(error);
  }
};

// Get user's consent history
export const getUserConsentHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const consents = await prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        consentType: true,
        purpose: true,
        granted: true,
        withdrawnAt: true,
        consentMethod: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ consents });
  } catch (error) {
    next(error);
  }
};

// Get consent records by email (for cookie consent tracking)
export const getConsentByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;

    // Admin only or user owns the email
    if (req.user && req.user.role !== 'ADMIN' && req.user.email !== email) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const consents = await prisma.consentRecord.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
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

    res.json({ consents });
  } catch (error) {
    next(error);
  }
};

// Get all consent records (admin only)
export const getAllConsents = async (req, res, next) => {
  try {
    const { consentType, granted, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (consentType) where.consentType = consentType;
    if (granted !== undefined) where.granted = granted === 'true';

    const consents = await prisma.consentRecord.findMany({
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

    const total = await prisma.consentRecord.count({ where });

    res.json({
      consents,
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

// Check consent status for a specific type
export const checkConsentStatus = async (req, res, next) => {
  try {
    const { consentType } = req.params;
    const userId = req.user ? req.user.id : null;
    const email = req.user ? req.user.email : req.query.email;

    if (!email && !userId) {
      return res.status(400).json({ error: 'Email or authentication required' });
    }

    const whereClause = userId
      ? { userId, consentType, granted: true }
      : { email, consentType, granted: true };

    const consent = await prisma.consentRecord.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        consentType: true,
        granted: true,
        withdrawnAt: true,
        consentMethod: true,
        createdAt: true
      }
    });

    res.json({
      consentType,
      hasConsent: !!consent,
      consent: consent || null
    });
  } catch (error) {
    next(error);
  }
};

// Get current user's consents (for privacy policy consent management)
export const getUserConsents = async (req, res, next) => {
  try {
    // Try to get consents by userId if authenticated, otherwise by email
    let whereClause = {};

    if (req.user && req.user.id) {
      whereClause.userId = req.user.id;
    } else if (req.query.email) {
      whereClause.email = req.query.email;
    } else {
      return res.status(400).json({ error: 'Authentication required or email parameter needed' });
    }

    const consents = await prisma.consentRecord.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        consentType: true,
        purpose: true,
        granted: true,
        withdrawnAt: true,
        consentMethod: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ consents });
  } catch (error) {
    next(error);
  }
};

// Withdraw all consents for current user
export const withdrawAllConsents = async (req, res, next) => {
  try {
    const { reason } = req.body;

    let whereClause = {};

    if (req.user && req.user.id) {
      whereClause.userId = req.user.id;
    } else if (req.body.email) {
      whereClause.email = req.body.email;
    } else {
      return res.status(400).json({ error: 'Authentication required or email needed' });
    }

    // Withdraw all active consents
    const result = await prisma.consentRecord.updateMany({
      where: {
        ...whereClause,
        granted: true
      },
      data: {
        granted: false,
        withdrawnAt: new Date()
      }
    });

    // Log the bulk withdrawal
    await auditLog('update', 'ConsentRecord', null, req.user?.id, req.user?.email || req.body.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      action: 'bulk_withdraw',
      withdrawnCount: result.count,
      reason
    });

    res.json({
      success: true,
      message: 'All consents withdrawn successfully',
      withdrawnCount: result.count
    });
  } catch (error) {
    next(error);
  }
};

// Bulk consent operations (admin only)
export const bulkConsentOperation = async (req, res, next) => {
  try {
    const { operation, consentType, userIds, reason } = req.body;

    if (!['withdraw', 'grant'].includes(operation)) {
      return res.status(400).json({ error: 'Invalid operation. Use "withdraw" or "grant"' });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    const updateData = operation === 'withdraw'
      ? { granted: false, withdrawnAt: new Date() }
      : { granted: true, withdrawnAt: null };

    // Update all consents of the specified type for the given users
    const result = await prisma.consentRecord.updateMany({
      where: {
        userId: { in: userIds },
        consentType
      },
      data: updateData
    });

    // Log bulk operation
    await auditLog('update', 'ConsentRecord', null, req.user.id, req.user.email, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      operation,
      consentType,
      userCount: userIds.length,
      updatedCount: result.count,
      reason
    });

    res.json({
      message: `Bulk ${operation} operation completed`,
      operation,
      consentType,
      updatedRecords: result.count,
      userCount: userIds.length
    });
  } catch (error) {
    next(error);
  }
};