import asyncio
import logging
import os
import time

import psutil
import pynvml

logger = logging.getLogger(__name__)


class PerformanceTracker:
    def __init__(self, interval: float = 0.5):
        self.interval = interval
        self._gpu_utilizations: list[float] = []
        self._gpu_memory_usage_percent: list[float] = []
        self._gpu_memory_usage_used: list[float] = []
        self._start_time: float = 0
        self._total_inference_time: float = 0
        self._is_running = False
        self._task: asyncio.Task | None = None
        self._has_gpu = False
        self._current_gpu_util: float = 0
        self._current_gpu_mem_percent: float = 0
        self._current_gpu_mem_used: float = 0
        self._current_gpu_mem_total: float = 0

    async def start_tracking(self):
        self._is_running = True
        self._gpu_utilizations = []
        self._gpu_memory_usage_percent = []
        self._gpu_memory_usage_used = []
        self._start_time = time.perf_counter()

        try:
            pynvml.nvmlInit()
            self._has_gpu = True
            self._task = asyncio.create_task(self._poll_gpu())
        except pynvml.NVMLError as e:
            logger.warning("NVML initialization failed: %s", e)
            self._has_gpu = False

    async def stop_tracking(self):
        self._is_running = False
        if self._task:
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
            self._task = None

        self._total_inference_time = time.perf_counter() - self._start_time

        try:
            pynvml.nvmlShutdown()
        except pynvml.NVMLError:
            pass

    async def _poll_gpu(self):
        try:
            handle = pynvml.nvmlDeviceGetHandleByIndex(0) # Primary GPU
            while self._is_running:
                try:
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    mem = pynvml.nvmlDeviceGetMemoryInfo(handle)

                    self._current_gpu_util = float(util.gpu)
                    self._gpu_utilizations.append(self._current_gpu_util)
                    # Memory usage as percentage
                    mem_percent = (float(mem.used) / float(mem.total) * 100.0) if mem.total > 0 else 0
                    self._current_gpu_mem_percent = mem_percent
                    self._current_gpu_mem_used = float(mem.used)
                    self._current_gpu_mem_total = float(mem.total)
                    self._gpu_memory_usage_percent.append(mem_percent)
                    self._gpu_memory_usage_used.append(self._current_gpu_mem_used)
                except pynvml.NVMLError as err:
                     logger.warning("NVML Error during polling: %s", err)

                await asyncio.sleep(self.interval)
        except Exception as e:
             logger.error("Polling background task error: %s", e)

    def get_current_metrics(self) -> dict[str, float | bool]:
        return {
            "gpu_utilization": self._current_gpu_util,
            "gpu_memory_percent": self._current_gpu_mem_percent,
            "gpu_memory_used_gb": round(self._current_gpu_mem_used / (1024**3), 1),
            "gpu_memory_total_gb": round(self._current_gpu_mem_total / (1024**3), 1),
            "has_gpu": self._has_gpu,
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory_percent": psutil.virtual_memory().percent,
            "memory_used_gb": round(psutil.virtual_memory().used / (1024**3), 1),
            "memory_total_gb": round(psutil.virtual_memory().total / (1024**3), 1),
            "elapsed_seconds": round(time.perf_counter() - self._start_time, 1),
            "pid": os.getpid(),
        }

    def get_metrics(self) -> dict[str, float]:
        avg_util = sum(self._gpu_utilizations) / len(self._gpu_utilizations) if self._gpu_utilizations else 0
        avg_mem_percent = sum(self._gpu_memory_usage_percent) / len(self._gpu_memory_usage_percent) if self._gpu_memory_usage_percent else 0
        avg_mem_used = sum(self._gpu_memory_usage_used) / len(self._gpu_memory_usage_used) if self._gpu_memory_usage_used else 0

        peak_util = max(self._gpu_utilizations) if self._gpu_utilizations else 0
        peak_mem_used = max(self._gpu_memory_usage_used) if self._gpu_memory_usage_used else 0

        return {
            "avg_gpu_utilization": round(avg_util, 2),
            "avg_gpu_memory": round(avg_mem_percent, 2),
            "avg_gpu_memory_used": round(avg_mem_used, 2),
            "peak_gpu_utilization": round(peak_util, 2),
            "peak_gpu_memory_used": round(peak_mem_used, 2),
            "inference_time": round(self._total_inference_time, 2)
        }
