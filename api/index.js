// Vercel serverless function wrapper for Express app
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set project root for Vercel (api/ is at root level, so go up one level)
process.env.PROJECT_ROOT = path.join(__dirname, '../');

// Import app after setting PROJECT_ROOT
import app from '../backend/src/server.js';

// Export as Vercel serverless function handler
export default app;
