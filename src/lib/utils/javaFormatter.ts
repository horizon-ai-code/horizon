/**
 * Pure utility function to format messy Java code snippets.
 * Extracts string literals, char literals, comments, and generics into placeholders,
 * then normalizes spacing, braces, indentation, and blank lines,
 * and finally restores the placeholders.
 */
export function formatJavaCode(rawCode: string): string {
  if (!rawCode) return "";

  const placeholders: string[] = [];
  let cleanCode = "";
  let i = 0;

  // 1. EXTRACT STRINGS & COMMENTS TO PLACEHOLDERS
  while (i < rawCode.length) {
    const char = rawCode[i];
    const nextChar = rawCode[i + 1] || "";

    // Multi-line comment
    if (char === "/" && nextChar === "*") {
      let comment = "/*";
      i += 2;
      while (i < rawCode.length) {
        if (rawCode[i] === "*" && rawCode[i + 1] === "/") {
          comment += "*/";
          i += 2;
          break;
        }
        comment += rawCode[i];
        i++;
      }
      const ph = `___PH_ML_COMMENT_${placeholders.length}___`;
      placeholders.push(comment);
      cleanCode += ph;
      continue;
    }

    // Single-line comment
    if (char === "/" && nextChar === "/") {
      let comment = "//";
      i += 2;
      while (i < rawCode.length && rawCode[i] !== "\n" && rawCode[i] !== "\r") {
        comment += rawCode[i];
        i++;
      }
      const ph = `___PH_SL_COMMENT_${placeholders.length}___`;
      placeholders.push(comment);
      cleanCode += ph;
      continue;
    }

    // String literal
    if (char === '"') {
      let str = '"';
      i++;
      let escaped = false;
      while (i < rawCode.length) {
        const sChar = rawCode[i];
        str += sChar;
        if (escaped) {
          escaped = false;
        } else if (sChar === "\\") {
          escaped = true;
        } else if (sChar === '"') {
          i++;
          break;
        }
        i++;
      }
      const ph = `___PH_STRING_${placeholders.length}___`;
      placeholders.push(str);
      cleanCode += ph;
      continue;
    }

    // Character literal
    if (char === "'") {
      let chLiteral = "'";
      i++;
      let escaped = false;
      while (i < rawCode.length) {
        const cChar = rawCode[i];
        chLiteral += cChar;
        if (escaped) {
          escaped = false;
        } else if (cChar === "\\") {
          escaped = true;
        } else if (cChar === "'") {
          i++;
          break;
        }
        i++;
      }
      const ph = `___PH_CHAR_${placeholders.length}___`;
      placeholders.push(chLiteral);
      cleanCode += ph;
      continue;
    }

    cleanCode += char;
    i++;
  }

  // 2. EXTRACT GENERICS TO PLACEHOLDERS
  let j = 0;
  while (j < cleanCode.length) {
    const match = cleanCode
      .substring(j)
      .match(/(?:\b[A-Z_][a-zA-Z0-9_]*|\bclass|\bnew|\binterface|public|private|protected|static)\s*</);
    if (!match || match.index === undefined) break;

    const startIdx = j + match.index + match[0].indexOf("<");

    let depth = 1;
    let k = startIdx + 1;
    while (k < cleanCode.length && depth > 0) {
      const c = cleanCode[k];
      if (c === "<") depth++;
      else if (c === ">") depth--;
      k++;
    }

    if (depth === 0) {
      const genericStr = cleanCode.substring(startIdx, k);
      const ph = `___PH_GENERIC_${placeholders.length}___`;
      placeholders.push(genericStr);
      cleanCode = cleanCode.substring(0, startIdx) + ph + cleanCode.substring(k);
      j = startIdx + ph.length;
    } else {
      j = startIdx + 1;
    }
  }

  // 3. NORMALIZATIONS
  cleanCode = cleanCode.replace(/\r\n/g, "\n");

  // Fix spaces after control flow keywords
  cleanCode = cleanCode.replace(/\b(if|while|catch|for|switch)\s*\(/g, "$1 (");

  // Normalize spaces around binary operators
  cleanCode = cleanCode.replace(/\s*&&\s*/g, " && ");
  cleanCode = cleanCode.replace(/\s*\|\|\s*/g, " || ");
  cleanCode = cleanCode.replace(/\s*!=\s*/g, " != ");
  cleanCode = cleanCode.replace(/\s*==\s*/g, " == ");
  cleanCode = cleanCode.replace(/\s*>=\s*/g, " >= ");
  cleanCode = cleanCode.replace(/\s*<=\s*/g, " <= ");

  // Assignment operator (=) keeping +=, -= etc safe
  cleanCode = cleanCode.replace(/(?<![!<>=+\-*/%&^|])\s*=\s*(?![=])/g, " = ");

  // Comparisons (< and >) keeping <<, >>, <=, >= and placeholders safe
  cleanCode = cleanCode.replace(/(?<![<])\s*<\s*(?![<=_])/g, " < ");
  cleanCode = cleanCode.replace(/(?<![>_])\s*>\s*(?![>=])/g, " > ");

  // 4. PARSE INTO STATEMENT LINES BY SPLITTING ORIGINAL LINES FIRST
  const rawLines = cleanCode.split("\n");
  const tempLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      tempLines.push("");
      continue;
    }

    let currentLine = "";
    let parenDepth = 0;

    for (let idx = 0; idx < trimmed.length; idx++) {
      const char = trimmed[idx];

      if (char === "(") {
        parenDepth++;
        currentLine += char;
      } else if (char === ")") {
        parenDepth = Math.max(0, parenDepth - 1);
        currentLine += char;
      } else if (char === ";") {
        currentLine += char;
        if (parenDepth === 0) {
          tempLines.push(currentLine.trim());
          currentLine = "";
        }
      } else if (char === "{") {
        if (currentLine && !currentLine.endsWith(" ")) {
          currentLine += " ";
        }
        currentLine += "{";
        tempLines.push(currentLine.trim());
        currentLine = "";
      } else if (char === "}") {
        if (currentLine.trim()) {
          tempLines.push(currentLine.trim());
        }
        tempLines.push("}");
        currentLine = "";
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) {
      tempLines.push(currentLine.trim());
    }
  }

  // 5. MERGE CATCH, ELSE, FINALLY TO PREVIOUS CLOSING BRACE
  const mergedLines: string[] = [];
  for (const line of tempLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      mergedLines.push("");
      continue;
    }

    if (
      (trimmed.startsWith("else") ||
        trimmed.startsWith("catch") ||
        trimmed.startsWith("finally")) &&
      mergedLines.length > 0
    ) {
      // Find the last non-empty line
      let lastNonEmptyIdx = mergedLines.length - 1;
      while (lastNonEmptyIdx >= 0 && mergedLines[lastNonEmptyIdx].trim() === "") {
        lastNonEmptyIdx--;
      }
      if (lastNonEmptyIdx >= 0 && mergedLines[lastNonEmptyIdx].trim() === "}") {
        // Remove any intermediate empty lines
        mergedLines.splice(lastNonEmptyIdx + 1);
        // Pop the closing brace line
        mergedLines.pop();
        // Push merged line
        mergedLines.push("} " + trimmed);
        continue;
      }
    }
    mergedLines.push(trimmed);
  }

  // 6. APPLY INDENTATION
  const formattedLines: string[] = [];
  let indentLevel = 0;

  for (const line of mergedLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      formattedLines.push("");
      continue;
    }

    let currentLineIndent = indentLevel;
    if (trimmed.startsWith("}")) {
      currentLineIndent = Math.max(0, indentLevel - 1);
    }

    const indent = " ".repeat(currentLineIndent * 4);
    formattedLines.push(indent + trimmed);

    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;
    indentLevel = Math.max(0, indentLevel + openBraces - closeBraces);
  }

  // 7. STRIP CONSECUTIVE BLANK LINES (Max 1 consecutive blank line)
  const cleanLines: string[] = [];
  let consecutiveEmpty = 0;
  for (const line of formattedLines) {
    if (line.trim() === "") {
      consecutiveEmpty++;
      if (consecutiveEmpty <= 1) {
        cleanLines.push("");
      }
    } else {
      consecutiveEmpty = 0;
      cleanLines.push(line);
    }
  }

  // Join and strip leading/trailing empty lines
  let result = cleanLines.join("\n").trim();
  if (result) {
    result += "\n";
  }

  // 8. RESTORE PLACEHOLDERS (Reverse order for nested replacements)
  for (let idx = placeholders.length - 1; idx >= 0; idx--) {
    const phChar = `___PH_CHAR_${idx}___`;
    const phString = `___PH_STRING_${idx}___`;
    const phSl = `___PH_SL_COMMENT_${idx}___`;
    const phMl = `___PH_ML_COMMENT_${idx}___`;
    const phGen = `___PH_GENERIC_${idx}___`;

    result = result.replace(phChar, placeholders[idx]);
    result = result.replace(phString, placeholders[idx]);
    result = result.replace(phSl, placeholders[idx]);
    result = result.replace(phMl, placeholders[idx]);
    result = result.replace(phGen, placeholders[idx]);
  }

  return result;
}
