"use client"

import { Settings, User } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import HorizonLogo from "./HorizonLogo";
import { useAppContext } from "@/context/AppContext";

export default function Navbar() {
  const { appState } = useAppContext();

  return (
    <nav className="relative z-40 border-b theme-transition px-8 py-3.5 flex justify-between items-center shrink-0 h-[70px] bg-background/60 border-border backdrop-blur-2xl shadow-sm dark:shadow-none">
      <div className="flex items-center gap-5 group cursor-default">
        <HorizonLogo glowing={appState === "analyzing"} />
        <div className="flex flex-col">
          <h1 className="text-xl font-poppins font-bold tracking-tight flex items-center gap-2.5 transition-colors duration-700 text-foreground">
            Horizon AI 
            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ring-1 transition-colors duration-700 bg-cyan-500/10 text-cyan-600 ring-cyan-500/30 dark:text-cyan-400">Java</span>
          </h1>
          <p className="text-[10px] font-medium tracking-widest uppercase opacity-60 transition-colors duration-700 text-muted-foreground">Multi-Agent Refactoring Studio</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="w-px h-6 transition-colors duration-700 bg-border"></div>
        <button className="p-2.5 rounded-full transition-all duration-300 ring-1 hover:bg-zinc-100 hover:scale-105 active:scale-95 ring-zinc-200 text-zinc-500 hover:text-zinc-900 dark:hover:bg-white/5 dark:ring-white/5 dark:text-gray-400 dark:hover:text-white cursor-pointer">
          <Settings size={16} />
        </button>
        <div className="w-10 h-10 ml-2 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 p-[2px] cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.2)] hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all hover:scale-105 active:scale-95">
          <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden transition-colors duration-700 bg-background">
            <User size={16} className="text-cyan-600 dark:text-gray-300" />
          </div>
        </div>
      </div>
    </nav>
  );
}
