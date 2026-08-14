#!/usr/bin/env python3
"""Full 30-entry verification with GPU monitoring and auto server restart."""
import asyncio, json, subprocess, sys, time, os
from datetime import datetime

import websockets

WS_URL = "ws://127.0.0.1:8000/ws"
TIMEOUT = 300
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "backend")
DS_PATH = os.path.join(BACKEND_DIR, "benchmark", "data", "dataset_final.json")
SERVER_LOG = "/tmp/horizon_server.log"

ALL_ENTRIES = [
    ("Simple", "68", "SUCCESS"), ("Simple", "424", "SUCCESS"), ("Simple", "1060", "SUCCESS"),
    ("Simple", "110", "SUCCESS"), ("Simple", "144", "SUCCESS"), ("Simple", "442", "SUCCESS"),
    ("Simple", "1343", "SUCCESS"), ("Simple", "1510", "SUCCESS"), ("Simple", "2272", "SUCCESS"),
    ("Simple", "2337", "SUCCESS"),
    ("Edge", "18", "SUCCESS"), ("Edge", "23", "SUCCESS"), ("Edge", "76", "SUCCESS"),
    ("Edge", "171", "SUCCESS"), ("Edge", "584", "SUCCESS"), ("Edge", "238", "ABORT_STRATEGY"),
    ("Edge", "620", "ABORT_STRATEGY"), ("Edge", "305", "SUCCESS"), ("Edge", "1053", "ABORT_STRATEGY"),
    ("Edge", "2227", "SUCCESS"),
    ("Complex", "217", "SUCCESS"), ("Complex", "610", "SUCCESS"), ("Complex", "1161", "SUCCESS"),
    ("Complex", "125", "SUCCESS"), ("Complex", "131", "SUCCESS"), ("Complex", "449", "SUCCESS"),
    ("Complex", "661", "SUCCESS"), ("Complex", "1014", "SUCCESS"), ("Complex", "1785", "SUCCESS"),
    ("Complex", "2155", "SUCCESS"),
]

with open(DS_PATH) as f:
    ds = json.load(f)
by_num = {str(e["num"]): e for e in ds}

def gpu_mem():
    try:
        out = subprocess.check_output(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader"], timeout=3)
        return out.decode().strip()
    except Exception:
        return "N/A"

def timestamp():
    return datetime.now().isoformat(timespec="seconds")

def health():
    try:
        out = subprocess.check_output(["curl", "-s", "http://127.0.0.1:8000/health"], timeout=5)
        return "ok" in out.decode()
    except Exception:
        return False

def restart_server(crash_num):
    print(f"\n  ** SERVER DEAD — RESTARTING (crash #{crash_num}) **", flush=True)
    # Capture crash log
    crash_file = f"/tmp/crash_{crash_num}.log"
    subprocess.run(["bash", "-c", f"tail -80 {SERVER_LOG} > {crash_file}"], check=False)
    print(f"  Crash log saved: {crash_file}", flush=True)

    # Kill lingering
    subprocess.run(["bash", "-c", "kill $(lsof -ti:8000) 2>/dev/null; sleep 2"], check=False)

    # Start new server
    with open(SERVER_LOG, "a") as log:
        subprocess.Popen(
            ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=BACKEND_DIR, stdout=log, stderr=subprocess.STDOUT
        )

    # Wait for ready
    for _ in range(20):
        time.sleep(2)
        if health():
            print(f"  Server back online", flush=True)
            return True
    print(f"  FATAL: server won't start", flush=True)
    return False

async def test_entry(cat, num, expected, index, total, crash_counter):
    entry = by_num.get(num)
    if not entry:
        return {"num": num, "cat": cat, "expected": expected, "actual": "NOT_IN_DATASET", "match": "ERROR"}

    intent = entry["intent"]
    gpu_pre = gpu_mem()
    t_entry = time.time()

    for attempt in range(3):
        try:
            async with websockets.connect(WS_URL, ping_interval=None, close_timeout=5) as ws:
                req = {"type": "multi", "code": entry["source_code"], "user_instruction": entry["instruction"]}
                await ws.send(json.dumps(req))
                exit_status = None
                while True:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)
                    except asyncio.TimeoutError:
                        exit_status = "TIMEOUT"
                        break
                    msg = json.loads(raw)
                    if msg.get("type") == "result":
                        exit_status = msg.get("exit_status", "MISSING")
                        # Drain remaining messages
                        try:
                            while True:
                                await asyncio.wait_for(ws.recv(), timeout=10)
                        except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
                            pass
                        break
                    if msg.get("type") == "error":
                        exit_status = f"ERR:{msg.get('content','?')}"
                        break
                elapsed = time.time() - t_entry
                gpu_post = gpu_mem()
                match = "MATCH" if exit_status == expected else "MISMATCH"
                print(f"[{index:2d}/{total}] #{num:>4s} {cat:8s} {intent:28s} GPU:{gpu_pre:>5s}→{gpu_post:>5s} got={exit_status:16s} exp={expected:16s} {match} ({elapsed:.0f}s)", flush=True)
                return {"num": num, "cat": cat, "intent": intent, "expected": expected, "actual": exit_status, "match": match, "elapsed": elapsed, "gpu_pre": gpu_pre, "gpu_post": gpu_post}
        except Exception as e:
            err = str(e)[:100]
            if "111" in err or "Connection refused" in err or "no close frame" in err:
                print(f"  #{num} attempt {attempt+1}/3: server unreachable ({err})", flush=True)
                # Server might be dead — restart
                if not health():
                    crash_counter[0] += 1
                    if not restart_server(crash_counter[0]):
                        return {"num": num, "cat": cat, "intent": intent, "expected": expected, "actual": "FATAL_NO_SERVER", "match": "ERROR", "elapsed": 0}
                await asyncio.sleep(3)
            else:
                print(f"  #{num} attempt {attempt+1}/3: {err}", flush=True)
                await asyncio.sleep(3)

    return {"num": num, "cat": cat, "intent": intent, "expected": expected, "actual": "ALL_RETRIES_FAILED", "match": "ERROR", "elapsed": 0}

async def main():
    total = len(ALL_ENTRIES)
    crash_counter = [0]
    results = []

    print(f"{timestamp()} Starting verification — {total} entries", flush=True)
    print(f"Server log: {SERVER_LOG}", flush=True)
    print()

    for i, (cat, num, expected) in enumerate(ALL_ENTRIES, 1):
        r = await test_entry(cat, num, expected, i, total, crash_counter)
        results.append(r)
        await asyncio.sleep(2)

    print("\n" + "=" * 110)
    print(f"FINAL SUMMARY — {total} entries | {crash_counter[0]} server crashes")
    print("=" * 110)
    print(f"{'#':>4s} {'Cat':8s} {'Intent':28s} {'Expected':16s} {'Actual':16s} {'Verdict':8s} {'Time':>6s}")
    print("-" * 110)

    matches = mismatches = errors = 0
    total_time = 0
    for r in results:
        elapsed = r.get("elapsed", 0) or 0
        total_time += elapsed
        m = r["match"]
        if m == "MATCH": matches += 1
        elif m == "MISMATCH": mismatches += 1
        else: errors += 1
        actual = r.get("actual", "?")
        print(f"{r['num']:>4s} {r['cat']:8s} {r.get('intent','?'):28s} {r['expected']:16s} {str(actual):16s} {m:8s} {elapsed:5.0f}s")

    print("-" * 110)
    print(f"MATCH: {matches} | MISMATCH: {mismatches} | ERROR: {errors}")
    print(f"Crashes: {crash_counter[0]} | Total time: {total_time:.0f}s ({total_time/60:.1f} min)")
    if mismatches:
        print(f"\nMISMATCH entries:")
        for r in results:
            if r["match"] == "MISMATCH":
                print(f"  #{r['num']} {r['cat']} {r.get('intent','')}: expected {r['expected']}, got {r['actual']}")

if __name__ == "__main__":
    asyncio.run(main())
