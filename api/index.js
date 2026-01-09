// Vercel serverless function wrapper for Express app
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment variables for Vercel
process.env.VERCEL = '1';
process.env.PROJECT_ROOT = path.join(__dirname, '../');

// Import app after setting environment variables
// Wrap in try-catch to handle any import errors gracefully
let app;
try {
  const serverModule = await import('../backend/src/server.js');
  app = serverModule.default || serverModule;
} catch (error) {
  console.error('Failed to import server:', error);
  console.error('Error stack:', error.stack);
  // Create a minimal error handler
  const express = (await import('express')).default;
  app = express();
  app.use((req, res) => {
    res.status(500).json({ 
      error: 'Server initialization failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  });
}

// Export as Vercel serverless function handler
export default app;
