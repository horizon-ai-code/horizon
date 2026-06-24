import { describe, it, expect } from 'vitest';
import { buildMetrics } from '@/lib/utils/buildMetrics';

describe('buildMetrics', () => {
  it('down when complexity decreased', () => {  // TC-BM-001
    const metrics = buildMetrics(10, 5);
    const cc = metrics.find((m) => m.title.includes('Complexity'));
    expect(cc?.direction).toBe('down');
  });

  it('up when complexity increased', () => {  // TC-BM-002
    const metrics = buildMetrics(5, 10);
    const cc = metrics.find((m) => m.title.includes('Complexity'));
    expect(cc?.direction).toBe('up');
  });

  it('neutral when unchanged', () => {  // TC-BM-003
    const metrics = buildMetrics(5, 5);
    const cc = metrics.find((m) => m.title.includes('Complexity'));
    expect(cc?.direction).toBe('neutral');
  });

  it('builds inference time metric', () => {  // TC-BM-004
    const metrics = buildMetrics(5, 3, { inference_time: 12.5 } as never);
    const time = metrics.find((m) => m.title.includes('Inference'));
    expect(time).toBeDefined();
  });

  it('builds GPU metrics when performance provided', () => {  // TC-BM-005
    const metrics = buildMetrics(5, 3, {
      avg_gpu_utilization: 80,
      peak_gpu_memory_used: 4096,
    } as never);
    expect(metrics.length).toBeGreaterThanOrEqual(3);
  });

  it('skips GPU metrics when performance is null', () => {  // TC-BM-006
    const metrics = buildMetrics(5, 3, null as never);
    expect(metrics.length).toBe(1);
  });
});
