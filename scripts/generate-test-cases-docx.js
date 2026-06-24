// generate-test-cases-docx.js — Converts docs/test-cases.md to a formatted .docx
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak,
} = require("docx");

// ─── Helpers ────────────────────────────────────────────────────────────────

const US_LETTER_W = 12240;
const US_LETTER_H = 15840;
const MARGIN = 1440;
const CONTENT_W = US_LETTER_W - MARGIN * 2; // 9360

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

// Table column width presets keyed by number of columns + identifier
const tableWidths = {
  "5":  [1080, 900, 2600, 2900, 1880], // ID, Type, Scenario, Input, Expected
  "4":  [1080, 900, 4500, 2880],        // ID, Type, Scenario, Expected
  "2":  [2000, 7360],                    // Legend
  "mat": [2200, 2400, 1000, 900, 2860], // Execution matrix (5 cols, different)
};

// ─── Inline text parser ─────────────────────────────────────────────────────

function parseInline(text) {
  // Returns array of { text, bold?, mono? }
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push({ text: boldMatch[1], bold: true });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    // Inline code: `text`
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      parts.push({ text: codeMatch[1], mono: true });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    // Arrow → render as text
    const arrowMatch = remaining.match(/^(→)/);
    if (arrowMatch) {
      parts.push({ text: arrowMatch[1] });
      remaining = remaining.slice(1);
      continue;
    }
      // Plain text: consume everything up to next ** or ` or end
      const nextBold = remaining.indexOf("**");
      const nextCode = remaining.indexOf("`");
      let endIdx = remaining.length;
      if (nextBold !== -1 && nextBold < endIdx) endIdx = nextBold;
      if (nextCode !== -1 && nextCode < endIdx) endIdx = nextCode;
      // Safety: if marker at position 0 with no close, consume 1 char to avoid loop
      if (endIdx === 0) endIdx = 1;
      parts.push({ text: remaining.slice(0, endIdx) });
      remaining = remaining.slice(endIdx);
  }
  return parts;
}

function inlineToTextRuns(parsed) {
  return parsed.map(p => new TextRun({
    text: p.text,
    bold: p.bold || false,
    font: p.mono ? "Consolas" : "Arial",
    size: p.mono ? 16 : 20, // 8pt monospace, 10pt body
  }));
}

// ─── Table cell builder ─────────────────────────────────────────────────────

function buildCell(content, width, isHeader) {
  const runs = [];
  if (typeof content === "string") {
    const parsed = parseInline(content);
    runs.push(...inlineToTextRuns(parsed));
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item === "string") {
        runs.push(...inlineToTextRuns(parseInline(item)));
      }
    }
  }
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: isHeader
      ? { fill: "2B579A", type: ShadingType.CLEAR }
      : undefined,
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 0, line: 240 },
      children: isHeader
        ? [new TextRun({ text: content, bold: true, font: "Arial", size: 18, color: "FFFFFF" })]
        : runs,
    })],
  });
}

// ─── Code block → monospace paragraph ───────────────────────────────────────

function makeCodeBlock(lines) {
  const children = lines.map(line =>
    new Paragraph({
      spacing: { before: 0, after: 0, line: 220 },
      shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
      indent: { left: 360 },
      children: [new TextRun({ text: line, font: "Consolas", size: 16 })],
    })
  );
  return children;
}

// ─── Horizontal rule ────────────────────────────────────────────────────────

function makeHR() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 },
    },
    children: [],
  });
}

// ─── Bullet list item ───────────────────────────────────────────────────────

function makeBullet(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 260 },
    indent: { left: 720, hanging: 360 },
    children: [new TextRun({ text, font: "Arial", size: 20 })],
  });
}

// ─── Markdown parser ────────────────────────────────────────────────────────

function parseMarkdown(filePath) {
  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  const blocks = [];
  let i = 0;
  let skipTOC = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines between blocks (but keep empties inside code blocks)
    if (trimmed === "") { i++; continue; }

    // Skip level-1 title, badge lines, and italic description (handled separately in buildDocument)
    if (/^# /.test(trimmed) || /^\[!\[/.test(trimmed) || /^_Comprehensive /.test(trimmed)) { i++; continue; }

    // Detect TOC section boundary: skip from "## Table of Contents" to next "## Section"
    if (/^##\s+Table of Contents/.test(trimmed)) {
      skipTOC = true;
      i++;
      continue;
    }
    if (skipTOC && /^##\s+Section\b/.test(trimmed)) {
      skipTOC = false;
      // Fall through to process this heading
    }
    if (skipTOC) { i++; continue; }

    // Separator
    if (/^---+\s*$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Level 1 heading (## Title)
    if (/^##\s/.test(trimmed)) {
      blocks.push({ type: "h1", text: trimmed.replace(/^##\s+/, "") });
      i++;
      continue;
    }

    // Level 2 heading (### Title)
    if (/^###\s/.test(trimmed)) {
      blocks.push({ type: "h2", text: trimmed.replace(/^###\s+/, "") });
      i++;
      continue;
    }

    // Table: starts with |
    if (trimmed.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i].trim();
        // Skip separator row (|---|---|): only dashes, colons, spaces allowed
        if (/^[\|:\- ]+$/.test(row) && row.includes("---")) {
          i++;
          continue;
        }
        const cells = row
          .split("|")
          .slice(1, -1)
          .map(c => c.trim());
        rows.push(cells);
        i++;
      }
      if (rows.length > 0) {
        blocks.push({ type: "table", rows });
      }
      continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      const codeLines = [];
      const fence = trimmed;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: "code", lines: codeLines });
      continue;
    }

    // Bullet list
    if (trimmed.startsWith("- ") || trimmed.startsWith("-**")) {
      const items = [];
      while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("-**"))) {
        items.push(lines[i].trim().replace(/^- /, "").replace(/^-/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Regular paragraph
    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (l === "" || /^##/.test(l) || /^###/.test(l) || l.startsWith("```") ||
          l.startsWith("---") || l.startsWith("|") || l.startsWith("- ")) {
        break;
      }
      paraLines.push(l);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "para", lines: paraLines });
    }
  }

  return blocks;
}

// ─── Build document ─────────────────────────────────────────────────────────

function buildDocument(blocks) {
  const children = [];

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "Test Cases Document — Horizon AI", font: "Arial", size: 44, bold: true })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "Comprehensive test specification for unit and integration testing", font: "Arial", size: 24, italics: true })],
  }));

  // Collect heading entries for rendered TOC
  const tocEntries = [];
  for (const block of blocks) {
    if (block.type === "h1") tocEntries.push({ level: 1, text: block.text });
    else if (block.type === "h2") tocEntries.push({ level: 2, text: block.text });
  }

  // Rendered TOC (not field code — works on first open without update)
  children.push(new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "Table of Contents", font: "Arial", size: 28, bold: true })] }));
  let tocSectionNum = 0;
  for (const entry of tocEntries) {
    if (entry.level === 1) {
      tocSectionNum++;
      children.push(new Paragraph({
        spacing: { before: 80, after: 40, line: 260 },
        indent: { left: 0 },
        children: [new TextRun({ text: `${tocSectionNum}.  ${entry.text}`, font: "Arial", size: 20, bold: true })],
      }));
      let subNum = 0;
      for (const sub of tocEntries) {
        if (sub.level === 2) {
          const match = sub.text.match(/^(\d+)\.(\d+)/);
          const parentSection = match ? parseInt(match[1]) : 0;
          if (parentSection === tocSectionNum) {
            subNum++;
            children.push(new Paragraph({
              spacing: { before: 20, after: 20, line: 240 },
              indent: { left: 360 },
              children: [new TextRun({ text: `${tocSectionNum}.${subNum}  ${sub.text.replace(/^\d+\.\d+\s+/, "")}`, font: "Arial", size: 18 })],
            }));
          }
        }
      }
    }
  }

  // Page break after TOC
  children.push(new Paragraph({ children: [new PageBreak()] }));

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];

    switch (block.type) {
      case "h1": {
        const text = block.text;
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 200 },
          pageBreakBefore: true,
          children: [new TextRun({ text, font: "Arial", size: 32, bold: true })],
        }));
        break;
      }
      case "h2": {
        const text = block.text;
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text, font: "Arial", size: 26, bold: true })],
        }));
        break;
      }
      case "para": {
        const text = block.lines.join(" ");
        if (!text) break;
        // Check if it's a module path or mock strategy line
        if (text.startsWith("**Module:**") || text.startsWith("**Purpose:**") || text.startsWith("**Mock strategy:**") || text.startsWith("**Approach:**")) {
          const parsed = parseInline(text);
          children.push(new Paragraph({
            spacing: { before: 40, after: 40, line: 260 },
            indent: { left: 0 },
            children: inlineToTextRuns(parsed),
          }));
        } else {
          const parsed = parseInline(text);
          children.push(new Paragraph({
            spacing: { before: 80, after: 80, line: 280 },
            children: inlineToTextRuns(parsed),
          }));
        }
        break;
      }
      case "table": {
        const rows = block.rows;
        const numCols = rows[0].length;
        const firstCell = rows[0][0];

        // Detect metadata table (2 cols, first cell empty)
        const isMeta = numCols === 2 && firstCell === "" && rows.length > 2;

        if (isMeta) {
          // Metadata table: special compact rendering
          for (let ri = 1; ri < rows.length; ri++) {
            const row = rows[ri];
            if (row.length >= 2) {
              const keyParsed = parseInline(row[0]);
              const valParsed = parseInline(row[1]);
              children.push(new Paragraph({
                spacing: { before: 30, after: 30, line: 260 },
                children: [
                  ...inlineToTextRuns(keyParsed),
                  new TextRun({ text: "  ", font: "Arial", size: 20 }),
                  ...inlineToTextRuns(valParsed),
                ],
              }));
            }
          }
          break;
        }

        // Detect column widths
        let widths;
        if (numCols === 5) {
          // Check if it's the execution matrix (first cell contains "Module")
          if (firstCell === "Module") {
            widths = tableWidths["mat"];
          } else {
            widths = tableWidths["5"];
          }
        } else if (numCols === 4) {
          widths = tableWidths["4"];
        } else if (numCols === 2) {
          widths = tableWidths["2"];
        } else {
          // Equal fallback
          const each = Math.floor(CONTENT_W / numCols);
          widths = Array(numCols).fill(each);
        }

        const tableRows = rows.map((row, ri) => {
          const isHeader = ri === 0;
          const cells = row.map((cell, ci) => {
            const w = widths[ci] || Math.floor(CONTENT_W / numCols);
            return buildCell(cell, w, isHeader);
          });
          return new TableRow({ children: cells });
        });

        children.push(new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: widths,
          rows: tableRows,
        }));

        // Add spacing after table
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      }
      case "code": {
        children.push(...makeCodeBlock(block.lines));
        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        break;
      }
      case "list": {
        for (const item of block.items) {
          const parsed = parseInline(item);
          children.push(new Paragraph({
            spacing: { before: 30, after: 30, line: 260 },
            indent: { left: 720, hanging: 360 },
            children: [
              new TextRun({ text: "\u2022  ", font: "Arial", size: 20 }),
              ...inlineToTextRuns(parsed),
            ],
          }));
        }
        break;
      }
      case "hr": {
        children.push(makeHR());
        break;
      }
    }
  }

  return children;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const mdPath = process.argv[2] || "docs/test-cases.md";
  const outPath = process.argv[3] || "docs/Test-Cases.docx";

  const blocks = parseMarkdown(mdPath);
  const contentChildren = buildDocument(blocks);

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20 } },
      },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", color: "1F3864" },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: "2B579A" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 22, bold: true, font: "Arial", color: "3B6EBF" },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: US_LETTER_W, height: US_LETTER_H },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: "Horizon AI — Test Cases", font: "Arial", size: 16, color: "999999", italics: true })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", font: "Arial", size: 18, color: "666666" }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "666666" }),
                  new TextRun({ text: " of ", font: "Arial", size: 18, color: "666666" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 18, color: "666666" }),
                ],
              }),
            ],
          }),
        },
        children: contentChildren,
      },
    ],
  });

  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(outPath, buffer);
    console.log(`Written: ${outPath} (${buffer.length} bytes)`);
  });
}

main();
