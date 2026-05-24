import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(__dirname, '..', 'data');

// Ensure root data dir exists
if (!fs.existsSync(DATA_ROOT)) fs.mkdirSync(DATA_ROOT, { recursive: true });

export function getUserDir(userId) {
  // Sanitize userId to be safe for filesystem
  const safeId = userId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const dir = path.join(DATA_ROOT, safeId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getJobDir(userId, jobId) {
  const dir = path.join(getUserDir(userId), jobId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveUserMeta(userId, meta) {
  const dir = getUserDir(userId);
  const filePath = path.join(dir, 'meta.json');
  const existing = loadUserMeta(userId);
  fs.writeFileSync(filePath, JSON.stringify({ ...existing, ...meta }, null, 2));
}

export function loadUserMeta(userId) {
  const dir = getUserDir(userId);
  const filePath = path.join(dir, 'meta.json');
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function saveFile(userId, jobId, filename, content) {
  const dir = getJobDir(userId, jobId);
  const filePath = path.join(dir, filename);
  if (typeof content === 'string') {
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    fs.writeFileSync(filePath, content);
  }
  return filePath;
}

export function getFilePath(userId, jobId, filename) {
  return path.join(getJobDir(userId, jobId), filename);
}

export function fileExists(userId, jobId, filename) {
  return fs.existsSync(getFilePath(userId, jobId, filename));
}

export function listUserJobs(userId) {
  const dir = getUserDir(userId);
  const metaPath = path.join(dir, 'meta.json');
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => {
      const jobMeta = path.join(dir, e.name, 'job.json');
      if (fs.existsSync(jobMeta)) {
        return JSON.parse(fs.readFileSync(jobMeta, 'utf8'));
      }
      return { id: e.name };
    });
}

export function saveJobMeta(userId, jobId, meta) {
  const dir = getJobDir(userId, jobId);
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(meta, null, 2));
}

export { DATA_ROOT };
