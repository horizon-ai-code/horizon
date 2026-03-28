"use client"

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Menu, FolderTree, Search, GitBranch, Play, LayoutGrid, Settings2 } from "lucide-react";

export default function Sidebar() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <div className={`w-[48px] shrink-0 border-r flex flex-col items-center z-20 transition-all duration-300
      ${isDark ? 'border-jb-border/40 bg-jb-panel' : 'border-[#ebecf0] bg-[#f7f8fa]'}`}>
      
      {/* Top Menu Icon Corner - Aligns with Navbar Height */}
      <div className={`h-[44px] w-full flex items-center justify-center shrink-0 border-b transition-colors duration-300
        ${isDark ? 'border-jb-border/30' : 'border-[#ebecf0]'}`}>
        <button className={`p-2 rounded-md transition-colors cursor-default
          ${isDark ? 'text-jb-text opacity-80 hover:bg-jb-panel hover:opacity-100' : 'text-[#080808] opacity-70 hover:bg-[#ebecf0] hover:opacity-100'}`}>
          <Menu size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Activity Bar Icons */}
      <div className="flex flex-col items-center py-4 gap-6 w-full">
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><FolderTree size={20} strokeWidth={1.5} /></button>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><Search size={20} strokeWidth={1.5} /></button>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><GitBranch size={20} strokeWidth={1.5} /></button>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><Play size={20} strokeWidth={1.5} /></button>
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><LayoutGrid size={20} strokeWidth={1.5} /></button>
        <div className="flex-1" />
        <button className={`transition-colors ${isDark ? 'text-jb-text opacity-50 hover:opacity-100 hover:text-jb-accent' : 'text-[#818594] hover:text-[#3574f0]'}`}><Settings2 size={20} strokeWidth={1.5} /></button>
      </div>
    </div>
  );
}
