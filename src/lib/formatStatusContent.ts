export interface ContentTag {
  label: string;
  value: string;
}

export interface FormattedContent {
  summary: string;
  tags: ContentTag[];
  details: string | null;
}

export function formatStatusContent(raw: string): FormattedContent {
  let text = raw;
  let details: string | null = null;

  // 1. Extract ```json ... ``` blocks and parse to readable text
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/g;
  const parsedBlocks: string[] = [];
  text = text.replace(jsonBlockRegex, (_, json) => {
    try {
      const parsed = JSON.parse(json.trim());
      const lines: string[] = [];
      for (const [key, val] of Object.entries(parsed)) {
        const label = key.replace(/_/g, " ");
        if (Array.isArray(val)) {
          if (val.length > 0) {
            lines.push(`${label}: ${val.join(", ")}`);
          }
        } else if (typeof val === "string" && val.length > 0) {
          lines.push(`${label}: ${val}`);
        } else if (val !== null && val !== undefined) {
          lines.push(`${label}: ${val}`);
        }
      }
      if (lines.length > 0) parsedBlocks.push(lines.join("\n"));
    } catch {
      parsedBlocks.push(json.trim());
    }
    return "";
  });
  if (parsedBlocks.length > 0) {
    details = parsedBlocks.join("\n\n");
  }

  // 1b. Extract standalone JSON objects (not in code blocks) — common in past session data
  const trimmed = text.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(trimmed);
      const lines: string[] = [];
      let nestedDetails: string[] = [];
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of entries) {
        for (const [key, val] of Object.entries(obj)) {
          const label = key.replace(/_/g, " ");
          if (typeof val === "object" && val !== null && !Array.isArray(val)) {
            const nested = JSON.stringify(val, null, 2);
            nestedDetails.push(`${label}:\n${nested}`);
          } else if (Array.isArray(val)) {
            if (val.length > 0) {
              const items = val.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
              lines.push(`${label}: ${items}`);
            }
          } else if (typeof val === "string" && val.length > 0) {
            lines.push(`${label}: ${val}`);
          } else if (val !== null && val !== undefined) {
            lines.push(`${label}: ${val}`);
          }
        }
      }
      if (lines.length > 0) {
        const joined = lines.join("\n");
        if (nestedDetails.length > 0) {
          details = joined + "\n\n" + nestedDetails.join("\n\n");
        } else {
          details = joined;
        }
      } else if (nestedDetails.length > 0) {
        details = nestedDetails.join("\n\n");
      }
      text = "";
    } catch {
      // Not valid JSON, fall through
    }
  }

  // If content is source code, show as collapsible details
  if (text.trim().match(/^(public|private|protected|class|void|int|boolean|String|if|for|while|try|return|import|package)\b/)) {
    const code = text.trim();
    const methodMatch = code.match(/(?:public|private|protected)\s+\w+\s+(\w+)\s*\(/);
    const summary = methodMatch ? `Code generated — ${methodMatch[1]}` : "Code generated";
    return { summary, tags: [], details: code };
  }

  // 2. Extract **Key:** `Value` or **Key:** Value pairs as tags (from structured content)
  const tags: ContentTag[] = [];
  const tagRegex = /\*\*([^*]+)\*:\*?\s*`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(text)) !== null) {
    tags.push({ label: match[1].trim(), value: match[2].trim() });
  }
  text = text.replace(tagRegex, "");

  // Also match **Key:** Value without backticks (line-based)
  const lineTagRegex = /^\*\*([^*]+)\*:\*?\s*(.+)$/gm;
  while ((match = lineTagRegex.exec(text)) !== null) {
    const val = match[2].trim();
    if (val && !val.startsWith("```")) {
      tags.push({ label: match[1].trim(), value: val });
    }
  }
  text = text.replace(lineTagRegex, "");

  // 3. Extract bullet items like "- **ACTION** on ..." as tags
  const bulletTagRegex = /-\s+\*\*([^*]+)\*\*\s*on\s+`([^`]+)`/g;
  while ((match = bulletTagRegex.exec(text)) !== null) {
    tags.push({ label: match[1].trim(), value: match[2].trim() });
  }
  text = text.replace(bulletTagRegex, "");

  // 4. Strip remaining **bold** markers
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");

  // 5. Strip backtick code markers
  text = text.replace(/`([^`]+)`/g, "$1");

  // 6. Remove markdown headers
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 7. Clean up: remove > blockquotes, extra newlines, trim
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  // 8. Extract the first meaningful line as summary, rest as additional text
  const lines = text.split("\n").filter((l) => l.trim());
  const summary = lines[0] || "";
  const rest = lines.slice(1).filter((l) => !l.match(/^\s*[-*]\s*$/)).join(" · ");

  // If there's meaningful rest content, add it as a tag
  if (rest && tags.length === 0) {
    tags.push({ label: "", value: rest });
  }

  return { summary, tags, details };
}
