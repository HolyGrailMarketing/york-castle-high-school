/**
 * Validates required environment variables on startup
 * Throws error with clear message if validation fails
 */

import prisma from './prisma.js';
import logger from './logger.js';

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
];

const optionalEnvVars = {
  PORT: '3000',
  NODE_ENV: 'development',
  CORS_ORIGIN: '',
  RESEND_API_KEY: '',
  RESEND_FROM_EMAIL: '',
  EMAIL_FROM: '',
};

export const validateEnvironment = () => {
  const errors = [];
  const warnings = [];
  
  // In serverless mode (Vercel), be more lenient - env vars might be set at runtime
  const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME;

  // Check required variables
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      if (isServerless) {
        // In serverless, make it a warning instead of error
        warnings.push(`Missing environment variable: ${varName} (may be set at runtime)`);
      } else {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    const isProduction = process.env.NODE_ENV === 'production';
    const minLength = isProduction ? 64 : 32;

    if (process.env.JWT_SECRET.length < minLength) {
      if (isProduction) {
        errors.push(`JWT_SECRET must be at least ${minLength} characters long in production. Current: ${process.env.JWT_SECRET.length}`);
      } else {
        warnings.push(`JWT_SECRET should be at least ${minLength} characters long for production. Current: ${process.env.JWT_SECRET.length}`);
      }
    }

    // Check for common weak secrets
    const weakSecrets = ['password', 'secret', '123456', 'admin'];
    if (weakSecrets.some(weak => process.env.JWT_SECRET.toLowerCase().includes(weak))) {
      warnings.push('JWT_SECRET contains common weak words. Consider using a randomly generated secret.');
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
      errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
    } else {
      // Supabase-specific validations
      const isSupabaseDirect = process.env.DATABASE_URL.includes('.supabase.co:5432');
      const isSupabasePooled = process.env.DATABASE_URL.includes('.pooler.supabase.com:6543');

      if (isSupabaseDirect || isSupabasePooled) {
        // Check for connection pooling parameter
        if (isSupabasePooled && !process.env.DATABASE_URL.includes('pgbouncer=true')) {
          warnings.push('Supabase pooled connection should include ?pgbouncer=true parameter for optimal performance.');
        }

        // Warn about potential connection issues
        if (isSupabaseDirect && process.env.NODE_ENV === 'production') {
          warnings.push('Using direct Supabase connection (port 5432) in production. Consider using connection pooling (port 6543) for better performance.');
        }
      }
    }
  }

  // Validate NODE_ENV
  if (process.env.NODE_ENV && !['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
    warnings.push(`NODE_ENV should be 'development', 'production', or 'test'. Current: ${process.env.NODE_ENV}`);
  }

  // Validate PORT
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`PORT must be a valid number between 1 and 65535. Current: ${process.env.PORT}`);
    }
  }

  // Validate CORS_ORIGIN format
  if (process.env.CORS_ORIGIN) {
    const origins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
    const urlRegex = /^https?:\/\/(localhost(:\d{1,5})?|([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(:\d{1,5})?)$/;

    for (const origin of origins) {
      if (origin !== '*' && !urlRegex.test(origin)) {
        errors.push(`CORS_ORIGIN contains invalid URL format: ${origin}. Use format: https://example.com or http://localhost:3000`);
      }
    }

    // In production, warn against allowing all origins
    if (process.env.NODE_ENV === 'production' && origins.includes('*')) {
      errors.push('CORS_ORIGIN cannot be "*" in production. Specify exact allowed origins.');
    }
  } else if (process.env.NODE_ENV === 'production') {
    errors.push('CORS_ORIGIN must be set in production for security.');
  }

  // Check email configuration (warn if incomplete)
  if (process.env.RESEND_API_KEY && !process.env.RESEND_FROM_EMAIL && !process.env.EMAIL_FROM) {
    warnings.push('RESEND_API_KEY is set but RESEND_FROM_EMAIL is missing. Emails may fail to send.');
  }
  if ((process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM) && !process.env.RESEND_API_KEY) {
    warnings.push('RESEND_FROM_EMAIL is set but RESEND_API_KEY is missing. Email service will not work.');
  }

  // Production-specific security validations
  if (process.env.NODE_ENV === 'production') {
    // Ensure critical security variables are properly configured
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) {
      errors.push('Production requires JWT_SECRET to be at least 64 characters long.');
    }

    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
      errors.push('Production requires CORS_ORIGIN to be set to specific allowed origins (not "*").');
    }

    // Warn about development defaults
    if (process.env.PORT && process.env.PORT === '3000') {
      warnings.push('Using default port 3000 in production. Consider using a production-specific port.');
    }
  }

  // Validate ADMIN_IP_WHITELIST format
  if (process.env.ADMIN_IP_WHITELIST) {
    const ips = process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim());
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

    for (const ip of ips) {
      if (!ipRegex.test(ip)) {
        warnings.push(`ADMIN_IP_WHITELIST contains invalid IP format: ${ip}. Use format: 192.168.1.1 or 192.168.1.0/24`);
      }
    }
  }

  // Throw if there are critical errors
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn('Environment validation warnings:');
    warnings.forEach(warning => logger.warn(`  - ${warning}`));
  }

  return true;
};

/**
 * Test database connection
 * @param {PrismaClient} prismaInstance - Optional Prisma client instance (defaults to singleton)
 */
export const testDatabaseConnection = async (prismaInstance = prisma) => {
  try {
    await prismaInstance.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    throw new Error(
      `Database connection failed: ${error.message}\n` +
      `Please check your DATABASE_URL in .env file.`
    );
  }
};





