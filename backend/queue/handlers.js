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
    const { userId, jobId } = job.payload;

    // Save initial job meta
    saveJobMeta(userId, job.id, {
      id: job.id,
      type: 'generate-assignment',
      scenario: job.payload.scenario,
      createdAt: job.createdAt,
      status: 'running',
    });

    const files = {};

    // Step 1: Mermaid ERD
    const mermaidCode = await generateMermaidERD(job);
    files.mermaid = 'erd.mmd';

    // Step 2: Mermaid → PNG
    const imgPath = await convertMermaidToPNG(job, mermaidCode);
    files.erdImage = imgPath.endsWith('.png') ? 'erd.png' : 'erd.svg';

    // Step 3: LaTeX doc
    const latexContent = await generateLatexDoc(job);
    files.latex = 'report.tex';

    // Step 4: LaTeX → DOCX
    await convertLatexToDocx(job, latexContent);
    files.docx = 'report.docx';

    // Step 5: Python code
    await generatePythonCode(job);
    files.python = 'create_database.py';

    // Step 6: Try run Python
    const runResult = await runPythonScript(job);
    if (runResult?.accdbPath) files.accdb = 'StudentAttendanceSystem.accdb';

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
