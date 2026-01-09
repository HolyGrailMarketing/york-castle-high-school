/**
 * Validates required environment variables on startup
 * Throws error with clear message if validation fails
 */

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

  // Check required variables
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters long for production');
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
      errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
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

  // Check email configuration (warn if incomplete)
  if (process.env.RESEND_API_KEY && !process.env.RESEND_FROM_EMAIL && !process.env.EMAIL_FROM) {
    warnings.push('RESEND_API_KEY is set but RESEND_FROM_EMAIL is missing. Emails may fail to send.');
  }
  if ((process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM) && !process.env.RESEND_API_KEY) {
    warnings.push('RESEND_FROM_EMAIL is set but RESEND_API_KEY is missing. Email service will not work.');
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
    console.warn('Environment validation warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  return true;
};

/**
 * Test database connection
 */
export const testDatabaseConnection = async (prisma) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    throw new Error(
      `Database connection failed: ${error.message}\n` +
      `Please check your DATABASE_URL in .env file.`
    );
  }
};





