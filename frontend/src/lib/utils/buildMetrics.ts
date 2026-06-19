import type { InsightMetric } from "@/types/insights";
import type { PerformanceMetrics } from "@/types/websocket";

export function buildMetrics(
  original_complexity: number | null,
  refactored_complexity: number | null,
  performance?: PerformanceMetrics
): InsightMetric[] {
  const metrics: InsightMetric[] = [];

  if (refactored_complexity !== null) {
    metrics.push({
      title: "Cyclomatic Complexity",
      before: original_complexity !== null ? `${original_complexity}` : "—",
      after: `${refactored_complexity}`,
      direction:
        original_complexity !== null
          ? refactored_complexity < original_complexity
            ? "down" as const
            : refactored_complexity > original_complexity
              ? "up" as const
              : "neutral" as const
          : "neutral" as const,
      iconKey: "CheckCircle",
    });
  }

  if (performance) {
    const memUsed = performance.avg_gpu_memory_used ?? 0;
    const memPercent = performance.avg_gpu_memory ?? 0;
    const gpuUtil = performance.avg_gpu_utilization ?? 0;
    const peakUtil = performance.peak_gpu_utilization ?? 0;
    const peakMemUsed = performance.peak_gpu_memory_used ?? 0;
    const infTime = performance.inference_time ?? 0;

    metrics.push({
      title: "Inference Time",
      before: "—",
      after: `${infTime}s`,
      direction: "neutral" as const,
      iconKey: "Clock",
    });

    metrics.push({
      title: "GPU Utilization",
      before: `${gpuUtil}%`,
      after: `${peakUtil}%`,
      direction: "neutral" as const,
      iconKey: "Cpu",
    });

    metrics.push({
      title: "GPU Memory",
      before: `${(memUsed / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      after: `${(peakMemUsed / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      direction: "neutral" as const,
      iconKey: "Layers",
    });
  }

  return metrics;
}
