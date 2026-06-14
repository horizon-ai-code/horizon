import pytest
import asyncio
from app.utils.performance import PerformanceTracker

@pytest.mark.asyncio
async def test_performance_tracker_collects_metrics():
    # Use a short interval for testing
    tracker = PerformanceTracker(interval=0.1)
    await tracker.start_tracking()
    # Wait long enough for at least one poll
    await asyncio.sleep(0.3)
    await tracker.stop_tracking()
    metrics = tracker.get_metrics()
    
    assert "avg_gpu_utilization" in metrics
    assert "avg_gpu_memory" in metrics
    assert "inference_time" in metrics
    # Inference time should be at least as long as we slept
    assert metrics["inference_time"] >= 0.3
