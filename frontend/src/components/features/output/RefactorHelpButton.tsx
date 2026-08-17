import React, { useState } from 'react';

interface RefactorHelpButtonProps {
  isDark: boolean;
}

export default function RefactorHelpButton({ isDark }: RefactorHelpButtonProps) {
  const [showIssueMsg, setShowIssueMsg] = useState(false);

  return (
    <div className="flex items-center mr-2 relative group">
      <span className={`absolute right-full mr-3 whitespace-nowrap text-[12px] font-medium transition-all duration-300 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
        Refactoring takes too long?
      </span>
      <div className="relative">
        <button
          onClick={() => setShowIssueMsg(!showIssueMsg)}
          className={`w-6 h-6 flex items-center justify-center rounded-md border text-[12px] font-bold cursor-pointer transition-all animate-pulse
            ${isDark ? 'border-yellow-500/50 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'border-amber-500/50 text-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.4)]'}`}
          title="Help"
        >
          ?
        </button>
        {showIssueMsg && (
          <div className={`absolute top-full right-0 mt-2 p-3 w-[250px] rounded-md shadow-xl border text-[12px] leading-relaxed z-50
            ${isDark ? 'bg-jb-bg border-jb-border text-yellow-400/90' : 'bg-white border-[#dfdfdf] text-amber-600'}`}>
            The refactoring takes too long because of some issues
          </div>
        )}
      </div>
    </div>
  );
}
