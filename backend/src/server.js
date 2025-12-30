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

// Test database connection
testDatabaseConnection(prisma)
  .then(() => {
    logger.info('Database connection successful');
  })
  .catch((error) => {
    logger.error('Database connection failed', { error: error.message });
    process.exit(1);
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
const allowedOrigins = NODE_ENV === 'production' 
  ? (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'])
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Serve admin dashboard (built React app) in production
if (NODE_ENV === 'production') {
  const adminDistPath = path.join(projectRoot, 'admin-dashboard/dist');
  
  // Serve static assets from admin dashboard
  app.use('/admin', express.static(adminDistPath));
  
  // Serve admin dashboard index.html for all /admin/* routes (React Router)
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  });
}

// Serve static files with caching headers
const staticOptions = {
  maxAge: NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true,
};

app.use('/css', express.static(path.join(projectRoot, 'css'), staticOptions));
app.use('/js', express.static(path.join(projectRoot, 'js'), staticOptions));
app.use('/images', express.static(path.join(projectRoot, 'images'), staticOptions));
app.use('/fonts', express.static(path.join(projectRoot, 'fonts'), staticOptions));
app.use('/videos', express.static(path.join(projectRoot, 'videos'), staticOptions));
app.use('/documents', express.static(path.join(projectRoot, 'documents'), staticOptions));

// Serve static HTML pages from root (index.html, etc.)
app.use(express.static(projectRoot, {
  extensions: ['html'],
  index: 'index.html',
}));

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
  if (NODE_ENV === 'production') {
    console.log(`🌐 Homepage: http://localhost:${PORT}/`);
    console.log(`👨‍💼 Admin Dashboard: http://localhost:${PORT}/admin`);
  } else {
    console.log(`🔌 API: http://localhost:${PORT}/api`);
    console.log(`💡 Admin Dashboard (dev): http://localhost:5173`);
  }
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

