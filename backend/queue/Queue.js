// ============================================================
// BullMQ Queue Setup
// Requires Redis — set REDIS_URL in .env
// e.g. REDIS_URL=redis://localhost:6379
//      REDIS_URL=rediss://:<password>@<host>:<port>  (Upstash)
// ============================================================

import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnection } from './redis.js';

// ── Singleton queue instance (used by API routes to enqueue jobs) ────────────
let _queue = null;
let _queueEvents = null;

export function getQueue() {
  if (!_queue) {
    _queue = new Queue('assignments', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,           // no auto-retry (fail fast, user can resubmit)
        removeOnComplete: {
          age: 60 * 60 * 24,  // keep completed jobs in Redis for 24h
          count: 200,
        },
        removeOnFail: {
          age: 60 * 60 * 24,
        },
      },
    });
  }
  return _queue;
}

export function getQueueEvents() {
  if (!_queueEvents) {
    _queueEvents = new QueueEvents('assignments', {
      connection: getRedisConnection(),
    });
  }
  return _queueEvents;
}

// ── Helpers used by API routes ───────────────────────────────────────────────

/**
 * Enqueue a new generate-assignment job.
 * Returns the BullMQ Job object.
 */
export async function enqueueJob(type, payload, userId) {
  const q = getQueue();
  const job = await q.add(type, { ...payload, userId }, {
    jobId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  return job;
}

/**
 * Get a single job by ID.
 */
export async function getJob(jobId) {
  const q = getQueue();
  return q.getJob(jobId);
}

/**
 * Serialize a BullMQ job into the same shape the frontend expects.
 * BullMQ stores progress logs in job.data.steps (we push them there).
 */
export async function serializeJob(job) {
  if (!job) return null;
  const state = await job.getState();    // 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  const progress = job.progress || {};

  return {
    id: job.id,
    type: job.name,
    userId: job.data.userId,
    status: bullStateToStatus(state),
    steps: progress.steps || [],
    result: job.returnvalue || null,
    error: job.failedReason || null,
    createdAt: job.timestamp,
    updatedAt: job.processedOn || job.timestamp,
  };
}

function bullStateToStatus(state) {
  switch (state) {
    case 'waiting':
    case 'delayed':
      return 'queued';
    case 'active':
      return 'running';
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
}