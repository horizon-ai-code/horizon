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
          : refactored_complexity <= 5
            ? "down" as const
            : "up" as const,
      iconKey: "CheckCircle",
    });
  }

  if (performance) {
    const memUsed = performance.avg_gpu_memory_used ?? 0;
    const memPercent = performance.avg_gpu_memory ?? 0;
    const gpuUtil = performance.avg_gpu_utilization ?? 0;
    const infTime = performance.inference_time ?? 0;

    metrics.push({
      title: "Inference Time",
      before: "—",
      after: `${infTime}s`,
      direction: "neutral" as const,
      iconKey: "Clock",
    });

    metrics.push({
      title: "Avg GPU Utilization",
      before: "—",
      after: `${gpuUtil}%`,
      direction: "neutral" as const,
      iconKey: "Cpu",
    });

    metrics.push({
      title: "Avg GPU Memory",
      before: "—",
      after: `${(memUsed / (1024 * 1024 * 1024)).toFixed(2)} GB (${memPercent}%)`,
      direction: "neutral" as const,
      iconKey: "Layers",
    });
  }

  return metrics;
}
