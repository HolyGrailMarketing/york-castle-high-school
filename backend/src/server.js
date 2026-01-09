import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import compression from 'compression';

import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requestLogger } from './middleware/requestLogger.js';
import { validateEnvironment, testDatabaseConnection } from './utils/envValidator.js';
import logger from './utils/logger.js';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';
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
import { initEmailService } from './services/emailService.js';

dotenv.config();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // Don't exit in development - allow server to continue
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Validate environment variables on startup
try {
  validateEnvironment();
  logger.info('Environment validation passed');
} catch (error) {
  logger.error('Environment validation failed', { error: error.message });
  process.exit(1);
}

// Initialize Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Test database connection (non-blocking in development)
const nodeEnv = process.env.NODE_ENV || 'development';
testDatabaseConnection(prisma)
  .then(() => {
    logger.info('Database connection successful');
  })
  .catch((error) => {
    logger.error('Database connection failed', { error: error.message });
    if (nodeEnv === 'production') {
      // In production, exit if database is not available
      logger.error('Cannot start server in production without database connection');
      process.exit(1);
    } else {
      // In development, log warning but continue (frontend can still be served)
      logger.warn('Server starting without database connection. API routes will fail until database is configured.');
      console.warn('⚠️  Database connection failed. Server will start but API routes may not work.');
      console.warn('   Please check your DATABASE_URL in backend/.env');
    }
  });

// Initialize email service
initEmailService();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../../');

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

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Security middleware (must be first)
app.use(securityHeaders);

// Compression middleware
app.use(compression());

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

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

// CRITICAL: Serve root index.html FIRST, before any static middleware
// This ensures the correct file is served and prevents admin dashboard from being served at root
app.get('/', (req, res) => {
  // Use path.join to ensure we get the exact file from project root
  const indexPath = path.join(projectRoot, 'index.html');
  
  // Explicitly check that the path is NOT in admin-dashboard
  if (indexPath.includes('admin-dashboard')) {
    logger.error('ERROR: Root route trying to serve admin-dashboard file!', { indexPath, projectRoot });
    return res.status(500).json({ error: 'Configuration error' });
  }
  
  if (fs.existsSync(indexPath)) {
    // Verify it's the correct file by checking content
    const fileContent = fs.readFileSync(indexPath, 'utf8');
    
    // Check for main site indicators
    const isMainSite = fileContent.includes('data-wf-page') || 
                      fileContent.includes('York Castle High School Home Page') ||
                      fileContent.includes('data-wf-site');
    
    // Check that it's NOT admin dashboard
    const isAdminDashboard = fileContent.includes('Admin Portal') ||
                            fileContent.includes('/admin/assets/') ||
                            fileContent.includes('id="root"');
    
    if (isMainSite && !isAdminDashboard) {
      logger.info('Serving root index.html', { path: indexPath });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(indexPath, (err) => {
        if (err) {
          logger.error('Error serving index.html', { error: err.message, path: indexPath });
          res.status(500).json({ error: 'Error serving homepage' });
        }
      });
    } else {
      logger.error('Wrong index.html detected', { 
        path: indexPath, 
        isMainSite, 
        isAdminDashboard,
        firstChars: fileContent.substring(0, 200)
      });
      res.status(500).json({ error: 'Configuration error - wrong file being served' });
    }
  } else {
    logger.error('index.html not found', { path: indexPath, projectRoot });
    res.status(404).json({ error: 'Homepage not found' });
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
// Skip admin and backend paths
app.get('*.html', (req, res, next) => {
  if (req.path.startsWith('/admin') || req.path.startsWith('/backend')) {
    return next();
  }
  const htmlPath = path.join(projectRoot, req.path);
  if (fs.existsSync(htmlPath) && htmlPath.endsWith('.html') && !htmlPath.includes('admin-dashboard') && !htmlPath.includes('backend')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(htmlPath);
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

app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: NODE_ENV,
    nodeVersion: process.version,
  });
  
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🌐 Homepage: http://localhost:${PORT}/`);
  if (fs.existsSync(adminDistPath)) {
    console.log(`👨‍💼 Admin Dashboard: http://localhost:${PORT}/admin`);
  } else {
    console.log(`⚠️  Admin Dashboard not built. Run: cd admin-dashboard && npm run build`);
  }
  console.log(`🔌 API: http://localhost:${PORT}/api`);
});

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

