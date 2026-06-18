"""Verification tests for performance.py changes."""
import unittest
from unittest.mock import patch

import pynvml

from app.utils.performance import PerformanceTracker


class TestPerformanceTrackerNVML(unittest.IsolatedAsyncioTestCase):
    @patch("pynvml.nvmlInit")
    async def test_start_tracking_nvml_error_does_not_crash(self, mock_init):
        """When NVML init fails with NVMLError, stop_tracking returns clean metrics."""
        mock_init.side_effect = pynvml.NVMLError(5)
        tracker = PerformanceTracker()
        await tracker.start_tracking()
        self.assertFalse(tracker._has_gpu)
        await tracker.stop_tracking()
        metrics = tracker.get_metrics()
        self.assertEqual(metrics["avg_gpu_utilization"], 0)
        self.assertEqual(metrics["avg_gpu_memory"], 0)
