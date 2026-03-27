"use client"

import { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FileCode2, Command, Square, Sparkles, X } from "lucide-react";
import CodeEditorPanel from "@/components/feature/CodeEditorPanel";
import { useAppContext } from "@/context/AppContext";

interface InputProps {
  sourceCode: string;
  setSourceCode: (val: string) => void;
  sourceError: boolean;
  setSourceError: (val: boolean) => void;
}

export default function Input({
  sourceCode,
  setSourceCode,
  sourceError,
  setSourceError,
}: InputProps) {
  const { appState } = useAppContext();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [clipboardPreview, setClipboardPreview] = useState("");

  useEffect(() => {
    setMounted(true);
    
    // Function to check clipboard
    const checkClipboard = async () => {
      try {
        if (!document.hasFocus()) return;
        
        const text = await navigator.clipboard.readText();
        const trimmedText = text.trim();
        
        // Only show preview if there's new text that isn't already in the editor
        if (trimmedText.length > 0 && trimmedText !== sourceCode.trim()) {
          setClipboardPreview(text);
        } else {
          setClipboardPreview("");
        }
      } catch (err) {
        console.debug("Clipboard access denied or unavailable:", err);
      }
    };

    // Check on focus and clicks (reliable triggers for user returning to app)
    window.addEventListener('focus', checkClipboard);
    window.addEventListener('pointerdown', checkClipboard);
    
    // Initial check
    checkClipboard();

    return () => {
      window.removeEventListener('focus', checkClipboard);
      window.removeEventListener('pointerdown', checkClipboard);
    };
  }, [sourceCode]);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const lineCount = sourceCode ? sourceCode.split('\n').length : 0;

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && clipboardPreview) {
      e.preventDefault();
      setSourceCode(clipboardPreview);
      setClipboardPreview("");
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full min-h-0 animate-meet-left relative">
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative transition-all duration-300
        ${sourceError 
          ? 'bg-red-500/5 shadow-[inset_0_0_40px_rgba(239,68,68,0.15)] ring-1 ring-inset ring-red-500/50'
          : 'bg-jb-panel'
        }`}>
        
        {/* IDE HEADER */}
        <div className={`px-2 flex items-center justify-between border-b h-[40px] shrink-0 relative z-20 transition-colors duration-300
          ${isDark ? 'bg-jb-bg border-jb-border' : 'bg-[#f7f8fa] border-[#ebecf0]'}`}>
          
          <div className="flex items-center h-full pt-1.5 pb-1 gap-1">
            <div className={`flex items-center gap-2 h-full px-3 rounded-md text-[12px] font-medium border shadow-sm cursor-default transition-colors duration-300
              ${isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50' : 'bg-white text-[#080808] border-[#dfdfdf]'}`}>
              Input.java
              <button className={`opacity-0 hover:opacity-100 p-0.5 rounded transition-all ml-1 w-4 h-4 flex items-center justify-center
                ${isDark ? 'hover:bg-jb-border' : 'hover:bg-[#ebecf0]'}`}>
                 <X size={10} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3 pr-2">
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded border shadow-sm flex items-center gap-1 transition-colors duration-300
              ${isDark ? 'bg-jb-accent/10 text-jb-accent border-jb-accent/30' : 'bg-[#3574f0]/10 text-[#3574f0] border-[#3574f0]/20'}`}>
              <span className={isDark ? "text-jb-accent" : "text-[#3574f0]"}>#</span> {lineCount} {lineCount === 1 ? 'LINE' : 'LINES'}
            </div>
          </div>
        </div>
        
        {/* Editor Area */}
        <div className="flex-1 min-h-0 flex flex-col relative z-10">
          {sourceCode.trim() === '' && !(isEditorFocused && clipboardPreview) && (
            <div className="absolute top-0 right-0 bottom-0 left-14 flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10 transition-colors duration-300">
              <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[32px] mb-6 shadow-2xl ring-1 transition-all duration-300
                ${isDark ? 'bg-jb-bg ring-jb-border' : 'bg-[#f7f8fa] ring-[#ebecf0]'}`}>
                <FileCode2 size={36} className={isDark ? "text-[#548af7]/60" : "text-[#3574f0]/60"} strokeWidth={1.5} />
              </div>
              <p className={`text-[15px] font-semibold transition-colors ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
                Paste your Java code snippet
              </p>
              <p className={`text-[13px] mt-2 font-medium max-w-sm transition-colors ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
                Best for loops, functions, and logic blocks. No class/package declarations needed.
              </p>
            </div>
          )}
          <CodeEditorPanel 
            value={sourceCode} 
            onChange={(val) => {
              setSourceCode(val);
              if (sourceError) setSourceError(false);
              // Clear preview if user starts typing
              if (clipboardPreview) setClipboardPreview("");
            }} 
            onKeyDown={handleEditorKeyDown}
            onFocus={() => setIsEditorFocused(true)}
            onBlur={() => setIsEditorFocused(false)}
            ghostValue={isEditorFocused ? clipboardPreview : ""}
            highlightLines={{ removed: [1, 2, 3, 4, 5, 6] }} 
            showDiff={appState === 'done'}
            placeholder="" 
            bottomPadding="240px"
          />
          
          {/* Ghost Text Hint */}
          {isEditorFocused && clipboardPreview && !sourceCode && (
            <div className="absolute bottom-4 left-14 z-20 pointer-events-none animate-pulse">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all duration-300
                ${isDark ? 'bg-jb-accent/10 border-jb-accent/20' : 'bg-[#3574f0]/5 border-[#3574f0]/15'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-jb-accent' : 'text-[#3574f0]'}`}>Tip</span>
                <span className={`text-[11px] font-medium ${isDark ? 'text-jb-accent/80' : 'text-[#3574f0]/80'}`}>Press <kbd className={`font-sans px-1.5 py-0.5 rounded border ${isDark ? 'border-jb-accent/30 bg-jb-accent/5' : 'border-[#3574f0]/20 bg-[#3574f0]/5'} text-[10px]`}>Tab</kbd> to paste copied code</span>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}