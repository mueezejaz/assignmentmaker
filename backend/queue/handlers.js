import { queue } from '../queue/Queue.js';
import {
  generateMermaidERD,
  convertMermaidToPNG,
  generateLatexDoc,
  convertLatexToDocx,
  generatePythonCode,
  runPythonScript,
} from '../services/assignment.js';
import { saveJobMeta } from '../storage/storage.js';

export function registerHandlers() {
  queue.register('generate-assignment', async (job) => {
    const { userId } = job.payload;
    // Save initial job meta
    saveJobMeta(userId, job.id, {
      id: job.id,
      type: 'generate-assignment',
      scenario: job.payload.scenario,
      createdAt: job.createdAt,
      status: 'running',
    });

    const files = {};

    // Step 1: Mermaid ERD code
    const mermaidCode = await generateMermaidERD(job);
    files.mermaid = 'erd.mmd';

    // Step 2: Mermaid → PNG (via Puppeteer)
    const imgPath = await convertMermaidToPNG(job, mermaidCode);
    files.erdImage = imgPath.endsWith('.png') ? 'erd.png' : 'erd.svg';

    // Step 3: Generate structured report JSON
    const reportData = await generateLatexDoc(job);
    files.reportJson = 'report.json';

    // Step 4: Build DOCX from structured JSON
    await convertLatexToDocx(job, reportData);
    files.docx = 'report.docx';

    // Step 5: Python script
    await generatePythonCode(job);
    files.python = 'create_database.py';

    // Step 6: Try run Python (Windows only, saves README on Linux)
    const runResult = await runPythonScript(job);
    if (runResult?.accdbPath) files.accdb = 'StudentAttendanceSystem.accdb';
    if (runResult?.note) files.readme = 'README.md';

    // Save final job meta
    saveJobMeta(userId, job.id, {
      id: job.id,
      type: 'generate-assignment',
      scenario: job.payload.scenario,
      createdAt: job.createdAt,
      completedAt: Date.now(),
      status: 'done',
      files,
    });

    return { files, jobDir: `data/${userId.replace(/[^a-zA-Z0-9_\-]/g, '_')}/${job.id}` };
  });
}