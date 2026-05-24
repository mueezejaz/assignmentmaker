import { generateText } from './gemini.js';
import { saveFile, saveJobMeta, getJobDir } from '../storage/storage.js';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// ─── STEP 1: Generate Mermaid ERD ─────────────────────────────────────────────
export async function generateMermaidERD(job) {
  const { scenario, userId } = job.payload;
  job.addStep('🤖 Asking Gemini to design the ERD in Mermaid notation...');

  const prompt = `You are a database architect. Given this university management system scenario:
"${scenario}"

Generate a complete Mermaid ER diagram (erDiagram syntax) for a University Management System with:
- Department, Teacher, Student, Course, Section, Enrollment, Attendance tables
- All relationships with proper cardinality (||--|{, }|--|{, etc.)
- Key attributes for each entity

Output ONLY the mermaid code block, nothing else. Start with \`\`\`mermaid and end with \`\`\`.`;

  const raw = await generateText(userId, prompt);
  const mermaidMatch = raw.match(/```mermaid\n([\s\S]+?)```/);
  if (!mermaidMatch) throw new Error('Gemini did not return valid Mermaid code.');

  const mermaidCode = mermaidMatch[1].trim();
  saveFile(userId, job.id, 'erd.mmd', mermaidCode);
  job.addStep('✅ ERD Mermaid code generated and saved.');
  return mermaidCode;
}

// ─── STEP 2: Convert Mermaid to PNG ───────────────────────────────────────────
export async function convertMermaidToPNG(job, mermaidCode) {
  job.addStep('🖼️ Converting Mermaid ERD to PNG image...');
  const jobDir = getJobDir(job.payload.userId, job.id);
  const mmdPath = path.join(jobDir, 'erd.mmd');
  const pngPath = path.join(jobDir, 'erd.png');

  // Try mmdc (mermaid CLI)
  try {
    // Write a config for dark theme
    const config = JSON.stringify({ theme: 'dark', background: '#1a0a0a' });
    const configPath = path.join(jobDir, 'mermaid.config.json');
    fs.writeFileSync(configPath, config);

    await execAsync(`npx --yes @mermaid-js/mermaid-cli@latest mmdc -i "${mmdPath}" -o "${pngPath}" -C "${configPath}" --width 2000`, {
      timeout: 60000,
      cwd: jobDir,
    });

    if (fs.existsSync(pngPath)) {
      job.addStep('✅ ERD PNG image created successfully.');
      return pngPath;
    }
  } catch (err) {
    job.addStep(`⚠️ Mermaid CLI failed: ${err.message}. Using SVG fallback...`, 'warning');
  }

  // Fallback: generate an SVG inline representation
  const svgContent = generateFallbackSVG(mermaidCode);
  const svgPath = path.join(jobDir, 'erd.svg');
  fs.writeFileSync(svgPath, svgContent);
  job.addStep('✅ ERD SVG created as fallback.');
  return svgPath;
}

function generateFallbackSVG(mermaidCode) {
  // Simple SVG placeholder with the mermaid code embedded
  const lines = mermaidCode.split('\n');
  const entities = lines
    .filter(l => /^\s+\w+\s*\{/.test(l) || /\w+\s*\|/.test(l))
    .map(l => l.trim())
    .slice(0, 20);

  const svgLines = entities.map((e, i) => `<text x="20" y="${30 + i * 18}" fill="#ff4444" font-size="12" font-family="monospace">${e.replace(/</g, '&lt;')}</text>`).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.max(400, entities.length * 20 + 60)}" style="background:#1a0a0a">
  <rect width="100%" height="100%" fill="#1a0a0a"/>
  <text x="20" y="20" fill="#ff6666" font-size="14" font-weight="bold" font-family="monospace">ERD Diagram (Mermaid)</text>
  ${svgLines}
</svg>`;
}

// ─── STEP 3: Generate Business Scenario LaTeX ─────────────────────────────────
export async function generateLatexDoc(job) {
  const { scenario, userId } = job.payload;
  job.addStep('📄 Generating LaTeX business scenario document with Gemini...');

  const prompt = `You are an academic technical writer. Write a comprehensive LaTeX document for a University Management System database project.

The document should include:
1. Business Scenario section - describing the operational scope, goals, and business logic
2. System Overview with key entities (Department, Teacher, Student, Course, Section, Enrollment, Attendance)
3. Normalization notes (3NF compliance)
4. Relationships overview

Use proper LaTeX formatting with:
- \\documentclass{article}
- \\usepackage packages (geometry, booktabs, hyperref, titlesec, xcolor)
- Proper sections, subsections
- A table listing all 7 entities with their primary keys
- Professional academic tone

Output ONLY the complete LaTeX code, nothing else.`;

  const latex = await generateText(userId, prompt);
  // Clean up if it has markdown fences
  const clean = latex.replace(/```latex\n?/g, '').replace(/```\n?/g, '').trim();
  saveFile(userId, job.id, 'report.tex', clean);
  job.addStep('✅ LaTeX document generated and saved.');
  return clean;
}

// ─── STEP 4: Convert LaTeX to DOCX ────────────────────────────────────────────
export async function convertLatexToDocx(job, latexContent) {
  job.addStep('📝 Converting LaTeX to DOCX...');
  const jobDir = getJobDir(job.payload.userId, job.id);
  const texPath = path.join(jobDir, 'report.tex');
  const docxPath = path.join(jobDir, 'report.docx');

  // Try pandoc first
  try {
    await execAsync(`pandoc "${texPath}" -o "${docxPath}" --from=latex --to=docx`, { timeout: 30000 });
    if (fs.existsSync(docxPath)) {
      job.addStep('✅ DOCX created via pandoc.');
      return docxPath;
    }
  } catch (err) {
    job.addStep(`⚠️ Pandoc not available: ${err.message}. Generating DOCX manually...`, 'warning');
  }

  // Fallback: Use officegen to create a basic DOCX from the LaTeX content
  await generateDocxFromLatex(latexContent, docxPath, job);
  job.addStep('✅ DOCX created successfully.');
  return docxPath;
}

async function generateDocxFromLatex(latexContent, outputPath, job) {
  // Parse some basic content from LaTeX
  const titleMatch = latexContent.match(/\\title\{([^}]+)\}/);
  const sections = [...latexContent.matchAll(/\\section\{([^}]+)\}([\s\S]*?)(?=\\section|\\end\{document\})/g)];

  const { default: officegen } = await import('officegen');
  const docx = officegen('docx');

  // Title
  const titlePara = docx.createP();
  titlePara.addText(titleMatch ? titleMatch[1] : 'University Management System', { bold: true, font_size: 20 });
  titlePara.options.align = 'center';

  docx.createP(); // spacing

  if (sections.length === 0) {
    // Just dump cleaned text
    const cleaned = latexContent
      .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, ' ')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const p = docx.createP();
    p.addText(cleaned.slice(0, 3000));
  } else {
    for (const [, secTitle, secBody] of sections) {
      const heading = docx.createP();
      heading.addText(secTitle, { bold: true, font_size: 14 });

      const body = secBody
        .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, ' ')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (body) {
        const p = docx.createP();
        p.addText(body.slice(0, 1000));
      }
      docx.createP();
    }
  }

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(outputPath);
    docx.generate(out, {
      finalize: resolve,
      error: reject,
    });
  });
}

// ─── STEP 5: Generate Python/Access DB Code ───────────────────────────────────
export async function generatePythonCode(job) {
  const { scenario, userId } = job.payload;
  job.addStep('🐍 Generating Python code to create the MS Access .accdb file...');

  const prompt = `You are a Python database programmer. Generate a Python script that creates a Microsoft Access .accdb database file for a University Management System.

The script must:
1. Use pyodbc and win32com.client to create the .accdb file
2. Create these 7 tables: Department, Teacher, Student, Course, Section, Enrollment, Attendance
3. Apply proper foreign key constraints
4. Insert at least 10 sample records per table with realistic Pakistani university data
5. The output .accdb file should be named "StudentAttendanceSystem.accdb" in the same directory as the script
6. Use AUTOINCREMENT for primary keys
7. Add proper field validations

The script should be production-ready, well-commented, and handle errors.

Output ONLY the Python code, no markdown fences, no explanation.`;

  const code = await generateText(userId, prompt);
  const clean = code.replace(/```python\n?/g, '').replace(/```\n?/g, '').trim();
  saveFile(userId, job.id, 'create_database.py', clean);
  job.addStep('✅ Python database creation script generated and saved.');
  return clean;
}

// ─── STEP 6: Run Python to generate .accdb ────────────────────────────────────
export async function runPythonScript(job) {
  job.addStep('⚙️ Note: .accdb generation requires Windows with MS Access installed.');
  job.addStep('📦 Python script saved and ready to run on your Windows machine.');

  const jobDir = getJobDir(job.payload.userId, job.id);
  const pyPath = path.join(jobDir, 'create_database.py');

  // Check if we're on Linux (can't run pyodbc/win32com on Linux)
  if (process.platform !== 'win32') {
    job.addStep('ℹ️ Running on Linux server - Python script saved for Windows execution.');
    // Create a README with instructions
    const readme = `# Database Creation Instructions

## Run on Windows Machine

1. Copy \`create_database.py\` to your Windows machine
2. Install dependencies:
   \`\`\`
   pip install pyodbc pywin32
   \`\`\`
3. Ensure Microsoft Access or ACE OLEDB driver is installed
4. Run the script:
   \`\`\`
   python create_database.py
   \`\`\`
5. The \`StudentAttendanceSystem.accdb\` file will be created in the same directory

## Requirements
- Windows OS
- Microsoft Access or Microsoft ACE OLEDB 12.0 Provider
- Python 3.8+
- pyodbc, pywin32 packages
`;
    saveFile(job.payload.userId, job.id, 'README.md', readme);
    return { note: 'Script saved. Run on Windows to generate .accdb file.' };
  }

  // If Windows, try running
  try {
    const { stdout, stderr } = await execAsync(`python "${pyPath}"`, {
      timeout: 60000,
      cwd: jobDir,
    });
    job.addStep(`✅ Python script ran successfully:\n${stdout}`);
    return { stdout, accdbPath: path.join(jobDir, 'StudentAttendanceSystem.accdb') };
  } catch (err) {
    throw new Error(`Python execution failed: ${err.message}`);
  }
}
