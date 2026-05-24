// ============================================================
// In-Memory Queue System (built from scratch)
// ============================================================

class Job {
  constructor(id, type, payload, userId) {
    this.id = id;
    this.type = type;
    this.payload = payload;
    this.userId = userId;
    this.status = 'queued';   // queued | running | done | failed
    this.steps = [];           // live step log
    this.result = null;
    this.error = null;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  addStep(message, state = 'running') {
    const step = { message, state, ts: Date.now() };
    this.steps.push(step);
    this.updatedAt = Date.now();
    console.log(`[Job ${this.id}] ${message}`);
    return step;
  }

  setRunning() {
    this.status = 'running';
    this.updatedAt = Date.now();
  }

  setDone(result) {
    this.status = 'done';
    this.result = result;
    this.updatedAt = Date.now();
    this.addStep('Job completed successfully.', 'done');
  }

  setFailed(error) {
    this.status = 'failed';
    this.error = typeof error === 'string' ? error : error?.message || 'Unknown error';
    this.updatedAt = Date.now();
    this.addStep(`Job failed: ${this.error}`, 'error');
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      userId: this.userId,
      status: this.status,
      steps: this.steps,
      result: this.result,
      error: this.error,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

class Queue {
  constructor(name, concurrency = 1) {
    this.name = name;
    this.concurrency = concurrency;
    this.jobs = new Map();        // jobId → Job
    this.pending = [];             // queue of jobIds
    this.running = 0;
    this.handlers = new Map();    // type → async fn(job)
    this._longPollWaiters = new Map(); // jobId → [resolve, ...]
  }

  register(type, handler) {
    this.handlers.set(type, handler);
  }

  enqueue(type, payload, userId) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job = new Job(id, type, payload, userId);
    this.jobs.set(id, job);
    this.pending.push(id);
    job.addStep('Job queued, waiting for worker...', 'queued');
    this._tick();
    return job;
  }

  getJob(id) {
    return this.jobs.get(id) || null;
  }

  getJobsForUser(userId) {
    return [...this.jobs.values()]
      .filter(j => j.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(j => j.toJSON());
  }

  // Long-poll: wait until job status changes or timeout
  waitForUpdate(jobId, sinceTs, timeoutMs = 25000) {
    return new Promise((resolve) => {
      const job = this.jobs.get(jobId);
      if (!job) return resolve(null);

      // If there's already a new update, return immediately
      if (job.updatedAt > sinceTs) {
        return resolve(job.toJSON());
      }

      // Otherwise register waiter
      if (!this._longPollWaiters.has(jobId)) {
        this._longPollWaiters.set(jobId, []);
      }
      const waiters = this._longPollWaiters.get(jobId);

      const timer = setTimeout(() => {
        const idx = waiters.indexOf(resolve);
        if (idx !== -1) waiters.splice(idx, 1);
        resolve(job.toJSON()); // return current state on timeout
      }, timeoutMs);

      const wrappedResolve = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
      waiters.push(wrappedResolve);
    });
  }

  _notifyWaiters(jobId) {
    const waiters = this._longPollWaiters.get(jobId);
    if (!waiters || waiters.length === 0) return;
    const job = this.jobs.get(jobId);
    const snapshot = job?.toJSON();
    [...waiters].forEach(resolve => resolve(snapshot));
    this._longPollWaiters.set(jobId, []);
  }

  _tick() {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const jobId = this.pending.shift();
      const job = this.jobs.get(jobId);
      if (!job) continue;
      this.running++;
      this._run(job).finally(() => {
        this.running--;
        this._tick();
      });
    }
  }

  async _run(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.setFailed(`No handler registered for job type: ${job.type}`);
      this._notifyWaiters(job.id);
      return;
    }

    job.setRunning();
    this._notifyWaiters(job.id);

    // Wrap addStep to also notify waiters
    const originalAddStep = job.addStep.bind(job);
    job.addStep = (message, state) => {
      const step = originalAddStep(message, state);
      this._notifyWaiters(job.id);
      return step;
    };

    try {
      const result = await handler(job);
      job.setDone(result);
    } catch (err) {
      job.setFailed(err);
    }
    this._notifyWaiters(job.id);
  }
}

// Singleton queue
const queue = new Queue('main', 2);
export { Queue, Job, queue };
