import { describe, it, expect } from 'vitest';
import { buildMetrics } from '@/lib/utils/buildMetrics';

describe('buildMetrics', () => {
  it('down when complexity decreased', () => {
    const metrics = buildMetrics(10, 5);
    const cc = metrics.find((m) => m.title.includes('Complexity'));
    expect(cc?.direction).toBe('down');
  });

  it('up when complexity increased', () => {
    const metrics = buildMetrics(5, 10);
    const cc = metrics.find((m) => m.title.includes('Complexity'));
    expect(cc?.direction).toBe('up');
  });

  it('neutral when unchanged', () => {
    const metrics = buildMetrics(5, 5);
    const cc = metrics.find((m) => m.title.includes('Complexity'));
    expect(cc?.direction).toBe('neutral');
  });

  it('builds inference time metric', () => {
    const metrics = buildMetrics(5, 3, { inference_time: 12.5 } as never);
    const time = metrics.find((m) => m.title.includes('Inference'));
    expect(time).toBeDefined();
  });

  it('builds GPU metrics when performance provided', () => {
    const metrics = buildMetrics(5, 3, {
      avg_gpu_utilization: 80,
      peak_gpu_memory_used: 4096,
    } as never);
    expect(metrics.length).toBeGreaterThanOrEqual(3);
  });

  it('skips GPU metrics when performance is null', () => {
    const metrics = buildMetrics(5, 3, null as never);
    expect(metrics.length).toBe(1);
  });
});
