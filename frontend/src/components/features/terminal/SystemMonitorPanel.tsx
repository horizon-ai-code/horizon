"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SystemMetricsPayload } from "@/types/websocket";
import { CpuIcon, MemoryIcon, GpuIcon, VramIcon } from "@/components/ui/SystemIcons";

// ── Props ──────────────────────────────────────────────────────────────────

interface SystemMonitorPanelProps {
  samples: SystemMetricsPayload[];
  systemMetrics: SystemMetricsPayload;
  connected: boolean;
  isDark: boolean;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ── Sparkline ──────────────────────────────────────────────────────────────

const GRAPH_W = 120;
const GRAPH_H = 40;

interface SparklineProps {
  values: number[];
  color: string;
}

function Sparkline({ values, color }: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * GRAPH_W;
      const y = GRAPH_H - ((v - min) / range) * GRAPH_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const avgY = GRAPH_H - ((avg - min) / range) * GRAPH_H;

  return (
    <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} className="w-full h-10 overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="0" y1={avgY} x2={GRAPH_W} y2={avgY}
        stroke={color}
        strokeWidth="0.5"
        strokeDasharray="2 2"
        opacity="0.5"
      />
    </svg>
  );
}

// ── Metric Card ────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  unit?: string;
  color: string;
  subtext1?: string;
  subtext2?: string;
  values: number[];
  isDark: boolean;
}

function MetricCard({ icon: Icon, label, value, unit, color, subtext1, subtext2, values, isDark }: MetricCardProps) {
  const displayValue = unit
    ? `${value}${unit}`
    : `${Math.round(value)}%`;

  return (
    <div
      className={`flex flex-col p-4 rounded-lg border min-w-[160px] flex-1 ${
        isDark ? "bg-jb-panel border-jb-border" : "bg-white border-[#dfdfdf]"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <span style={{ color }}>
          <Icon size={18} className="" />
        </span>
        <span className="text-[11px] font-bold tracking-wide" style={{ color }}>
          {label}
        </span>
      </div>

      {values.length >= 2 ? (
        <Sparkline values={values} color={color} />
      ) : values.length > 0 ? (
        <div className="h-10 flex items-center justify-center text-[10px] text-jb-text-muted">
          Collecting...
        </div>
      ) : null}

      {values.length === 0 && <div className="h-10" />}

      <div className="text-[28px] font-bold mt-1 leading-tight" style={{ color }}>
        {displayValue}
      </div>

      {subtext1 && (
        <span className="text-[10px] text-jb-text-muted mt-0.5">{subtext1}</span>
      )}
      {subtext2 && (
        <span className="text-[10px] text-jb-text-muted">{subtext2}</span>
      )}
    </div>
  );
}

// ── Uptime Card ────────────────────────────────────────────────────────────

interface UptimeCardProps {
  elapsedSeconds: number;
  isDark: boolean;
}

function UptimeCard({ elapsedSeconds, isDark }: UptimeCardProps) {
  const [localElapsed, setLocalElapsed] = useState(elapsedSeconds);

  useEffect(() => {
    if (Math.abs(elapsedSeconds - localElapsed) > 3) {
      setLocalElapsed(elapsedSeconds); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [elapsedSeconds, localElapsed]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex flex-col p-4 rounded-lg border min-w-[160px] flex-1 ${
        isDark ? "bg-jb-panel border-jb-border" : "bg-white border-[#dfdfdf]"
      }`}
    >
      <span className="text-[11px] font-bold tracking-wide mb-3" style={{ color: "#a78bfa" }}>
        UPTIME
      </span>
      <div className="text-[28px] font-bold font-mono my-2" style={{ color: "#a78bfa" }}>
        {formatElapsed(localElapsed)}
      </div>
      <span className="text-[10px] text-jb-text-muted">Server since boot</span>
    </div>
  );
}

// ── Metric Grid ────────────────────────────────────────────────────────────

interface MetricGridProps {
  samples: SystemMetricsPayload[];
  systemMetrics: SystemMetricsPayload;
  isDark: boolean;
}

function MetricGrid({ samples, systemMetrics, isDark }: MetricGridProps) {
  const cpuValues = samples.map((s) => s.cpu_percent);
  const memValues = samples.map((s) => s.memory_percent);

  const peakCpu = Math.round(Math.max(...cpuValues));
  const peakMem = Math.round(Math.max(...memValues));

  const cards: React.ReactNode[] = [
    <MetricCard
      key="cpu"
      icon={CpuIcon}
      label="CPU"
      value={Math.round(systemMetrics.cpu_percent)}
      color="#e09c3b"
      subtext1={`Peak: ${peakCpu}%`}
      subtext2={`${systemMetrics.memory_used_gb} / ${systemMetrics.memory_total_gb} GB`}
      values={cpuValues}
      isDark={isDark}
    />,
    <MetricCard
      key="mem"
      icon={MemoryIcon}
      label="RAM"
      value={Math.round(systemMetrics.memory_percent)}
      color="#4ec97e"
      subtext1={`Peak: ${peakMem}%`}
      subtext2={`${systemMetrics.memory_used_gb} / ${systemMetrics.memory_total_gb} GB`}
      values={memValues}
      isDark={isDark}
    />,
  ];

  if (systemMetrics.has_gpu) {
    const gpuValues = samples.map((s) => s.gpu_utilization);
    const vramValues = samples.map((s) => s.gpu_memory_percent);
    const peakGpu = Math.round(Math.max(...gpuValues));
    const peakVram = Math.round(Math.max(...vramValues));

    cards.push(
      <MetricCard
        key="gpu"
        icon={GpuIcon}
        label="GPU"
        value={Math.round(systemMetrics.gpu_utilization)}
        color="#5a8cf8"
        subtext1={`Peak: ${peakGpu}%`}
        values={gpuValues}
        isDark={isDark}
      />,
      <MetricCard
        key="vram"
        icon={VramIcon}
        label="VRAM"
        value={Math.round(systemMetrics.gpu_memory_percent)}
        color="#3dd6c8"
        subtext1={`Peak: ${peakVram}%`}
        subtext2={`${systemMetrics.gpu_memory_used_gb} / ${systemMetrics.gpu_memory_total_gb} GB`}
        values={vramValues}
        isDark={isDark}
      />,
    );
  }

  cards.push(
    <UptimeCard key="uptime" elapsedSeconds={systemMetrics.elapsed_seconds} isDark={isDark} />
  );

  return (
    <div className="flex flex-row gap-4 overflow-x-auto pb-2">
      {cards}
    </div>
  );
}

// ── States ─────────────────────────────────────────────────────────────────

function DisconnectedCard() {
  return (
    <div className="flex items-center gap-2 text-[12px] text-red-500 font-medium">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      Disconnected — waiting for server...
    </div>
  );
}

function WaitingCard() {
  return (
    <div className="flex items-center gap-2 text-[12px] text-jb-text-muted font-medium">
      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      Connected — collecting data...
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SystemMonitorPanel({
  samples,
  systemMetrics,
  connected,
  isDark,
  onClose,
}: SystemMonitorPanelProps) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [handleEsc]);

  return (
    <div className="relative" style={{ zIndex: 100 }}>
      <div
        className="fixed inset-0 cursor-default"
        onClick={onClose}
        style={{ zIndex: 99 }}
      />

      <AnimatePresence>
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          className={`absolute top-0 left-0 right-0 overflow-hidden border-b shadow-xl ${
            isDark ? "bg-jb-panel border-jb-border" : "bg-white border-[#dfdfdf]"
          }`}
          style={{ zIndex: 100 }}
        >
          <div className="px-6 py-5">
            {!connected && <DisconnectedCard />}
            {connected && !systemMetrics && <WaitingCard />}
            {connected && systemMetrics && (
              <MetricGrid
                samples={samples}
                systemMetrics={systemMetrics}
                isDark={isDark}
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
