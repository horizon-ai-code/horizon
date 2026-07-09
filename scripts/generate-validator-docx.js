const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak
} = require("docx");

// ── Helpers ──────────────────────────────────────────────────────────────

const FONT = "Arial";
const MONO = "Courier New";
const CONTENT_W = 9026;
const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const headerShading = { fill: "000000", type: ShadingType.CLEAR };
const altShading = { fill: "F2F2F2", type: ShadingType.CLEAR };

function p(text, opts = {}) {
  const runs = [];
  if (typeof text === "string") {
    runs.push(new TextRun({ text, font: FONT, size: opts.size || 22, bold: opts.bold, italics: opts.italics }));
  } else if (Array.isArray(text)) {
    runs.push(...text);
  }
  return new Paragraph({
    spacing: { after: opts.after !== undefined ? opts.after : 120, line: opts.line || 276 },
    ...(opts.alignment ? { alignment: opts.alignment } : {}),
    ...(opts.keepNext ? { keepNext: true } : {}),
    children: runs,
  });
}

function heading(text, level) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: level === 1 ? 360 : level === 2 ? 280 : 200, after: 120 },
    children: [new TextRun({ text, font: FONT })],
  });
}

function bold(t) { return new TextRun({ text: t, font: FONT, size: 22, bold: true }); }
function ital(t) { return new TextRun({ text: t, font: FONT, size: 22, italics: true }); }
function normal(t) { return new TextRun({ text: t, font: FONT, size: 22 }); }
function mono(t) { return new TextRun({ text: t, font: MONO, size: 20 }); }
function boldMono(t) { return new TextRun({ text: t, font: MONO, size: 20, bold: true }); }

function codeBlock(code) {
  return new Paragraph({
    spacing: { after: 40, line: 260 },
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    indent: { left: 240 },
    children: [new TextRun({ text: code, font: MONO, size: 20 })],
  });
}

function bulletP(textRuns) {
  const runs = typeof textRuns === "string"
    ? [normal(textRuns)]
    : textRuns;
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80, line: 276 },
    children: runs,
  });
}

function numberedP(textRuns, ref = "numbers") {
  const runs = typeof textRuns === "string"
    ? [normal(textRuns)]
    : textRuns;
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 276 },
    children: runs,
  });
}

function cell(textRuns, opts = {}) {
  const runs = typeof textRuns === "string"
    ? [new TextRun({ text: textRuns, font: FONT, size: opts.size || 20, bold: opts.bold, color: opts.color || "000000" })]
    : textRuns;
  return new TableCell({
    borders,
    width: { size: opts.width, type: WidthType.DXA },
    margins: cellMargins,
    shading: opts.shading || undefined,
    verticalAlign: "center",
    children: [new Paragraph({ spacing: { after: 40, line: 260 }, children: runs })],
  });
}

function headerCell(text, width) {
  return cell([new TextRun({ text, font: FONT, size: 20, bold: true, color: "FFFFFF" })], { width, shading: headerShading });
}

function table(columns, rows, opts = {}) {
  const totalW = columns.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: columns,
    rows: [
      opts.headerRow ? new TableRow({
        children: opts.headerRow.map((h, i) => headerCell(h, columns[i])),
        tableHeader: true,
      }) : null,
      ...rows.map((row, ri) => new TableRow({
        children: row.map((c, ci) => cell(c, {
          width: columns[ci],
          shading: ri % 2 === 1 && !opts.headerRow ? altShading : undefined,
        })),
      })),
    ].filter(Boolean),
  });
}

// ── Content ──────────────────────────────────────────────────────────────

const children = [];

// Title page
children.push(new Paragraph({ spacing: { before: 3000 } }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 200 },
  children: [new TextRun({ text: "Horizon Validator", font: FONT, size: 52, bold: true, color: "000000" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 120 },
  children: [new TextRun({ text: "How Validation Works in the AI Refactoring Pipeline", font: FONT, size: 28, color: "000000" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 40 },
  children: [new TextRun({ text: "Internal Documentation", font: FONT, size: 22, color: "000000" })],
}));
children.push(new Paragraph({ spacing: { before: 120 } }));

// ── Section: What does the validator do?
children.push(heading("What does the Validator do?", 1));
children.push(p("Whenever Horizon refactors your Java code, it does not just trust the AI got it right. The validator runs a series of checks to make sure the refactored code is correct, safe, and actually did what you asked. Think of it as a safety net that catches mistakes before they reach you."));

// ── Section: Four Security Gates
children.push(heading("The Big Picture: Four Security Gates", 1));
children.push(p("Every refactored piece of code must pass through four gates, in order:"));

children.push(heading("Gate 1 \u2014 \u201CDoes it even compile?\u201D", 2));
children.push(p("First, we check if the new code is valid Java. If it cannot be parsed, there is no point continuing. We try a few tricks (like wrapping bare statements in a class) because the AI sometimes outputs code fragments rather than full classes."));
children.push(p([bold("If it fails: "), normal("We send it back to the AI with the syntax error and ask it to try again. It gets three chances. After that, we tell the Planner to come up with a different strategy.")]));

children.push(heading("Gate 2 \u2014 \u201CDid complexity get worse?\u201D", 2));
children.push(p("Some refactorings should make code simpler. We use ", { after: 0 }));
children.push(p([bold("cyclomatic complexity"), normal(" (a standard metric that counts how many different paths through a piece of code there are \u2014 higher numbers mean harder-to-test code).")]));
children.push(p([bold("If it fails: "), normal("The system says \u201Cyour refactoring made the code harder to understand\u201D and asks the AI to try a different approach.")]));

children.push(heading("Gate 3 \u2014 \u201CDid you touch code you should not have?\u201D", 2));
children.push(p("When you ask Horizon to refactor a specific method, the AI should only change that method. Everything else should stay exactly as it was. The validator compares the structure of every non-target method between the original and refactored code."));
children.push(p("This gate applies the same way to every refactoring type. There are no per-refactoring rules \u2014 the check is universal. If a method outside the target scope changed structurally, that is a boundary violation. The system rejects the refactoring."));
children.push(p([bold("If it fails: "), normal("The AI is told exactly which method was accidentally modified and asked to preserve it.")]));

children.push(heading("Gate 4 \u2014 \u201CDid the refactoring actually happen?\u201D", 2));
children.push(p("This is the most specific check. For each type of refactoring, the validator checks that the expected structural change occurred. For example:"));
children.push(p([bold("If it fails: "), normal("The system tells the AI \u201Cyou said you extracted a method but the method count did not change\u201D and asks it to try again.")]));

// ── Section: The 12 Refactoring Types (TABLE 1)
children.push(heading("The 12 Refactoring Types and What They Mean", 1));

const t1Cols = [1800, 1400, 5826];
const t1Header = ["Refactoring", "Category", "What It Does"];
const t1Rows = [
  ["Flatten Conditional", "Control Flow", "Transforms deeply nested if-statements into a flat sequence of early returns or guard clauses. Turns \u201Carrow code\u201D into linear, top-to-bottom flow."],
  ["Decompose Conditional", "Control Flow", "Breaks a complicated boolean expression into separate named boolean variables. Each variable captures one business condition, making the logic self-documenting."],
  ["Consolidate Conditional", "Control Flow", "Merges multiple if-statements or switch cases that share identical behavior into a single condition or polymorphic dispatch."],
  ["Remove Control Flag", "Control Flow", "Eliminates the \u201Cboolean sentinel\u201D pattern \u2014 a flag variable used to control a loop \u2014 in favor of direct break or return statements."],
  ["Replace Loop with Pipeline", "Control Flow", "Converts an imperative for-loop into a declarative Java Stream pipeline using .stream(), .filter(), .map(), .collect()."],
  ["Split Loop", "Control Flow", "Takes one loop that performs two unrelated tasks and splits it into two separate, single-purpose loops."],
  ["Extract Method", "Method Movement", "Moves a block of code into a new, descriptively named helper method. The original location calls the new method instead."],
  ["Inline Method", "Method Movement", "The reverse of extraction \u2014 takes a method whose body is simple and self-explanatory, replaces every call site with the body directly, then removes the method."],
  ["Extract Variable", "State Management", "Replaces a repeated or complex expression with a named variable computed once. The variable name explains what the expression represents."],
  ["Inline Variable", "State Management", "Replaces a variable that just holds a simple expression result with the expression itself, when the variable name adds no clarity."],
  ["Extract Constant", "State Management", "Promotes a hardcoded magic number or literal string into a named static final field. Documents what the value means and centralizes it."],
  ["Rename Symbol", "State Management", "Changes the name of a variable, method, or field to be more descriptive \u2014 without altering any behavior. Pure renaming with zero logic change."],
];

children.push(table(t1Cols, t1Rows, { headerRow: t1Header }));
children.push(p(""));

// ── Section: CC Rules (TABLE 2)
children.push(heading("Cyclomatic Complexity Rules Per Refactoring Type", 1));
children.push(p("CC measures how many independent paths exist through code. Some refactorings naturally add or remove paths. The validator uses four different rules depending on the refactoring type:"));

const t2Cols = [1700, 1600, 5726];
const t2Header = ["Refactoring", "CC Rule", "What This Means"];
const t2Rows = [
  ["Flatten Conditional", "Loosened", "Complexity can increase by up to 1. Early returns add an extra exit path, so a small CC bump is expected and acceptable."],
  ["Decompose Conditional", "Extract Rule", "The target method\u2019s CC must not increase. Adding named variables should not change complexity, and the refactoring should not introduce new branches."],
  ["Consolidate Conditional", "Strict", "Overall CC must not increase. Merging branches should reduce or maintain complexity \u2014 never add more paths."],
  ["Remove Control Flag", "Strict", "Overall CC must not increase. Removing a flag should eliminate the branching around it, not add new ones."],
  ["Replace Loop w/ Pipeline", "Strict", "Overall CC must not increase. Streams inherently flatten control flow, so CC should go down or stay flat."],
  ["Split Loop", "Loosened", "Complexity can increase by up to 1. Having two loops instead of one adds a new path, a reasonable tradeoff for clarity."],
  ["Extract Method", "Extract Rule", "The source method\u2019s CC must not increase. Extracting code should simplify the caller. The new helper method\u2019s CC is not restricted."],
  ["Inline Method", "Skip", "No complexity check. Inlining naturally makes the caller more complex as it absorbs the inlined logic, so CC increase is expected."],
  ["Extract Variable", "Strict", "Overall CC must not increase. Adding a variable declaration does not change the number of execution paths."],
  ["Inline Variable", "Strict", "Overall CC must not increase. Removing a variable does not add or remove execution paths."],
  ["Extract Constant", "Strict", "Overall CC must not increase. Adding a constant field has no impact on control flow."],
  ["Rename Symbol", "Strict", "Overall CC must not increase. Renaming should change nothing but the name \u2014 all structure must be preserved."],
];

children.push(table(t2Cols, t2Rows, { headerRow: t2Header }));
children.push(p(""));

children.push(heading("How the CC Rules are Enforced", 2));
children.push(bulletP([bold("Strict: "), normal("If the refactored code\u2019s overall CC is higher than the original, the refactoring is rejected.")]));
children.push(bulletP([bold("Loosened: "), normal("Same as strict, but allows the refactored CC to exceed the original by up to 1.")]));
children.push(bulletP([bold("Extract Rule: "), normal("Instead of checking overall code complexity, it checks only the specific target method. If that method\u2019s CC went up, the refactoring is rejected. Also rejected if the target method cannot be found in the refactored code at all.")]));
children.push(bulletP([bold("Skip: "), normal("The complexity gate is bypassed entirely for this refactoring type.")]));

// ── Section: Intent Check Requirements (TABLE 3)
children.push(heading("Intent Check Requirements Per Refactoring Type", 1));
children.push(p("Each refactoring type has a custom structural check that verifies the expected change actually occurred in the code."));

const t3Cols = [1600, 2200, 2400, 2826];
const t3Header = ["Refactoring", "What is Checked", "Pass Condition", "Fail Condition"];
const t3Rows = [
  ["Flatten Cond.", "Max nesting depth of IfStatement nodes", "New depth is strictly less than old depth", "Depth unchanged or increased"],
  ["Decompose Cond.", "BinaryOperation count + new variables in conditionals", "Binary ops decreased, OR new variables introduced and used in a conditional", "No new variables AND no binary-op reduction"],
  ["Consolidate Cond.", "Total IfStatement + SwitchStatement count", "Count decreased", "Count unchanged or increased"],
  ["Remove Ctrl Flag", "Break/Return count + variable changes", "Any one of three: (1) exits increased, (2) variables removed, (3) new variables with existing exits", "No change in exits, no variables removed or added"],
  ["Replace Loop w/ Pipe.", "Loop count + Stream API evidence", "Loop count decreased AND stream evidence found (or loop decreased as fallback)", "Loop count unchanged"],
  ["Split Loop", "ForStatement + WhileStatement count", "Count increased", "Count unchanged or decreased"],
  ["Extract Method", "MethodDeclaration count", "Count increased", "Count unchanged or decreased"],
  ["Inline Method", "MethodDeclaration count", "Count decreased or stayed the same", "Count increased"],
  ["Extract Variable", "VariableDeclarator count", "Count increased", "Count unchanged or decreased"],
  ["Inline Variable", "VariableDeclarator count", "Count decreased or stayed the same", "Count increased"],
  ["Extract Constant", "FieldDeclaration count + UPPERCASE names", "Field count increased, OR new uppercase-named variables appeared", "No new fields and no new uppercase variables"],
  ["Rename Symbol", "Per-method structural signatures (SHA-256 of AST skeleton)", "Every original method\u2019s signature has a match in the refactored code", "At least one original method\u2019s signature has no match"],
];

children.push(table(t3Cols, t3Rows, { headerRow: t3Header }));
children.push(p(""));

// ── Section: Boundary Preservation
children.push(heading("Boundary Preservation", 1));
children.push(p([bold("This gate has no per-refactoring rules. "), normal("It works the same way for every refactoring type.")]));
children.push(p("The validator extracts all methods from both the original and refactored code, then compares them side by side. Any method that exists in both versions but is not in the target scope must have an identical structural signature. If a non-target method\u2019s structure changed, the refactoring is rejected."));
children.push(p("New methods are always allowed \u2014 the check only applies to methods that already existed. Adding new classes, enums, or helper methods as part of the refactoring strategy is fine. Modifying something that was supposed to stay untouched is not."));

// ── Section: How the System Handles Failure
children.push(heading("How the System Handles Failure", 1));
children.push(p("When a gate fails, Horizon does not just give up. It follows a recovery strategy:"));
children.push(numberedP([bold("Syntax failure: "), normal("Send the error back to the AI Generator and ask it to fix the syntax. Up to 3 attempts.")]));
children.push(numberedP([bold("Structural failure "), normal("(complexity, boundary, or intent):"), bold(" "), normal("Send the finding back to the Generator once for a targeted fix.")]));
children.push(numberedP([bold("Still failing after that: "), normal("Escalate to the Planner to rethink the entire refactoring strategy. Up to 3 strategy retries.")]));
children.push(p("If all retries are exhausted, the system reports ABORT_SYNTAX or ABORT_STRATEGY and returns the best effort so far."));

// ── Section: Error Tiers (TABLE 4)
children.push(heading("Error Tiers (Severity Levels)", 1));
children.push(p("Failures are organized into five tiers:"));

const t4Cols = [1300, 1900, 5826];
const t4Header = ["Tier", "Name", "What Went Wrong"];
const t4Rows = [
  ["Tier 1", "Syntax", "Generated code is not valid Java \u2014 cannot even parse it"],
  ["Tier 2-A", "Complexity", "Cyclomatic complexity increased beyond what is allowed"],
  ["Tier 2-B", "Boundary", "The AI modified a method it was not supposed to touch"],
  ["Tier 2-C", "Intent", "The refactoring did not produce the expected structural change"],
  ["Tier 3", "Judge", "The Judge model reviewed the result and rejected it"],
];

children.push(table(t4Cols, t4Rows, { headerRow: t4Header }));
children.push(p(""));
children.push(p("Tier 1 is the most fundamental \u2014 if code does not parse, nothing else matters. Tier 3 is the final human-judgment-like review performed by a separate AI model."));

// ── Section: Real Example
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(heading("Real Example: What Happens During Validation", 1));
children.push(p("Let us say you ask Horizon to extract a method from this code:"));

children.push(codeBlock("class Calculator {"));
children.push(codeBlock("    void process() {"));
children.push(codeBlock("        int total = price * quantity;"));
children.push(codeBlock("        double tax = total * 0.08;"));
children.push(codeBlock("        System.out.println(total + tax);"));
children.push(codeBlock("    }"));
children.push(codeBlock("}"));

children.push(p("The AI might produce:"));
children.push(codeBlock("class Calculator {"));
children.push(codeBlock("    void process() {"));
children.push(codeBlock("        double result = calculateTotal(price, quantity);"));
children.push(codeBlock("        System.out.println(result);"));
children.push(codeBlock("    }"));
children.push(codeBlock("    double calculateTotal(int price, int quantity) {"));
children.push(codeBlock("        int total = price * quantity;"));
children.push(codeBlock("        double tax = total * 0.08;"));
children.push(codeBlock("        return total + tax;"));
children.push(codeBlock("    }"));
children.push(codeBlock("}"));

children.push(p("The validator then checks:"));
children.push(numberedP([bold("Syntax: "), normal("Parses OK \u2014 both are valid Java.")]));
children.push(numberedP([bold("Complexity: "), normal("Uses the Extract Rule \u2014 the process() method\u2019s CC must not increase. Original had 1 path, refactored has 1 path. Pass.")]));
children.push(numberedP([bold("Boundary: "), normal("No other methods exist to leak into. Pass.")]));
children.push(numberedP([bold("Intent: "), normal("Method count was 1, now it is 2. Extract-method detection passes.")]));
children.push(p("All gates green \u2192 the refactoring is accepted and moves on to the Judge for final review."));

// ── Section: Where to Find the Code
children.push(heading("Where to Find the Code", 1));
children.push(bulletP([bold("Core validator logic: "), normal("backend/app/modules/validator/__init__.py")]));
children.push(bulletP([bold("Phase 4 orchestration: "), normal("backend/app/modules/orchestrator/phases/phase4_validation.py")]));
children.push(bulletP([bold("Types and data structures: "), ital("backend/app/utils/types.py"), normal(" \u2014 RefactorIntent, FailureTier, StructureUnit")]));
children.push(bulletP([ital("backend/app/utils/schemas.py"), normal(" \u2014 ValidationFinding, ErrorReport, IntentPacket")]));

// ── Assemble Document ─────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: "000000" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: "000000" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: "000000" },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 } },
          children: [new TextRun({ text: "Horizon Validator \u2014 Internal Documentation", font: FONT, size: 18, italics: true, color: "000000" })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Page ", font: FONT, size: 18, color: "000000" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "000000" })],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("docs/validator-report.docx", buffer);
  console.log("Done: docs/validator-report.docx");
});
