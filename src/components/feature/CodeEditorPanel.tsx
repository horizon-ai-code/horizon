"use client"

import { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Sanitizes the themes to prevent React from crashing on shorthand properties
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sanitizeTheme = (theme: any) => {
  const cleanTheme = JSON.parse(JSON.stringify(theme));
  Object.keys(cleanTheme).forEach(key => {
    if (cleanTheme[key].background) {
      cleanTheme[key].backgroundColor = cleanTheme[key].background;
      delete cleanTheme[key].background;
    }
  });
  return cleanTheme;
};

const baseTheme = sanitizeTheme(oneDark);

const jetbrainsTheme = {
  ...baseTheme,
  'keyword': { ...baseTheme['keyword'], color: '#cf8e6d' },
  'class-name': { ...baseTheme['class-name'], color: '#2aacb8' },
  'string': { ...baseTheme['string'], color: '#56a8f5' },
  'function': { ...baseTheme['function'], color: '#56a8f5' },
  'comment': { ...baseTheme['comment'], color: '#6f737a' },
  'builtin': { ...baseTheme['builtin'], color: '#f4bf4f' },
  'type': { ...baseTheme['type'], color: '#2aacb8' },
};

const safeLightTheme = sanitizeTheme(oneLight);

interface CodeEditorPanelProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  highlightLines?: {
    removed?: number[];
    added?: number[];
    issue?: number[];
  };
  showDiff?: boolean;
  bottomPadding?: string;
  ghostValue?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function CodeEditorPanel({ 
  value, 
  onChange, 
  placeholder, 
  highlightLines = {}, 
  showDiff = false, 
  bottomPadding = '48px',
  ghostValue = '',
  onKeyDown,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave
}: CodeEditorPanelProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null); // NEW: Controls background scroll

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // Sync scrolling across the Text, Gutter, and Background layers simultaneously
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
    if (bgRef.current) bgRef.current.scrollTop = scrollTop;
  };

  const lines = value.split('\n');

  if (!mounted) return null;

  return (
    <div 
      className="relative flex-1 flex min-h-0 font-mono text-[13.5px] overflow-hidden bg-[#2b2d30] dark:bg-[#2b2d30] dark:ring-1 dark:ring-[#393b40]"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      
      {/* 1. BACKGROUND LAYER (The Magic Fix)
          This layer sits completely behind everything and draws full-width colored 
          rectangles that perfectly span from the gutter to the far right edge. */}
      <div 
        ref={bgRef} 
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      >
        <div style={{ paddingTop: '24px', paddingBottom: bottomPadding }}>
          {lines.map((_, i) => {
            const isRemoved = showDiff && highlightLines.removed?.includes(i);
            const isAdded = showDiff && highlightLines.added?.includes(i);
            const isIssue = showDiff && highlightLines.issue?.includes(i);
            
            const getBgStyle = () => {
              if (isRemoved) return { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 226, 226, 0.8)' };
              if (isAdded) return { backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : 'rgba(220, 252, 231, 0.8)' };
              if (isIssue) return { backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255, 237, 213, 0.8)' };
              return { backgroundColor: 'transparent' };
            };

            return <div key={i} className="h-[24px] w-full" style={getBgStyle()} />;
          })}
        </div>
      </div>

      {/* 2. GUTTER LAYER (Now transparent, only colors the numbers) */}
      <div 
        ref={gutterRef}
        className="w-14 z-10 select-none flex flex-col overflow-hidden shrink-0 bg-transparent text-muted-foreground"
        style={{ paddingTop: '24px', paddingBottom: bottomPadding }}
      >
        {lines.map((_, i) => {
          const isRemoved = showDiff && highlightLines.removed?.includes(i);
          const isAdded = showDiff && highlightLines.added?.includes(i);
          const isIssue = showDiff && highlightLines.issue?.includes(i);
          
          return (
            <div 
              key={i} 
              className={`h-[24px] leading-[24px] flex items-center justify-center
                ${isRemoved ? 'text-red-500 font-medium' : 
                  isAdded ? 'text-cyan-500 font-medium' : 
                  isIssue ? 'text-orange-500 font-medium' : ''}`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      {/* 3. CODE LAYER (Cleaned up, perfectly aligned to text area) */}
      <div className="relative flex-1 overflow-hidden h-full z-10 no-transition">
        <div ref={preRef} className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Main Content Layer */}
          <SyntaxHighlighter
            language="java"
            style={isDark ? jetbrainsTheme : safeLightTheme}
            wrapLines={false}
            customStyle={{ 
              margin: 0, 
              border: "none", 
              boxShadow: "none", 
              backgroundImage: "none",
              padding: `24px 24px ${bottomPadding} 24px`, 
              backgroundColor: "transparent", 
              fontSize: '13px', 
              lineHeight: '24px', 
              letterSpacing: 'normal', 
              wordSpacing: 'normal', 
              fontWeight: '500', 
              fontVariantLigatures: 'none', 
              boxSizing: 'border-box'
            }}
            codeTagProps={{
              style: {
                fontFamily: 'var(--font-fira-code), monospace', 
                fontSize: '13px', 
                lineHeight: '24px', 
                tabSize: 4,
                backgroundColor: "transparent", 
                letterSpacing: 'normal', 
                wordSpacing: 'normal', 
                fontWeight: 'normal', 
                fontVariantLigatures: 'none',
              }
            }}
          >
            {value || ' '}
          </SyntaxHighlighter>

          {/* Ghost Preview Layer */}
          {ghostValue && !value && (
            <div className="absolute inset-0 opacity-30 pointer-events-none">
              <SyntaxHighlighter
                language="java"
                style={isDark ? jetbrainsTheme : safeLightTheme}
                wrapLines={false}
                customStyle={{ 
                  margin: 0, 
                  border: "none", 
                  boxShadow: "none", 
                  backgroundImage: "none",
                  padding: `24px 24px ${bottomPadding} 24px`, 
                  backgroundColor: "transparent", 
                  fontSize: '13px', 
                  lineHeight: '24px', 
                  letterSpacing: 'normal', 
                  wordSpacing: 'normal', 
                  fontWeight: '500', 
                  fontVariantLigatures: 'none', 
                  boxSizing: 'border-box'
                }}
                codeTagProps={{
                  style: {
                    fontFamily: 'var(--font-fira-code), monospace', 
                    fontSize: '13px', 
                    lineHeight: '24px', 
                    tabSize: 4,
                    backgroundColor: "transparent", 
                    letterSpacing: 'normal', 
                    wordSpacing: 'normal', 
                    fontWeight: 'normal', 
                    fontVariantLigatures: 'none',
                  }
                }}
              >
                {ghostValue}
              </SyntaxHighlighter>
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          spellCheck="false"
          placeholder={placeholder}
          className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none border-none caret-cyan-400 overflow-auto text-transparent selection:bg-cyan-500/20 font-mono"
          style={{ 
            color: 'transparent', 
            WebkitTextFillColor: 'transparent', 
            whiteSpace: 'pre', 
            wordSpacing: 'normal', 
            boxSizing: 'border-box',
            fontFamily: 'var(--font-fira-code), monospace', 
            fontSize: "13px", 
            tabSize: 4, 
            lineHeight: '24px', 
            letterSpacing: 'normal',
            display: 'block', 
            padding: `24px 24px ${bottomPadding} 24px`, 
            fontWeight: 'normal', 
            fontVariantLigatures: 'none',
          }}
        />
      </div>
    </div>
  );
}