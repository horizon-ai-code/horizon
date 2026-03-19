"use client"

import React, { useState, useEffect } from 'react';
import { useTheme } from "next-themes";
import { TrendingDown, Sparkles, Layers, CheckCircle } from 'lucide-react';

export default function InsightsPanel() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const metrics = [
    { title: "Time Complexity", value: "O(N²) → O(N)", icon: TrendingDown, color: isDark ? "text-cyan-400" : "text-cyan-600", bg: isDark ? "bg-cyan-500/10" : "bg-cyan-50", border: isDark ? "border-cyan-500/20" : "border-cyan-200" },
    { title: "Readability", value: "Low → High", icon: Sparkles, color: isDark ? "text-purple-400" : "text-purple-600", bg: isDark ? "bg-purple-500/10" : "bg-purple-50", border: isDark ? "border-purple-500/20" : "border-purple-200" },
    { title: "Variables Managed", value: "2 → 1", icon: Layers, color: isDark ? "text-orange-400" : "text-orange-600", bg: isDark ? "bg-orange-500/10" : "bg-orange-50", border: isDark ? "border-orange-500/20" : "border-orange-200" },
    { title: "Syntax Check", value: "Valid", icon: CheckCircle, color: isDark ? "text-green-400" : "text-green-600", bg: isDark ? "bg-green-500/10" : "bg-green-50", border: isDark ? "border-green-500/20" : "border-green-200" }
  ];

  if (!mounted) return null;

  return (
    <div className="h-full p-6 animate-in fade-in duration-500 overflow-y-auto">
      <h3 className={`text-sm font-semibold mb-6 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
        <Sparkles size={16} className={isDark ? "text-cyan-400" : "text-cyan-600"} /> Target Segment Insights
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className={`p-4 rounded-[16px] border ${m.border} ${m.bg} flex flex-col gap-3 group hover:scale-[1.02] transition-transform duration-300`}>
            <div className={`p-2.5 w-max rounded-[12px] border ${m.border} ${m.color} ${isDark ? 'bg-[#18181b]' : 'bg-white'} shadow-sm group-hover:scale-110 transition-transform`}>
              <m.icon size={18} />
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>{m.title}</p>
              <p className={`text-[16px] font-bold ${isDark ? 'text-gray-200' : 'text-slate-900'}`}>{m.value}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className={`mt-6 p-4 rounded-[16px] border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
         <h4 className={`text-[12px] font-bold mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Summary</h4>
         <p className={`text-[13px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
            The multi-agent swarm successfully reduced time complexity by optimizing the original nested loop structure into a linear scan using a HashSet. Space complexity increased to O(N) as a tradeoff, which the Consensus Judge determined acceptable for modern memory constraints natively observed in Next.js backend/frontend architectures.
         </p>
      </div>
    </div>
  );
}
