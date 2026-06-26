"use client"

import Image from "next/image";

import { useMounted } from "@/hooks/useMounted";
import { useIsDark } from "@/hooks/useIsDark";

export default function HorizonLogo({ glowing = false }: { glowing?: boolean }) {
  const mounted = useMounted();
  const isDark = useIsDark();

  return (
    // Completely stripped of all borders, backgrounds, shadows, and padding
    <div className="relative flex items-center justify-center w-10 h-10 transition-all duration-700">
      
      {mounted && (
        <Image 
          src={isDark ? "/logo-dark.png" : "/logo-light.png"} 
          alt="Horizon Logo" 
          width={40} 
          height={40} 
          className="object-contain" // Removed 'p-1' so it doesn't shrink inside the container
          priority
        />
      )}

      {/* Keeps only the soft background pulse during the 'analyzing' state, placed BEHIND the logo */}
      {glowing && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-cyan-400 rounded-full blur-[16px] opacity-30 -z-10 animate-pulse pointer-events-none"></div>
      )}
    </div>
  );
}