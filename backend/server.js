import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import apiRouter from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Frontend dist path ──────────────────────────────────────────────────────
// In production the built React app lives at ../frontend/dist relative to server.js
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const SERVE_FRONTEND = NODE_ENV === 'production' && fs.existsSync(FRONTEND_DIST);

// ─── Middleware ─────────────────────────────────────────────────────────────
// In dev mode allow the Vite dev server origin; in prod the same origin serves both
const allowedOrigins = SERVE_FRONTEND
  ? []   // same-origin — CORS not needed
  : [process.env.FRONTEND_URL || 'http://localhost:5173'];

if (!SERVE_FRONTEND) {
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    platform: process.platform,
    env: NODE_ENV,
    servingFrontend: SERVE_FRONTEND,
  });
});

// ─── Serve React build in production ────────────────────────────────────────
if (SERVE_FRONTEND) {
  // Static assets (JS, CSS, images, etc.)
  app.use(express.static(FRONTEND_DIST));

  // For any non-API route hand back index.html so React Router works
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 University Assignment Generator — Server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Platform : ${process.platform}`);
  console.log(`   Mode     : ${NODE_ENV}`);
  if (SERVE_FRONTEND) {
    console.log(`   Frontend : serving build from ${FRONTEND_DIST}`);
  } else {
    console.log(`   Frontend : proxied from ${process.env.FRONTEND_URL || 'http://localhost:5173'} (dev)`);
    console.log(`\n⚠️  To enable production mode build the frontend first:`);
    console.log(`   cd frontend && npm run build`);
    console.log(`   Then restart the server with NODE_ENV=production`);
  }
  console.log(`\n⚠️  Remember to start the worker in a separate terminal:`);
  console.log(`   node worker.js\n`);
});