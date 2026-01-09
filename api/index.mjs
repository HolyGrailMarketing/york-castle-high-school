// Vercel serverless function wrapper for Express app
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment variables for Vercel BEFORE any imports that might need them
process.env.VERCEL = '1';
process.env.PROJECT_ROOT = path.join(__dirname, '../');

// Add backend node_modules to module resolution path
const backendNodeModules = path.join(__dirname, '../backend/node_modules');
if (process.env.NODE_PATH) {
  process.env.NODE_PATH = `${process.env.NODE_PATH}:${backendNodeModules}`;
} else {
  process.env.NODE_PATH = backendNodeModules;
}

// Import app after setting environment variables
// Use dynamic import to catch errors during module initialization
let app;

async function initializeApp() {
  try {
    console.log('Initializing serverless function...', { 
      projectRoot: process.env.PROJECT_ROOT,
      cwd: process.cwd(),
      nodeVersion: process.version,
      nodePath: process.env.NODE_PATH
    });
    
    // Try to import from backend node_modules first
    const require = createRequire(import.meta.url);
    const backendPackageJson = path.join(__dirname, '../backend/package.json');
    
    console.log('Checking backend dependencies...');
    try {
      require.resolve('express', { paths: [backendNodeModules] });
      console.log('Express found in backend node_modules');
    } catch (e) {
      console.warn('Express not found in backend node_modules, will try default resolution');
    }
    
    const serverModule = await import('../backend/src/server.js');
    app = serverModule.default || serverModule;
    
    if (!app) {
      throw new Error('Server module did not export a default export');
    }
    
    console.log('Server imported successfully, app type:', typeof app);
    return app;
  } catch (error) {
    console.error('Failed to import server:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      path: error.path,
      cause: error.cause
    });
    
    // Create a minimal error handler
    try {
      // Try to import express from backend node_modules
      const require = createRequire(import.meta.url);
      let express;
      try {
        express = require('express');
      } catch (e) {
        // Fallback to dynamic import
        const expressModule = await import('express');
        express = expressModule.default || expressModule;
      }
      
      app = express();
      app.use((req, res) => {
        res.status(500).json({ 
          error: 'Server initialization failed',
          message: error.message,
          details: {
            name: error.name,
            code: error.code,
            ...(process.env.NODE_ENV === 'development' ? {
              stack: error.stack
            } : {})
          }
        });
      });
      console.log('Created fallback error handler');
      return app;
    } catch (expressError) {
      console.error('Failed to create error handler:', expressError.message);
      console.error('Express error stack:', expressError.stack);
      // Last resort - return a simple function
      app = (req, res) => {
        res.status(500).json({ 
          error: 'Server initialization failed',
          message: 'Unable to initialize server or error handler',
          originalError: error.message,
          expressError: expressError.message
        });
      };
      return app;
    }
  }
}

// Initialize and export
app = await initializeApp();

// Export as Vercel serverless function handler
export default app;
