import { Router } from 'express';
import { enqueueJob, getJob, serializeJob, getQueueEvents } from '../queue/Queue.js';
import {
  saveUserMeta, loadUserMeta, getFilePath,
} from '../storage/storage.js';
import { validateApiKey, initGemini, hasClient } from '../services/gemini.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// ─── Clerk user ID from header ─────────────────────────────────────────────
function getUserId(req) {
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

  const encoded = Buffer.from(apiKey).toString('base64');
  saveUserMeta(userId, { apiKeyEncoded: encoded, apiKeySet: true, apiKeySetAt: Date.now() });
  initGemini(userId, apiKey);

  res.json({ success: true, message: 'API key validated and saved.' });
});

router.get('/api-key/status', (req, res) => {
  const userId = getUserId(req);
  const meta = loadUserMeta(userId);

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
router.post('/jobs', async (req, res) => {
  const userId = getUserId(req);
  const { scenario } = req.body;

  if (!scenario) return res.status(400).json({ error: 'Scenario description required' });

  const meta = loadUserMeta(userId);
  if (meta.apiKeyEncoded && !hasClient(userId)) {
    const apiKey = Buffer.from(meta.apiKeyEncoded, 'base64').toString();
    initGemini(userId, apiKey);
  }
  if (!hasClient(userId)) {
    return res.status(403).json({ error: 'Please set your Gemini API key first.' });
  }

  try {
    const job = await enqueueJob('generate-assignment', { userId, scenario }, userId);
    res.json({ jobId: job.id, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: `Failed to enqueue job: ${err.message}` });
  }
});

router.get('/jobs', async (req, res) => {
  // BullMQ doesn't natively filter jobs by userId across all states efficiently.
  // We fall back to reading job.json files written to disk by the worker.
  const userId = getUserId(req);
  const userDir = path.join('data', userId.replace(/[^a-zA-Z0-9_\-]/g, '_'));

  if (!fs.existsSync(userDir)) return res.json({ jobs: [] });

  const entries = fs.readdirSync(userDir, { withFileTypes: true });
  const jobs = entries
    .filter(e => e.isDirectory())
    .map(e => {
      const metaPath = path.join(userDir, e.name, 'job.json');
      if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
      return { id: e.name, status: 'unknown' };
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  res.json({ jobs });
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(await serializeJob(job));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Long Polling ──────────────────────────────────────────────────────────
// BullMQ QueueEvents lets us efficiently wait for job updates via Redis pub/sub.
router.get('/jobs/:id/poll', async (req, res) => {
  const jobId = req.params.id;
  const sinceTs = parseInt(req.query.since || '0', 10);
  const TIMEOUT_MS = 25000;

  try {
    const job = await getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const snapshot = await serializeJob(job);

    // If already updated since the client's last-seen timestamp, return immediately
    if (snapshot.updatedAt > sinceTs || snapshot.status === 'done' || snapshot.status === 'failed') {
      return res.json(snapshot);
    }

    // Otherwise wait for the next progress/completed/failed event
    const queueEvents = getQueueEvents();

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timer);
        queueEvents.off('progress', onProgress);
        queueEvents.off('completed', onDone);
        queueEvents.off('failed', onDone);
        resolve();
      };

      const onProgress = ({ jobId: id }) => { if (id === jobId) cleanup(); };
      const onDone = ({ jobId: id }) => { if (id === jobId) cleanup(); };

      queueEvents.on('progress', onProgress);
      queueEvents.on('completed', onDone);
      queueEvents.on('failed', onDone);
    });

    const updated = await getJob(jobId);
    res.json(await serializeJob(updated));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── File Download ─────────────────────────────────────────────────────────
router.get('/jobs/:id/files/:filename', (req, res) => {
  const userId = getUserId(req);
  const { id, filename } = req.params;

  const safe = filename.replace(/[^a-zA-Z0-9._\-]/g, '');

  let filePath = getFilePath(userId, id, safe);

  // ONLY for StudentAttendanceSystem.accdb
  if (safe === 'StudentAttendanceSystem.accdb') {
    const folderPath = path.dirname(filePath);

    const accdbFile = fs.readdirSync(folderPath).find(file =>
      file.toLowerCase().endsWith('.accdb')
    );

    if (accdbFile) {
      filePath = path.join(folderPath, accdbFile);
    }
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    '.py': 'text/x-python',
    '.tex': 'text/x-latex',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.mmd': 'text/plain',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.accdb': 'application/msaccess',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${path.basename(filePath)}"`
  );

  fs.createReadStream(filePath).pipe(res);
});

// ─── Inline file view (for images) ────────────────────────────────────────
router.get('/jobs/:id/view/:filename', (req, res) => {
  const userId = getUserId(req);
  const { id, filename } = req.params;
  console.log(filename)

  const safe = filename.replace(/[^a-zA-Z0-9._\-]/g, '');
  const jobDir = path.join(BASE_STORAGE_DIR, userId, id);

  if (!fs.existsSync(jobDir)) {
    return res.status(404).json({ error: 'Job folder not found' });
  }

  let filePath;

  // Only ignore filename when frontend sends .accdb
  if (safe.toLowerCase().endsWith('.accdb')) {
    const accdbFile = fs.readdirSync(jobDir).find(file =>
      file.toLowerCase().endsWith('.accdb')
    );

    if (!accdbFile) {
      return res.status(404).json({ error: 'No ACCDB file found' });
    }

    filePath = path.join(jobDir, accdbFile);
  } else {
    filePath = getFilePath(userId, id, safe);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.png') {
    res.setHeader('Content-Type', 'image/png');
  } else if (ext === '.svg') {
    res.setHeader('Content-Type', 'image/svg+xml');
  } else if (ext === '.accdb') {
    res.setHeader('Content-Type', 'application/msaccess');
  } else {
    res.setHeader('Content-Type', 'text/plain');
  }

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