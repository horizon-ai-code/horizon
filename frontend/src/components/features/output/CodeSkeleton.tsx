"use client"

import { useTheme } from "next-themes";

interface CodeSkeletonProps {
  sourceCode: string;
}

export default function CodeSkeleton({ sourceCode }: CodeSkeletonProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark" || resolvedTheme === undefined;
  const bg = isDark ? "bg-white/15" : "bg-white/70";

  let lines = sourceCode ? sourceCode.split("\n") : [];
  lines = lines.slice(0, 20);
  while (lines.length < 10) lines.push("");

  return (
    <div className="font-mono text-[13px] leading-[24px] p-6 bg-jb-panel h-full overflow-hidden select-none">
      {lines.map((line, i) => {
        const indent = line.match(/^\s*/)?.[0].length || 0;
        const trimmedLen = line.trim().length;
        const width = trimmedLen > 0
          ? Math.min(95, Math.max(10, trimmedLen * 7 + 10))
          : 5;
        return (
          <div key={i} className="flex items-center" style={{ height: "24px" }}>
            <span className="w-14 text-right text-[11px] pr-4 select-none shrink-0"
      style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)" }}>
              {i + 1}
            </span>
            <div
              className={`h-3 rounded animate-pulse ${bg}`}
              style={{
                width: `${width}%`,
                marginLeft: `${indent * 0.5}rem`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
