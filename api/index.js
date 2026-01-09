// Vercel serverless function wrapper for Express app
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment variables for Vercel
process.env.VERCEL = '1';
process.env.PROJECT_ROOT = path.join(__dirname, '../');

// Import app after setting environment variables
let app;
try {
  app = await import('../backend/src/server.js');
  app = app.default || app;
} catch (error) {
  console.error('Failed to import server:', error);
  // Create a minimal error handler
  app = (await import('express')).default();
  app.use((req, res) => {
    res.status(500).json({ 
      error: 'Server initialization failed',
      message: error.message 
    });
  });
}

// Export as Vercel serverless function handler
export default app;
