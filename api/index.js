import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './database.js';
import authRoutes from './routes/auth.js';
import trackerRoutes from './routes/tracker.js';
import adminRoutes from './routes/admin.js';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Database initialization middleware for serverless compatibility
let dbInitialized = false;
let dbInitPromise = null;

const ensureDb = async (req, res, next) => {
  if (dbInitialized) return next();
  
  if (!dbInitPromise) {
    console.log('[Database] Lazy initializing database schema for request...');
    dbInitPromise = initDb().then(() => {
      dbInitialized = true;
    }).catch(err => {
      dbInitPromise = null;
      console.error('[Database] Lazy initialization failed:', err);
    });
  }
  
  await dbInitPromise;
  
  if (dbInitialized) {
    next();
  } else {
    res.status(500).json({ message: 'Database failed to initialize' });
  }
};

// Apply database initializer middleware to all API requests
app.use('/api', ensureDb);

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend static build files in production/standalone mode
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback for single page application routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Akestron Time Tracker API is active. Client build not found.');
    }
  });
});

// Only start the server port listener when running locally
if (!process.env.VERCEL) {
  try {
    initDb().then(() => {
      app.listen(PORT, () => {
        console.log(`[Akestron Tracker] Server listening on port ${PORT}`);
      });
    });
  } catch (error) {
    console.error('Fatal: Local server failed to start:', error);
    process.exit(1);
  }
}

// Export the express app for Vercel Serverless Function wrapper
export default app;
