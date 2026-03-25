"use client"

import { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FileCode2, Command, Square, Sparkles } from "lucide-react";
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
      <div className={`flex-1 flex flex-col min-h-0 rounded-2xl border overflow-hidden shadow-2xl relative transition-all duration-300
        ${sourceError 
          ? 'bg-red-500/5 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
          : 'bg-jb-panel border-jb-border'
        }`}>
        
        {/* IDE HEADER */}
        <div className="px-5 flex items-center justify-between border-b h-[48px] shrink-0 relative z-20 bg-jb-bg border-jb-border transition-colors duration-300">
          
          {/* Mac Traffic Lights */}
          <div className="flex items-center gap-2">
            <div 
              className={`w-3 h-3 rounded-full bg-[#ff5f56] ${appState === 'analyzing' ? 'animate-traffic-pulse' : ''}`}
            ></div>
            <div 
              className={`w-3 h-3 rounded-full bg-[#ffbd2e] ${appState === 'analyzing' ? 'animate-traffic-pulse' : ''}`}
            ></div>
            <div 
              className={`w-3 h-3 rounded-full bg-[#27c93f] ${appState === 'analyzing' ? 'animate-traffic-pulse' : ''}`}
            ></div>
          </div>
          
          {/* Right Aligned Badges */}
          <div className="flex items-center gap-3">
            <div className={`text-[10px] font-bold px-3 py-1 rounded-full border shadow-sm flex items-center gap-1 bg-jb-accent/10 text-jb-accent border-jb-accent/30`}>
              <span className="text-jb-accent">#</span> {lineCount} {lineCount === 1 ? 'LINE' : 'LINES'}
            </div>
            <span className="text-[11px] font-mono font-bold tracking-widest text-jb-text opacity-80 uppercase transition-colors">
              Input.java
            </span>
          </div>
        </div>
        
        {/* Editor Area */}
        <div className="flex-1 min-h-0 flex flex-col relative z-10">
          {sourceCode.trim() === '' && !(isEditorFocused && clipboardPreview) && (
            <div className="absolute top-0 right-0 bottom-0 left-14 flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10">
              <div className="flex items-center justify-center w-[88px] h-[88px] rounded-[32px] mb-6 shadow-2xl bg-background ring-1 ring-border">
                <FileCode2 size={36} className="text-cyan-500/60" strokeWidth={1.5} />
              </div>
              <p className="text-[15px] font-semibold text-foreground">
                Paste your Java code snippet
              </p>
              <p className="text-[13px] mt-2 font-medium max-w-sm text-muted-foreground">
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
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-md">
                <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-wider">Tip</span>
                <span className="text-[11px] font-medium text-cyan-500/80">Press <kbd className="font-sans px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/5 text-[10px]">Tab</kbd> to paste copied code</span>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}