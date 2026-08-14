#!/usr/bin/env python3
"""30-entry verification with WS drain + auto-restart every 4 entries."""
import asyncio, json, subprocess, sys, time, os

import websockets

WS_URL = "ws://127.0.0.1:8000/ws"
TIMEOUT = 300
RESTART_EVERY = 4
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "backend")
DS_PATH = os.path.join(BACKEND_DIR, "benchmark", "data", "dataset_final.json")
SERVER_LOG = "/tmp/horizon_final.log"
GPU_TRACE = "/tmp/gpu_trace.log"
RESULTS_FILE = "/tmp/verify_results.log"

ALL = [
    ("Simple","68","SUCCESS"),("Simple","424","SUCCESS"),("Simple","1060","SUCCESS"),
    ("Simple","110","SUCCESS"),("Simple","144","SUCCESS"),("Simple","442","SUCCESS"),
    ("Simple","1343","SUCCESS"),("Simple","1510","SUCCESS"),("Simple","2272","SUCCESS"),
    ("Simple","2337","SUCCESS"),
    ("Edge","18","SUCCESS"),("Edge","23","SUCCESS"),("Edge","76","SUCCESS"),
    ("Edge","171","SUCCESS"),("Edge","584","SUCCESS"),("Edge","238","ABORT_STRATEGY"),
    ("Edge","620","ABORT_STRATEGY"),("Edge","305","SUCCESS"),("Edge","1053","ABORT_STRATEGY"),
    ("Edge","2227","SUCCESS"),
    ("Complex","217","SUCCESS"),("Complex","610","SUCCESS"),("Complex","1161","SUCCESS"),
    ("Complex","125","SUCCESS"),("Complex","131","SUCCESS"),("Complex","449","SUCCESS"),
    ("Complex","661","SUCCESS"),("Complex","1014","SUCCESS"),("Complex","1785","SUCCESS"),
    ("Complex","2155","SUCCESS"),
]

with open(DS_PATH) as f:
    by_num = {str(e["num"]): e for e in json.load(f)}

def gpu():
    try:
        o = subprocess.check_output(["nvidia-smi","--query-gpu=memory.used","--format=csv,noheader"], timeout=3)
        return o.decode().strip()
    except: return "N/A"

def health():
    try:
        return b"ok" in subprocess.check_output(["curl","-s","http://127.0.0.1:8000/health"], timeout=5)
    except: return False

def restart(idx, crash=False):
    label = "RESTART" if not crash else "CRASH"
    print(f"\n  ** {label} (entry #{idx}) **", flush=True)
    subprocess.run(["bash","-c","kill $(lsof -ti:8000) 2>/dev/null; sleep 2"], check=False)

    # Capture log tail before restart
    if os.path.exists(SERVER_LOG):
        tail = subprocess.check_output(["tail","-30",SERVER_LOG]).decode()
        tag = "restart" if not crash else "crash"
        with open(f"/tmp/{tag}_{idx}.log","w") as f:
            f.write(tail)

    # Start fresh server
    with open(SERVER_LOG, "a") as log:
        subprocess.Popen(
            ["/home/pugario/.conda/envs/horizon_env/bin/uvicorn","app.main:app","--host","0.0.0.0","--port","8000"],
            cwd=BACKEND_DIR, stdout=log, stderr=subprocess.STDOUT, env={**os.environ, "PATH": "/home/pugario/.conda/envs/horizon_env/bin:" + os.environ.get("PATH","")})

    for i in range(30):
        time.sleep(2)
        if health():
            print(f"  Server ready", flush=True)
            return True
        print(f"  Waiting ({i+1})...", flush=True)
    print("  FATAL: server won't start", flush=True)
    return False

async def run_one(cat, num, expected, idx, total, restarts):
    entry = by_num.get(num)
    if not entry:
        return {"num":num,"cat":cat,"expected":expected,"actual":"NOT_IN_DATASET","match":"ERROR"}
    intent = entry["intent"]
    g0 = gpu()
    t0 = time.time()

    for attempt in range(2):
        try:
            async with websockets.connect(WS_URL, ping_interval=None, close_timeout=3) as ws:
                await ws.send(json.dumps({"type":"multi","code":entry["source_code"],"user_instruction":entry["instruction"]}))
                exit_status = None
                while True:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)
                    except asyncio.TimeoutError:
                        exit_status = "TIMEOUT"; break
                    msg = json.loads(raw)
                    if msg.get("type") == "result":
                        exit_status = msg.get("exit_status","MISSING")
                        # Drain: stay connected until server closes
                        try:
                            while True:
                                await asyncio.wait_for(ws.recv(), timeout=15)
                        except: pass
                        break
                    if msg.get("type") == "error":
                        exit_status = "ERR"; break
                elapsed = time.time() - t0
                g1 = gpu()
                match = "MATCH" if exit_status == expected else "MISMATCH"
                line = f"[{idx:2d}/{total}] #{num:>4s} {cat:8s} {intent:28s} GPU:{g0:>5s}→{g1:>5s} got={exit_status:16s} exp={expected:16s} {match} ({elapsed:.0f}s)"
                print(line, flush=True)
                with open(RESULTS_FILE,"a") as f: f.write(line+"\n")
                return {"num":num,"cat":cat,"intent":intent,"expected":expected,"actual":exit_status,"match":match,"elapsed":elapsed}
        except Exception as e:
            err = str(e)[:80]
            # Server dead?
            if not health():
                restarts[0] += 1
                if not restart(idx, crash=True):
                    return {"num":num,"cat":cat,"intent":intent,"expected":expected,"actual":"SERVER_DEAD","match":"ERROR","elapsed":0}
            else:
                print(f"  #{num} retry: {err}", flush=True)
                await asyncio.sleep(3)
    return {"num":num,"cat":cat,"intent":intent,"expected":expected,"actual":"ALL_FAILED","match":"ERROR","elapsed":0}

async def main():
    total = len(ALL)
    restarts = [0]
    results = []

    # Start GPU monitor
    subprocess.Popen(["bash","-c",f"while true; do echo \"$(date +%H:%M:%S) $(nvidia-smi --query-gpu=memory.used --format=csv,noheader 2>/dev/null || echo N/A)\"; sleep 2; done > {GPU_TRACE}"])
    print(f"GPU trace: {GPU_TRACE}", flush=True)

    # First server start
    if not restart(1, crash=False):
        print("Cannot start server", flush=True); return
    restarts[0] = 0

    print(f"\n{'='*110}")
    print(f"Starting {total} entries. Restart every {RESTART_EVERY}. Server log: {SERVER_LOG}")
    print(f"{'='*110}\n", flush=True)

    for i, (cat, num, expected) in enumerate(ALL, 1):
        # Planned restart
        if i > 1 and (i - 1) % RESTART_EVERY == 0:
            restart(i, crash=False)
        r = await run_one(cat, num, expected, i, total, restarts)
        results.append(r)
        await asyncio.sleep(2)

    print("\n" + "="*110)
    print(f"FINAL SUMMARY — {total} entries | {restarts[0]} unplanned restarts (crashes)")
    print("="*110)
    print(f"{'#':>4s} {'Cat':8s} {'Intent':28s} {'Expected':16s} {'Actual':16s} {'Verdict':8s} {'Time':>6s}")
    print("-"*110)
    m = mm = e = tt = 0
    for r in results:
        el = r.get("elapsed",0) or 0; tt += el
        if r["match"]=="MATCH": m+=1
        elif r["match"]=="MISMATCH": mm+=1
        else: e+=1
        print(f"{r['num']:>4s} {r['cat']:8s} {r.get('intent','?'):28s} {r['expected']:16s} {str(r.get('actual','?')):16s} {r['match']:8s} {el:5.0f}s")
    print("-"*110)
    print(f"MATCH: {m} | MISMATCH: {mm} | ERROR: {e} | Crashes: {restarts[0]}")
    print(f"Total time: {tt:.0f}s ({tt/60:.1f} min)")

    with open(RESULTS_FILE,"a") as f:
        f.write(f"\nMATCH:{m} MISMATCH:{mm} ERROR:{e} CRASHES:{restarts[0]} TIME:{tt:.0f}s\n")

if __name__ == "__main__":
    asyncio.run(main())
