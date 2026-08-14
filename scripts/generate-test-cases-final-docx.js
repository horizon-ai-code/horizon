const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak,
} = require("docx");

const A4_W = 11906;
const A4_H = 16838;
const MARGIN = 1440;
const CONTENT_W = A4_W - MARGIN * 2;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function parseInline(text) {
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push({ text: boldMatch[1], bold: true });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      parts.push({ text: codeMatch[1], mono: true });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    const nextBold = remaining.indexOf("**");
    const nextCode = remaining.indexOf("`");
    let endIdx = remaining.length;
    if (nextBold !== -1 && nextBold < endIdx) endIdx = nextBold;
    if (nextCode !== -1 && nextCode < endIdx) endIdx = nextCode;
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
    size: p.mono ? 16 : 20,
  }));
}

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

function parseMarkdown(filePath) {
  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  const blocks = [];
  let i = 0;
  let skipTOC = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") { i++; continue; }

    if (/^# /.test(trimmed) || /^\[!\[/.test(trimmed) || /^_All 268 /.test(trimmed)) {
      i++;
      continue;
    }

    if (/^##\s+Table of Contents/.test(trimmed)) {
      skipTOC = true;
      i++;
      continue;
    }
    if (skipTOC && /^##\s+1\.\s/.test(trimmed)) {
      skipTOC = false;
    }
    if (skipTOC) { i++; continue; }

    if (/^---+\s*$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (/^##\s/.test(trimmed)) {
      blocks.push({ type: "h1", text: trimmed.replace(/^##\s+/, "") });
      i++;
      continue;
    }

    if (/^###\s/.test(trimmed)) {
      blocks.push({ type: "h2", text: trimmed.replace(/^###\s+/, "") });
      i++;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i].trim();
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

    if (trimmed.startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      if (codeLines.length > 0) {
        blocks.push({ type: "code", lines: codeLines });
      }
      continue;
    }

    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (l === "" || /^##/.test(l) || /^###/.test(l) || l.startsWith("```") ||
          l.startsWith("---") || l.startsWith("|")) {
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

function columnWidthsFor(numCols, firstCell) {
  // Complex tables (5 cols): wide last column for "Complexity Reason"
  if (numCols === 5) return [900, 1200, 800, 2300, 3826];
  // Summary table (6 cols)
  if (numCols === 6) return [1300, 1500, 1500, 1500, 1500, 1726];
  // Standard test tables (4 cols)
  if (numCols === 4) return [900, 1400, 800, 3926];
  // Other: equal split
  const each = Math.floor(CONTENT_W / numCols);
  return Array(numCols).fill(each);
}

function buildDocument(blocks) {
  const children = [];

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "Horizon AI — Test Cases (Grouped by Complexity)", font: "Arial", size: 36, bold: true })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: "268 tests grouped: Simple, Edge, Complex. Backend / Frontend.", font: "Arial", size: 22, italics: true, color: "666666" })],
  }));

  const tocEntries = [];
  for (const block of blocks) {
    if (block.type === "h1") tocEntries.push({ level: 1, text: block.text });
    else if (block.type === "h2") tocEntries.push({ level: 2, text: block.text });
  }

  children.push(new Paragraph({
    spacing: { before: 400 },
    children: [new TextRun({ text: "Table of Contents", font: "Arial", size: 24, bold: true })],
  }));
  let tocSectionNum = 0;
  for (const entry of tocEntries) {
    if (entry.level === 1) {
      tocSectionNum++;
      children.push(new Paragraph({
        spacing: { before: 80, after: 40, line: 260 },
        children: [new TextRun({ text: `${tocSectionNum}.  ${entry.text}`, font: "Arial", size: 20, bold: true })],
      }));
      let subNum = 0;
      for (const sub of tocEntries) {
        if (sub.level === 2) {
          const match = sub.text.match(/(\d+\.\d+)/);
          const parentSection = match ? parseInt(match[1].split(".")[0]) : 0;
          if (parentSection === tocSectionNum) {
            subNum++;
            children.push(new Paragraph({
              spacing: { before: 20, after: 20, line: 240 },
              indent: { left: 360 },
              children: [new TextRun({ text: `${tocSectionNum}.${subNum}  ${sub.text}`, font: "Arial", size: 18 })],
            }));
          }
        }
      }
    }
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  for (const block of blocks) {
    switch (block.type) {
      case "h1": {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 200 },
          pageBreakBefore: true,
          children: [new TextRun({ text: block.text, font: "Arial", size: 28, bold: true })],
        }));
        break;
      }
      case "h2": {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 140 },
          children: [new TextRun({ text: block.text, font: "Arial", size: 24, bold: true })],
        }));
        break;
      }
      case "para": {
        const text = block.lines.join(" ");
        if (!text) break;
        const parsed = parseInline(text);
        children.push(new Paragraph({
          spacing: { before: 40, after: 40, line: 260 },
          children: inlineToTextRuns(parsed),
        }));
        break;
      }
      case "table": {
        const rows = block.rows;
        const numCols = rows[0].length;
        const widths = columnWidthsFor(numCols, rows[0][0]);

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
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      }
      case "code": {
        for (const line of block.lines) {
          children.push(new Paragraph({
            spacing: { before: 0, after: 0, line: 220 },
            shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
            indent: { left: 360 },
            children: [new TextRun({ text: line, font: "Consolas", size: 16 })],
          }));
        }
        children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        break;
      }
      case "hr": {
        children.push(new Paragraph({
          spacing: { before: 100, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 1 } },
          children: [],
        }));
        break;
      }
    }
  }

  return children;
}

function main() {
  const mdPath = process.argv[2] || "docs/test-cases-final.md";
  const outPath = process.argv[3] || "docs/test-cases-final.docx";

  const blocks = parseMarkdown(mdPath);
  const contentChildren = buildDocument(blocks);

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: "1F3864" },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: "2B579A" },
          paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: A4_W, height: A4_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Horizon AI — Test Cases by Complexity", font: "Arial", size: 16, color: "999999", italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", font: "Arial", size: 18, color: "666666" }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "666666" }),
              new TextRun({ text: " of ", font: "Arial", size: 18, color: "666666" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 18, color: "666666" }),
            ],
          })],
        }),
      },
      children: contentChildren,
    }],
  });

  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(outPath, buffer);
    console.log(`Written: ${outPath} (${buffer.length} bytes)`);
  });
}

main();
