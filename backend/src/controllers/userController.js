import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { sendInvitationEmail, isEmailConfigured } from '../services/emailService.js';
import logger from '../utils/logger.js';
import { auditLog } from '../middleware/auditLog.js';

export const getUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          notifyGeneralRequests: true,
          notifySixthFormApps: true,
          notifyAdmissions: true,
          notifyOverdueRequests: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
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

export const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin/staff
    if (id !== req.user.id && !['ADMIN', 'STAFF'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        notifyGeneralRequests: true,
        notifySixthFormApps: true,
        notifyAdmissions: true,
        notifyOverdueRequests: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Audit log personal data access
    await auditLog('read', 'User', id, req.user.id, req.user.email, { accessedByRole: req.user.role }, req.ip || req.connection.remoteAddress, req.get('User-Agent'));

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, password, notifyGeneralRequests, notifySixthFormApps, notifyAdmissions, notifyOverdueRequests } = req.body;

    // Users can only update their own profile unless they're admin
    if (id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Submission notification routing is admin-only - ignore these flags unless
    // the requester is an admin, so a user can't self-assign notifications.
    if (req.user.role === 'ADMIN') {
      if (notifyGeneralRequests !== undefined) updateData.notifyGeneralRequests = Boolean(notifyGeneralRequests);
      if (notifySixthFormApps !== undefined) updateData.notifySixthFormApps = Boolean(notifySixthFormApps);
      if (notifyAdmissions !== undefined) updateData.notifyAdmissions = Boolean(notifyAdmissions);
      if (notifyOverdueRequests !== undefined) updateData.notifyOverdueRequests = Boolean(notifyOverdueRequests);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        notifyGeneralRequests: true,
        notifySixthFormApps: true,
        notifyAdmissions: true,
        notifyOverdueRequests: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get user details before deletion for audit log
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { email: true, name: true, role: true }
    });

    await prisma.user.delete({
      where: { id },
    });

    // Audit log the deletion
    await auditLog('delete', 'User', id, req.user.id, req.user.email, {
      deletedUserEmail: userToDelete?.email,
      deletedUserName: userToDelete?.name,
      deletedUserRole: userToDelete?.role
    }, req.ip || req.connection.remoteAddress, req.get('User-Agent'));

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const {
      email: rawEmail,
      name,
      role,
      phone,
      authMethod = 'GOOGLE',
      notifyGeneralRequests = false,
      notifySixthFormApps = false,
      notifyAdmissions = false,
      notifyOverdueRequests = false,
    } = req.body;

    if (!rawEmail || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // New users must sign in with Google OAuth - email/password accounts are
    // no longer created through this endpoint.
    if (authMethod !== 'GOOGLE') {
      return res.status(400).json({ error: 'New users must use Google OAuth as the authentication method' });
    }

    // Normalize email so it always matches the lowercased address Google
    // returns at sign-in time (and to keep accounts unique by case).
    const email = rawEmail.toLowerCase().trim();

    if (role && !['ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'PARENT'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Validate email domain - all new users authenticate via Google OAuth
    const { validateEmailDomain } = await import('../utils/domainValidator.js');
    const validation = validateEmailDomain(email);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: null, // Google OAuth users have no local password
        name,
        role: role || 'STUDENT',
        phone: phone || null,
        provider: 'GOOGLE',
        providerId: null, // Will be set on first Google sign-in
        picture: null, // Will be set on first Google sign-in
        notifyGeneralRequests: Boolean(notifyGeneralRequests),
        notifySixthFormApps: Boolean(notifySixthFormApps),
        notifyAdmissions: Boolean(notifyAdmissions),
        notifyOverdueRequests: Boolean(notifyOverdueRequests),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        provider: true,
        providerId: true,
        picture: true,
        notifyGeneralRequests: true,
        notifySixthFormApps: true,
        notifyAdmissions: true,
        notifyOverdueRequests: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Send invitation email
    if (isEmailConfigured()) {
      try {
        // Construct login URL - prioritize explicit URL, then derive from sending email domain
        let loginUrl = process.env.FRONTEND_URL || process.env.APP_URL;

        // If no explicit URL, extract domain from sending email address
        if (!loginUrl) {
          const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
          if (fromEmail && fromEmail.includes('@')) {
            // Extract domain from email (e.g., noreply@yorkcastle.edu.jm -> yorkcastle.edu.jm)
            const emailDomain = fromEmail.split('@')[1];
            // Use HTTPS for production domains (not localhost or test domains)
            const protocol = (emailDomain.includes('localhost') || emailDomain.includes('127.0.0.1'))
              ? 'http'
              : 'https';
            loginUrl = `${protocol}://${emailDomain}`;
          } else {
            // Fallback to request host (for development)
            const protocol = req.protocol || 'http';
            const host = req.get('host') || 'localhost:3000';
            loginUrl = `${protocol}://${host}`;
          }
        }

        const fullLoginUrl = `${loginUrl}/admin/login`;
        await sendInvitationEmail(email, name, user.role, authMethod, fullLoginUrl);
        logger.info('Invitation email sent successfully', {
          email,
          name,
          authMethod,
          loginUrl: fullLoginUrl
        });
      } catch (emailError) {
        // Log error but don't fail user creation if email fails
        logger.error('Failed to send invitation email', {
          error: emailError.message,
          stack: emailError.stack,
          email,
          name,
          authMethod,
        });
        // Also log to console for immediate visibility
        logger.error('Failed to send invitation email:', { error: emailError.message });
      }
    } else {
      logger.warn('Email service not configured - invitation email not sent', {
        email,
        name,
        authMethod,
      });
      logger.warn('Email service not configured. Invitation email was not sent.');
      logger.warn('Please configure RESEND_API_KEY and RESEND_FROM_EMAIL in your .env file');
    }

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'PARENT'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent changing own role
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(error);
  }
};