"use client"

import React, { useState, useEffect } from 'react';
import { useTheme } from "next-themes";
import { Sparkles, Layers, CheckCircle, TrendingUp, TrendingDown, Clock, Cpu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InsightMetric } from '@/types/insights';

interface InsightsPanelProps {
  metrics: InsightMetric[];
  summary: string;
}

const metricIconMap: Record<string, LucideIcon> = {
  Sparkles,
  Layers,
  CheckCircle,
  Clock,
  Cpu,
};

export default function InsightsPanel({ metrics, summary }: InsightsPanelProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

  if (metrics.length === 0 && !summary.trim()) {
    return (
      <div className="h-full p-6 animate-in fade-in duration-500 overflow-y-auto flex items-center justify-center">
        <p className={`text-[13px] font-medium ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>
          No insights available for this run.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full p-6 animate-in fade-in duration-500 overflow-y-auto">
      <h3 className={`text-sm font-semibold mb-6 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
        <Sparkles size={16} className={isDark ? "text-cyan-400" : "text-cyan-600"} /> Target Segment Insights
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m, i) => (
          (() => {
            const displayTitle = m.title;
            const MetricIcon = (m.iconKey && metricIconMap[m.iconKey]) || Sparkles;
            const isIncrease = m.direction === 'up';
            const isDecrease = m.direction === 'down';
            
            const isComplexity = displayTitle === 'Cyclomatic Complexity';
            
            // Custom colors for each card
            const getCardTheme = () => {
              if (displayTitle === 'Cyclomatic Complexity') return { 
                base: 'blue', 
                color: isDark ? 'text-blue-400' : 'text-blue-600',
                bg: isDark ? 'bg-blue-500/10' : 'bg-blue-500/5',
                border: isDark ? 'border-blue-500/20' : 'border-blue-500/10'
              };
              if (displayTitle === 'Inference Time') return { 
                base: 'amber', 
                color: isDark ? 'text-amber-400' : 'text-amber-600',
                bg: isDark ? 'bg-amber-500/10' : 'bg-amber-500/5',
                border: isDark ? 'border-amber-500/20' : 'border-amber-500/10'
              };
              if (displayTitle === 'Avg GPU Utilization') return { 
                base: 'purple', 
                color: isDark ? 'text-purple-400' : 'text-purple-600',
                bg: isDark ? 'bg-purple-500/10' : 'bg-purple-500/5',
                border: isDark ? 'border-purple-500/20' : 'border-purple-500/10'
              };
              if (displayTitle === 'Avg GPU Memory') return { 
                base: 'cyan', 
                color: isDark ? 'text-cyan-400' : 'text-cyan-600',
                bg: isDark ? 'bg-cyan-500/10' : 'bg-cyan-500/5',
                border: isDark ? 'border-cyan-500/20' : 'border-cyan-500/10'
              };
              
              // Fallback dynamic colors
              return {
                base: 'emerald',
                color: isIncrease ? (isDark ? 'text-green-400' : 'text-green-600') : (isDecrease ? (isDark ? 'text-red-400' : 'text-red-600') : (isDark ? 'text-blue-400' : 'text-blue-600')),
                bg: isIncrease ? (isDark ? 'bg-green-500/10' : 'bg-green-500/5') : (isDecrease ? (isDark ? 'bg-red-500/10' : 'bg-red-500/5') : (isDark ? 'bg-blue-500/10' : 'bg-blue-500/5')),
                border: isIncrease ? (isDark ? 'border-green-500/20' : 'border-green-500/10') : (isDecrease ? (isDark ? 'border-red-500/20' : 'border-red-500/10') : (isDark ? 'border-blue-500/20' : 'border-blue-500/10'))
              };
            };

            const theme = getCardTheme();

            return (
              <div key={`${m.title}-${i}`} className={`p-4 rounded-[16px] border ${theme.border} ${theme.bg} flex flex-col gap-3 group hover:scale-[1.02] transition-transform duration-300`}>
                <div className={`p-2.5 w-max rounded-[12px] border ${theme.border} ${theme.color} bg-background shadow-sm group-hover:scale-110 transition-transform flex items-center gap-2`}>
                  <MetricIcon size={18} />
                  {!isComplexity && (isIncrease ? <TrendingUp size={14} /> : isDecrease ? <TrendingDown size={14} /> : null)}
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>{displayTitle}</p>
                  <div className="flex items-baseline gap-2">
                    <p className={`text-[16px] font-bold ${isDark ? 'text-gray-200' : 'text-slate-900'}`}>
                      {isComplexity && m.before && m.before !== '—' ? `${m.before} → ${m.after}` : m.after}
                    </p>
                    {!isComplexity && m.before && m.before !== '—' && (
                      <p className={`text-[12px] font-medium line-through opacity-50 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        {m.before}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        ))}
      </div>

      {summary.trim() && (
        <div className="mt-6 p-4 rounded-[16px] border border-border bg-secondary/30">
           <h4 className={`text-[12px] font-bold mb-2 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Summary</h4>
           <p className={`text-[13px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              {summary}
           </p>
        </div>
      )}
    </div>
  );
}
