from app.utils.performance import PerformanceTracker


class SystemMonitor:
    def __init__(self) -> None:
        self._tracker = PerformanceTracker()

    async def start(self) -> None:
        await self._tracker.start_tracking()

    async def stop(self) -> None:
        await self._tracker.stop_tracking()

    def get_current_metrics(self) -> dict:
        return self._tracker.get_current_metrics()
