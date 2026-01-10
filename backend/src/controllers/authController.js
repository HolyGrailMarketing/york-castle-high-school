import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmailDomain, isAllowedDomain } from '../utils/domainValidator.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import logger from '../utils/logger.js';


// Configure Google OAuth Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName || profile.name?.givenName + ' ' + profile.name?.familyName;
          const picture = profile.photos?.[0]?.value;
          const providerId = profile.id;

          if (!email) {
            return done(new Error('No email found in Google profile'), null);
          }

          // Validate domain
          if (!isAllowedDomain(email)) {
            return done(new Error('Email domain not allowed'), null);
          }

          // Check if user exists (must be pre-created by admin)
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            return done(new Error('User account not found. Please contact your administrator.'), null);
          }

          // Update user with Google info if not already set
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
              providerId: providerId || user.providerId,
              picture: picture || user.picture,
              name: name || user.name,
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
              createdAt: true,
            },
          });

          return done(null, updatedUser);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
} else {
  logger.warn('Google OAuth credentials not configured. Google Sign-In will not be available.');
}

export const register = async (req, res, next) => {
  try {
    const { email, password, name, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (default role is STUDENT, only admins can create other roles)
    const userRole = role && req.user?.role === 'ADMIN' ? role : 'STUDENT';

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: userRole,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    logger.error('Registration error:', { error: error.message });
    if (error.code === 'P1001') {
      return res.status(503).json({
        error: 'Database connection failed',
        message: 'Please check your database configuration',
      });
    }
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Check if user is OAuth-only (no password)
    if (user.provider === 'GOOGLE' && !user.password) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'This account uses Google Sign-In. Please sign in with Google.',
      });
    }

    // Verify password (only for EMAIL provider users)
    if (!user.password) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    logger.error('Login error:', { error: error.message });
    if (error.code === 'P1001') {
      return res.status(503).json({
        error: 'Database connection failed',
        message: 'Please check your database configuration. Make sure PostgreSQL is running and DATABASE_URL is correct in .env file',
      });
    }
    next(error);
  }
};

export const logout = async (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  // In a production app, you might want to implement token blacklisting
  res.json({ message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  res.json({
    user: req.user,
  });
};

export const updateMe = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    // Don't allow empty values
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No fields to update',
        message: 'Please provide at least one field to update (name or phone)',
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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

    // Audit log the update
    const { createAuditLog } = await import('../middleware/auditLog.js');
    await createAuditLog('update', 'User', userId, req.user.id, req.user.email, {
      changes: updateData,
    }, req.ip || req.connection.remoteAddress, req.get('User-Agent'));

    res.json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'User not found',
        message: 'The user account could not be found',
      });
    }
    next(error);
  }
};

// Google OAuth handlers
export const googleAuth = (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'Google OAuth not configured',
      message: 'Google Sign-In is not available. Please configure Google OAuth credentials.',
    });
  }
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
  })(req, res, next);
};

export const googleCallback = async (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'Google OAuth not configured',
      message: 'Google Sign-In is not available. Please configure Google OAuth credentials.',
    });
  }
  
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    if (err) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: err.message || 'Google authentication failed',
      });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: info?.message || 'Failed to authenticate with Google',
      });
    }

    try {
      // Generate JWT token
      const token = generateToken(user.id);

      // Redirect to frontend with token
      // Since we're serving from the same server, use relative path
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      res.redirect(`${baseUrl}/admin/auth/callback?token=${token}`);
    } catch (error) {
      next(error);
    }
  })(req, res, next);
};
