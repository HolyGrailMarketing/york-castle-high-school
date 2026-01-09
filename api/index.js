// Vercel serverless function wrapper for Express app
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment variables for Vercel BEFORE any imports that might need them
process.env.VERCEL = '1';
process.env.PROJECT_ROOT = path.join(__dirname, '../');

// Import app after setting environment variables
// Use dynamic import to catch errors during module initialization
let app;
try {
  console.log('Initializing serverless function...', { 
    projectRoot: process.env.PROJECT_ROOT,
    cwd: process.cwd()
  });
  
  const serverModule = await import('../backend/src/server.js');
  app = serverModule.default || serverModule;
  
  console.log('Server imported successfully');
} catch (error) {
  console.error('Failed to import server:', error.message);
  console.error('Error stack:', error.stack);
  console.error('Error details:', {
    name: error.name,
    code: error.code,
    path: error.path
  });
  
  // Create a minimal error handler
  try {
    const express = (await import('express')).default;
    app = express();
    app.use((req, res) => {
      res.status(500).json({ 
        error: 'Server initialization failed',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          name: error.name,
          code: error.code
        } : undefined
      });
    });
  } catch (expressError) {
    console.error('Failed to create error handler:', expressError);
    // Last resort - return a simple function
    app = (req, res) => {
      res.status(500).json({ 
        error: 'Server initialization failed',
        message: 'Unable to initialize server or error handler'
      });
    };
  }
}

// Export as Vercel serverless function handler
export default app;
