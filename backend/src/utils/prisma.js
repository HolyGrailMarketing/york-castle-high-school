/**
 * Prisma Client Singleton
 * 
 * This module exports a single Prisma Client instance that should be used
 * throughout the application. This prevents connection pool exhaustion
 * in serverless environments like Vercel.
 * 
 * IMPORTANT: Always import from this file instead of creating new PrismaClient instances.
 */

import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

// Determine if we're in a serverless environment
const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME;

// IMPORTANT: For Supabase PgBouncer with Prisma
// - Use Transaction mode connection string (not Session mode)
// - Session mode has strict pool_size limits that cause "max clients reached" errors
// - Transaction mode is recommended for Prisma Client
// 
// Your DATABASE_URL should point to Transaction mode pooler:
// postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
//
// If you're getting "MaxClientsInSessionMode" errors, ensure you're using Transaction mode, not Session mode.

// Prisma Client configuration
const prismaClientConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  // Optimize for Supabase connection pooling
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

// Connection retry configuration for serverless
const MAX_RETRIES = isServerless ? 5 : 1;
const RETRY_DELAY = 1000; // 1 second

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createPrismaWithRetry = async (config, retries = MAX_RETRIES) => {
  try {
    console.log('Attempting to create PrismaClient...');
    const client = new PrismaClient(config);
    console.log('PrismaClient instance created successfully');

    // In serverless, don't connect immediately - let it connect on first query
    // This avoids connection issues during cold starts
    if (!isServerless) {
      await client.$connect();
      logger.info('Prisma client connected successfully');
    }

    return client;
  } catch (error) {
    console.error('Failed to create PrismaClient:', error.message);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Check if Prisma Client hasn't been generated yet
    if (error.message?.includes('did not initialize yet') || error.message?.includes('Prisma Client') || error.message?.includes('prisma generate')) {
      console.error('PRISMA CLIENT NOT GENERATED YET - This means "prisma generate" has not run successfully');
      if (retries > 0) {
        console.warn(`Retrying Prisma Client creation... (${retries} attempts left)`);
        logger.warn(`Prisma Client not generated yet, retrying... (${retries} attempts left)`, {
          error: error.message
        });
        await sleep(RETRY_DELAY);
        return createPrismaWithRetry(config, retries - 1);
      }
      const errorMsg = `Prisma Client has not been generated. Please ensure "prisma generate" runs in installCommand before deployment. Original error: ${error.message}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (retries > 0) {
      console.warn(`Prisma connection failed, retrying... (${retries} attempts left)`);
      logger.warn(`Prisma connection failed, retrying... (${retries} attempts left)`, {
        error: error.message
      });
      await sleep(RETRY_DELAY);
      return createPrismaWithRetry(config, retries - 1);
    }
    console.error('Final Prisma Client creation failure:', error.message);
    throw error;
  }
};

// Connection optimization for serverless environments
if (isServerless) {
  // Reduce connection pool size for serverless to prevent connection exhaustion
  prismaClientConfig.datasources.db = {
    ...prismaClientConfig.datasources.db,
  };
}

// Global Prisma Client instance (singleton pattern)
// In development, reuse the same instance across hot reloads
const globalForPrisma = globalThis;

let prismaInstance;

// Initialize Prisma Client - must be done synchronously for proper export
// In serverless, this will happen during module evaluation, so Prisma Client must be generated first
console.log('Initializing Prisma Client...', { 
  isServerless, 
  nodeEnv: process.env.NODE_ENV,
  vercel: process.env.VERCEL 
});

if (process.env.NODE_ENV === 'production' || isServerless) {
  // In production/serverless, initialize with retry logic
  // NOTE: This uses top-level await, which means Prisma Client MUST be generated before this module is imported
  // This is ensured by running "prisma generate" in installCommand before building
  try {
    console.log('Creating Prisma Client instance for production/serverless...');
    prismaInstance = await createPrismaWithRetry(prismaClientConfig);
    console.log('Prisma Client initialized successfully in production/serverless');
  } catch (error) {
    console.error('CRITICAL: Failed to initialize Prisma Client in production/serverless');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    logger.error('CRITICAL: Failed to initialize Prisma Client in production/serverless', { 
      error: error.message,
      stack: error.stack,
      hint: 'Ensure "prisma generate" runs in installCommand before deployment'
    });
    // Re-throw the error - this will prevent the server from starting
    // This is intentional - we can't run without Prisma Client
    throw error;
  }
} else {
  // In development, initialize immediately and reuse across hot reloads
  try {
    console.log('Creating Prisma Client instance for development...');
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = await createPrismaWithRetry(prismaClientConfig);
    }
    prismaInstance = globalForPrisma.prisma;
    console.log('Prisma Client initialized successfully in development');
  } catch (error) {
    console.error('Failed to initialize Prisma Client in development');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    logger.error('Failed to initialize Prisma Client in development', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Handle graceful shutdown
if (!isServerless && prismaInstance) {
  // In non-serverless environments, disconnect on process exit
  process.on('beforeExit', async () => {
    if (prismaInstance && typeof prismaInstance.$disconnect === 'function') {
      await prismaInstance.$disconnect();
    }
  });
  
  process.on('SIGINT', async () => {
    if (prismaInstance && typeof prismaInstance.$disconnect === 'function') {
      await prismaInstance.$disconnect();
    }
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    if (prismaInstance && typeof prismaInstance.$disconnect === 'function') {
      await prismaInstance.$disconnect();
    }
    process.exit(0);
  });
}

// Export the singleton instance
export default prismaInstance;

// Also export a function to disconnect (useful for testing)
export const disconnectPrisma = async () => {
  if (prismaInstance && typeof prismaInstance.$disconnect === 'function') {
    await prismaInstance.$disconnect();
  }
};
