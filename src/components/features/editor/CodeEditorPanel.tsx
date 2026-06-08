"use client"

import { useRef, useEffect, useState, useMemo } from "react";
import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from "framer-motion";
import { formatJavaCode } from "@/lib/utils/javaFormatter";

const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then((mod) => mod.Prism),
  { ssr: false }
);

type ThemeStyle = Record<string, React.CSSProperties>;

const sanitizeTheme = (theme: ThemeStyle): ThemeStyle => {
  const cleanTheme = JSON.parse(JSON.stringify(theme)) as ThemeStyle;
  for (const key of Object.keys(cleanTheme)) {
    const style = cleanTheme[key] as Record<string, string | undefined>;
    if (style.background) {
      style.backgroundColor = style.background;
      delete style.background;
    }
  }
  return cleanTheme;
};

const baseTheme = sanitizeTheme(oneDark);
if (baseTheme['pre[class*="language-"]']) baseTheme['pre[class*="language-"]'].backgroundColor = 'transparent';
if (baseTheme['code[class*="language-"]']) baseTheme['code[class*="language-"]'].backgroundColor = 'transparent';

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
if (safeLightTheme['pre[class*="language-"]']) safeLightTheme['pre[class*="language-"]'].backgroundColor = 'transparent';
if (safeLightTheme['code[class*="language-"]']) safeLightTheme['code[class*="language-"]'].backgroundColor = 'transparent';

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
  const bgRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [internalIsFocused, setInternalIsFocused] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : true;

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
    if (bgRef.current) bgRef.current.scrollTop = scrollTop;

    setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1000);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const formattedText = formatJavaCode(pastedText);

    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newValue = text.substring(0, start) + formattedText + text.substring(end);
      onChange(newValue);

      // Reposition cursor after the inserted text (in next tick)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + formattedText.length;
      }, 0);
    }
  };

  const lines = useMemo(() => value.split('\n'), [value]);

  const syntaxCustomStyle = useMemo<CSSProperties>(() => ({ 
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
    boxSizing: 'border-box',
    minWidth: 'max-content'
  }), [bottomPadding]);

  const codeTagStyle = useMemo<CSSProperties>(() => ({
    fontFamily: 'var(--font-fira-code), monospace', 
    fontSize: '13px', 
    lineHeight: '24px', 
    tabSize: 4,
    backgroundColor: "transparent", 
    letterSpacing: 'normal', 
    wordSpacing: 'normal', 
    fontWeight: 'normal', 
    fontVariantLigatures: 'none',
    minWidth: 'max-content',
    display: 'inline-block'
  }), []);

  const textareaStyle = useMemo<CSSProperties>(() => ({ 
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
  }), [bottomPadding]);

  if (!mounted) return null;

  return (
    <div 
      className="relative flex-1 flex min-h-0 font-mono text-[13.5px] overflow-hidden bg-jb-panel border-jb-border transition-colors duration-300"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      
      {/* 1. BACKGROUND LAYER */}
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
              if (isRemoved) return { backgroundColor: isDark ? 'rgba(249, 62, 62, 0.2)' : '#fef2f2' };
              if (isAdded) return { backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : '#ecfdf5' };
              if (isIssue) return { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb' };
              return { backgroundColor: 'transparent' };
            };

            return <div key={i} className="h-[24px] w-full" style={getBgStyle()} />;
          })}
        </div>
      </div>

      {/* 2. GUTTER LAYER */}
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

      {/* 3. CODE LAYER */}
      <div className="relative flex-1 overflow-hidden h-full z-10 no-transition">
        <div ref={preRef} className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {/* Main Content Layer */}
          <SyntaxHighlighter
            language="java"
            style={isDark ? jetbrainsTheme : intellijLightTheme}
            wrapLines={false}
            customStyle={syntaxCustomStyle}
            codeTagProps={{ style: codeTagStyle }}
          >
            {value || ' '}
          </SyntaxHighlighter>

          {/* Ghost Preview Layer */}
          {!!ghostValue && !value && (
            <div className="absolute inset-0 opacity-30 pointer-events-none">
              <SyntaxHighlighter
                language="java"
                style={isDark ? jetbrainsTheme : intellijLightTheme}
                wrapLines={false}
                customStyle={syntaxCustomStyle}
                codeTagProps={{ style: codeTagStyle }}
              >
                {ghostValue}
              </SyntaxHighlighter>
            </div>
          )}

          {/* Premium Tab-to-Paste Hint */}
          <AnimatePresence>
            {!!ghostValue && !value && internalIsFocused && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
              >
                <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300
                  ${isDark 
                    ? 'bg-jb-bg/40 border-white/10 ring-1 ring-white/[0.05]' 
                    : 'bg-white/60 border-slate-200/50 shadow-slate-200/50 ring-1 ring-black/[0.02]'
                  }`}
                >
                  <div className={`flex items-center gap-2 text-[12px] font-semibold tracking-tight
                    ${isDark ? 'text-jb-text' : 'text-slate-900'}`}
                  >
                    <span className="opacity-70">Press</span>
                    <kbd className={`inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md border font-sans text-[11px] font-bold shadow-sm transition-all
                      ${isDark 
                        ? 'bg-[#3e4045] border-[#4e5157] text-jb-text border-b-[2.5px]' 
                        : 'bg-[#f7f8fa] border-[#d1d1d1] text-[#080808] border-b-[2.5px]'
                      }`}
                    >
                      Tab
                    </kbd>
                    <span className="opacity-70">to paste copied code</span>
                  </div>
                  
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse
                    ${isDark ? 'bg-jb-accent' : 'bg-[#3574f0]'}`} 
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          onFocus={() => {
            setInternalIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setInternalIsFocused(false);
            onBlur?.();
          }}
          spellCheck="false"
          placeholder={placeholder}
          className={`absolute inset-0 w-full h-full bg-transparent resize-none outline-none border-none caret-jb-accent overflow-auto text-transparent selection:bg-jb-accent/20 font-mono custom-chat-scrollbar ${isScrolling ? 'is-scrolling' : ''}`}
          style={textareaStyle}
        />
      </div>
    </div>
  );
}
