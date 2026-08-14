#!/usr/bin/env python3
"""
Verify exit_status for 30 selected dataset entries via Horizon WebSocket API.
Compares live pipeline results against documented expected exit_status.
"""
import asyncio
import json
import sys
import time
from pathlib import Path

try:
    import websockets
except ImportError:
    print("pip install websockets")
    sys.exit(1)

DATASET_PATH = Path(__file__).resolve().parent.parent / "backend" / "benchmark" / "data" / "dataset_final.json"
WS_URL = "ws://127.0.0.1:8000/ws"
TIMEOUT = 300  # seconds per entry

DOCX_NUMS = {
    "Simple":  ["68", "424", "1060", "110", "144", "442", "1343", "1510", "2272", "2337"],
    "Edge":    ["18", "23", "76", "171", "584", "238", "620", "305", "1053", "2227"],
    "Complex": ["217", "610", "1161", "125", "131", "449", "661", "1014", "1785", "2155"],
}

# Expected exit_status from docx (ground truth)
EXPECTED = {
    "238": "ABORT_STRATEGY",
    "620": "ABORT_STRATEGY",
    "1053": "ABORT_STRATEGY",
}
for cat, nums in DOCX_NUMS.items():
    for n in nums:
        EXPECTED.setdefault(n, "SUCCESS")

CAT_LOOKUP = {}
for cat, nums in DOCX_NUMS.items():
    for n in nums:
        CAT_LOOKUP[n] = cat


def load_dataset_entries(nums: set[str]) -> dict:
    with open(DATASET_PATH) as f:
        ds = json.load(f)
    entries = {}
    for e in ds:
        n = str(e["num"])
        if n in nums:
            entries[n] = {
                "num": n,
                "source_code": e["source_code"],
                "instruction": e["instruction"],
                "intent": e["intent"],
                "difficulty": e["difficulty"],
            }
    return entries


async def test_entry(entry: dict, entry_index: int, total: int) -> dict:
    num = entry["num"]
    cat = CAT_LOOKUP[num]
    expected = EXPECTED[num]

    print(f"\n[{entry_index}/{total}] #{num} ({cat}, {entry['intent']})", flush=True)

    try:
        async with websockets.connect(WS_URL, ping_interval=None, close_timeout=10) as ws:
            request = {
                "type": "multi",
                "code": entry["source_code"],
                "user_instruction": entry["instruction"],
            }
            await ws.send(json.dumps(request))
            print(f"  Sent request ({len(entry['source_code'])} chars)", flush=True)

            start = time.time()
            exit_status = None
            error_msg = None

            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)
                except asyncio.TimeoutError:
                    error_msg = "TIMEOUT"
                    break

                msg = json.loads(raw)
                msg_type = msg.get("type", "")

                if msg_type == "result":
                    exit_status = msg.get("exit_status", "MISSING")
                    break

                if msg_type == "error":
                    error_msg = msg.get("content", str(msg))
                    break

                # Progress indicator
                if msg_type == "status":
                    content = msg.get("content", "")[:60]
                    print(f"    [{int(time.time() - start)}s] {content}", flush=True)

            elapsed = time.time() - start

            actual = exit_status if exit_status else f"NO_RESULT: {error_msg}"
            match = "MATCH" if actual == expected else "MISMATCH"

            result = {
                "num": num,
                "category": cat,
                "intent": entry["intent"],
                "expected": expected,
                "actual": actual,
                "match": match,
                "elapsed_s": round(elapsed, 1),
            }

            status = "MATCH" if actual == expected else "MISMATCH"
            print(f"  Result: {actual} (expected {expected}) -> {status} in {elapsed:.0f}s", flush=True)
            return result

    except websockets.exceptions.ConnectionClosed as e:
        result = {
            "num": num, "category": cat, "intent": entry["intent"],
            "expected": expected, "actual": f"CONN_CLOSED: {e}",
            "match": "ERROR", "elapsed_s": 0,
        }
        print(f"  ERROR: Connection closed - {e}", flush=True)
        return result

    except Exception as e:
        result = {
            "num": num, "category": cat, "intent": entry["intent"],
            "expected": expected, "actual": f"ERROR: {e}",
            "match": "ERROR", "elapsed_s": 0,
        }
        print(f"  ERROR: {e}", flush=True)
        return result


def print_summary(results: list[dict]):
    print("\n" + "=" * 90)
    print("SUMMARY")
    print("=" * 90)
    print(f"{'#':>4s}  {'Category':8s}  {'Intent':28s}  {'Expected':16s}  {'Actual':16s}  {'Verdict':8s}  {'Time':>6s}")
    print("-" * 90)

    matches = 0
    mismatches = 0
    errors = 0
    total_time = 0

    for r in results:
        actual = r["actual"]
        expected = r["expected"]
        match = r["match"]
        elapsed = r["elapsed_s"]

        if match == "MATCH":
            matches += 1
        elif match == "MISMATCH":
            mismatches += 1
        else:
            errors += 1

        total_time += elapsed

        print(f"{r['num']:>4s}  {r['category']:8s}  {r['intent']:28s}  {expected:16s}  {actual:16s}  {match:8s}  {elapsed:5.0f}s")

    print("-" * 90)
    print(f"Total: {len(results)} entries  |  MATCH: {matches}  |  MISMATCH: {mismatches}  |  ERROR: {errors}")
    print(f"Total time: {total_time:.0f}s ({total_time/60:.1f} min)")

    if errors:
        print(f"\nERROR entries:")
        for r in results:
            if r["match"] not in ("MATCH", "MISMATCH"):
                print(f"  #{r['num']}: {r['actual']}")


async def main():
    # Load entries
    all_nums = set()
    for nums in DOCX_NUMS.values():
        all_nums.update(nums)
    entries = load_dataset_entries(all_nums)

    if len(entries) != 30:
        print(f"ERROR: Expected 30 entries, found {len(entries)}")
        missing = all_nums - set(entries.keys())
        if missing:
            print(f"Missing: {sorted(missing)}")
        sys.exit(1)

    print(f"Loaded {len(entries)} entries from {DATASET_PATH}")
    print(f"Connecting to {WS_URL} ...")
    print(f"Timeout per entry: {TIMEOUT}s")
    print(f"Total entries to test: {len(entries)}")

    # Run sequentially (pipeline processes one at a time)
    results = []
    ordered = []
    for cat in ["Simple", "Edge", "Complex"]:
        for n in DOCX_NUMS[cat]:
            if n in entries:
                ordered.append(entries[n])

    for i, entry in enumerate(ordered, 1):
        result = await test_entry(entry, i, len(ordered))
        results.append(result)
        # Brief pause between entries
        await asyncio.sleep(1)

    print_summary(results)


if __name__ == "__main__":
    asyncio.run(main())
