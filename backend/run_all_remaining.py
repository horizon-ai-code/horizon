import asyncio
import json
import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from run_task_orchestration import run_task

async def run_all():
    print("Starting execution for remaining tasks 2 through 8...")
    for t_num in range(2, 9):
        print(f"\n==================================================")
        print(f"STARTING TASK {t_num} OF 8")
        print(f"==================================================")
        try:
            await run_task(t_num)
        except Exception as e:
            print(f"ERROR executing task {t_num}: {e}")

if __name__ == "__main__":
    asyncio.run(run_all())
