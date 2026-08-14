#!/usr/bin/env python3
"""Retry remaining entries after server crash."""
import asyncio, json, time, sys
import websockets

WS_URL = "ws://127.0.0.1:8000/ws"
TIMEOUT = 300

REMAINING = [
    ("Simple", "1343", "SUCCESS", "INLINE_METHOD"),
    ("Simple", "1510", "SUCCESS", "CONSOLIDATE_CONDITIONAL"),
    ("Simple", "2272", "SUCCESS", "EXTRACT_CONSTANT"),
    ("Simple", "2337", "SUCCESS", "DECOMPOSE_CONDITIONAL"),
    ("Edge", "18", "SUCCESS", "RENAME_SYMBOL"),
    ("Edge", "23", "SUCCESS", "DECOMPOSE_CONDITIONAL"),
    ("Edge", "76", "SUCCESS", "INLINE_METHOD"),
    ("Edge", "171", "SUCCESS", "RENAME_SYMBOL"),
    ("Edge", "584", "SUCCESS", "EXTRACT_CONSTANT"),
    ("Edge", "238", "ABORT_STRATEGY", "FLATTEN_CONDITIONAL"),
    ("Edge", "620", "ABORT_STRATEGY", "CONSOLIDATE_CONDITIONAL"),
    ("Edge", "305", "SUCCESS", "SPLIT_LOOP"),
    ("Edge", "1053", "ABORT_STRATEGY", "RENAME_SYMBOL"),
    ("Edge", "2227", "SUCCESS", "SPLIT_LOOP"),
    ("Complex", "217", "SUCCESS", "EXTRACT_METHOD"),
    ("Complex", "610", "SUCCESS", "EXTRACT_METHOD"),
    ("Complex", "1161", "SUCCESS", "EXTRACT_CONSTANT"),
    ("Complex", "125", "SUCCESS", "CONSOLIDATE_CONDITIONAL"),
    ("Complex", "131", "SUCCESS", "DECOMPOSE_CONDITIONAL"),
    ("Complex", "449", "SUCCESS", "EXTRACT_METHOD"),
    ("Complex", "661", "SUCCESS", "DECOMPOSE_CONDITIONAL"),
    ("Complex", "1014", "SUCCESS", "EXTRACT_METHOD"),
    ("Complex", "1785", "SUCCESS", "DECOMPOSE_CONDITIONAL"),
    ("Complex", "2155", "SUCCESS", "CONSOLIDATE_CONDITIONAL"),
]

with open("/home/pugario/Projects/horizon/backend/benchmark/data/dataset_final.json") as f:
    ds = json.load(f)
by_num = {str(e["num"]): e for e in ds}

async def test_one(cat, num, expected, intent):
    entry = by_num.get(num)
    if not entry:
        return {"num": num, "category": cat, "intent": intent, "expected": expected, "actual": "NOT_IN_DATASET", "match": "ERROR", "elapsed_s": 0}

    for attempt in range(3):
        try:
            async with websockets.connect(WS_URL, ping_interval=None, close_timeout=5) as ws:
                req = {"type": "multi", "code": entry["source_code"], "user_instruction": entry["instruction"]}
                await ws.send(json.dumps(req))
                t0 = time.time()
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
                        # Don't break! Let server finish sending insights etc.
                        # Continue draining until server closes or 10s silence
                        try:
                            while True:
                                await asyncio.wait_for(ws.recv(), timeout=10)
                        except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
                            pass
                        break
                    if msg.get("type") == "error":
                        exit_status = f"ERROR: {msg.get('content',msg)}"
                        break
                elapsed = time.time() - t0
                match = "MATCH" if exit_status == expected else "MISMATCH"
                print(f"#{num:>4s} {cat:8s} {intent:28s} got={exit_status:16s} exp={expected:16s} {match} ({elapsed:.0f}s)", flush=True)
                return {"num": num, "category": cat, "intent": intent, "expected": expected, "actual": exit_status, "match": match, "elapsed_s": round(elapsed, 1)}
        except Exception as e:
            print(f"#{num:>4s} attempt {attempt+1}/3: {e}", flush=True)
            await asyncio.sleep(3)
    return {"num": num, "category": cat, "intent": intent, "expected": expected, "actual": f"ALL_RETRIES_FAILED", "match": "ERROR", "elapsed_s": 0}

async def main():
    total = len(REMAINING)
    results = []
    for i, (cat, num, expected, intent) in enumerate(REMAINING, 1):
        print(f"[{i}/{total}] #{num} ({cat}, {intent})", flush=True)
        r = await test_one(cat, num, expected, intent)
        results.append(r)
        await asyncio.sleep(2)

    print("\n" + "=" * 90)
    matches = sum(1 for r in results if r["match"] == "MATCH")
    mismatches = sum(1 for r in results if r["match"] == "MISMATCH")
    errors = sum(1 for r in results if r["match"] == "ERROR")
    total_s = sum(r["elapsed_s"] for r in results)
    print(f"Completed: {len(results)} | MATCH: {matches} | MISMATCH: {mismatches} | ERROR: {errors}")
    print(f"Total time: {total_s:.0f}s ({total_s/60:.1f} min)")
    for r in results:
        if r["match"] != "MATCH":
            print(f"  #{r['num']}: exp={r['expected']} got={r['actual']} -> {r['match']}")

asyncio.run(main())
