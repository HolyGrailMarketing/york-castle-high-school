/**
 * Audit Logging Middleware
 *
 * Logs all data access and modification activities for compliance with
 * Jamaican Data Protection Act. Maintains audit trail for 6+ years.
 */

import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';

// Audit log function
export const auditLog = async (
  action,           // 'create', 'read', 'update', 'delete', 'export', 'access'
  entityType,       // 'User', 'Application', 'Request', etc.
  entityId,         // ID of the entity being acted upon
  userId = null,    // User performing the action (null for anonymous)
  userEmail = null, // Email for audit purposes
  metadata = {},    // Additional context
  ipAddress = null,
  userAgent = null
) => {
  try {
    // Skip audit logging if disabled (for performance in high-volume operations)
    if (process.env.DISABLE_AUDIT_LOGGING === 'true') {
      return;
    }

    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId,
        userEmail,
        ipAddress,
        userAgent,
        metadata,
        createdAt: new Date()
      }
    });

    // In development, log to console for debugging
    if (process.env.NODE_ENV === 'development') {
      logger.info('Audit log', { action, entityType, entityId, userEmail: userEmail || 'anonymous' });
    }
  } catch (error) {
    // Don't let audit logging failures break the main operation
    // Log to console in production for monitoring
    logger.error('Audit logging failed:', { error: error.message });
  }
};

// Middleware to log API requests that access personal data
export const auditMiddleware = (req, res, next) => {
  // Store original send method to capture response
  const originalSend = res.send;
  res.send = function(data) {
    // Log the request after response is sent
    setImmediate(() => {
      logApiRequest(req, res, data);
    });
    originalSend.call(this, data);
  };

  next();
};

// Log API requests that involve personal data
const logApiRequest = async (req, res, data) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    // Determine if this request accesses personal data
    const personalDataRoutes = [
      '/api/users',
      '/api/applications',
      '/api/sixth-form',
      '/api/requests',
      '/api/data-subject',
      '/api/consent'
    ];

    const isPersonalDataRoute = personalDataRoutes.some(route =>
      req.path.startsWith(route)
    );

    if (!isPersonalDataRoute) {
      return; // Skip logging non-personal data routes
    }

    // Determine action type based on HTTP method
    let action = 'access';
    switch (req.method) {
      case 'GET':
        action = 'read';
        break;
      case 'POST':
        action = 'create';
        break;
      case 'PUT':
      case 'PATCH':
        action = 'update';
        break;
      case 'DELETE':
        action = 'delete';
        break;
    }

    // Extract entity type from URL
    let entityType = 'Unknown';
    let entityId = null;

    if (req.path.includes('/users/')) {
      entityType = 'User';
      entityId = req.params.id;
    } else if (req.path.includes('/applications/')) {
      entityType = 'Application';
      entityId = req.params.id;
    } else if (req.path.includes('/sixth-form/')) {
      entityType = 'SixthFormApplication';
      entityId = req.params.id;
    } else if (req.path.includes('/requests/')) {
      entityType = 'Request';
      entityId = req.params.id;
    } else if (req.path.includes('/data-subject/')) {
      entityType = 'DataSubjectRequest';
      entityId = req.params.id;
    } else if (req.path.includes('/consent/')) {
      entityType = 'ConsentRecord';
      entityId = req.params.id;
    } else if (req.path.includes('/blog/')) {
      entityType = 'BlogPost';
      entityId = req.params.id;
    } else if (req.path.includes('/events/')) {
      entityType = 'Event';
      entityId = req.params.id;
    } else if (req.path.includes('/documents/')) {
      entityType = 'Document';
      entityId = req.params.id;
    } else if (req.path.includes('/courses/')) {
      entityType = 'Course';
      entityId = req.params.id;
    }

    // Log the access
    await auditLog(action, entityType, entityId, userId, userEmail, {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode,
      responseSize: data ? data.length : 0
    }, ipAddress, userAgent);

  } catch (error) {
    logger.error('API audit logging failed:', { error: error.message });
  }
};

// Specific audit function for data exports
export const auditDataExport = async (
  exportType,      // 'personal_data', 'user_data', 'application_data'
  recordCount,
  userId,
  userEmail,
  ipAddress,
  userAgent,
  filters = {}
) => {
  await auditLog('export', 'DataExport', null, userId, userEmail, {
    exportType,
    recordCount,
    filters
  }, ipAddress, userAgent);
};

// Audit function for admin actions
export const auditAdminAction = async (
  action,          // 'bulk_delete', 'bulk_update', 'system_config', etc.
  targetEntity,    // What was affected
  affectedCount,
  adminUserId,
  adminEmail,
  ipAddress,
  userAgent,
  details = {}
) => {
  await auditLog('admin', 'AdminAction', null, adminUserId, adminEmail, {
    action,
    targetEntity,
    affectedCount,
    ...details
  }, ipAddress, userAgent);
};

// Audit function for consent changes
export const auditConsentChange = async (
  consentType,
  granted,
  userId,
  userEmail,
  ipAddress,
  userAgent,
  consentMethod
) => {
  await auditLog(granted ? 'consent_granted' : 'consent_withdrawn', 'Consent', null, userId, userEmail, {
    consentType,
    granted,
    consentMethod
  }, ipAddress, userAgent);
};

// Audit function for data subject requests
export const auditDataSubjectRequest = async (
  requestType,
  requestId,
  userId,
  userEmail,
  ipAddress,
  userAgent
) => {
  await auditLog('data_subject_request', 'DataSubjectRequest', requestId, userId, userEmail, {
    requestType
  }, ipAddress, userAgent);
};

// Alias for backward compatibility
export const createAuditLog = auditLog;