import { generateText } from './gemini.js';
import { saveFile, saveJobMeta, getJobDir } from '../storage/storage.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageOrientation
} from 'docx';

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CACHE: Store Mermaid code by userId
// ─────────────────────────────────────────────────────────────────────────────
export const userMermaidCache = {};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Generate Mermaid ERD
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMermaidERD(job) {
  const { scenario, userId } = job.payload;
  console.log("this is scenario", scenario)
  job.addStep('🤖 Asking Gemini to design the ERD in Mermaid notation...');

  const prompt = `You are a senior database architect and ERD specialist.

The user has provided this specific scenario:
"${scenario}"

CRITICAL INSTRUCTION: You MUST base your entire ERD design on the scenario above. Identify the real-world domain (it may be a hospital, library, hotel, school, e-commerce system, etc.) and derive entity names, attributes, and relationships that make sense FOR THAT SPECIFIC SCENARIO. Do NOT default to a generic university system. Every entity name, attribute name, and relationship label must reflect the actual domain described in the scenario.

Analyze the scenario and identify:
1. The core entities that exist in this domain (e.g., if it's a hospital: Patient, Doctor, Ward, etc.)
2. The attributes each entity should have based on the scenario
3. The relationships between those entities

Then generate a PROFESSIONAL and SYNTACTICALLY CORRECT Mermaid ER diagram for this system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL MERMAID SYNTAX RULES — FOLLOW EXACTLY OR THE DIAGRAM WILL FAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — First line MUST be exactly:
erDiagram

RULE 2 — Derive 6–9 entity names from the scenario. Use PascalCase, no spaces.
  Examples for a hospital: Patient, Doctor, Ward, Appointment, Prescription, Department
  Examples for a library: Member, Book, Author, Loan, Category, Branch
  The entities MUST reflect the actual domain of the scenario provided.

RULE 3 — Each entity block MUST follow this exact format with NO deviations:
  EntityName {
      dataType attributeName
      dataType attributeName PK
      dataType attributeName FK
  }

  - Opening brace { must be on the SAME LINE as the entity name
  - Each attribute on its own indented line
  - Closing brace } on its own line
  - NO quotes around entity names
  - NO spaces inside attribute names (e.g. use PatientID not Patient ID)

RULE 4 — Allowed data types ONLY (use exactly as written):
  int
  string
  date
  boolean
  float

RULE 5 — Relationship lines MUST use these exact connectors:
  ||--||    (one and only one — to — one and only one)
  ||--|{    (one and only one — to — one or more)
  }|--|{    (one or more — to — one or more)
  ||--o{    (one and only one — to — zero or more)
  }o--||    (zero or more — to — one and only one)

RULE 6 — Relationship statement format MUST be exactly:
  EntityA CONNECTOR EntityB : "label"

  - Label MUST be in double quotes
  - Use short, clear verbs relevant to the scenario domain
  - One relationship statement per line

RULE 7 — STRICT PROHIBITIONS (any of these will break the diagram):
  - NO %% comments of any kind
  - NO classDef, style, or CSS blocks
  - NO %%{init: ...}%% blocks
  - NO theme or color configuration
  - NO multi-word attribute names with spaces
  - NO special characters in attribute names (only alphanumeric)
  - NO markdown text, explanations, or notes outside the code block
  - NO trailing whitespace on relationship lines

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ATTRIBUTE GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each entity derived from the scenario:
- Include a primary key (ID field) marked PK
- Include 3–6 meaningful attributes that reflect the real domain
- Include foreign key fields (marked FK) where relationships exist
- Attribute names must be camelCase or PascalCase, no spaces

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXACT FORMAT EXAMPLE (for a HOSPITAL scenario — adapt yours to YOUR scenario domain)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

erDiagram
    Department {
        int DeptID PK
        string DeptName
        string Location
        int EstablishedYear
    }

    Doctor {
        int DoctorID PK
        string FullName
        string Specialization
        string Email
        int DeptID FK
    }

    Department ||--|{ Doctor : "employs"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output ONLY the Mermaid code block. Start with:
\`\`\`mermaid

End with:
\`\`\`
`;

  const raw = await generateText(userId, prompt);
  const mermaidMatch = raw.match(/```mermaid\n([\s\S]+?)```/);
  if (!mermaidMatch) throw new Error('Gemini did not return a valid Mermaid code block.');

  const mermaidCode = mermaidMatch[1].trim();

  // Store the Mermaid code in the global object
  userMermaidCache[userId] = mermaidCode;

  saveFile(userId, job.id, 'erd.mmd', mermaidCode);
  job.addStep('✅ ERD Mermaid code generated and saved.');
  return mermaidCode;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Convert Mermaid → SVG (white background, black diagram, no color)
// ─────────────────────────────────────────────────────────────────────────────
export async function convertMermaidToPNG(job, mermaidCode) {
  job.addStep('🖼️ Rendering ERD diagram to SVG...');
  const jobDir = getJobDir(job.payload.userId, job.id);
  const svgPath = path.join(jobDir, 'erd.svg');

  const svgContent = generateFallbackSVG(mermaidCode);
  fs.writeFileSync(svgPath, svgContent);
  job.addStep('✅ ERD SVG rendered successfully (white background, black diagram).');
  return svgPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Generator — white background, black text and borders, no color scheme
// Parses the Mermaid ERD code and renders a clean ER diagram as SVG
// ─────────────────────────────────────────────────────────────────────────────
function generateFallbackSVG(mermaidCode) {
  const lines = mermaidCode.split('\n').map(l => l.trim()).filter(l => l && l !== 'erDiagram');

  // ── Parse entities ──────────────────────────────────────────────────────────
  const entities = [];
  let current = null;

  for (const line of lines) {
    const entityMatch = line.match(/^(\w+)\s*\{/);
    const attrMatch = line.match(/^(int|string|date|boolean|float)\s+(\w+)(\s+(PK|FK))?/i);
    const closeMatch = line === '}';

    if (entityMatch && !line.includes(':')) {
      current = { name: entityMatch[1], attrs: [] };
      entities.push(current);
    } else if (attrMatch && current) {
      const tag = attrMatch[4] ? attrMatch[4].toUpperCase() : '';
      current.attrs.push({ type: attrMatch[1], name: attrMatch[2], tag });
    } else if (closeMatch) {
      current = null;
    }
  }

  // ── Parse relationships ─────────────────────────────────────────────────────
  const relationships = [];
  for (const line of lines) {
    const m = line.match(/^(\w+)\s+(\S+)\s+(\w+)\s*:\s*"?([^"]+)"?$/);
    if (m && !line.match(/^(int|string|date|boolean|float)/i) && !m[1].match(/^(int|string|date|boolean|float)$/i)) {
      relationships.push({ from: m[1], connector: m[2], to: m[3], label: m[4].replace(/"/g, '') });
    }
  }

  // ── Layout constants ────────────────────────────────────────────────────────
  const ENTITY_W = 240;
  const HEADER_H = 36;
  const ROW_H = 26;
  const PADDING = 60;
  const COLS = 3;

  const positions = {};
  entities.forEach((e, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PADDING + col * (ENTITY_W + PADDING * 2);
    const y = PADDING + row * (HEADER_H + ROW_H * 8 + PADDING * 1.5);
    const h = HEADER_H + ROW_H * e.attrs.length + 8;
    positions[e.name] = { x, y, w: ENTITY_W, h };
  });

  const totalCols = Math.min(COLS, entities.length);
  const totalRows = Math.ceil(entities.length / COLS);
  const svgW = PADDING + totalCols * (ENTITY_W + PADDING * 2);
  const maxAttrCount = Math.max(...entities.map(e => e.attrs.length), 0);
  const svgH = PADDING + totalRows * (HEADER_H + ROW_H * maxAttrCount + PADDING * 2.5) + 60;

  const linesSVG = relationships.map(rel => {
    const a = positions[rel.from];
    const b = positions[rel.to];
    if (!a || !b) return '';

    const ax = a.x + a.w;
    const ay = a.y + a.h / 2;
    const bx = b.x;
    const by = b.y + b.h / 2;
    const mx = (ax + bx) / 2;
    const labelX = mx;
    const labelY = (ay + by) / 2 - 8;

    return `
    <path d="M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}"
          fill="none" stroke="#000000" stroke-width="1.5" marker-end="url(#arrow)"/>
    <rect x="${labelX - 28}" y="${labelY - 10}" width="56" height="14"
          fill="#ffffff" stroke="none"/>
    <text x="${labelX}" y="${labelY}" text-anchor="middle"
          font-family="Arial" font-size="10" fill="#333333">${rel.label}</text>`;
  }).join('');

  const boxesSVG = entities.map(e => {
    const { x, y, w, h } = positions[e.name];

    const attrRows = e.attrs.map((a, i) => {
      const rowY = y + HEADER_H + i * ROW_H;
      const bg = i % 2 === 0 ? '#ffffff' : '#f5f5f5';
      const tagLabel = a.tag ? ` «${a.tag}»` : '';
      const nameWeight = a.tag === 'PK' ? 'bold' : 'normal';
      return `
      <rect x="${x}" y="${rowY}" width="${w}" height="${ROW_H}"
            fill="${bg}" stroke="#000000" stroke-width="0.5"/>
      <text x="${x + 10}" y="${rowY + ROW_H / 2 + 4}"
            font-family="Arial" font-size="11" fill="#000000">
        <tspan font-style="italic" fill="#555555">${a.type}</tspan>
        <tspan font-weight="${nameWeight}" fill="#000000"> ${a.name}</tspan>
        <tspan fill="#888888" font-size="9">${tagLabel}</tspan>
      </text>`;
    }).join('');

    return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}"
          fill="#ffffff" stroke="#000000" stroke-width="1.5" rx="2"/>
    <rect x="${x}" y="${y}" width="${w}" height="${HEADER_H}"
          fill="#000000" stroke="#000000" stroke-width="1.5" rx="2"/>
    <rect x="${x}" y="${y + HEADER_H - 2}" width="${w}" height="4"
          fill="#000000" stroke="none"/>
    <text x="${x + w / 2}" y="${y + HEADER_H / 2 + 5}"
          text-anchor="middle" font-family="Arial" font-size="13"
          font-weight="bold" fill="#ffffff">${e.name}</text>
    ${attrRows}`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${svgW}" height="${svgH}"
     viewBox="0 0 ${svgW} ${svgH}">

  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8"
            refX="8" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#000000"/>
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#ffffff"/>

  <text x="${svgW / 2}" y="32" text-anchor="middle"
        font-family="Arial" font-size="18" font-weight="bold"
        fill="#000000">Entity Relationship Diagram</text>

  ${linesSVG}

  ${boxesSVG}

</svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Generate structured report content (JSON → clean DOCX)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateLatexDoc(job) {
  const { scenario, userId } = job.payload;
  job.addStep('📄 Generating structured report content with Gemini...');

  // Get the cached Mermaid code to enforce table consistency
  const cachedMermaid = userMermaidCache[userId] || '';

  const prompt = `You are an academic technical writer for a database design course.

The user has provided this specific scenario:
"${scenario}"

CRITICAL INSTRUCTION: Analyze the scenario above carefully. Identify the real-world domain it describes (e.g., hospital management, library system, hotel booking, e-commerce, school administration, etc.). ALL content you generate — the title, entities, attributes, relationships, business rules — MUST reflect THIS specific scenario. Do NOT use generic university/student content unless the scenario explicitly describes a university.

Based on the scenario, identify 6–9 core entities, their attributes, and the relationships between them.

Write a comprehensive database design report for this system.

Return ONLY a valid JSON object — absolutely no markdown fences, no backticks, no explanatory text before or after, just the raw JSON starting with { and ending with }:

{
  "title": "<System Name from scenario> – Database Design Report",
  "subtitle": "A Comprehensive Database Design Document",
  "businessScenario": {
    "overview": "2–3 sentence overview derived directly from the scenario provided",
    "goals": ["goal 1 relevant to scenario", "goal 2", "goal 3", "goal 4"],
    "businessRules": ["rule 1 relevant to scenario domain", "rule 2", "rule 3", "rule 4", "rule 5"]
  },
  "entities": [
    {
      "name": "EntityName (from scenario domain)",
      "primaryKey": "EntityID",
      "description": "What this entity represents in the context of the scenario",
      "keyAttributes": ["EntityID", "Attribute2", "Attribute3", "Attribute4"]
    }
  ],
  "normalization": {
    "1NF": "Explanation of first normal form compliance specific to this system",
    "2NF": "Explanation of second normal form compliance specific to this system",
    "3NF": "Explanation of third normal form compliance specific to this system"
  },
  "relationships": [
    {
      "from": "EntityA",
      "to": "EntityB",
      "type": "One-to-Many",
      "description": "Relationship description relevant to the scenario"
    }
  ]
}

IMPORTANT RULES FOR THE JSON:
- Use only straight double quotes " for all strings — no smart/curly quotes
- No trailing commas after the last item in any array or object
- No comments inside the JSON
- Escape any double quotes inside string values as \\"
- All string values must be on a single line (no newlines inside strings)
- Return ONLY the JSON object, nothing else

CRITICAL ALIGNMENT INSTRUCTION:
You MUST ensure the entities, attributes, primary keys, and relationships in your JSON EXACTLY MATCH the following Mermaid ERD design generated in the previous step:

\`\`\`mermaid
${cachedMermaid}
\`\`\`
`;

  const raw = await generateText(userId, prompt);

  // ── Robust JSON extraction ──────────────────────────────────────────────────
  // Strip markdown fences if present
  let jsonStr = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Find the outermost { ... } block
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Gemini response did not contain a JSON object.');
  }
  jsonStr = jsonStr.slice(start, end + 1);

  // Fix common LLM JSON mistakes before parsing
  jsonStr = fixCommonJsonIssues(jsonStr);

  let reportData;
  try {
    reportData = JSON.parse(jsonStr);
  } catch (e) {
    // Last-resort: sanitize encoding issues and retry
    try {
      const sanitized = jsonStr
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-');
      reportData = JSON.parse(sanitized);
    } catch (e2) {
      throw new Error(
        `Failed to parse Gemini report JSON after sanitization: ${e2.message}\n\n` +
        `Raw response (first 500 chars):\n${raw.slice(0, 500)}`
      );
    }
  }

  saveFile(userId, job.id, 'report.json', JSON.stringify(reportData, null, 2));
  job.addStep('✅ Report content generated and saved.');
  return reportData;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON sanitizer — fixes common mistakes LLMs make in JSON output
// ─────────────────────────────────────────────────────────────────────────────
function fixCommonJsonIssues(str) {
  // Remove trailing commas before } or ]
  str = str.replace(/,\s*([\}\]])/g, '$1');

  // Replace smart/curly quotes with straight quotes
  str = str.replace(/[\u2018\u2019]/g, "'");
  str = str.replace(/[\u201C\u201D]/g, '"');

  // Replace em/en dashes with hyphens
  str = str.replace(/[\u2013\u2014]/g, '-');

  // Remove stray control characters (except normal whitespace \t \n \r)
  // eslint-disable-next-line no-control-regex
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return str;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Build clean DOCX from structured JSON using docx package
// ─────────────────────────────────────────────────────────────────────────────
export async function convertLatexToDocx(job, reportData) {
  job.addStep('📝 Building professional Word document...');
  const jobDir = getJobDir(job.payload.userId, job.id);
  const docxPath = path.join(jobDir, 'report.docx');

  const borderDef = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
  const allBorders = { top: borderDef, bottom: borderDef, left: borderDef, right: borderDef };
  const headerShading = { fill: '000000', type: ShadingType.CLEAR };
  const altShading = { fill: 'EEEEEE', type: ShadingType.CLEAR };

  const makeHeading = (text, level) => new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: '000000' })],
  });

  const makePara = (text, opts = {}) => new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, ...opts })],
  });

  const makeBullet = (text) => new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text })],
  });

  const makeTableHeaderCell = (text, widthDXA) => new TableCell({
    borders: allBorders,
    width: { size: widthDXA, type: WidthType.DXA },
    shading: headerShading,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })] })],
  });

  const makeTableCell = (text, widthDXA, shade = false) => new TableCell({
    borders: allBorders,
    width: { size: widthDXA, type: WidthType.DXA },
    shading: shade ? altShading : { fill: 'FFFFFF', type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, color: '000000', size: 20 })] })],
  });

  const entityTableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeTableHeaderCell('Entity / Table', 2340),
        makeTableHeaderCell('Primary Key', 1872),
        makeTableHeaderCell('Description', 5148),
      ],
    }),
    ...reportData.entities.map((e, i) => new TableRow({
      children: [
        makeTableCell(e.name, 2340, i % 2 !== 0),
        makeTableCell(e.primaryKey, 1872, i % 2 !== 0),
        makeTableCell(e.description, 5148, i % 2 !== 0),
      ],
    })),
  ];

  const entityTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 1872, 5148],
    rows: entityTableRows,
  });

  const relTableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeTableHeaderCell('From', 2000),
        makeTableHeaderCell('To', 2000),
        makeTableHeaderCell('Cardinality', 1800),
        makeTableHeaderCell('Description', 3560),
      ],
    }),
    ...reportData.relationships.map((r, i) => new TableRow({
      children: [
        makeTableCell(r.from, 2000, i % 2 !== 0),
        makeTableCell(r.to, 2000, i % 2 !== 0),
        makeTableCell(r.type, 1800, i % 2 !== 0),
        makeTableCell(r.description, 3560, i % 2 !== 0),
      ],
    })),
  ];

  const relTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2000, 2000, 1800, 3560],
    rows: relTableRows,
  });

  const attrSections = reportData.entities.flatMap(e => [
    makeHeading(e.name, HeadingLevel.HEADING_3),
    makePara(e.description),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [makeTableHeaderCell('Attribute', 4680), makeTableHeaderCell('Notes', 4680)],
        }),
        ...e.keyAttributes.map((attr, i) => new TableRow({
          children: [
            makeTableCell(attr, 4680, i % 2 !== 0),
            makeTableCell(
              attr === e.primaryKey ? 'Primary Key (PK)'
                : attr.endsWith('ID') && attr !== e.primaryKey ? 'Foreign Key (FK)'
                  : 'Attribute',
              4680, i % 2 !== 0
            ),
          ],
        })),
      ],
    }),
    new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }),
  ]);

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }],
      }],
    },
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial', color: '000000' },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: '000000' },
          paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 }
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: '000000' },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 }
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1440, after: 200 },
          children: [new TextRun({ text: reportData.title, bold: true, size: 48, color: '000000', font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 160 },
          children: [new TextRun({ text: reportData.subtitle || '', size: 26, color: '444444', font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 2880 },
          children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 22, color: '666666' })],
        }),

        makeHeading('1. Business Scenario', HeadingLevel.HEADING_1),
        makeHeading('1.1 Overview', HeadingLevel.HEADING_2),
        makePara(reportData.businessScenario.overview),
        makeHeading('1.2 System Goals', HeadingLevel.HEADING_2),
        ...reportData.businessScenario.goals.map(g => makeBullet(g)),
        makeHeading('1.3 Business Rules', HeadingLevel.HEADING_2),
        ...reportData.businessScenario.businessRules.map(r => makeBullet(r)),

        makeHeading('2. System Entities', HeadingLevel.HEADING_1),
        makePara('The system architecture revolves around the core entities identified from the scenario, each capturing an essential dimension of the system:'),
        new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }),
        entityTable,
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),

        makeHeading('3. Entity Attribute Details', HeadingLevel.HEADING_1),
        ...attrSections,

        makeHeading('4. Normalization', HeadingLevel.HEADING_1),
        makeHeading('4.1 First Normal Form (1NF)', HeadingLevel.HEADING_2),
        makePara(reportData.normalization['1NF']),
        makeHeading('4.2 Second Normal Form (2NF)', HeadingLevel.HEADING_2),
        makePara(reportData.normalization['2NF']),
        makeHeading('4.3 Third Normal Form (3NF)', HeadingLevel.HEADING_2),
        makePara(reportData.normalization['3NF']),

        makeHeading('5. Entity Relationships', HeadingLevel.HEADING_1),
        makePara('The following table summarises all relationships between entities in the system:'),
        new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }),
        relTable,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(docxPath, buffer);
  job.addStep('✅ Word document built successfully.');
  return docxPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Generate Python DB creation script
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePythonCode(job) {
  const { scenario, userId } = job.payload;
  job.addStep('🐍 Generating Python script to create the MS Access database...');

  // Get the cached Mermaid code to enforce table consistency
  const cachedMermaid = userMermaidCache[userId] || '';

  const prompt = `You are an expert Python developer specializing in Microsoft Access database automation with pyodbc and win32com.

The user has provided this specific scenario:
"${scenario}"

CRITICAL INSTRUCTION:
Analyze the scenario carefully and derive the correct domain, entities, table names, and attributes FROM THE SCENARIO itself.
Do NOT default to a university/student system unless the scenario explicitly describes one.

You MUST generate Python code in the SAME STYLE and STRUCTURE as the provided reference example below.

VERY IMPORTANT:
The generated Python code must be extremely stable, practical, and avoid common MS Access errors.
Use the reference implementation pattern exactly.

STRICT IMPLEMENTATION RULES:

1. ALWAYS import:
   - pyodbc
   - os
   - win32com.client

2. ALWAYS create the .accdb file FIRST using:
   win32com.client.Dispatch("ADOX.Catalog")

3. ALWAYS use this exact database creation pattern:

   if os.path.exists(path):
       os.remove(path)

   catalog = win32com.client.Dispatch("ADOX.Catalog")
   catalog.Create(
       f"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={path};"
   )

4. ALWAYS build DB path using:
   os.path.dirname(os.path.abspath(__file__))

5. ALWAYS use this connection string style:

   CONN_STR = (
       r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};"
       f"DBQ={DB_PATH};"
   )

6. ALWAYS connect using:
   pyodbc.connect(CONN_STR, autocommit=True)

7. CREATE TABLE RULES:
   - Create 6–9 tables
   - Create parent tables before child tables
   - Use AUTOINCREMENT PRIMARY KEY
   - Use ONLY valid MS Access types:
       TEXT(n)
       INTEGER
       FLOAT
       YESNO
       DATE
       DATETIME
   - NEVER use:
       VARCHAR
       BOOLEAN
       SERIAL
       AUTO_INCREMENT
       FOREIGN KEY inside CREATE TABLE
       REFERENCES inside CREATE TABLE

8. FOREIGN KEY RULE:
   AFTER all tables are created, apply relationships separately using:
   ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...

9. SAMPLE DATA RULES:
   - Insert EXACTLY 5 rows per table
   - Use realistic data matching the scenario
   - If scenario is Pakistani, use Pakistani names/context
   - Use individual INSERT statements or parameterized inserts
   - NEVER use bulk insert syntax

10. ERROR PREVENTION RULES:
   - Wrap EVERYTHING in:
       try:
       except Exception as e:
       finally:
   - ALWAYS close cursor and connection safely
   - Print detailed error messages
   - Print success message after:
       - database creation
       - each table creation
       - foreign key creation
       - sample data insertion

11. IMPORTANT ACCESS COMPATIBILITY RULES:
   - DO NOT use SQL features unsupported by MS Access
   - DO NOT use CASCADE
   - DO NOT use CHECK constraints
   - DO NOT use ENGINE syntax
   - DO NOT use MySQL/PostgreSQL syntax
   - Avoid reserved keywords as column names
   - Use simple table/column names without spaces

12. OUTPUT STRUCTURE:
   The code structure should closely follow this order:

   - imports
   - DB path
   - create_blank_accdb()
   - connection setup
   - DDL list
   - create tables loop
   - FK list
   - apply FK loop
   - sample data inserts
   - success messages
   - cleanup in finally block

13. DATABASE FILE NAME:
   Name the .accdb file according to the scenario domain.
   Examples:
   - HospitalManagementSystem.accdb
   - LibraryManagementSystem.accdb
   - InventoryManagementSystem.accdb

14. OUTPUT FORMAT:
   Output ONLY raw Python code.
   DO NOT include:
   - markdown
   - backticks
   - explanations
   - comments outside the code

REFERENCE STYLE REQUIREMENT:
The generated script must closely resemble a production-ready version of the reference implementation provided by the user, including:
- stable connection handling
- ADOX database creation
- separated FK creation
- autocommit=True
- structured DDL arrays
- parameterized inserts
- proper cleanup
- clear print messages

The final script must run successfully on Windows with:
- Python
- pyodbc
- pywin32
- Microsoft Access Database Engine installed.

CRITICAL ALIGNMENT INSTRUCTION:
You MUST ensure the tables, columns, primary keys, and foreign keys in your Python script EXACTLY MATCH the following Mermaid ERD design generated in previous steps:

\`\`\`mermaid
${cachedMermaid}
\`\`\`
`;
  const raw = await generateText(userId, prompt);

  // Strip any markdown code fences the model might add despite instructions
  const clean = raw
    .replace(/^```python\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  saveFile(userId, job.id, 'create_database.py', clean);
  job.addStep('✅ Python database creation script generated and saved.');
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6: Run Python (Windows only) or save README
// ─────────────────────────────────────────────────────────────────────────────
export async function runPythonScript(job) {
  job.addStep('⚙️ Note: .accdb generation requires Windows with MS Access installed.');
  job.addStep('📦 Python script saved and ready to run on your Windows machine.');

  const jobDir = getJobDir(job.payload.userId, job.id);
  const pyPath = path.join(jobDir, 'create_database.py');

  if (process.platform !== 'win32') {
    job.addStep('ℹ️ Running on Linux server — Python script saved for Windows execution.');
    const readme = `# Database Creation Instructions

## Prerequisites (Windows only)
- Windows OS with Microsoft Access or ACE OLEDB 12.0 Provider installed
- Python 3.8+

## Steps
1. Copy \`create_database.py\` to your Windows machine
2. Install dependencies:
   \`\`\`
   pip install pyodbc
   \`\`\`
3. Run the script:
   \`\`\`
   python create_database.py
   \`\`\`
4. The \`.accdb\` file will be created in the same folder

## Troubleshooting
- If you get "Data source name not found", install the [Microsoft Access Database Engine](https://www.microsoft.com/en-us/download/details.aspx?id=54920)
- Use the 64-bit engine if running 64-bit Python
`;
    saveFile(job.payload.userId, job.id, 'README.md', readme);
    return { note: 'Script saved. Run on Windows to generate .accdb file.' };
  }

  try {
    const { stdout } = await execAsync(`py "${pyPath}"`, { timeout: 60000, cwd: jobDir });
    job.addStep(`✅ Python script executed successfully:\n${stdout}`);
    return { stdout, accdbPath: path.join(jobDir, 'StudentAttendanceSystem.accdb') };
  } catch (err) {
    throw new Error(`Python execution failed: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP UTILITY
// ─────────────────────────────────────────────────────────────────────────────
export function cleanupJobCache(userId) {
  if (userMermaidCache[userId]) {
    delete userMermaidCache[userId];
  }
}