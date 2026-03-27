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

export const jetbrainsTheme = {
  ...baseTheme,
  'keyword': { ...baseTheme['keyword'], color: '#cf8e6d' },
  'class-name': { ...baseTheme['class-name'], color: '#2aacb8' },
  'string': { ...baseTheme['string'], color: '#56a8f5' },
  'function': { ...baseTheme['function'], color: '#56a8f5' },
  'comment': { ...baseTheme['comment'], color: '#6f737a', fontStyle: 'italic' },
  'builtin': { ...baseTheme['builtin'], color: '#f4bf4f' },
  'type': { ...baseTheme['type'], color: '#2aacb8' },
  'number': { ...baseTheme['number'], color: '#56a8f5' },
  'boolean': { ...baseTheme['boolean'], color: '#cf8e6d' },
  'operator': { ...baseTheme['operator'], color: '#dfe1e5' },
};

const safeLightTheme = sanitizeTheme(oneLight);

export const intellijLightTheme = {
  ...safeLightTheme,
  'keyword': { ...safeLightTheme['keyword'], color: '#0033b3', fontWeight: 'bold' },
  'class-name': { ...safeLightTheme['class-name'], color: '#000000' },
  'string': { ...safeLightTheme['string'], color: '#067d17' },
  'function': { ...safeLightTheme['function'], color: '#067d17' },
  'comment': { ...safeLightTheme['comment'], color: '#8c8c8c', fontStyle: 'italic' },
  'builtin': { ...safeLightTheme['builtin'], color: '#000000' },
  'type': { ...safeLightTheme['type'], color: '#000000' },
  'number': { ...safeLightTheme['number'], color: '#1750eb' },
  'boolean': { ...safeLightTheme['boolean'], color: '#1750eb' },
  'operator': { ...safeLightTheme['operator'], color: '#080808' },
};

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
      className="relative flex-1 flex min-h-0 font-mono text-[13.5px] overflow-hidden bg-jb-panel border-jb-border transition-colors duration-300"
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
              if (isRemoved) return { backgroundColor: isDark ? 'rgba(249, 62, 62, 0.2)' : '#fef2f2' }; // Dark: red-500/20, Light: red-50
              if (isAdded) return { backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : '#ecfdf5' }; // Dark: cyan-500/15, Light: emerald-50
              if (isIssue) return { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb' }; // Dark: amber-500/15, Light: amber-100
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
              className={`h-[24px] leading-[24px] flex items-center justify-center font-medium
                ${isRemoved ? 'text-red-500' : 
                  isAdded ? (isDark ? 'text-cyan-400' : 'text-emerald-600') : 
                  isIssue ? 'text-amber-500' : 'text-jb-text-muted opacity-50'}`}
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
            style={isDark ? jetbrainsTheme : intellijLightTheme}
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
                style={isDark ? jetbrainsTheme : intellijLightTheme}
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
          className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none border-none caret-jb-accent overflow-auto text-transparent selection:bg-jb-accent/20 font-mono"
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