import express from 'express';
import prisma from '../utils/prisma.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../../');

/**
 * Get disk space information
 */
const getDiskSpace = () => {
  try {
    const stats = fs.statSync(projectRoot);
    // Note: This is a simplified check. For production, consider using a library like 'diskusage'
    return {
      available: 'N/A', // Would need diskusage library for accurate info
      free: 'N/A',
      total: 'N/A',
    };
  } catch (error) {
    return { error: 'Unable to check disk space' };
  }
};

/**
 * Get memory usage
 */
const getMemoryUsage = () => {
  const usage = process.memoryUsage();
  return {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
  };
};

/**
 * Test database connectivity
 */
const testDatabase = async () => {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const duration = Date.now() - startTime;
    return {
      status: 'connected',
      responseTime: `${duration}ms`,
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message,
    };
  }
};

/**
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: `${Math.round(process.uptime())}s`,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
    },
    memory: getMemoryUsage(),
    disk: getDiskSpace(),
    database: await testDatabase(),
  };

  const duration = Date.now() - startTime;
  health.responseTime = `${duration}ms`;

  // Determine overall health status
  if (health.database.status !== 'connected') {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;





