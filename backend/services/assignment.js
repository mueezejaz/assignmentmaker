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
// STEP 1: Generate Mermaid ERD
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMermaidERD(job) {
  const { scenario, userId } = job.payload;
  job.addStep('🤖 Asking Gemini to design the ERD in Mermaid notation...');

  const prompt = `You are a senior database architect and ERD specialist.

Given this university system scenario:
"${scenario}"

Generate a PROFESSIONAL and SYNTACTICALLY CORRECT Mermaid ER diagram for a University Management System.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL MERMAID SYNTAX RULES — FOLLOW EXACTLY OR THE DIAGRAM WILL FAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — First line MUST be exactly:
erDiagram

RULE 2 — Use ONLY these seven entity names (no others):
  Department
  Teacher
  Student
  Course
  Section
  Enrollment
  Attendance

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
  - NO spaces inside attribute names (e.g. use DeptID not Dept ID)

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
  - Use short, clear verbs: "employs", "has", "offers", "teaches", "enrolls", "records", "attends"
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
REQUIRED ENTITY ATTRIBUTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Department  → DeptID PK, DeptName, Location, EstablishedYear
Teacher     → TeacherID PK, FullName, Email, Phone, DeptID FK
Student     → StudentID PK, FullName, RollNo, Email, DeptID FK
Course      → CourseID PK, CourseName, CourseCode, CreditHours, DeptID FK
Section     → SectionID PK, SectionName, Semester, AcademicYear, CourseID FK, TeacherID FK
Enrollment  → EnrollmentID PK, StudentID FK, SectionID FK, EnrollDate, Grade
Attendance  → AttendanceID PK, EnrollmentID FK, AttendanceDate, Status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED RELATIONSHIPS (include ALL of these)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Department ||--|{ Teacher : "employs"
Department ||--|{ Student : "has"
Department ||--|{ Course : "offers"
Course ||--|{ Section : "has"
Teacher ||--|{ Section : "teaches"
Student ||--|{ Enrollment : "enrolls"
Section ||--|{ Enrollment : "contains"
Enrollment ||--|{ Attendance : "records"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXACT EXAMPLE OF CORRECT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

erDiagram
    Department {
        int DeptID PK
        string DeptName
        string Location
        int EstablishedYear
    }

    Teacher {
        int TeacherID PK
        string FullName
        string Email
        string Phone
        int DeptID FK
    }

    Department ||--|{ Teacher : "employs"

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
  const relPattern = /^(\w+)\s+(\|\|--\|\||[|{][\|o]-[-|o][|{]\||\|\|--o{|}o--\|\||\|\|-\-\|{|}[\|]-\-[|{]|\|\|--\|{|}[|o]--\|\||\|\|--\|\{|}o--\|[|]|\|\|--\|[{]|}[|]--\|[{]|[|][|]--[|][{]|}[|]--|[{]|\|\|--\|{|}\|--\|\||[|][|]-\-[|][|]|\S+)\s+(\w+)\s*:\s*"?([^"]+)"?$/;

  for (const line of lines) {
    // Match any relationship line: EntityA <connector> EntityB : "label"
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

  // Position entities in a grid
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

  // ── Draw relationship lines ─────────────────────────────────────────────────
  const linesSVG = relationships.map(rel => {
    const a = positions[rel.from];
    const b = positions[rel.to];
    if (!a || !b) return '';

    // Connect center-right of A to center-left of B (or adjust for layout)
    const ax = a.x + a.w;
    const ay = a.y + a.h / 2;
    const bx = b.x;
    const by = b.y + b.h / 2;

    // Simple curved path
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

  // ── Draw entity boxes ───────────────────────────────────────────────────────
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
    <!-- Entity: ${e.name} -->
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

  <!-- White background -->
  <rect width="100%" height="100%" fill="#ffffff"/>

  <!-- Title -->
  <text x="${svgW / 2}" y="32" text-anchor="middle"
        font-family="Arial" font-size="18" font-weight="bold"
        fill="#000000">Entity Relationship Diagram</text>

  <!-- Relationship lines (drawn behind boxes) -->
  ${linesSVG}

  <!-- Entity boxes -->
  ${boxesSVG}

</svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Generate structured report content (JSON → clean DOCX)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateLatexDoc(job) {
  const { scenario, userId } = job.payload;
  job.addStep('📄 Generating structured report content with Gemini...');

  const prompt = `You are an academic technical writer for a university database course.
Given this scenario: "${scenario}"

Write a comprehensive design report for a University Management System database with these 7 tables:
Department, Teacher, Student, Course, Section, Enrollment, Attendance.

Return ONLY a valid JSON object with this exact structure (no markdown fences, no extra text):
{
  "title": "University Management System – Database Design Report",
  "subtitle": "A Comprehensive Database Design Document",
  "businessScenario": {
    "overview": "2-3 sentence overview of the university system",
    "goals": ["goal 1", "goal 2", "goal 3", "goal 4"],
    "businessRules": ["rule 1", "rule 2", "rule 3", "rule 4", "rule 5"]
  },
  "entities": [
    { "name": "Department", "primaryKey": "DeptID", "description": "Stores academic department info", "keyAttributes": ["DeptID", "DeptName", "Location", "HOD"] },
    { "name": "Teacher", "primaryKey": "TeacherID", "description": "Faculty member records", "keyAttributes": ["TeacherID", "FullName", "Email", "DeptID"] },
    { "name": "Student", "primaryKey": "StudentID", "description": "Registered student data", "keyAttributes": ["StudentID", "FullName", "RollNo", "DeptID"] },
    { "name": "Course", "primaryKey": "CourseID", "description": "Academic course definitions", "keyAttributes": ["CourseID", "CourseName", "CreditHours", "DeptID"] },
    { "name": "Section", "primaryKey": "SectionID", "description": "Course section instances per semester", "keyAttributes": ["SectionID", "SectionName", "Semester", "CourseID", "TeacherID"] },
    { "name": "Enrollment", "primaryKey": "EnrollmentID", "description": "Student-section registrations", "keyAttributes": ["EnrollmentID", "StudentID", "SectionID", "EnrollDate"] },
    { "name": "Attendance", "primaryKey": "AttendanceID", "description": "Per-class attendance records", "keyAttributes": ["AttendanceID", "EnrollmentID", "Date", "Status"] }
  ],
  "normalization": {
    "1NF": "Explanation of first normal form compliance",
    "2NF": "Explanation of second normal form compliance",
    "3NF": "Explanation of third normal form compliance"
  },
  "relationships": [
    { "from": "Department", "to": "Teacher", "type": "One-to-Many", "description": "A department employs many teachers" },
    { "from": "Department", "to": "Student", "type": "One-to-Many", "description": "A department has many students" },
    { "from": "Department", "to": "Course", "type": "One-to-Many", "description": "A department offers many courses" },
    { "from": "Course", "to": "Section", "type": "One-to-Many", "description": "A course has multiple sections per semester" },
    { "from": "Teacher", "to": "Section", "type": "One-to-Many", "description": "A teacher instructs multiple sections" },
    { "from": "Student", "to": "Enrollment", "type": "One-to-Many", "description": "A student has many enrollment records" },
    { "from": "Section", "to": "Enrollment", "type": "One-to-Many", "description": "A section contains many enrolled students" },
    { "from": "Enrollment", "to": "Attendance", "type": "One-to-Many", "description": "Each enrollment tracks many attendance entries" }
  ]
}

Fill in proper, detailed content for each field based on the scenario. Keep descriptions professional and academic. Return ONLY the JSON.`;

  const raw = await generateText(userId, prompt);

  let jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1);

  let reportData;
  try {
    reportData = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse Gemini report JSON: ${e.message}`);
  }

  saveFile(userId, job.id, 'report.json', JSON.stringify(reportData, null, 2));
  job.addStep('✅ Report content generated and saved.');
  return reportData;
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
            makeTableCell(attr.endsWith('ID') && attr !== e.primaryKey ? 'Foreign Key (FK)' : attr === e.primaryKey ? 'Primary Key (PK)' : 'Attribute', 4680, i % 2 !== 0),
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
        makePara('The system architecture revolves around seven core entities, each capturing an essential dimension of university operations:'),
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
        makePara('The following table summarises all relationships between entities in the University Management System:'),
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

  const prompt = `You are an expert Python developer. Write a complete, working Python script to create a Microsoft Access .accdb database for a University Management System.

STRICT REQUIREMENTS — the script must run without errors:
1. Import pyodbc and use the "Microsoft Access Driver (*.mdb, *.accdb)" connection string
2. Create the database file named "StudentAttendanceSystem.accdb" in the same folder as the script
3. Create these 7 tables in this ORDER (respect FK dependencies):
   - Department (DeptID AUTOINCREMENT PK, DeptName TEXT(100) NOT NULL, Location TEXT(100), EstablishedYear INTEGER)
   - Teacher (TeacherID AUTOINCREMENT PK, FullName TEXT(100) NOT NULL, Email TEXT(100), Phone TEXT(20), DeptID INTEGER NOT NULL)
   - Student (StudentID AUTOINCREMENT PK, FullName TEXT(100) NOT NULL, RollNo TEXT(20) UNIQUE, Email TEXT(100), DeptID INTEGER NOT NULL)
   - Course (CourseID AUTOINCREMENT PK, CourseName TEXT(100) NOT NULL, CourseCode TEXT(20), CreditHours INTEGER, DeptID INTEGER NOT NULL)
   - Section (SectionID AUTOINCREMENT PK, SectionName TEXT(10) NOT NULL, Semester TEXT(20), AcademicYear TEXT(10), CourseID INTEGER NOT NULL, TeacherID INTEGER NOT NULL)
   - Enrollment (EnrollmentID AUTOINCREMENT PK, StudentID INTEGER NOT NULL, SectionID INTEGER NOT NULL, EnrollDate DATETIME, Grade TEXT(5))
   - Attendance (AttendanceID AUTOINCREMENT PK, EnrollmentID INTEGER NOT NULL, AttendanceDate DATETIME NOT NULL, Status TEXT(10) NOT NULL)
4. Insert exactly 5 sample rows per table using realistic Pakistani university data (names, cities, etc.)
5. Use separate INSERT statements — no bulk insert
6. Print a success message after each table is created and populated
7. Wrap everything in try/except and close the connection in a finally block
8. Use os.path.dirname(os.path.abspath(__file__)) to get the script directory for the .accdb path
9. The connection string template: r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=<path>;"
10. MS Access does not support CREATE TABLE with FK REFERENCES syntax — do NOT add REFERENCES or FOREIGN KEY clauses to CREATE TABLE statements. FK relationships are implied by the column names only.
11. MS Access uses AUTOINCREMENT not AUTO_INCREMENT

Output ONLY the Python code — no markdown fences, no explanations, no comments outside the code.`;

  const code = await generateText(userId, prompt);
  const clean = code.replace(/```python\n?/g, '').replace(/```\n?/g, '').trim();
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
4. \`StudentAttendanceSystem.accdb\` will be created in the same folder

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