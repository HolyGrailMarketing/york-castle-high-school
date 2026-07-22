import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmailDomain, isAllowedDomain } from '../utils/domainValidator.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import logger from '../utils/logger.js';


// Configure Google OAuth Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Determine callback URL - prioritize environment variable, then construct
  // In production, MUST be full HTTPS URL for Google OAuth to work
  let callbackURL = process.env.GOOGLE_CALLBACK_URL;
  
  // If not set, construct from environment
  if (!callbackURL) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV) {
      // Production - use HTTPS URL from environment or default
      if (process.env.VERCEL_URL) {
        // Vercel provides VERCEL_URL (may or may not include protocol)
        const vercelUrl = process.env.VERCEL_URL.startsWith('http') 
          ? process.env.VERCEL_URL 
          : `https://${process.env.VERCEL_URL}`;
        callbackURL = `${vercelUrl}/api/auth/google/callback`;
      } else if (process.env.CORS_ORIGIN) {
        // Use first origin from CORS_ORIGIN, ensure HTTPS
        const origins = process.env.CORS_ORIGIN.split(',');
        let baseUrl = origins[0].trim();
        // Force HTTPS in production
        if (baseUrl.startsWith('http://')) {
          baseUrl = baseUrl.replace('http://', 'https://');
        } else if (!baseUrl.startsWith('http')) {
          baseUrl = `https://${baseUrl}`;
        }
        callbackURL = `${baseUrl}/api/auth/google/callback`;
      } else {
        // Production default - must use HTTPS for yorkcastlehighschool.org
        // Use www version as primary, but both www and non-www should be registered in Google Console
        callbackURL = 'https://www.yorkcastlehighschool.org/api/auth/google/callback';
      }
    } else {
      // Development default - can be relative or localhost
      callbackURL = process.env.PORT 
        ? `http://localhost:${process.env.PORT}/api/auth/google/callback`
        : 'http://localhost:3000/api/auth/google/callback';
    }
  } else {
    // Environment variable is set - validate and ensure HTTPS in production
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV) {
      if (callbackURL.startsWith('http://')) {
        logger.warn('GOOGLE_CALLBACK_URL uses HTTP in production - forcing HTTPS', {
          original: callbackURL,
          service: 'york-castle-api'
        });
        callbackURL = callbackURL.replace('http://', 'https://');
      }
      // Ensure it doesn't use localhost in production
      if (callbackURL.includes('localhost')) {
        logger.warn('GOOGLE_CALLBACK_URL uses localhost in production - using default', {
          original: callbackURL,
          service: 'york-castle-api'
        });
        callbackURL = 'https://www.yorkcastlehighschool.org/api/auth/google/callback';
      }
    }
  }

  logger.info('Google OAuth Strategy configured', { 
    clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'not set',
    callbackURL,
    environment: process.env.NODE_ENV || 'development',
    vercel: !!process.env.VERCEL,
    service: 'york-castle-api'
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          logger.info('Google OAuth profile received', {
            profileId: profile.id,
            hasEmail: !!profile.emails?.[0]?.value,
            hasName: !!profile.displayName,
            service: 'york-castle-api'
          });

          const email = profile.emails?.[0]?.value?.toLowerCase().trim();
          const name = profile.displayName || profile.name?.givenName + ' ' + profile.name?.familyName;
          const picture = profile.photos?.[0]?.value;
          const providerId = profile.id;

          if (!email) {
            logger.warn('Google OAuth profile missing email', {
              profileId: profile.id,
              emails: profile.emails,
              service: 'york-castle-api'
            });
            return done(new Error('No email found in Google profile'), null);
          }

          // Look up the user first (accounts must be pre-created — students get
          // one automatically when they submit an application). Match
          // case-insensitively so mixed-case emails resolve against Google's
          // lowercased address.
          let user;
          try {
            user = await prisma.user.findFirst({
              where: { email: { equals: email, mode: 'insensitive' } },
            });
          } catch (dbError) {
            logger.error('Database error finding user in Google OAuth', {
              error: dbError.message,
              code: dbError.code,
              email,
              service: 'york-castle-api'
            });
            return done(new Error('Database connection error. Please try again later.'), null);
          }

          if (!user) {
            logger.warn('Google OAuth user not found in database', {
              email,
              profileId: profile.id,
              service: 'york-castle-api'
            });
            // No auto-provisioning — surface a friendly "no account" outcome so
            // the callback can redirect the applicant back with guidance.
            return done(null, false, { message: 'NO_ACCOUNT' });
          }

          // Staff accounts must use an approved school domain. Students/parents
          // apply with personal emails (e.g. Gmail), so any domain is allowed
          // for them.
          const STAFF_ROLES = ['ADMIN', 'STAFF', 'TEACHER'];
          if (STAFF_ROLES.includes(user.role) && !isAllowedDomain(email)) {
            logger.warn('Google OAuth staff email domain not allowed', {
              email,
              role: user.role,
              profileId: profile.id,
              service: 'york-castle-api'
            });
            return done(null, false, { message: 'DOMAIN_NOT_ALLOWED' });
          }

          logger.info('Google OAuth user validated', {
            email,
            role: user.role,
            domain: email.split('@')[1],
            service: 'york-castle-api'
          });

          logger.info('Google OAuth user found in database', {
            userId: user.id,
            email: user.email,
            existingProvider: user.provider,
            service: 'york-castle-api'
          });

          // Update user with Google info - set provider and update fields that are provided
          let updatedUser;
          try {
            // Build update data object - always set provider to GOOGLE when using Google OAuth
            const updateData = {
              provider: 'GOOGLE',
            };

            // Set providerId if provided (Google always provides this)
            if (providerId) {
              updateData.providerId = providerId;
            }

            // Set picture if provided and valid
            if (picture) {
              updateData.picture = picture;
            }

            // Set name if provided (Google always provides this via displayName)
            if (name) {
              updateData.name = name;
            }

            updatedUser = await prisma.user.update({
              where: { id: user.id },
              data: updateData,
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

            logger.info('Google OAuth user updated successfully', {
              userId: updatedUser.id,
              email: updatedUser.email,
              provider: updatedUser.provider,
              service: 'york-castle-api'
            });
          } catch (updateError) {
            logger.error('Database error updating user in Google OAuth', {
              error: updateError.message,
              code: updateError.code,
              stack: updateError.stack,
              userId: user.id,
              email: user.email,
              service: 'york-castle-api'
            });
            
            // If update fails due to record not found, return error
            if (updateError.code === 'P2025') {
              logger.warn('User was deleted during OAuth flow', {
                userId: user.id,
                email: user.email,
                service: 'york-castle-api'
              });
              return done(new Error('User account not found. Please contact your administrator.'), null);
            }
            
            // If update fails for other reasons (e.g., database connection), still try to proceed with existing user
            // This allows authentication to continue even if profile update fails
            logger.warn('User update failed but proceeding with authentication', {
              userId: user.id,
              email: user.email,
              updateError: updateError.message,
              service: 'york-castle-api'
            });
            updatedUser = user;
          }

          return done(null, updatedUser);
        } catch (error) {
          logger.error('Unexpected error in Google OAuth strategy callback', {
            error: error.message,
            stack: error.stack,
            code: error.code,
            profileId: profile?.id,
            service: 'york-castle-api'
          });
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
    const { email: rawEmail, password, name, phone, role } = req.body;
    const email = rawEmail?.toLowerCase().trim();

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
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

    // Find user (case-insensitive so login isn't sensitive to email casing)
    const user = await prisma.user.findFirst({
      where: { email: { equals: email?.toLowerCase().trim(), mode: 'insensitive' } },
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
// --- Password reset ---
// The reset token is a short-lived JWT signed with a per-user secret that
// includes the current password hash. That makes it single-use (it stops
// verifying once the password changes) without needing any DB columns.
const resetSecret = (user) => `${process.env.JWT_SECRET}|pwreset|${user.password || 'nopw'}`;
const signResetToken = (user) => jwt.sign({ userId: user.id, type: 'password_reset' }, resetSecret(user), { expiresIn: '1h' });

const resolveBaseUrl = (req) => {
  const proto = req.headers['x-forwarded-proto'] ||
    (process.env.NODE_ENV === 'production' ? 'https' : req.protocol) || 'https';
  const host = req.get('host') || req.headers.host || 'www.yorkcastlehighschool.org';
  const finalProto = (process.env.NODE_ENV === 'production' || process.env.VERCEL) ? 'https' : proto;
  return `${finalProto}://${host}`;
};

export const forgotPassword = async (req, res, next) => {
  // Always return the same response so the endpoint can't be used to discover
  // which emails have accounts.
  const generic = { message: 'If an account exists for that email, we’ve sent a link to reset your password.' };
  try {
    const email = req.body.email?.toLowerCase().trim();
    if (!email) return res.json(generic);

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (user) {
      const token = signResetToken(user);
      const resetUrl = `${resolveBaseUrl(req)}/reset-password.html?token=${encodeURIComponent(token)}`;
      try {
        await sendPasswordResetEmail(user.email, user.name, resetUrl);
        logger.info('Password reset email sent', { userId: user.id });
      } catch (mailError) {
        // Don't leak failures to the client; log for ops.
        logger.error('Failed to send password reset email', { userId: user.id, error: mailError.message });
      }
    }

    return res.json(generic);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const invalid = { error: 'This reset link is invalid or has expired. Please request a new one.' };

    if (!token) return res.status(400).json({ error: 'Reset token is required' });

    // Read userId without verifying so we can fetch the per-user secret.
    const decoded = jwt.decode(token);
    if (!decoded || decoded.type !== 'password_reset' || !decoded.userId) {
      return res.status(400).json(invalid);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(400).json(invalid);

    try {
      jwt.verify(token, resetSecret(user)); // throws if expired, tampered, or already used
    } catch {
      return res.status(400).json(invalid);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    logger.info('Password reset completed', { userId: user.id });
    return res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'Google OAuth not configured',
      message: 'Google Sign-In is not available. Please configure Google OAuth credentials.',
    });
  }
  
  // Determine callback URL - ensure HTTPS in production
  let callbackURL = process.env.GOOGLE_CALLBACK_URL;
  
  // If not set in env, construct from request (but ensure HTTPS in production)
  if (!callbackURL) {
    // In production, use HTTPS from environment or construct from host
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV) {
      // Use Vercel URL or construct from host header
      if (process.env.VERCEL_URL) {
        callbackURL = `https://${process.env.VERCEL_URL}/api/auth/google/callback`;
      } else if (req.headers.host) {
        // Ensure HTTPS in production (Vercel/CloudFlare should set X-Forwarded-Proto)
        const protocol = req.headers['x-forwarded-proto'] || (process.env.NODE_ENV === 'production' ? 'https' : req.protocol);
        callbackURL = `${protocol}://${req.headers.host}/api/auth/google/callback`;
        // Force HTTPS in production if somehow still HTTP
        if (process.env.NODE_ENV === 'production' && callbackURL.startsWith('http://')) {
          callbackURL = callbackURL.replace('http://', 'https://');
        }
      } else {
        // Fallback - use domain from CORS_ORIGIN if available
        if (process.env.CORS_ORIGIN) {
          const origins = process.env.CORS_ORIGIN.split(',');
          const baseUrl = origins[0].trim().replace(/^http:\/\//, 'https://');
          callbackURL = `${baseUrl}/api/auth/google/callback`;
        } else {
          callbackURL = 'https://www.yorkcastlehighschool.org/api/auth/google/callback';
        }
      }
    } else {
      // Development - use relative path or localhost
      callbackURL = '/api/auth/google/callback';
    }
  }
  
  // Passport.js GoogleStrategy doesn't support per-request callbackURL override
  // The callback URL is set at strategy initialization above
  // If the environment variable isn't set, log a warning and use the strategy's default
  if (!process.env.GOOGLE_CALLBACK_URL && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
    logger.warn('GOOGLE_CALLBACK_URL not set in production - callback URL may be incorrect', {
      constructed: callbackURL,
      host: req.headers.host,
      protocol: req.headers['x-forwarded-proto'] || req.protocol,
      service: 'york-castle-api'
    });
  }
  
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    // Remember whether sign-in began on the public portal so the callback can
    // give a friendly redirect (instead of a JSON error) on failure.
    state: ['signin', 'student'].includes(req.query.from) ? 'public' : undefined,
  })(req, res, next);
};

export const googleCallback = async (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.error('Google OAuth callback attempted but credentials not configured');
    return res.status(503).json({
      error: 'Google OAuth not configured',
      message: 'Google Sign-In is not available. Please configure Google OAuth credentials.',
    });
  }
  
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    if (err) {
      logger.error('Google OAuth authentication error', {
        error: err.message,
        stack: err.stack,
        code: err.code,
        path: req.path,
        query: req.query,
        service: 'york-castle-api'
      });
      return res.status(401).json({
        error: 'Authentication failed',
        message: err.message || 'Google authentication failed',
      });
    }

    if (!user) {
      logger.warn('Google OAuth callback - no user returned', {
        info: info?.message || 'No info provided',
        query: req.query,
        path: req.path,
        service: 'york-castle-api'
      });
      // Public-portal sign-ins get a friendly redirect with an error code;
      // the admin flow keeps its existing JSON response.
      if (req.query.state === 'public') {
        const proto = req.headers['x-forwarded-proto'] ||
          (process.env.NODE_ENV === 'production' ? 'https' : req.protocol) || 'https';
        const h = req.get('host') || req.headers.host || 'www.yorkcastlehighschool.org';
        const finalProto = (process.env.NODE_ENV === 'production' || process.env.VERCEL) ? 'https' : proto;
        const code = info?.message || 'AUTH_FAILED';
        return res.redirect(`${finalProto}://${h}/signin.html?error=${code}`);
      }
      return res.status(401).json({
        error: 'Authentication failed',
        message: info?.message || 'Failed to authenticate with Google',
      });
    }

    try {
      logger.info('Google OAuth callback successful', {
        userId: user.id,
        email: user.email,
        path: req.path,
        service: 'york-castle-api'
      });

      // Generate JWT token
      if (!process.env.JWT_SECRET) {
        logger.error('JWT_SECRET not set - cannot generate token for Google OAuth user', {
          userId: user.id,
          email: user.email,
          service: 'york-castle-api'
        });
        return res.status(500).json({
          error: 'Server configuration error',
          message: 'Authentication token generation failed. Please contact administrator.',
        });
      }

      const token = generateToken(user.id);

      // Determine redirect URL - use proper protocol detection for serverless
      // In Vercel/serverless, req.protocol may not be set correctly
      const protocol = req.headers['x-forwarded-proto'] || 
                       (process.env.NODE_ENV === 'production' ? 'https' : req.protocol) ||
                       'https';
      const host = req.get('host') || req.headers.host || 'www.yorkcastlehighschool.org';
      
      // Ensure HTTPS in production
      const finalProtocol = (process.env.NODE_ENV === 'production' || process.env.VERCEL) 
        ? 'https' 
        : protocol;

      // Route to the right portal by role: students to the application status
      // page, parents to the parent portal, staff to the admin dashboard.
      let redirectPath;
      if (user.role === 'STUDENT') redirectPath = '/application-status.html';
      else if (user.role === 'PARENT') redirectPath = '/parent-portal.html';
      else redirectPath = '/admin/auth/callback';
      const redirectUrl = `${finalProtocol}://${host}${redirectPath}?token=${token}`;
      
      logger.info('Redirecting Google OAuth user to admin callback', {
        userId: user.id,
        email: user.email,
        redirectUrl: redirectUrl.replace(token, '[REDACTED]'),
        protocol: finalProtocol,
        host,
        service: 'york-castle-api'
      });

      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Error in Google OAuth callback handler', {
        error: error.message,
        stack: error.stack,
        userId: user?.id,
        email: user?.email,
        path: req.path,
        service: 'york-castle-api'
      });
      next(error);
    }
  })(req, res, next);
};
