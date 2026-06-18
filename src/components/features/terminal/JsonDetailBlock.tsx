"use client";

interface JsonDetailBlockProps {
  data: unknown;
  isDark: boolean;
}

const keyStyle = "font-bold";
const stringCls = (d: boolean) => d ? "text-[#3dd6c8]" : "text-[#16a34a]";
const numberCls = (d: boolean) => d ? "text-[#e09c3b]" : "text-[#d97706]";
const boolCls = (d: boolean) => d ? "text-[#a78bfa]" : "text-[#7c3aed]";
const nullCls = (d: boolean) => d ? "text-[#a78bfa] italic" : "text-[#7c3aed] italic";
const mutedCls = (d: boolean) => d ? "text-[#8d95a5]" : "text-[#888]";

export default function JsonDetailBlock({ data, isDark }: JsonDetailBlockProps) {
  return (
    <div className={`mt-1 px-2.5 py-2 rounded text-[11px] leading-relaxed overflow-x-auto
      ${isDark ? "bg-[#1e1f22] border border-[#393b40]" : "bg-[#f9f9f9] border border-[#e4e4e4]"}`}>
      <JsonValue value={data} isDark={isDark} depth={0} />
    </div>
  );
}

function JsonValue({ value, isDark, depth }: { value: unknown; isDark: boolean; depth: number }) {
  if (value === null || value === undefined) {
    return <span className={nullCls(isDark)}>null</span>;
  }

  if (typeof value === "boolean") {
    return <span className={boolCls(isDark)}>{String(value)}</span>;
  }

  if (typeof value === "number") {
    return <span className={numberCls(isDark)}>{value}</span>;
  }

  if (typeof value === "string") {
    return <span className={stringCls(isDark)}>"{value}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className={mutedCls(isDark)}>[]</span>;
    return (
      <div className="flex flex-col gap-0.5">
        {value.map((item, i) => (
          <div key={i} className="flex items-start pl-2"
            style={{ borderLeft: isDark ? "1px solid #393b40" : "1px solid #ddd" }}>
            <div className="min-w-0 flex-1">
              <JsonValue value={item} isDark={isDark} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className={mutedCls(isDark)}>{'{}'}</span>;
    return (
      <div className="flex flex-col">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start gap-1.5 pl-2"
            style={{ borderLeft: depth > 0 ? (isDark ? "1px solid #393b40" : "1px solid #ddd") : "" }}>
            <span className={`${keyStyle} shrink-0 ${isDark ? "text-[#5a8cf8]" : "text-[#3574f0]"}`}>
              {k.replace(/_/g, " ")}:
            </span>
            <div className="min-w-0 flex-1">
              {isSimple(v) ? (
                <JsonValue value={v} isDark={isDark} depth={depth + 1} />
              ) : (
                <span className="break-all">
                  <JsonValue value={v} isDark={isDark} depth={depth + 1} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function isSimple(v: unknown): boolean {
  return v === null || typeof v === "boolean" || typeof v === "number" || typeof v === "string";
}
