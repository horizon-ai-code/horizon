import asyncio
import time

import pynvml


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
            print(f"[PerformanceTracker] NVML initialization failed: {e}")
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

                    self._gpu_utilizations.append(float(util.gpu))
                    # Memory usage as percentage
                    mem_percent = (float(mem.used) / float(mem.total) * 100.0) if mem.total > 0 else 0
                    self._gpu_memory_usage_percent.append(mem_percent)
                    self._gpu_memory_usage_used.append(float(mem.used))
                except pynvml.NVMLError as err:
                    print(f"[PerformanceTracker] NVML Error during polling: {err}")

                await asyncio.sleep(self.interval)
        except Exception as e:
            print(f"[PerformanceTracker] Polling background task error: {e}")

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
