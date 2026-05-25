// ============================================================
// BullMQ Worker — run this as a SEPARATE PROCESS:
//   node worker.js
//
// Each worker process = separate Node.js thread.
// Run multiple workers for more parallelism:
//   node worker.js   (terminal 1)
//   node worker.js   (terminal 2)
//
// Or set WORKER_CONCURRENCY=4 to handle 4 jobs inside one process
// (still concurrent via event loop, good for I/O-bound Gemini calls).
// ============================================================

import { Worker } from 'bullmq';
import { getRedisConnection } from './queue/redis.js';
import {
    generateMermaidERD,
    convertMermaidToPNG,
    generateLatexDoc,
    convertLatexToDocx,
    generatePythonCode,
    runPythonScript,
} from './services/assignment.js';
import { saveJobMeta } from './storage/storage.js';
import { initGemini, hasClient } from './services/gemini.js';
import { loadUserMeta } from './storage/storage.js';
import { seg } from './seg/seg.js';

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

console.log(`\n🔧 Assignment Worker starting...`);
console.log(`   Concurrency: ${CONCURRENCY} jobs at once`);
console.log(`   Redis: ${seg["REDIS_URL"] || 'redis://localhost:6379'}\n`);

// ── Helper: push a step and update BullMQ progress ───────────────────────────
async function addStep(bullJob, steps, message, state = 'running') {
    const step = { message, state, ts: Date.now() };
    steps.push(step);
    console.log(`[Job ${bullJob.id}] ${message}`);

    // BullMQ progress is stored in Redis and readable by the API server
    await bullJob.updateProgress({ steps });
    return step;
}

// ── Main job processor ────────────────────────────────────────────────────────
async function processJob(bullJob) {
    const { userId, scenario } = bullJob.data;
    const steps = [];

    const log = (msg, state) => addStep(bullJob, steps, msg, state);

    // Re-initialise Gemini if this worker process doesn't have the client yet
    // (workers are separate processes — they don't share memory with the API server)
    if (!hasClient(userId)) {
        const meta = loadUserMeta(userId);
        if (!meta.apiKeyEncoded) {
            throw new Error('No API key found for user. Please set your Gemini API key.');
        }
        const apiKey = Buffer.from(meta.apiKeyEncoded, 'base64').toString();
        initGemini(userId, apiKey);
    }

    // Save initial job meta
    saveJobMeta(userId, bullJob.id, {
        id: bullJob.id,
        type: 'generate-assignment',
        scenario,
        createdAt: bullJob.timestamp,
        status: 'running',
    });

    // Build a fake "job" object that our existing service functions expect.
    // They call job.addStep() and job.payload — we adapt here.
    const fakeJob = {
        id: bullJob.id,
        payload: { userId, scenario },
        addStep: (msg, state) => addStep(bullJob, steps, msg, state),
    };

    const files = {};

    await log('🚀 Job started — generating your database assignment...');

    // Step 1: Mermaid ERD
    const mermaidCode = await generateMermaidERD(fakeJob);
    files.mermaid = 'erd.mmd';

    // Step 2: Mermaid → PNG (both styles)
    const { crowsfoot: imgPath, chen: chenImgPath } = await convertMermaidToPNG(fakeJob, mermaidCode);
    files.erdImage = imgPath.endsWith('.png') ? 'erd.png' : 'erd.svg';
    files.erdChen = chenImgPath.endsWith('.png') ? 'erd_chen.png' : 'erd_chen.svg';

    // Step 3: Structured report JSON
    const reportData = await generateLatexDoc(fakeJob);
    files.reportJson = 'report.json';

    // Step 4: Build DOCX
    await convertLatexToDocx(fakeJob, reportData);
    files.docx = 'report.docx';

    // Step 5: Python script
    await generatePythonCode(fakeJob);
    files.python = 'create_database.py';

    // Step 6: Run Python (Windows) or save README (Linux)
    const runResult = await runPythonScript(fakeJob);
    if (runResult?.accdbPath) files.accdb = 'StudentAttendanceSystem.accdb';
    if (runResult?.note) files.readme = 'README.md';

    const jobDir = `data/${userId.replace(/[^a-zA-Z0-9_\-]/g, '_')}/${bullJob.id}`;

    // Save final meta
    saveJobMeta(userId, bullJob.id, {
        id: bullJob.id,
        type: 'generate-assignment',
        scenario,
        createdAt: bullJob.timestamp,
        completedAt: Date.now(),
        status: 'done',
        files,
    });

    await log('🎉 All files generated successfully!', 'done');

    return { files, jobDir };
}

// ── Create the Worker ─────────────────────────────────────────────────────────
const worker = new Worker('assignments', processJob, {
    connection: getRedisConnection(),
    concurrency: CONCURRENCY,
});

worker.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed: ${err.message}`);
    if (job) {
        saveJobMeta(job.data.userId, job.id, {
            id: job.id,
            status: 'failed',
            error: err.message,
        });
    }
});

worker.on('error', (err) => {
    console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Worker shutting down...');
    await worker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Worker shutting down...');
    await worker.close();
    process.exit(0);
});