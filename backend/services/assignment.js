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
// GLOBAL CACHE: Store DOT code by userId
// ─────────────────────────────────────────────────────────────────────────────
export const userMermaidCache = {};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Generate Graphviz DOT ERD
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMermaidERD(job) {
  const { scenario, userId } = job.payload;
  console.log("this is scenario", scenario);
  job.addStep('Asking Gemini to design the ERD....');

  const prompt = `You are a senior database architect and ERD specialist.

The user has provided this specific scenario:
"${scenario}"

CRITICAL INSTRUCTION: You MUST base your entire ERD design on the scenario above. Identify the real-world domain (it may be a hospital, library, hotel, school, e-commerce system, etc.) and derive entity names, attributes, and relationships that make sense FOR THAT SPECIFIC SCENARIO. Do NOT default to a generic university system. Every entity name, attribute name, and relationship label must reflect the actual domain described in the scenario.

Analyze the scenario and identify:
1. The core entities that exist in this domain (e.g., if it's a hospital: Patient, Doctor, Ward, etc.)
2. The attributes each entity should have based on the scenario
3. The relationships between those entities

Then generate a PROFESSIONAL and SYNTACTICALLY CORRECT Graphviz DOT ER diagram for this system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL GRAPHVIZ DOT SYNTAX RULES — FOLLOW EXACTLY OR THE DIAGRAM WILL FAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — First line MUST be exactly:
digraph ERD {

RULE 2 — Global graph settings MUST come immediately after the opening brace:
    graph [rankdir=LR, fontname="Helvetica", fontsize=12, bgcolor="white", pad="0.5", nodesep=0.8, ranksep=1.2];
    node [shape=none, fontname="Helvetica", fontsize=11, margin=0];
    edge [fontname="Helvetica", fontsize=10, color="#333333", arrowsize=0.8];

RULE 3 — Derive 6–9 entity names from the scenario. Use PascalCase, no spaces.
  Examples for a hospital: Patient, Doctor, Ward, Appointment, Prescription, Department
  Examples for a library: Member, Book, Author, Loan, Category, Branch
  The entities MUST reflect the actual domain of the scenario provided.

RULE 4 — Each entity MUST be defined as an HTML-like label table node:
  EntityName [label=<
    <TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="#222222" ALIGN="CENTER"><FONT COLOR="white" POINT-SIZE="12"><B>EntityName</B></FONT></TD></TR>
      <TR><TD ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>int</I></FONT> <B>EntityID</B> <FONT COLOR="#888888" POINT-SIZE="9">«PK»</FONT></TD></TR>
      <TR><TD BGCOLOR="#F5F5F5" ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>string</I></FONT> AttributeName</TD></TR>
      <TR><TD ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>int</I></FONT> ForeignKeyID <FONT COLOR="#888888" POINT-SIZE="9">«FK»</FONT></TD></TR>
    </TABLE>
  >];

  RULES for entity tables:
  - Header row: dark background (#222222), white bold text, centered
  - PK row: white background, bold attribute name, «PK» tag in gray
  - Normal rows: alternate between white and #F5F5F5 backgrounds
  - FK rows: include «FK» tag in gray
  - Each attribute on its own TR/TD row
  - Allowed data types: int, string, date, boolean, float (shown in italic)
  - 3–6 meaningful attributes per entity plus the PK

RULE 5 — Relationship edges MUST use this exact format:
  EntityA -> EntityB [label="verb", arrowhead=crow, arrowtail=tee, dir=both];

  Allowed arrowhead/arrowtail values (ERD crow's foot notation):
  - One-to-Many:    arrowhead=crow, arrowtail=tee, dir=both
  - Many-to-One:    arrowhead=tee, arrowtail=crow, dir=both
  - One-to-One:     arrowhead=tee, arrowtail=tee, dir=both
  - Many-to-Many:   arrowhead=crow, arrowtail=crow, dir=both
  - Zero-or-Many:   arrowhead=crow, arrowtail=odot, dir=both

RULE 6 — Closing brace MUST be on its own line:
}

RULE 7 — STRICT PROHIBITIONS:
  - NO comments of any kind (// or /* */)
  - NO subgraph clusters unless grouping makes sense
  - NO special characters in node names (only alphanumeric, no spaces)
  - NO markdown text, explanations, or notes outside the code block
  - Node names used in edges MUST exactly match the names used in node definitions
  - NO mixing of HTML labels and plain string labels

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXACT FORMAT EXAMPLE (for a HOSPITAL scenario — adapt yours to YOUR scenario domain)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

digraph ERD {
    graph [rankdir=LR, fontname="Helvetica", fontsize=12, bgcolor="white", pad="0.5", nodesep=0.8, ranksep=1.2];
    node [shape=none, fontname="Helvetica", fontsize=11, margin=0];
    edge [fontname="Helvetica", fontsize=10, color="#333333", arrowsize=0.8];

    Department [label=<
        <TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
            <TR><TD BGCOLOR="#222222" ALIGN="CENTER"><FONT COLOR="white" POINT-SIZE="12"><B>Department</B></FONT></TD></TR>
            <TR><TD ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>int</I></FONT> <B>DeptID</B> <FONT COLOR="#888888" POINT-SIZE="9">«PK»</FONT></TD></TR>
            <TR><TD BGCOLOR="#F5F5F5" ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>string</I></FONT> DeptName</TD></TR>
            <TR><TD ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>string</I></FONT> Location</TD></TR>
        </TABLE>
    >];

    Doctor [label=<
        <TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
            <TR><TD BGCOLOR="#222222" ALIGN="CENTER"><FONT COLOR="white" POINT-SIZE="12"><B>Doctor</B></FONT></TD></TR>
            <TR><TD ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>int</I></FONT> <B>DoctorID</B> <FONT COLOR="#888888" POINT-SIZE="9">«PK»</FONT></TD></TR>
            <TR><TD BGCOLOR="#F5F5F5" ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>string</I></FONT> FullName</TD></TR>
            <TR><TD ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>string</I></FONT> Specialization</TD></TR>
            <TR><TD BGCOLOR="#F5F5F5" ALIGN="LEFT"><FONT COLOR="#444444" POINT-SIZE="10"><I>int</I></FONT> DeptID <FONT COLOR="#888888" POINT-SIZE="9">«FK»</FONT></TD></TR>
        </TABLE>
    >];

    Department -> Doctor [label="employs", arrowhead=crow, arrowtail=tee, dir=both];
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output ONLY the Graphviz DOT code block. Start with:
\`\`\`dot

End with:
\`\`\`
`;

  const raw = await generateText(userId, prompt);
  const dotMatch = raw.match(/```dot\n([\s\S]+?)```/);
  if (!dotMatch) throw new Error('Gemini did not return a valid DOT code block.');

  const dotCode = dotMatch[1].trim();

  // Store the DOT code in the global cache (key reused for compatibility)
  userMermaidCache[userId] = dotCode;

  saveFile(userId, job.id, 'erd.dot', dotCode);
  job.addStep('ERD Graphviz DOT code generated and saved.');
  return dotCode;
}
// ─────────────────────────────────────────────────────────────────────────────
// CHEN NOTATION GENERATOR
// Parses the crow's foot DOT code and regenerates a Chen-style ERD
// (rectangles = entities, ovals = attributes, diamonds = relationships)
// ─────────────────────────────────────────────────────────────────────────────
function generateChenNotationDOT(crowsfootDot) {
  // ── 1. Parse entity names & attributes from HTML label blocks ─────────────
  const entities = [];
  const nodeBlockRegex = /(\w+)\s*\[label=<([\s\S]*?)>\s*\]/g;
  let nb;
  while ((nb = nodeBlockRegex.exec(crowsfootDot)) !== null) {
    const entityName = nb[1];
    if (['graph', 'node', 'edge'].includes(entityName)) continue;

    const tableContent = nb[2];
    const attrs = [];
    let isPK = false;

    const trRegex = /<TR>([\s\S]*?)<\/TR>/gi;
    let tr;
    let rowIndex = 0;
    while ((tr = trRegex.exec(tableContent)) !== null) {
      if (rowIndex === 0) { rowIndex++; continue; } // skip header
      // Extract bold text (attribute name)
      const boldMatch = tr[1].match(/<B>([^<]+)<\/B>/);
      const isPKRow = tr[1].includes('«PK»');
      const isFKRow = tr[1].includes('«FK»');
      if (boldMatch) {
        attrs.push({
          name: boldMatch[1].trim(),
          isPK: isPKRow,
          isFK: isFKRow,
        });
      } else {
        // fallback: strip all tags
        const text = tr[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text) attrs.push({ name: text, isPK: isPKRow, isFK: isFKRow });
      }
      rowIndex++;
    }

    entities.push({ name: entityName, attrs });
  }

  // ── 2. Parse relationships ─────────────────────────────────────────────────
  const relationships = [];
  const edgeRegex = /(\w+)\s*->\s*(\w+)\s*\[label="([^"]+)"[^\]]*arrowhead=(\w+)[^\]]*arrowtail=(\w+)/g;
  let er;
  while ((er = edgeRegex.exec(crowsfootDot)) !== null) {
    relationships.push({
      from: er[1],
      to: er[2],
      label: er[3],
      arrowhead: er[4],
      arrowtail: er[5],
    });
  }

  // ── 3. Map arrowhead combos → cardinality labels ───────────────────────────
  function cardinalityLabel(arrowhead, arrowtail) {
    if (arrowhead === 'crow' && arrowtail === 'tee') return { from: '1', to: 'M' };
    if (arrowhead === 'tee' && arrowtail === 'crow') return { from: 'M', to: '1' };
    if (arrowhead === 'crow' && arrowtail === 'crow') return { from: 'M', to: 'M' };
    if (arrowhead === 'tee' && arrowtail === 'tee') return { from: '1', to: '1' };
    if (arrowhead === 'crow' && arrowtail === 'odot') return { from: '0', to: 'M' };
    return { from: '1', to: 'M' };
  }

  // ── 4. Color palette (matching Image 2 green theme) ───────────────────────
  const ENTITY_COLOR = '#a8d08d'; // green rectangle
  const ENTITY_BORDER = '#5a8a3c';
  const ATTR_COLOR = '#c6e0b4'; // light green oval
  const ATTR_BORDER = '#5a8a3c';
  const REL_COLOR = '#e2efda';  // diamond
  const REL_BORDER = '#5a8a3c';
  const PK_COLOR = '#ffd966'; // yellow oval for PK
  const PK_BORDER = '#b8860b';
  const FK_COLOR = '#f4b942'; // orange oval for FK
  const FK_BORDER = '#b8860b';

  // ── 5. Build DOT lines ─────────────────────────────────────────────────────
  const lines = [];
  lines.push('graph ChenERD {');
  lines.push('    graph [rankdir=LR, fontname="Helvetica", fontsize=11, bgcolor="white", pad="1.0", nodesep=1.2, ranksep=2.0, splines=true];');
  lines.push('    node [fontname="Helvetica", fontsize=10];');
  lines.push('    edge [fontname="Helvetica", fontsize=9, color="#555555"];');
  lines.push('');

  // Entity rectangles
  entities.forEach(e => {
    lines.push(`    ${e.name} [shape=rectangle, style="filled,bold", fillcolor="${ENTITY_COLOR}", color="${ENTITY_BORDER}", penwidth=2, label="${e.name}", fontsize=12, fontcolor="white", fontname="Helvetica-Bold", margin="0.2,0.1"];`);
  });
  lines.push('');

  // Attribute ovals
  entities.forEach(e => {
    e.attrs.forEach((attr, i) => {
      const safeId = `${e.name}_attr_${i}`;
      let fillColor = ATTR_COLOR;
      let borderColor = ATTR_BORDER;
      let fontStyle = 'Helvetica';
      let labelText = attr.name;

      if (attr.isPK) {
        fillColor = PK_COLOR;
        borderColor = PK_BORDER;
        fontStyle = 'Helvetica-Bold';
        // Underline PK using HTML label
        lines.push(`    ${safeId} [shape=ellipse, style="filled", fillcolor="${fillColor}", color="${borderColor}", penwidth=1.5, label=<\<U\>${labelText}\<\/U\>>, fontname="${fontStyle}"];`);
        lines.push(`    ${e.name} -- ${safeId};`);
        return;
      }
      if (attr.isFK) {
        fillColor = FK_COLOR;
        borderColor = FK_BORDER;
        fontStyle = 'Helvetica-Oblique';
      }
      lines.push(`    ${safeId} [shape=ellipse, style="filled", fillcolor="${fillColor}", color="${borderColor}", penwidth=1.5, label="${labelText}", fontname="${fontStyle}"];`);
      lines.push(`    ${e.name} -- ${safeId};`);
    });
    lines.push('');
  });

  // Relationship diamonds + edges
  relationships.forEach((rel, i) => {
    const diamondId = `rel_${i}_${rel.label.replace(/\s+/g, '_')}`;
    const card = cardinalityLabel(rel.arrowhead, rel.arrowtail);

    lines.push(`    ${diamondId} [shape=diamond, style="filled", fillcolor="${REL_COLOR}", color="${REL_BORDER}", penwidth=1.5, label="${rel.label}", fontname="Helvetica-Bold", fontsize=10, margin="0.1,0.05"];`);
    lines.push(`    ${rel.from} -- ${diamondId} [label="${card.from}", fontsize=10, fontcolor="#333333", fontname="Helvetica-Bold"];`);
    lines.push(`    ${diamondId} -- ${rel.to} [label="${card.to}", fontsize=10, fontcolor="#333333", fontname="Helvetica-Bold"];`);
    lines.push('');
  });

  lines.push('}');
  return lines.join('\n');
}
// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Convert Graphviz DOT → PNG using the dot CLI
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Convert Graphviz DOT → PNG using the dot CLI (HIGH RESOLUTION)
// ─────────────────────────────────────────────────────────────────────────────
export async function convertMermaidToPNG(job, dotCode) {
  job.addStep('Rendering Graphviz DOT ERD to PNG...');

  const jobDir = getJobDir(job.payload.userId, job.id);

  const dotPath = path.join(jobDir, 'erd.dot');
  const pngPath = path.join(jobDir, 'erd.png');
  const chenPngPath = path.join(jobDir, 'erd_chen.png');

  // Save DOT source
  fs.writeFileSync(dotPath, dotCode);

  // Generate Chen notation DOT
  const chenDotPath = path.join(jobDir, 'erd_chen.dot');
  const chenDotCode = generateChenNotationDOT(dotCode);
  fs.writeFileSync(chenDotPath, chenDotCode);

  try {
    // ── Render crow's foot ERD at high DPI ──────────────────────────────────
    await execAsync(
      `dot -Tpng -Gdpi=300 "${dotPath}" -o "${pngPath}"`,
      { cwd: jobDir, timeout: 60000 }
    );
    job.addStep('Crow\'s foot ERD rendered to PNG (300 DPI).');

    // ── Render Chen notation ERD at high DPI ────────────────────────────────
    await execAsync(
      `dot -Tpng -Gdpi=300 "${chenDotPath}" -o "${chenPngPath}"`,
      { cwd: jobDir, timeout: 60000 }
    );
    job.addStep('Chen notation ERD rendered to PNG (300 DPI).');

    return { crowsfoot: pngPath, chen: chenPngPath };
  } catch (err) {
    console.error(err);
    job.addStep('⚠️ Graphviz dot failed. Falling back to SVG renderer.');

    const svgPath = path.join(jobDir, 'erd.svg');
    const fallbackSVG = generateFallbackSVG(dotCode);
    fs.writeFileSync(svgPath, fallbackSVG);
    return { crowsfoot: svgPath, chen: svgPath };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK SVG: Parse the DOT code and render a basic ER diagram as SVG
// Used only when the dot CLI is unavailable
// ─────────────────────────────────────────────────────────────────────────────
function generateFallbackSVG(dotCode) {
  // ── Parse entity names from node definitions ──────────────────────────────
  const entities = [];
  const nodeRegex = /^\s*(\w+)\s*\[label=/gm;
  let nm;
  while ((nm = nodeRegex.exec(dotCode)) !== null) {
    if (nm[1] !== 'graph' && nm[1] !== 'node' && nm[1] !== 'edge') {
      entities.push({ name: nm[1], attrs: [] });
    }
  }

  // ── Parse attributes from HTML-label tables ───────────────────────────────
  // Match each node block and extract TR/TD content
  const nodeBlockRegex = /(\w+)\s*\[label=<([\s\S]*?)>\s*\]/g;
  let nb;
  while ((nb = nodeBlockRegex.exec(dotCode)) !== null) {
    const entityName = nb[1];
    if (entityName === 'graph' || entityName === 'node' || entityName === 'edge') continue;
    const entity = entities.find(e => e.name === entityName);
    if (!entity) continue;

    const tableContent = nb[2];
    // Extract each TR's TD text content (strip XML tags)
    const trRegex = /<TR>([\s\S]*?)<\/TR>/gi;
    let tr;
    let rowIndex = 0;
    while ((tr = trRegex.exec(tableContent)) !== null) {
      if (rowIndex === 0) { rowIndex++; continue; } // skip header row
      const tdText = tr[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (tdText) entity.attrs.push(tdText);
      rowIndex++;
    }
  }

  // ── Parse relationships from edge definitions ─────────────────────────────
  const relationships = [];
  const edgeRegex = /(\w+)\s*->\s*(\w+)\s*\[label="([^"]+)"/g;
  let er;
  while ((er = edgeRegex.exec(dotCode)) !== null) {
    relationships.push({ from: er[1], to: er[2], label: er[3] });
  }

  // ── Layout ────────────────────────────────────────────────────────────────
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
    return `
    <path d="M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}"
          fill="none" stroke="#000000" stroke-width="1.5" marker-end="url(#arrow)"/>
    <rect x="${mx - 28}" y="${(ay + by) / 2 - 18}" width="56" height="14"
          fill="#ffffff" stroke="none"/>
    <text x="${mx}" y="${(ay + by) / 2 - 8}" text-anchor="middle"
          font-family="Helvetica" font-size="10" fill="#333333">${rel.label}</text>`;
  }).join('');

  const boxesSVG = entities.map(e => {
    const { x, y, w, h } = positions[e.name];
    const attrRows = e.attrs.map((a, i) => {
      const rowY = y + HEADER_H + i * ROW_H;
      const bg = i % 2 === 0 ? '#ffffff' : '#f5f5f5';
      return `
      <rect x="${x}" y="${rowY}" width="${w}" height="${ROW_H}"
            fill="${bg}" stroke="#000000" stroke-width="0.5"/>
      <text x="${x + 10}" y="${rowY + ROW_H / 2 + 4}"
            font-family="Helvetica" font-size="11" fill="#000000">${a}</text>`;
    }).join('');

    return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}"
          fill="#ffffff" stroke="#000000" stroke-width="1.5" rx="2"/>
    <rect x="${x}" y="${y}" width="${w}" height="${HEADER_H}"
          fill="#222222" stroke="#222222" stroke-width="1.5" rx="2"/>
    <rect x="${x}" y="${y + HEADER_H - 2}" width="${w}" height="4"
          fill="#222222" stroke="none"/>
    <text x="${x + w / 2}" y="${y + HEADER_H / 2 + 5}"
          text-anchor="middle" font-family="Helvetica" font-size="13"
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
        font-family="Helvetica" font-size="18" font-weight="bold"
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
  job.addStep('Generating structured report content with Gemini...');

  const cachedDot = userMermaidCache[userId] || '';

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
You MUST ensure the entities, attributes, primary keys, and relationships in your JSON EXACTLY MATCH the following Graphviz DOT ERD design generated in the previous step:

\`\`\`dot
${cachedDot}
\`\`\`
`;

  const raw = await generateText(userId, prompt);

  let jsonStr = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Gemini response did not contain a JSON object.');
  }
  jsonStr = jsonStr.slice(start, end + 1);
  jsonStr = fixCommonJsonIssues(jsonStr);

  let reportData;
  try {
    reportData = JSON.parse(jsonStr);
  } catch (e) {
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
  job.addStep('Report content generated and saved.');
  return reportData;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON sanitizer
// ─────────────────────────────────────────────────────────────────────────────
function fixCommonJsonIssues(str) {
  str = str.replace(/,\s*([\}\]])/g, '$1');
  str = str.replace(/[\u2018\u2019]/g, "'");
  str = str.replace(/[\u201C\u201D]/g, '"');
  str = str.replace(/[\u2013\u2014]/g, '-');
  // eslint-disable-next-line no-control-regex
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return str;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Build clean DOCX from structured JSON using docx package
// ─────────────────────────────────────────────────────────────────────────────
export async function convertLatexToDocx(job, reportData) {
  job.addStep('Building professional Word document...');
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
  job.addStep('Word document built successfully.');
  return docxPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Generate Python DB creation script
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePythonCode(job) {
  const { scenario, userId } = job.payload;
  job.addStep('Generating script to create the MS Access database...');

  const cachedDot = userMermaidCache[userId] || '';

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

CRITICAL ALIGNMENT INSTRUCTION:
You MUST ensure the tables, columns, primary keys, and foreign keys in your Python script EXACTLY MATCH the following Graphviz DOT ERD design generated in previous steps:

\`\`\`dot
${cachedDot}
\`\`\`
`;

  const raw = await generateText(userId, prompt);

  const clean = raw
    .replace(/^```python\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  saveFile(userId, job.id, 'create_database.py', clean);
  job.addStep('database creation script generated and saved.');
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6: Run Python (Windows only) or save README
// ─────────────────────────────────────────────────────────────────────────────
export async function runPythonScript(job) {
  job.addStep('️ Note: .accdb generation requires Windows with MS Access installed.');
  job.addStep(' script saved and ready to run on your Windows machine.');

  const jobDir = getJobDir(job.payload.userId, job.id);
  const pyPath = path.join(jobDir, 'create_database.py');

  if (process.platform !== 'win32') {
    job.addStep('️ Running on Linux server — Python script saved for Windows execution.');
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
    job.addStep(`script executed successfully`);
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