import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
// Lazy load heavy dependencies in serverless
let swaggerUi, swaggerJsdoc, compression;
const loadHeavyDependencies = async () => {
  if (!swaggerUi) {
    const swaggerModule = await import('swagger-ui-express');
    const swaggerJsdocModule = await import('swagger-jsdoc');
    const compressionModule = await import('compression');
    swaggerUi = swaggerModule.default;
    swaggerJsdoc = swaggerJsdocModule.default;
    compression = compressionModule.default;
  }
};

import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requestLogger } from './middleware/requestLogger.js';
import { validateEnvironment, testDatabaseConnection } from './utils/envValidator.js';
import logger from './utils/logger.js';
import prisma from './utils/prisma.js';
import passport from 'passport';

// Check if we're in a serverless environment
const isServerless = process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME;
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import applicationRoutes from './routes/applications.js';
import sixthFormRoutes from './routes/sixthForm.js';
import blogRoutes from './routes/blog.js';
import eventRoutes from './routes/events.js';
import courseRoutes from './routes/courses.js';
import documentRoutes from './routes/documents.js';
import requestRoutes from './routes/requests.js';
import analyticsRoutes from './routes/analytics.js';
import healthRoutes from './routes/health.js';
import dataSubjectRoutes from './routes/dataSubject.js';
import consentRoutes from './routes/consent.js';
import { initEmailService } from './services/emailService.js';

// Load environment variables
// In Vercel, env vars are provided directly, but we still try to load .env for local dev
// Calculate project root for dotenv (will be recalculated later for consistency)
const __filenameForEnv = fileURLToPath(import.meta.url);
const __dirnameForEnv = path.dirname(__filenameForEnv);
const envProjectRoot = process.env.PROJECT_ROOT || path.join(__dirnameForEnv, '../../');
try {
  dotenv.config({ path: path.join(envProjectRoot, 'backend/.env') });
} catch (err) {
  // Ignore if .env file doesn't exist (Vercel provides env vars directly)
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // Don't exit in serverless mode (Vercel) or development
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL && !process.env.VERCEL_ENV) {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  // Don't exit in serverless mode (Vercel)
  if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
    process.exit(1);
  }
});

// Validate environment variables on startup
// Wrap in try-catch and make it non-fatal in serverless
try {
  validateEnvironment();
  logger.info('Environment validation passed');
} catch (error) {
  // In serverless, just log the error but don't crash
  if (isServerless) {
    logger.error('Environment validation failed (non-fatal in serverless):', { error: error.message });
    logger.warn('Environment validation failed (continuing in serverless mode)', { error: error.message });
  } else {
    logger.error('Environment validation failed', { error: error.message });
    if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
      process.exit(1);
    }
  }
}

// Prisma client is now imported from utils/prisma.js (singleton)

// Test database connection (non-blocking in development)
const nodeEnv = process.env.NODE_ENV || 'development';
testDatabaseConnection(prisma)
  .then(() => {
    logger.info('Database connection successful');
  })
  .catch((error) => {
    logger.error('Database connection failed', { error: error.message });
    if (nodeEnv === 'production' && !process.env.VERCEL && !process.env.VERCEL_ENV) {
      // In production (non-serverless), exit if database is not available
      logger.error('Cannot start server in production without database connection');
      process.exit(1);
    } else {
      // In development or serverless, log warning but continue (frontend can still be served)
      logger.warn('Server starting without database connection. API routes will fail until database is configured.');
      if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
        logger.warn('Database connection failed. Server will start but API routes may not work.');
        logger.warn('Please check your DATABASE_URL in backend/.env');
      }
    }
  });

// Initialize email service
initEmailService();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Use PROJECT_ROOT env var if set (for Vercel), otherwise calculate from __dirname
const projectRoot = process.env.PROJECT_ROOT || path.join(__dirname, '../../');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'York Castle High School API',
      version: '1.0.0',
      description: 'API for York Castle High School management system',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

// Initialize heavy dependencies for development or when API docs are requested
let swaggerSpec = null;
const initSwagger = async () => {
  if (!swaggerSpec) {
    await loadHeavyDependencies();
    swaggerSpec = swaggerJsdoc(swaggerOptions);
  }
  return swaggerSpec;
};

// Security middleware (must be first)
app.use(securityHeaders);

// Compression middleware - load immediately for simplicity
loadHeavyDependencies().then(() => {
  app.use(compression());
}).catch(err => {
  logger.warn('Failed to load compression middleware:', { error: err.message });
});

// CORS configuration
// When running on single server, allow same origin
const allowedOrigins = NODE_ENV === 'production' 
  ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'])
  : ['http://localhost:3000']; // Single server mode - no separate frontend server

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Passport (for Google OAuth)
app.use(passport.initialize());

// Request logging middleware
app.use(requestLogger);

// Serve uploaded files (only in non-serverless environments)
// In serverless, files should be stored in cloud storage (S3, etc.) and served via CDN
if (!isServerless) {
  const uploadsPath = path.join(__dirname, '../uploads');
  // Only serve if directory exists
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
  }
} else {
  // In serverless, serve from /tmp if needed (temporary files)
  const tmpUploadsPath = path.join(os.tmpdir(), 'uploads');
  if (fs.existsSync(tmpUploadsPath)) {
    app.use('/uploads', express.static(tmpUploadsPath));
  }
}

// API Documentation (lazy loaded)
app.use('/api-docs', async (req, res, next) => {
  try {
    if (!swaggerUi) {
      await loadHeavyDependencies();
    }
    if (!swaggerSpec) {
      swaggerSpec = await initSwagger();
    }
    return swaggerUi.serve(req, res, next);
  } catch (error) {
    logger.error('Failed to load Swagger UI:', { error: error.message });
    res.status(500).json({ error: 'API documentation temporarily unavailable' });
  }
}, async (req, res) => {
  try {
    if (!swaggerSpec) {
      swaggerSpec = await initSwagger();
    }
    return swaggerUi.setup(swaggerSpec)(req, res);
  } catch (error) {
    logger.error('Failed to setup Swagger UI:', { error: error.message });
    res.status(500).json({ error: 'API documentation temporarily unavailable' });
  }
});

// Enhanced health check
app.use('/health', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/sixth-form', sixthFormRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/data-subject', dataSubjectRoutes);
app.use('/api/consent', consentRoutes);

// CRITICAL: Serve root index.html FIRST, before any static middleware
// This ensures the correct file is served and prevents admin dashboard from being served at root
app.get('/', (req, res, next) => {
  try {
    // Use path.resolve to get absolute path and prevent any path manipulation
    const indexPath = path.resolve(projectRoot, 'index.html');
    
    logger.info('Root route handler', { indexPath, projectRoot, vercel: !!process.env.VERCEL });
    
    // Explicitly check that the path is NOT in admin-dashboard
    if (indexPath.includes('admin-dashboard')) {
      logger.error('ERROR: Root route trying to serve admin-dashboard file!', { indexPath, projectRoot });
      return res.status(500).json({ error: 'Configuration error' });
    }
    
    if (!fs.existsSync(indexPath)) {
      logger.error('index.html not found', { path: indexPath, projectRoot, cwd: process.cwd() });
      return res.status(404).json({ error: 'Homepage not found', path: indexPath });
    }
    
    // Verify it's the correct file by checking content
    let fileContent;
    try {
      fileContent = fs.readFileSync(indexPath, 'utf8');
    } catch (err) {
      logger.error('Error reading index.html', { error: err.message, stack: err.stack, path: indexPath });
      return res.status(500).json({ error: 'Error reading homepage', message: err.message });
    }
  
  // Check for main site indicators (must have these)
  const hasWfPage = fileContent.includes('data-wf-page');
  const hasWfSite = fileContent.includes('data-wf-site');
  const hasHomePage = fileContent.includes('York Castle High School Home Page');
  
  // Check that it's NOT admin dashboard (must NOT have these)
  const hasAdminAssets = fileContent.includes('/admin/assets/');
  const hasAdminPortal = fileContent.includes('Admin Portal');
  const hasRootDiv = fileContent.includes('<div id="root">');
  const hasLangEn = fileContent.includes('<html lang="en">');
  const hasReactRoot = fileContent.includes('id="root"');
  
  // Main site must have webflow attributes and NOT have admin dashboard indicators
  const isMainSite = (hasWfPage || hasWfSite || hasHomePage) && 
                    !hasAdminAssets && 
                    !hasAdminPortal && 
                    !hasRootDiv && 
                    !hasLangEn &&
                    !hasReactRoot;
  
  if (!isMainSite) {
    logger.error('Wrong index.html detected - REJECTING (admin dashboard detected)', { 
      path: indexPath, 
      hasWfPage,
      hasWfSite,
      hasHomePage,
      hasAdminAssets,
      hasAdminPortal,
      hasRootDiv,
      hasLangEn,
      firstChars: fileContent.substring(0, 300)
    });
    // Don't serve the wrong file - return error instead
    return res.status(500).json({ 
      error: 'Configuration error - wrong file being served',
      message: 'The root route attempted to serve admin dashboard HTML. This should not happen.'
    });
  }
  
    // All checks passed - serve the correct file
    logger.info('Serving root index.html (VALIDATED)', { path: indexPath });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(indexPath, (err) => {
      if (err) {
        logger.error('Error serving index.html', { error: err.message, stack: err.stack, path: indexPath });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error serving homepage', message: err.message });
        }
      }
    });
  } catch (error) {
    logger.error('Unexpected error in root route handler', { 
      error: error.message, 
      stack: error.stack,
      projectRoot,
      vercel: !!process.env.VERCEL
    });
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
});

// Serve static files with caching headers (define before use)
const staticOptions = {
  maxAge: NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true,
};

// Serve admin dashboard (built React app)
const adminDistPath = path.join(projectRoot, 'admin-dashboard/dist');
if (fs.existsSync(adminDistPath)) {
  // Serve static assets from admin dashboard
  app.use('/admin', express.static(adminDistPath, staticOptions));
  
  // Serve admin dashboard index.html for all /admin/* routes (React Router)
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  });
  
  logger.info('Admin dashboard static files enabled', { path: adminDistPath });
}

// Serve static assets (CSS, JS, images, etc.)
app.use('/css', express.static(path.join(projectRoot, 'css'), staticOptions));
app.use('/js', express.static(path.join(projectRoot, 'js'), staticOptions));
app.use('/images', express.static(path.join(projectRoot, 'images'), staticOptions));
app.use('/fonts', express.static(path.join(projectRoot, 'fonts'), staticOptions));
app.use('/videos', express.static(path.join(projectRoot, 'videos'), staticOptions));
app.use('/documents', express.static(path.join(projectRoot, 'documents'), staticOptions));

// Serve other HTML pages (but not index.html - we handle that above)
// Using regex pattern to match any path ending with .html
app.get(/^\/[^/]+\.html$/, (req, res, next) => {
  // Skip admin and backend paths
  if (req.path.startsWith('/admin') || req.path.startsWith('/backend')) {
    return next();
  }
  const htmlPath = path.join(projectRoot, req.path);
  logger.info('HTML route matched', { path: req.path, htmlPath, exists: fs.existsSync(htmlPath) });
  if (fs.existsSync(htmlPath) && !htmlPath.includes('admin-dashboard') && !htmlPath.includes('backend')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(htmlPath, (err) => {
      if (err) {
        logger.error('Error serving HTML file', { error: err.message, path: htmlPath });
        next(err);
      }
    });
  } else {
    logger.warn('HTML file not found', { path: req.path, htmlPath });
    next();
  }
});

// Also handle HTML files in subdirectories (like dashboard/dashboard.html)
app.get(/^\/.*\.html$/, (req, res, next) => {
  // Skip admin and backend paths
  if (req.path.startsWith('/admin') || req.path.startsWith('/backend')) {
    return next();
  }
  const htmlPath = path.join(projectRoot, req.path);
  if (fs.existsSync(htmlPath) && !htmlPath.includes('admin-dashboard') && !htmlPath.includes('backend')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(htmlPath, (err) => {
      if (err) {
        logger.error('Error serving HTML file (subdir)', { error: err.message, path: htmlPath });
        next(err);
      }
    });
  } else {
    next();
  }
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// 404 handler for other routes (serve 404.html if exists, otherwise JSON)
app.use((req, res) => {
  const notFoundPage = path.join(projectRoot, '404.html');
  if (fs.existsSync(notFoundPage)) {
    res.status(404).sendFile(notFoundPage);
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});

// Helper function to start server on a given port
const startServer = (port, isRetry = false) => {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info('Server started', {
        port: port,
        isRetry: isRetry,
        originalPort: isRetry ? PORT : port,
        environment: NODE_ENV,
        nodeVersion: process.version,
      });
      
      logger.info(`Server running on port ${port}`);
      logger.info(`API Documentation: http://localhost:${port}/api-docs`);
      logger.info(`Homepage: http://localhost:${port}/`);
      if (fs.existsSync(adminDistPath)) {
        logger.info(`Admin Dashboard: http://localhost:${port}/admin`);
      } else {
        logger.warn(`Admin Dashboard not built. Run: cd admin-dashboard && npm run build`);
      }
      logger.info(`API: http://localhost:${port}/api`);
      
      resolve(server);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject({ code: 'EADDRINUSE', port: port, error: error });
      } else {
        reject({ error: error });
      }
    });
  });
};

// Only start listening if not running on Vercel (serverless)
// Vercel will handle the HTTP server
if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  startServer(PORT)
    .catch((err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${PORT} is already in use. Trying alternative port ${PORT + 1}...`, {
          originalPort: PORT,
          alternativePort: PORT + 1,
          suggestion: `To use a specific port, set PORT environment variable or run: lsof -ti:${PORT} | xargs kill -9`
        });
        
        // Try alternative port
        return startServer(PORT + 1, true);
      } else {
        logger.error('Server startup error:', { error: err.error?.message || err.message });
        process.exit(1);
      }
    })
    .catch((err) => {
      logger.error('Failed to start server on alternative port as well.', {
        error: err.error?.message || err.message,
        suggestion: 'Please free up a port or set PORT environment variable to an available port.'
      });
      process.exit(1);
    });
} else {
  logger.info('Running on Vercel - serverless mode', {
    environment: NODE_ENV,
    nodeVersion: process.version,
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;

