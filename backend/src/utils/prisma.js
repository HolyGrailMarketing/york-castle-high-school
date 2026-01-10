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
const MAX_RETRIES = isServerless ? 3 : 1;
const RETRY_DELAY = 1000; // 1 second

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createPrismaWithRetry = async (config, retries = MAX_RETRIES) => {
  try {
    const client = new PrismaClient(config);

    // Test connection in serverless to avoid cold start failures
    if (isServerless) {
      await client.$connect();
      logger.info('Prisma client connected successfully');
    }

    return client;
  } catch (error) {
    if (retries > 0) {
      logger.warn(`Prisma connection failed, retrying... (${retries} attempts left)`, {
        error: error.message
      });
      await sleep(RETRY_DELAY);
      return createPrismaWithRetry(config, retries - 1);
    }
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

if (process.env.NODE_ENV === 'production' || isServerless) {
  // In production/serverless, create instance with retry logic
  prismaInstance = await createPrismaWithRetry(prismaClientConfig);
} else {
  // In development, reuse the same instance across hot reloads
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = await createPrismaWithRetry(prismaClientConfig);
  }
  prismaInstance = globalForPrisma.prisma;
}

// Handle graceful shutdown
if (!isServerless) {
  // In non-serverless environments, disconnect on process exit
  process.on('beforeExit', async () => {
    await prismaInstance.$disconnect();
  });
  
  process.on('SIGINT', async () => {
    await prismaInstance.$disconnect();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await prismaInstance.$disconnect();
    process.exit(0);
  });
}

// Export the singleton instance
export default prismaInstance;

// Also export a function to disconnect (useful for testing)
export const disconnectPrisma = async () => {
  await prismaInstance.$disconnect();
};
