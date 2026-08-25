"""Multi-agent pipeline benchmark runner."""
import json
import os
import time
from datetime import datetime, timezone

from ..dataset import load_completed_nums, resolve_range


class MockDB:
    def __init__(self):
        self.sessions = {}
    def create_session(self, id=None, instruction="", original_code="", mode="multi"):
        self.sessions[id] = {}
    def log_status(self, **kw):
        pass
    def complete_session(self, **kw):
        pass
    def mark_as_halted(self, id):
        pass


class MockClient:
    def __init__(self, cid: str):
        self.id = cid
        self.log: list[dict] = []
        self.results = None
    @property
    def is_stale(self) -> bool:
        return False
    async def send_status(self, role, content, phase=None, **kw):
        self.log.append({
            "role": str(role.value) if hasattr(role, 'value') else str(role),
            "phase": phase,
            "message": str(content)[:500],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    async def send_result(self, **kw):
        self.results = kw
    async def send_insights(self, insights):
        pass

    async def send_phase_states(self, states: dict, failing_phase: int | None,
                                 strategy_iteration: int, syntax_heal_attempt: int) -> None:
        pass


async def _run_multi_entry(entry: dict, agent, validator) -> dict:
    from app.modules.orchestrator import Orchestrator
    from app.utils.performance import PerformanceTracker
    from app.utils.types import ExitStatus

    num = entry["num"]
    code = entry["source_code"]
    instruction = entry["instruction"]
    intent_assigned = entry["intent"]
    difficulty = entry["difficulty"]

    db = MockDB()
    client = MockClient(f"bench-{num}")
    orch = Orchestrator(agent, validator, db)
    orch.skip_judge = False

    original_generate = agent.generate
    llm_calls: list[dict] = []
    async def capture_generate(messages, **kwargs):
        t0 = time.time()
        result = await original_generate(messages, **kwargs)
        ms = int((time.time() - t0) * 1000)
        raw = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        llm_calls.append({"raw_response": raw[:5000], "duration_ms": ms, "status": "OK" if result.get("success", True) else "ERROR"})
        return result
    agent.generate = capture_generate

    tracker = PerformanceTracker(interval=0.5)
    await tracker.start_tracking()
    t_start = time.perf_counter()
    try:
        await orch.execute_orchestration(client, code, instruction)
    except Exception as e:
        print(f"  [{num}] Orchestration error: {e}")
    agent.generate = original_generate
    total_ms = int((time.perf_counter() - t_start) * 1000)
    await tracker.stop_tracking()
    gpu_metrics = tracker.get_metrics()
    state = getattr(orch, 'state', None)
    if not state:
        return {"num": num, "difficulty": difficulty, "intent": intent_assigned, "instruction": instruction[:100],
                "exit_status": "ERROR", "error": "No state available"}

    original_cc = state.original_complexity
    working_code = state.working_code if state.exit_status == ExitStatus.SUCCESS else code
    refactored_cc = validator.get_complexity(working_code)
    cc_delta = refactored_cc - original_cc
    code_unchanged = working_code.strip() == code.strip()
    phase4_findings = []
    for fb in state.cumulative_feedback:
        tier = fb.get("failure_tier", "UNKNOWN")
        err = fb.get("error", "") or fb.get("error_report", {}).get("message", "")
        phase4_findings.append({"tier": str(tier), "message": str(err)[:200]})

    judge_verdict = None
    judge_issues = []
    if state.exit_status == ExitStatus.SUCCESS:
        judge_verdict = "ACCEPT"
    else:
        for fb in state.cumulative_feedback:
            if "TIER_3" in str(fb.get("failure_tier", "")):
                judge_verdict = "REVISE"
                err = fb.get("error", [])
                judge_issues = err if isinstance(err, list) else [str(err)]
                break

    gen_timings_result = []
    for gt in state.gen_timings:
        gen_timings_result.append({"step": gt.get("step", 0), "action": gt.get("action", ""), "target": gt.get("target", ""),
                                    "time_ms": gt.get("time_ms", 0), "status": gt.get("status", ""), "agent": "generator"})

    result = {
        "num": num, "difficulty": difficulty, "intent": intent_assigned, "instruction": instruction,
        "exit_status": state.exit_status.value if state.exit_status else "N/A",
        "status": "PASS" if state.exit_status == ExitStatus.SUCCESS else "FAIL",
        "phase4_pass": len(phase4_findings) == 0,
        "judge_verdict": judge_verdict, "original_cc": original_cc, "refactored_cc": refactored_cc,
        "cc_delta": cc_delta, "duration_ms": total_ms, "strategy_iter": state.strategy_iter,
        "syntax_iter": state.syntax_iter, "code_unchanged": code_unchanged, "original_code": code,
        "final_code": working_code, "phase4_findings": phase4_findings, "judge_issues": judge_issues or [],
        "gen_timings": gen_timings_result,
        "gpu_metrics": {"peak_memory_used_mb": gpu_metrics.get("peak_gpu_memory_used", 0),
                        "avg_memory_used_mb": gpu_metrics.get("avg_gpu_memory_used", 0),
                        "peak_utilization": gpu_metrics.get("peak_gpu_utilization", 0),
                        "avg_utilization": gpu_metrics.get("avg_gpu_utilization", 0)},
        "log": {"phases": llm_calls},
    }
    return result


async def _run_multi_cmd(args) -> None:
    from app.modules.agent import AgentService
    from app.modules.validator import Validator
    from app.utils.performance import PerformanceTracker

    os.makedirs(args.out_dir, exist_ok=True)
    with open(args.dataset) as f:
        all_entries = json.load(f)
    start, end, tag = resolve_range(args, len(all_entries))
    entries = all_entries[start:end]
    out_path = os.path.join(args.out_dir, f"benchmark_279_{tag}.json") if tag else os.path.join(args.out_dir, "benchmark_279_results.json")
    completed = load_completed_nums(out_path) if args.resume else set()
    entries = [e for e in entries if e["num"] not in completed]
    if not entries:
        print("All entries already completed."); return

    agent = AgentService()
    validator = Validator()
    import yaml

    from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
    with open(MODELS_CONFIG_PATH) as f:
        model_cfg = yaml.safe_load(f)
    with open(PROMPTS_CONFIG_PATH) as f:
        prompts_cfg = yaml.safe_load(f)

    metrics = PerformanceTracker()
    await metrics.start_tracking()

    results = []
    t0 = time.time()
    for idx, entry in enumerate(entries):
        global_idx = start + idx
        print(f"\n[{global_idx+1:3d}/{len(all_entries)}] #{entry['num']} ({entry['difficulty']}) [{entry.get('intent','?')}]  ", end="", flush=True)
        r = await _run_multi_entry(entry, agent, validator)
        results.append(r)
        mark = "✓" if r.get("status") == "PASS" else "✗"
        batch_done = idx + 1
        batch_passed = sum(1 for x in results if x.get("status") == "PASS")
        total_in_batch = len(entries)
        print(f"{mark} | {r.get('exit_status','?'):15} | CC Δ={r.get('cc_delta',0):+d} | {r.get('duration_ms',0)//1000}s | [{batch_done}/{total_in_batch}] {batch_passed}P {batch_done - batch_passed}F")

    await agent.unload()
    await metrics.stop_tracking()

    output = {
        "metadata": {"timestamp": datetime.now(timezone.utc).isoformat(),
                     "duration_seconds": int(time.time()-t0),
                     "dataset": args.dataset, "range": {"start": start, "end": end},
                     "total_entries": len(results)},
        "entries": results,
    }
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    passed = sum(1 for r in results if r.get("status") == "PASS")
    print(f"\nSaved: {out_path}")
    print(f"BENCHMARK: {passed}/{len(results)} PASS ({passed*100//max(1,len(results))}%)")
