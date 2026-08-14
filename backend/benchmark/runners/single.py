"""Single-model baseline benchmark runner."""
import json
import os
import time
from datetime import datetime, timezone

from ..dataset import resolve_range


async def _run_single_cmd(args) -> None:
    import yaml

    from app.modules.agent import AgentService
    from app.modules.validator import Validator
    from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
    from app.utils.response_parser import ResponseParser

    with open(MODELS_CONFIG_PATH) as f:
        cfg = yaml.safe_load(f)["single"]
    with open(PROMPTS_CONFIG_PATH) as f:
        sys_prompt = yaml.safe_load(f)["single"]["coder"]

    os.makedirs(args.out_dir, exist_ok=True)
    with open(args.dataset) as f:
        all_entries = json.load(f)
    start, end, tag = resolve_range(args, len(all_entries))
    entries = all_entries[start:end]
    out_path = os.path.join(args.out_dir, f"benchmark_279_{tag}.json") if tag else os.path.join(args.out_dir, "benchmark_279_results.json")

    agent = AgentService()
    validator = Validator()
    await agent.swap(cfg)
    await agent.clear_context()
    print(f"Loaded: {cfg.get('name')} ({cfg.get('filename')})")

    results = []
    t0 = time.time()
    for idx, entry in enumerate(entries):
        num = entry["num"]; code = entry["source_code"]; instruction = entry["instruction"]
        global_idx = start + idx
        print(f"\n[{global_idx+1:3d}/{len(all_entries)}] #{num} ({entry['difficulty']}) [{entry.get('intent','?')}]  ", end="", flush=True)

        original_generate = agent.generate
        llm_calls = []
        async def cg(messages, **kwargs):
            t0 = time.time(); r = await original_generate(messages, **kwargs)
            ms = int((time.time()-t0)*1000); raw = r.get("choices",[{}])[0].get("message",{}).get("content","")
            llm_calls.append({"raw_response": raw[:5000], "duration_ms": ms, "status": "OK" if r.get("success",True) else "ERROR"})
            return r
        agent.generate = cg

        orig_cc = validator.get_complexity(code)
        t = time.perf_counter()
        coder_prompt = f"<code>{code}</code>\n\nInstruction: {instruction}"
        messages = [{"role": "system", "content": sys_prompt}, {"role": "user", "content": coder_prompt}]
        raw = await agent.generate(messages, temp=0.1, max_tokens=4096)
        agent.generate = original_generate
        response_text = raw.get("choices",[{}])[0].get("message",{}).get("content","")
        refactored = ResponseParser.extract_xml(response_text, "code") or code
        refa_cc = validator.get_complexity(refactored)
        cc_delta = refa_cc - orig_cc
        code_unchanged = refactored.strip() == code.strip()
        dur = int((time.perf_counter() - t) * 1000)

        results.append({
            "num": num, "difficulty": entry["difficulty"], "intent": entry.get("intent","?"),
            "instruction": instruction, "exit_status": "SUCCESS" if not code_unchanged else "NO_CHANGE",
            "status": "PASS" if not code_unchanged else "FAIL",
            "original_cc": orig_cc, "refactored_cc": refa_cc, "cc_delta": cc_delta,
            "duration_ms": dur, "code_unchanged": code_unchanged, "original_code": code,
            "final_code": refactored, "llm_calls": llm_calls,
            "gpu_metrics": {},
            "model": {"name": cfg.get("name"), "temperature": cfg.get("temperature"),
                      "max_tokens": cfg.get("max_tokens"), "context_size": cfg.get("context_size"),
                      "layers": cfg.get("layers"), "filename": cfg.get("filename")},
        })
        mark = "✓" if not code_unchanged else "✗"
        batch_done = idx + 1
        batch_passed = sum(1 for x in results if x.get("status") == "PASS")
        total_in_batch = len(entries)
        print(f"{mark} | CC Δ={cc_delta:+d} | {dur//1000}s | [{batch_done}/{total_in_batch}] {batch_passed}P {batch_done - batch_passed}F")

    await agent.unload()
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
