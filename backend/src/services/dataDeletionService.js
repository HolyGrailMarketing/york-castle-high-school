/**
 * Secure Data Deletion Service
 *
 * Handles data deletion requests with proper retention period management
 * and legal compliance under Jamaican Data Protection Act.
 *
 * Data Retention Periods (based on Jamaican education regulations):
 * - Student academic records: 7 years after graduation
 * - Application data: 3 years after submission
 * - User account data: 2 years of inactivity or upon deletion request
 * - Financial records: 7 years (legal requirement)
 * - Audit logs: 6 years minimum (compliance requirement)
 * - Consent records: 6 years after withdrawal
 */

import prisma from '../utils/prisma.js';
import { auditAdminAction, auditLog } from '../middleware/auditLog.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

// Data retention periods in days
const RETENTION_PERIODS = {
  STUDENT_RECORDS: 7 * 365,      // 7 years
  APPLICATION_DATA: 3 * 365,     // 3 years
  USER_ACCOUNTS: 2 * 365,        // 2 years inactivity
  FINANCIAL_RECORDS: 7 * 365,    // 7 years
  AUDIT_LOGS: 6 * 365,          // 6 years
  CONSENT_RECORDS: 6 * 365,      // 6 years after withdrawal
  GENERAL_DATA: 3 * 365         // 3 years default
};

/**
 * Check if data can be deleted based on retention requirements
 */
export const canDeleteData = (entityType, createdAt, additionalFactors = {}) => {
  const now = new Date();
  const createdDate = new Date(createdAt);
  const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));

  switch (entityType) {
    case 'User':
      // Student records retention
      if (additionalFactors.isStudent) {
        return ageInDays >= RETENTION_PERIODS.STUDENT_RECORDS;
      }
      // General user accounts
      return ageInDays >= RETENTION_PERIODS.USER_ACCOUNTS;

    case 'Application':
    case 'SixthFormApplication':
      return ageInDays >= RETENTION_PERIODS.APPLICATION_DATA;

    case 'AuditLog':
      return ageInDays >= RETENTION_PERIODS.AUDIT_LOGS;

    case 'ConsentRecord':
      // Consent records kept 6 years after withdrawal
      if (additionalFactors.withdrawnAt) {
        const withdrawnDate = new Date(additionalFactors.withdrawnAt);
        const timeSinceWithdrawal = Math.floor((now - withdrawnDate) / (1000 * 60 * 60 * 24));
        return timeSinceWithdrawal >= RETENTION_PERIODS.CONSENT_RECORDS;
      }
      // Active consent records not deleted
      return false;

    case 'BlogPost':
    case 'Event':
    case 'Document':
      // Public content may need to be retained for historical/academic purposes
      return additionalFactors.forceDelete === true;

    default:
      return ageInDays >= RETENTION_PERIODS.GENERAL_DATA;
  }
};

/**
 * Soft delete user account and related data
 * Marks data as deleted but retains for retention period
 */
export const softDeleteUser = async (userId, adminUserId, reason = 'Data subject deletion request') => {
  const transaction = await prisma.$transaction(async (tx) => {
    // Get user details for audit
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check retention requirements
    const canDelete = canDeleteData('User', user.createdAt, {
      isStudent: user.role === 'STUDENT'
    });

    if (!canDelete) {
      throw new Error('User data cannot be deleted due to legal retention requirements');
    }

    // Anonymize user data instead of deleting (for audit and relationship integrity)
    const anonymizedData = {
      name: '[DELETED]',
      email: `deleted_${userId}@deleted.local`,
      phone: null,
      providerId: null,
      picture: null,
      updatedAt: new Date()
    };

    await tx.user.update({
      where: { id: userId },
      data: anonymizedData
    });

    // Log the deletion
    await auditAdminAction('user_deletion', 'User', 1, adminUserId, null, null, null, {
      userId,
      originalEmail: user.email,
      originalName: user.name,
      reason,
      deletionType: 'soft'
    });

    return {
      userId,
      anonymized: true,
      retentionPeriod: RETENTION_PERIODS.STUDENT_RECORDS
    };
  });

  return transaction;
};

/**
 * Hard delete user account and cascade delete related data
 * Only allowed after retention period expires
 */
export const hardDeleteUser = async (userId, adminUserId, reason = 'Retention period expired') => {
  const transaction = await prisma.$transaction(async (tx) => {
    // Get user details before deletion
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            applications: true,
            sixthFormApplications: true,
            enrollments: true,
            requests: true,
            blogPosts: true,
            events: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify retention period has passed
    const canDelete = canDeleteData('User', user.createdAt, {
      isStudent: true // Assume student for maximum retention
    });

    if (!canDelete) {
      throw new Error('Retention period has not expired. Cannot hard delete.');
    }

    // Delete related data in correct order (respecting foreign keys)

    // Delete applications
    await tx.application.deleteMany({
      where: { userId }
    });

    // Delete sixth form applications
    await tx.sixthFormApplication.deleteMany({
      where: { userId }
    });

    // Delete enrollments
    await tx.enrollment.deleteMany({
      where: { userId }
    });

    // Delete requests
    await tx.request.deleteMany({
      where: { userId }
    });

    // Delete blog posts (and their comments if any)
    await tx.blogPost.deleteMany({
      where: { authorId: userId }
    });

    // Delete events
    await tx.event.deleteMany({
      where: { creatorId: userId }
    });

    // Delete consent records
    await tx.consentRecord.deleteMany({
      where: { userId }
    });

    // Delete data subject requests
    await tx.dataSubjectRequest.deleteMany({
      where: { userId }
    });

    // Finally delete the user
    await tx.user.delete({
      where: { id: userId }
    });

    // Log the hard deletion
    await auditAdminAction('user_hard_deletion', 'User', 1, adminUserId, null, null, null, {
      userId,
      originalEmail: user.email,
      originalName: user.name,
      reason,
      deletedRelatedData: user._count
    });

    return {
      userId,
      deleted: true,
      relatedDataDeleted: user._count
    };
  });

  return transaction;
};

/**
 * Delete specific data entity (application, request, etc.)
 */
export const deleteDataEntity = async (entityType, entityId, adminUserId, reason = 'Data subject deletion request') => {
  const transaction = await prisma.$transaction(async (tx) => {
    let entity;
    let canDelete = false;

    // Get entity details and check retention
    switch (entityType) {
      case 'Application':
        entity = await tx.application.findUnique({
          where: { id: entityId },
          select: { id: true, submittedAt: true, userId: true }
        });
        canDelete = entity ? canDeleteData('Application', entity.submittedAt) : false;
        if (canDelete) {
          await tx.application.delete({ where: { id: entityId } });
        }
        break;

      case 'SixthFormApplication':
        entity = await tx.sixthFormApplication.findUnique({
          where: { id: entityId },
          select: { id: true, submittedAt: true, userId: true }
        });
        canDelete = entity ? canDeleteData('SixthFormApplication', entity.submittedAt) : false;
        if (canDelete) {
          await tx.sixthFormApplication.delete({ where: { id: entityId } });
        }
        break;

      case 'Request':
        entity = await tx.request.findUnique({
          where: { id: entityId },
          select: { id: true, createdAt: true, userId: true }
        });
        canDelete = entity ? canDeleteData('Request', entity.createdAt) : false;
        if (canDelete) {
          await tx.request.delete({ where: { id: entityId } });
        }
        break;

      default:
        throw new Error(`Unsupported entity type for deletion: ${entityType}`);
    }

    if (!entity) {
      throw new Error(`${entityType} not found`);
    }

    if (!canDelete) {
      throw new Error(`Cannot delete ${entityType} due to retention requirements`);
    }

    // Log the deletion
    await auditAdminAction('entity_deletion', entityType, 1, adminUserId, null, null, null, {
      entityId,
      userId: entity.userId,
      reason,
      entityType
    });

    return {
      entityType,
      entityId,
      deleted: true
    };
  });

  return transaction;
};

/**
 * Anonymize data instead of deleting (for cases where deletion isn't allowed)
 */
export const anonymizeData = async (entityType, entityId, adminUserId, reason = 'Data anonymization for privacy') => {
  const transaction = await prisma.$transaction(async (tx) => {
    switch (entityType) {
      case 'Application':
        await tx.application.update({
          where: { id: entityId },
          data: {
            firstName: '[ANONYMIZED]',
            lastName: '[ANONYMIZED]',
            email: `anon_${entityId}@anon.local`,
            phone: null,
            address: null,
            previousSchool: null,
            notes: '[ANONYMIZED FOR PRIVACY]'
          }
        });
        break;

      case 'Request':
        await tx.request.update({
          where: { id: entityId },
          data: {
            title: '[ANONYMIZED REQUEST]',
            description: '[ANONYMIZED FOR PRIVACY]',
            response: '[ANONYMIZED FOR PRIVACY]'
          }
        });
        break;

      default:
        throw new Error(`Anonymization not supported for entity type: ${entityType}`);
    }

    // Log the anonymization
    await auditAdminAction('data_anonymization', entityType, 1, adminUserId, null, null, null, {
      entityId,
      reason,
      entityType
    });

    return {
      entityType,
      entityId,
      anonymized: true
    };
  });

  return transaction;
};

/**
 * Schedule data deletion for future execution
 * Useful for setting up retention-based deletions
 */
export const scheduleDeletion = async (entityType, entityId, deletionDate, adminUserId) => {
  // In a real implementation, this would use a job queue system
  // For now, we'll just log the scheduled deletion

  await auditAdminAction('deletion_scheduled', entityType, 1, adminUserId, null, null, null, {
    entityId,
    scheduledFor: deletionDate,
    entityType
  });

  // TODO: Implement job queue system (e.g., Bull, Agenda) for scheduled deletions
  logger.info('Scheduled deletion', { entityType, entityId, deletionDate });

  return {
    entityType,
    entityId,
    scheduledFor: deletionDate
  };
};

/**
 * Process data deletion request from data subject rights endpoint
 */
export const processDeletionRequest = async (requestId, adminUserId) => {
  const request = await prisma.dataSubjectRequest.findUnique({
    where: { id: requestId },
    include: { user: true }
  });

  if (!request || request.status !== 'IN_PROGRESS') {
    throw new Error('Invalid or unverified deletion request');
  }

  const { userId, email } = request;

  if (userId) {
    // Authenticated user deletion
    return await softDeleteUser(userId, adminUserId, 'Data subject deletion request');
  } else {
    // Anonymous deletion request - anonymize data by email
    // This is more complex and requires manual review
    throw new Error('Anonymous deletion requests require manual review. Please contact DPO.');
  }
};

/**
 * Clean up expired data (for scheduled maintenance)
 */
export const cleanupExpiredData = async () => {
  const now = new Date();
  const results = {
    consentRecordsDeleted: 0,
    auditLogsDeleted: 0
  };

  // Delete expired consent records (6 years after withdrawal)
  const expiredConsents = await prisma.consentRecord.findMany({
    where: {
      granted: false,
      withdrawnAt: {
        not: null,
        lt: new Date(now.getTime() - RETENTION_PERIODS.CONSENT_RECORDS * 24 * 60 * 60 * 1000)
      }
    }
  });

  for (const consent of expiredConsents) {
    await prisma.consentRecord.delete({ where: { id: consent.id } });
    results.consentRecordsDeleted++;
  }

  // Delete old audit logs (6+ years)
  const expiredAuditLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: {
        lt: new Date(now.getTime() - RETENTION_PERIODS.AUDIT_LOGS * 24 * 60 * 60 * 1000)
      }
    }
  });

  for (const log of expiredAuditLogs) {
    await prisma.auditLog.delete({ where: { id: log.id } });
    results.auditLogsDeleted++;
  }

  // Log cleanup results
  await auditAdminAction('data_cleanup', 'ExpiredData', results.consentRecordsDeleted + results.auditLogsDeleted,
    null, 'SYSTEM', null, null, results);

  return results;
};