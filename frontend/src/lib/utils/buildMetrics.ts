import type { InsightMetric } from "@/types/insights";
import type { PerformanceMetrics } from "@/types/websocket";

function complexityInterpretation(before: number | null, after: number): string {
  if (before === null) {
    return `Baseline set at ${after} — monitor going forward.`;
  }
  if (before === after) {
    return "Complexity stayed the same — the refactoring didn't make the code harder to follow.";
  }
  const change = ((after - before) / before) * 100;
  const absChange = Math.abs(change);
  if (change < 0) {
    if (absChange >= 50) {
      return "Complexity was cut by more than half — the refactored code is much simpler to maintain.";
    }
    if (absChange >= 20) {
      return `Complexity dropped around ${absChange.toFixed(0)}% — the new structure is noticeably cleaner than the original.`;
    }
    return "Complexity edged down slightly — a small step toward cleaner code.";
  }
  if (absChange >= 50) {
    return "Complexity more than doubled — worth reviewing whether the new approach added unnecessary branching.";
  }
  if (absChange >= 20) {
    return `Complexity rose around ${absChange.toFixed(0)}% — this part of the code may need another pass.`;
  }
  return "Complexity went up slightly — a minor trade-off that's usually acceptable.";
}

function inferenceInterpretation(seconds: number, mode: "single" | "multi"): string | undefined {
  if (seconds <= 0) return;
  if (mode === "single") {
    if (seconds < 10) {
      return "The refactoring completed in under 10 seconds — that's a fast turnaround for a single model pass.";
    }
    if (seconds < 25) {
      return `It took about ${seconds.toFixed(0)} seconds end-to-end — right in the normal range for single-model refactoring.`;
    }
    if (seconds < 45) {
      return `The model took around ${seconds.toFixed(0)} seconds — slower than average; the code or instruction may have been complex.`;
    }
    return "This run took over 45 seconds — consider a lighter model or narrower scope next time.";
  }
  if (seconds < 45) {
    return "The full pipeline finished in under 45 seconds — efficient orchestration across all agents.";
  }
  if (seconds < 120) {
    return `The multi-agent cycle completed in about ${seconds.toFixed(0)} seconds — typical for a full pipeline with planning and review.`;
  }
  if (seconds < 240) {
    return `At roughly ${seconds.toFixed(0)} seconds, the pipeline is running slow — planning or generation may have needed multiple attempts.`;
  }
  return "The pipeline took over 4 minutes — check agent configurations and consider simplifying the task.";
}

function gpuMemoryInterpretation(avgGb: number): string {
  if (avgGb < 2) {
    return "Averaged under 2 GB — the model runs comfortably with plenty of room on the 4 GB GPU.";
  }
  if (avgGb < 2.5) {
    return `Averaged around ${avgGb.toFixed(2)} GB — well within what the 4 GB card can handle.`;
  }
  if (avgGb < 3) {
    return `Averaged ${avgGb.toFixed(2)} GB — still fits the 4 GB budget with modest headroom.`;
  }
  return `Average memory went over 3 GB — the 4 GB GPU is near its limit and OOM crashes are a real risk under sustained load.`;
}

function gpuInterpretation(peak: number): string {
  if (peak < 30) {
    return "GPU utilization stayed under 30% — the workload didn't push the hardware, and there's headroom for larger batches.";
  }
  if (peak < 60) {
    return `Peak GPU utilization hit around ${peak.toFixed(0)}% — decent but not fully tapping into the available compute.`;
  }
  if (peak < 85) {
    return `The GPU reached ${peak.toFixed(0)}% at peak — a solid utilization rate that shows the hardware was well matched to the task.`;
  }
  return "GPU peaked above 85% — near maximum capacity; the hardware was well saturated during execution.";
}

export function buildMetrics(
  original_complexity: number | null,
  refactored_complexity: number | null,
  performance?: PerformanceMetrics,
  mode: "single" | "multi" = "single"
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
      interpretation: complexityInterpretation(original_complexity, refactored_complexity),
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
      interpretation: inferenceInterpretation(infTime, mode),
    });

    metrics.push({
      title: "GPU Utilization",
      before: `${gpuUtil}%`,
      after: `${peakUtil}%`,
      direction: "neutral" as const,
      iconKey: "Cpu",
      interpretation: gpuUtil > 0 || peakUtil > 0 ? gpuInterpretation(peakUtil) : undefined,
    });

    const memAvgGb = memUsed / (1024 * 1024 * 1024);
    const memPeakGb = peakMemUsed / (1024 * 1024 * 1024);

    metrics.push({
      title: "GPU Memory",
      before: `${memAvgGb.toFixed(2)} GB`,
      after: `${memPeakGb.toFixed(2)} GB`,
      direction: "neutral" as const,
      iconKey: "Layers",
      interpretation: memUsed > 0 ? gpuMemoryInterpretation(memAvgGb) : undefined,
    });
  }

  return metrics;
}
