import { Router } from 'express';
import { queue } from '../queue/Queue.js';
import {
  saveUserMeta, loadUserMeta, listUserJobs, getFilePath, getUserDir
} from '../storage/storage.js';
import { validateApiKey, initGemini, hasClient } from '../services/gemini.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// ─── Clerk user ID from header ─────────────────────────────────────────────
function getUserId(req) {
  // In production with Clerk, verify JWT. For now extract from header.
  return req.headers['x-user-id'] || req.body?.userId || 'anonymous';
}

// ─── API Key Management ─────────────────────────────────────────────────────
router.post('/api-key', async (req, res) => {
  const userId = getUserId(req);
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API key required' });

  const validation = await validateApiKey(apiKey);
  if (!validation.valid) {
    return res.status(400).json({ error: `Invalid API key: ${validation.error}` });
  }

  // Store encrypted (simple base64 for demo - use proper encryption in prod)
  const encoded = Buffer.from(apiKey).toString('base64');
  saveUserMeta(userId, { apiKeyEncoded: encoded, apiKeySet: true, apiKeySetAt: Date.now() });
  initGemini(userId, apiKey);

  res.json({ success: true, message: 'API key validated and saved.' });
});

router.get('/api-key/status', (req, res) => {
  const userId = getUserId(req);
  const meta = loadUserMeta(userId);

  // Re-init Gemini if key exists in storage but not in memory
  if (meta.apiKeyEncoded && !hasClient(userId)) {
    const apiKey = Buffer.from(meta.apiKeyEncoded, 'base64').toString();
    initGemini(userId, apiKey);
  }

  res.json({
    hasKey: !!meta.apiKeySet,
    keySetAt: meta.apiKeySetAt || null,
    isInitialized: hasClient(userId),
  });
});

router.delete('/api-key', (req, res) => {
  const userId = getUserId(req);
  saveUserMeta(userId, { apiKeyEncoded: null, apiKeySet: false });
  res.json({ success: true });
});

// ─── Job Management ─────────────────────────────────────────────────────────
router.post('/jobs', (req, res) => {
  const userId = getUserId(req);
  const { scenario } = req.body;
  console.log("tis is ", scenario)

  if (!scenario) return res.status(400).json({ error: 'Scenario description required' });

  const meta = loadUserMeta(userId);
  if (meta.apiKeyEncoded && !hasClient(userId)) {
    const apiKey = Buffer.from(meta.apiKeyEncoded, 'base64').toString();
    initGemini(userId, apiKey);
  }
  if (!hasClient(userId)) {
    return res.status(403).json({ error: 'Please set your Gemini API key first.' });
  }

  const job = queue.enqueue('generate-assignment', { userId, scenario }, userId);
  res.json({ jobId: job.id, status: job.status });
});

router.get('/jobs', (req, res) => {
  const userId = getUserId(req);
  const jobs = queue.getJobsForUser(userId);
  res.json({ jobs });
});

router.get('/jobs/:id', (req, res) => {
  const job = queue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job.toJSON());
});

// ─── Long Polling ──────────────────────────────────────────────────────────
router.get('/jobs/:id/poll', async (req, res) => {
  const jobId = req.params.id;
  const sinceTs = parseInt(req.query.since || '0', 10);

  const job = queue.getJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Wait for update (long poll, 25s timeout)
  const snapshot = await queue.waitForUpdate(jobId, sinceTs, 25000);
  res.json(snapshot || job.toJSON());
});

// ─── File Download ─────────────────────────────────────────────────────────
router.get('/jobs/:id/files/:filename', (req, res) => {
  const userId = getUserId(req);
  const { id, filename } = req.params;

  // Security: only allow safe filenames
  const safe = filename.replace(/[^a-zA-Z0-9._\-]/g, '');
  const filePath = getFilePath(userId, id, safe);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = path.extname(safe).toLowerCase();
  const mimeTypes = {
    '.py': 'text/x-python',
    '.tex': 'text/x-latex',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.mmd': 'text/plain',
    '.json': 'application/json',
    '.md': 'text/markdown',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  fs.createReadStream(filePath).pipe(res);
});

// ─── Inline file view (for images) ────────────────────────────────────────
router.get('/jobs/:id/view/:filename', (req, res) => {
  const userId = getUserId(req);
  const { id, filename } = req.params;
  const safe = filename.replace(/[^a-zA-Z0-9._\-]/g, '');
  const filePath = getFilePath(userId, id, safe);

  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const ext = path.extname(safe).toLowerCase();
  if (ext === '.png') res.setHeader('Content-Type', 'image/png');
  else if (ext === '.svg') res.setHeader('Content-Type', 'image/svg+xml');
  else res.setHeader('Content-Type', 'text/plain');

  fs.createReadStream(filePath).pipe(res);
});

// ─── User profile ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const userId = getUserId(req);
  const meta = loadUserMeta(userId);
  res.json({
    userId,
    hasApiKey: !!meta.apiKeySet,
    apiKeySetAt: meta.apiKeySetAt,
  });
});

export default router;
