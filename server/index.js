import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './database.js';
import authRoutes from './routes/auth.js';
import trackerRoutes from './routes/tracker.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend static build files in production/standalone mode
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

// Fallback for single page application routing
app.get('*', (req, res, next) => {
  // Pass through if request is for a missing API route
  if (req.path.startsWith('/api')) {
    return next();
  }
  
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // If frontend dist is not built, output helpful message
      res.status(200).send('Akestron Time Tracker API is active. Client build not found (run npm run build in client folder).');
    }
  });
});

// Start application
const start = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`[Akestron Tracker] Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Fatal: Server failed to start:', error);
    process.exit(1);
  }
};

start();
