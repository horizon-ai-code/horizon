"use client"

import { Settings, User } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import HorizonLogo from "./HorizonLogo";
import { useAppContext } from "@/context/AppContext";

export default function Navbar() {
  const { appState } = useAppContext();

  return (
    <nav className="relative z-40 border-b px-8 py-3.5 flex justify-between items-center shrink-0 h-[70px] bg-background/60 border-border backdrop-blur-2xl shadow-sm">
      <div className="flex items-center gap-5 group cursor-default">
        <HorizonLogo glowing={appState === "analyzing"} />
        <div className="flex flex-col">
          <h1 className="text-xl font-poppins font-bold tracking-tight flex items-center gap-2.5 text-foreground">
            Horizon AI 
            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ring-1 bg-cyan-500/5 text-cyan-600 ring-cyan-500/20">Java</span>
          </h1>
          <p className="text-[10px] font-medium tracking-widest uppercase opacity-60 text-muted-foreground">Multi-Agent Refactoring Studio</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="w-px h-6 bg-border"></div>
        <button className="p-2.5 rounded-full transition-transform ring-1 hover:bg-accent hover:scale-105 active:scale-95 ring-border text-muted-foreground hover:text-foreground cursor-pointer">
          <Settings size={16} />
        </button>
        <div className="w-10 h-10 ml-2 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 p-[2px] cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.2)] hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-transform hover:scale-105 active:scale-95">
          <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden bg-background">
            <User size={16} className="text-primary-foreground/90" />
          </div>
        </div>
      </div>
    </nav>
  );
}
