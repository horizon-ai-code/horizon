"use client"

import { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeEditorPanelProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  diffType?: "none" | "removed" | "added";
  showDiff?: boolean;
  bottomPadding?: string;
}

export default function CodeEditorPanel({ value, onChange, placeholder, diffType = "none", showDiff = false, bottomPadding = '48px' }: CodeEditorPanelProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : true;

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop;
    }
  };

  const lines = value.split('\n');

  const getLineDiffType = (line: string | undefined) => {
  // 1. Add a safety check for undefined lines
  if (!showDiff || !line) return 'none'; 

  if (diffType === 'removed') {
    const removedTriggers = ['int add', 'int subtract', 'int multiply', 'return a + b', 'return a - b', 'return a * b'];
    if (removedTriggers.some(trigger => line.includes(trigger))) return 'removed';
  } else if (diffType === 'added') {
    const addedTriggers = ['/**', 'perform', 'compute'];
    if (addedTriggers.some(trigger => line.includes(trigger))) return 'added';
  }
  return 'none';
};

  if (!mounted) return null;

  return (
    <div className="relative flex-1 flex min-h-0 font-mono text-[13.5px] overflow-hidden">
      <div 
        ref={gutterRef}
        className={`w-14 select-none flex flex-col border-r transition-colors duration-700 overflow-hidden shrink-0 z-10
          ${isDark ? 'bg-[#0a0a0c]/80 backdrop-blur-xl border-white/5 text-gray-600/70' : 'bg-slate-50/80 backdrop-blur-xl border-slate-100 text-slate-400'}`}
        style={{ paddingTop: '24px', paddingBottom: bottomPadding }}
      >
        {lines.map((line, i) => {
          const type = getLineDiffType(lines[i]);
          const isRemoved = type === 'removed';
          const isAdded = type === 'added';
          
          return (
            <div 
              key={i} 
              className={`h-[24px] leading-[24px] flex items-center justify-center transition-all duration-300
                ${isRemoved ? 'bg-red-500/10 text-red-400 font-medium' : 
                  isAdded ? 'bg-cyan-500/10 text-cyan-400 font-medium' : ''}`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      <div className="relative flex-1 overflow-hidden h-full">
        <div 
          ref={preRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <SyntaxHighlighter
            language="java"
            style={isDark ? vscDarkPlus : vs}
            customStyle={{ 
              margin: 0, 
              padding: `24px 24px ${bottomPadding} 24px`, 
              backgroundColor: 'transparent', 
              fontSize: '13.5px',
              lineHeight: '24px'
            }}
            wrapLines={true}
            lineProps={(lineNumber) => {
              const lineIndex = lineNumber - 1;
              const type = lineIndex < lines.length ? getLineDiffType(lines[lineIndex]) : 'none';
              let style: React.CSSProperties = { display: 'block' };
              if (type === 'removed') {
                style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(254, 226, 226, 0.5)';
                style.borderLeft = isDark ? '3px solid rgba(239, 68, 68, 0.2)' : '3px solid rgba(254, 202, 202, 1)';
              } else if (type === 'added') {
                style.backgroundColor = isDark ? 'rgba(6, 182, 212, 0.1)' : 'rgba(207, 250, 254, 0.5)';
                style.borderLeft = isDark ? '3px solid rgba(6, 182, 212, 0.2)' : '3px solid rgba(165, 243, 252, 1)';
              } else {
                style.borderLeft = '3px solid transparent';
              }
              return { style };
            }}
          >
            {value || ' '}
          </SyntaxHighlighter>
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck="false"
          placeholder={placeholder}
          className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none border-l-[3px] border-transparent caret-cyan-400 overflow-auto text-transparent selection:bg-cyan-500/20 font-mono"
          style={{ 
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
            whiteSpace: 'pre',
            lineHeight: '24px',
            letterSpacing: 'normal',
            display: 'block',
            padding: `24px 24px ${bottomPadding} 24px`
          }}
        />
      </div>
    </div>
  );
}
