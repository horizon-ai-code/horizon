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

  // 1. Extract ```json ... ``` blocks
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/g;
  const jsonBlocks: string[] = [];
  text = text.replace(jsonBlockRegex, (_, json) => {
    jsonBlocks.push(json.trim());
    return "";
  });
  if (jsonBlocks.length > 0) {
    details = jsonBlocks.join("\n\n");
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
