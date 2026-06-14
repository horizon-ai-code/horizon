"""Unified Horizon benchmark tool.

Usage:
  python3 -m benchmark.benchmark run-multi --dataset <file> --batch N
  python3 -m benchmark.benchmark run-single --dataset <file> --batch N
  python3 -m benchmark.benchmark aggregate --dir <results_dir>
  python3 -m benchmark.benchmark csr --dir <results_dir>
  python3 -m benchmark.benchmark ber --dir <results_dir> --dataset <file>
  python3 -m benchmark.benchmark halstead --code <file>
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# ── Subcommand imports (lazy — only loaded when needed for that subcommand) ──

HERE = os.path.dirname(__file__)
STUBS_DIR = os.path.join(HERE, "stubs")


# ═══════════════════════════════════════════════════════════════════
# SECTION 1: Shared utilities
# ═══════════════════════════════════════════════════════════════════

def clean_code(code: str) -> str:
    code = re.sub(r'^```[a-z]*\n?', '', code)
    code = re.sub(r'\n?```\s*$', '', code)
    return code.strip()


def wrap_code(code: str) -> str:
    """Wrap bare methods in compilable class (non-public to avoid javac filename issues)."""
    cleaned = clean_code(code)
    lines = cleaned.split('\n')
    imports = [l.strip() for l in lines if l.strip().startswith('import ')]
    non_import = '\n'.join(l for l in lines if not l.strip().startswith('import '))
    has_class = bool(re.search(r'\bclass\s+\w+\s*\{', non_import))
    if has_class:
        result = '\n'.join(imports)
        if result: result += '\n\n'
        body = non_import.strip()
        body = re.sub(r'\bpublic\s+class\b', 'class', body)
        body = re.sub(r'\n\s*public\s*\n', '\n', body)
        body = re.sub(r'^\s*public\s*\n', '', body)
        result += body
        return result
    else:
        result = '\n'.join(imports)
        if result: result += '\n\n'
        indented = '\n'.join('    ' + l if l.strip() else l for l in non_import.strip().split('\n'))
        return result + 'class Wrapper {\n' + indented + '\n}'


def load_entries(base_dir: str) -> list[dict]:
    entries = []
    batch_files = sorted(f for f in os.listdir(base_dir)
                         if f.startswith("benchmark_279_batch_") and f.endswith(".json"))
    for fname in batch_files:
        with open(os.path.join(base_dir, fname)) as f:
            entries.extend(json.load(f).get("entries", []))
    return entries


def resolve_range(args: argparse.Namespace, total: int) -> tuple[int, int, str | None]:
    if args.start is not None and args.end is not None:
        return args.start, min(args.end, total), None
    if args.batch is not None:
        bs = args.batch_size
        s = (args.batch - 1) * bs
        e = min(args.batch * bs, total)
        return s, e, f"batch_{args.batch}"
    return 0, total, "all"


def load_completed_nums(path: str | None) -> set[int]:
    if not path or not os.path.exists(path):
        return set()
    with open(path) as f:
        data = json.load(f)
    return {e["num"] for e in data.get("entries", [])}


# ── Mock classes for multi-agent runner ──

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


# ── Utilities used by CSR and BER ──

def parse_method_info(code: str) -> tuple[str, list[tuple[str, str]]] | None:
    try:
        import javalang
    except ImportError:
        return None
    cleaned = clean_code(code)
    try:
        tree = javalang.parse.parse(cleaned)
    except Exception:
        return None
    for _, node in tree:
        if isinstance(node, javalang.tree.MethodDeclaration):
            name = node.name
            params = []
            for p in getattr(node, 'parameters', []):
                ptype = p.type.name if hasattr(p.type, 'name') else str(p.type)
                params.append((ptype, p.name))
            return name, params
    return None


# ═══════════════════════════════════════════════════════════════════
# SECTION 2: Run subcommands (need GPU)
# ═══════════════════════════════════════════════════════════════════

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
    orch.SKIP_JUDGE = False

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
    working_code = state.working_code
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


def _build_shared_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Horizon benchmarking tool")
    sub = p.add_subparsers(dest="command", required=True)

    # run-multi
    rm = sub.add_parser("run-multi", help="Run multi-agent pipeline")
    rm.add_argument("--dataset", type=str, default="benchmark/data/dataset_final.json")
    rm.add_argument("--batch", type=int, default=None)
    rm.add_argument("--batch-size", type=int, default=50)
    rm.add_argument("--start", type=int, default=None)
    rm.add_argument("--end", type=int, default=None)
    rm.add_argument("--resume", action="store_true")
    rm.add_argument("--out-dir", type=str, default=os.path.join(HERE, "results", "multi"))

    # run-single
    rs = sub.add_parser("run-single", help="Run single-model baseline")
    rs.add_argument("--dataset", type=str, default="benchmark/data/dataset_final.json")
    rs.add_argument("--batch", type=int, default=None)
    rs.add_argument("--batch-size", type=int, default=50)
    rs.add_argument("--start", type=int, default=None)
    rs.add_argument("--end", type=int, default=None)
    rs.add_argument("--resume", action="store_true")
    rs.add_argument("--out-dir", type=str, default=os.path.join(HERE, "results", "single"))

    # aggregate
    ag = sub.add_parser("aggregate", help="Summarize benchmark results (offline)")
    ag.add_argument("--dir", type=str, default=os.path.join(HERE, "results", "multi"))

    # csr
    cs = sub.add_parser("csr", help="Compilation success rate (needs JDK)")
    cs.add_argument("--dir", type=str, default=os.path.join(HERE, "results", "multi"))

    # ber
    be = sub.add_parser("ber", help="Behavioral equivalence rate (needs JDK)")
    be.add_argument("--dir", type=str, default=os.path.join(HERE, "results", "multi"))
    be.add_argument("--dataset", type=str, default="benchmark/data/dataset_final.json")

    # halstead
    ha = sub.add_parser("halstead", help="Halstead metrics for a Java file")
    ha.add_argument("--code", type=str, required=True)

    # report
    rp = sub.add_parser("report", help="Generate full report CSV with optional CSR/BER")
    rp.add_argument("--dir", type=str, required=True)
    rp.add_argument("--mode", type=str, choices=["multi", "single"], required=True)
    rp.add_argument("--output", type=str, default=None)
    rp.add_argument("--dataset", type=str, default=None)
    rp.add_argument("--csr", action="store_true")
    rp.add_argument("--ber", action="store_true")

    return p


def cmd_aggregate(args: argparse.Namespace) -> None:
    """Aggregate subcommand — reads saved batch JSONs, prints summary."""
    from app.utils.halstead import compute_mi

    entries = load_entries(args.dir)
    if not entries:
        print(f"No batch files found in {args.dir}")
        sys.exit(1)

    print(f"Loaded {len(entries)} entries from {args.dir}")

    # Per-entry metrics with MI
    em = []
    for e in entries:
        orig = e.get("original_code", "")
        refa = e.get("final_code", "")
        orig_cc = e.get("original_cc", 0)
        refa_cc = e.get("refactored_cc", 0)
        _, omi = compute_mi(orig, orig_cc) if orig.strip() else (None, 0.0)
        _, rmi = compute_mi(refa, refa_cc) if refa.strip() and refa != orig else (None, 0.0)
        em.append({
            "num": e.get("num", 0), "difficulty": e.get("difficulty", "?"), "intent": e.get("intent", "?"),
            "exit_status": str(e.get("exit_status", "?")), "status": e.get("status", "FAIL"),
            "original_cc": orig_cc, "refactored_cc": refa_cc, "cc_delta": e.get("cc_delta", 0),
            "duration_ms": e.get("duration_ms", 0), "strategy_iter": e.get("strategy_iter", 0),
            "code_unchanged": e.get("code_unchanged", False), "judge_verdict": e.get("judge_verdict"),
            "phase4_findings": e.get("phase4_findings", []), "gpu": e.get("gpu_metrics", {}),
            "original_mi": omi, "refactored_mi": rmi, "mi_delta": rmi - omi,
        })

    total = len(em)
    passed = sum(1 for x in em if x["status"] == "PASS")
    cc_deltas = [x["cc_delta"] for x in em]
    mi_deltas = [x["mi_delta"] for x in em if x["mi_delta"] != 0.0]

    tier_counts = Counter()
    for x in em:
        for f in x.get("phase4_findings", []):
            tier_counts[f.get("tier", "UNKNOWN")] += 1
    t1 = tier_counts.get("FailureTier.TIER_1_SYNTAX", 0)
    t2a = tier_counts.get("FailureTier.TIER_2_A_COMPLEXITY", 0)
    t2b = tier_counts.get("FailureTier.TIER_2_B_BOUNDARY", 0)
    t2c = tier_counts.get("FailureTier.TIER_2_C_INTENT_MATH", 0)
    t3 = tier_counts.get("FailureTier.TIER_3_JUDGE", 0)
    total_tiers = t1 + t2a + t2b + t2c + t3

    per_intent = {}
    for x in em:
        i = x["intent"]
        if i not in per_intent:
            per_intent[i] = {"count": 0, "passed": 0}
        per_intent[i]["count"] += 1
        per_intent[i]["passed"] += 1 if x["status"] == "PASS" else 0

    per_diff = {}
    for x in em:
        d = x["difficulty"]
        if d not in per_diff:
            per_diff[d] = {"count": 0, "passed": 0}
        per_diff[d]["count"] += 1
        per_diff[d]["passed"] += 1 if x["status"] == "PASS" else 0

    resolved = sum(1 for x in em if x["strategy_iter"] > 1 and x["exit_status"] == "SUCCESS")
    exhausted = sum(1 for x in em if x["exit_status"] == "ABORT_STRATEGY")

    print(f"\n{'='*55}")
    print(f"  Passed:  {passed}/{total} ({passed*100//total}%)")
    print(f"  SUCCESS: {sum(1 for x in em if x['exit_status']=='SUCCESS')}")
    print(f"  ABORT:   {exhausted}")
    print(f"  CC Δ avg: {sum(cc_deltas)/len(cc_deltas):.2f}   (-{sum(1 for c in cc_deltas if c<0)} / 0{sum(1 for c in cc_deltas if c==0)} / +{sum(1 for c in cc_deltas if c>0)})")
    print(f"  MI Δ avg: {sum(mi_deltas)/len(mi_deltas):.2f}" if mi_deltas else "  MI Δ avg: N/A")
    print(f"  Interception rate: {(t1+t2a+t2b+t2c)/total_tiers*100:.0f}%" if total_tiers else "  Interception rate: N/A")
    print(f"  Resolution rate: {resolved/(resolved+exhausted)*100:.0f}%" if (resolved+exhausted) else "  Resolution rate: N/A")
    print(f"\n  Per intent:")
    for intent in sorted(per_intent):
        c = per_intent[intent]["count"]
        p = per_intent[intent]["passed"]
        print(f"    {intent:<30} {p:3d}/{c:3d} ({p*100//c:3d}%)")
    print(f"\n  Per difficulty:")
    for d in ["Easy", "Medium", "Hard"]:
        c = per_diff[d]["count"]
        p = per_diff[d]["passed"]
        print(f"    {d:<10} {p:3d}/{c:3d} ({p*100//c:3d}%)")
    print(f"{'='*55}")


def cmd_csr(args: argparse.Namespace) -> None:
    """Compilation success rate — runs javac on every refactored entry."""
    entries = load_entries(args.dir)
    if not entries:
        print(f"No batch files in {args.dir}"); sys.exit(1)

    results = []
    for e in entries:
        num = e.get("num", 0)
        refactored = e.get("final_code", "")
        if not refactored or e.get("code_unchanged"):
            results.append({"num": num, "pass": True}); continue
        wrapped = wrap_code(refactored)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.java', delete=False) as f:
            f.write(wrapped); src = f.name
        try:
            r = subprocess.run(["javac", "--release", "25", "-cp", STUBS_DIR, src], capture_output=True, text=True, timeout=30)
            results.append({"num": num, "pass": r.returncode == 0, "errors": r.stderr[:200] if r.stderr else []})
        except FileNotFoundError:
            results.append({"num": num, "pass": False, "errors": ["javac not found"]})
        finally:
            try: os.unlink(src)
            except: pass

    passed = sum(1 for r in results if r["pass"])
    print(f"\nCSR: {passed}/{len(results)} ({passed*100//len(results)}%) compiled successfully")
    fails = [r for r in results if not r["pass"]]
    if fails:
        print(f"  Failed entries: {len(fails)}")
        for f in fails[:5]:
            print(f"    #{f['num']}: {str(f.get('errors',''))[:80]}")


def cmd_ber(args: argparse.Namespace) -> None:
    """Behavioral equivalence rate — compile + run tests against refactored code."""
    # BER helper templates
    _BUILD_LIST = """
    static ListNode _buildList(int... vals) {
        if (vals.length == 0) return null;
        ListNode head = new ListNode(vals[0]);
        ListNode cur = head;
        for (int i = 1; i < vals.length; i++) { cur.next = new ListNode(vals[i]); cur = cur.next; }
        return head; }"""

    _PRINT_RESULT = """
    static int _nodeVal(ListNode n) {
        for (String fn : new String[]{"val","value"}) { try {
            java.lang.reflect.Field f = n.getClass().getDeclaredField(fn); f.setAccessible(true);
            return f.getInt(n);
        } catch (Exception e) {} }
        return -1; }
    static String _printResult(Object o) {
        if (o == null) return "null";
        if (o instanceof ListNode) {
            StringBuilder sb = new StringBuilder("["); ListNode n = (ListNode) o;
            while (n != null) { sb.append(_nodeVal(n)); n = n.next; if (n != null) sb.append(","); }
            sb.append("]"); return sb.toString();
        }
        if (o instanceof int[]) {
            int[] a = (int[]) o; StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) { sb.append(a[i]); if (i < a.length-1) sb.append(","); }
            sb.append("]"); return sb.toString();
        }
        return o.toString();
    }"""

    entries = load_entries(args.dir)
    if not entries:
        print(f"No batch files in {args.dir}"); sys.exit(1)

    dataset = {}
    if os.path.exists(args.dataset):
        with open(args.dataset) as f:
            for de in json.load(f):
                dataset[de["num"]] = de

    def _parse_test_params(text: str, params: list) -> list[tuple[str, str]]:
        text = text.strip().replace('\\[', '[').replace('\\]', ']').replace('\\n', '\n')
        if '=' in text:
            pairs = []; i = 0
            while i < len(text):
                m = re.match(r'(\w+)\s*=\s*', text[i:])
                if not m: break
                name = m.group(1); i += m.end()
                if i < len(text) and text[i] == '[':
                    d = 0; j = i
                    while j < len(text) and (d > 0 or text[j] == '['):
                        if text[j] == '[': d += 1
                        elif text[j] == ']': d -= 1
                        j += 1
                    value = '[' + text[i+1:j-1] + ']' if j > i else text[i:j]; i = j
                elif i < len(text) and text[i] == '"':
                    j = i+1
                    while j < len(text) and text[j] != '"': j += 1
                    value = text[i:j+1]; i = j+1
                else:
                    j = i
                    while j < len(text) and text[j] not in (',','\n'): j += 1
                    value = text[i:j].strip(); i = j
                pairs.append((name, value))
                while i < len(text) and text[i] in (',',' ','\n','\t'): i += 1
            if pairs: return pairs
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        return [(params[idx][1], line) for idx, line in enumerate(lines) if idx < len(params)]

    def _default_for_type(ptype: str) -> str:
        return {'int':'0','long':'0','short':'0','byte':'0','double':'0.0','float':'0.0','boolean':'false',
                'string':'""','ListNode':'null','TreeNode':'null','list':'null'}.get(ptype.lower(), 'null')

    def _token_to_java(token: str, ptype: str) -> str:
        token = token.strip()
        if ptype.lower() in ('int','long','double','float','boolean','short','byte'):
            return token
        if ptype.lower() == 'string':
            return f'"{token}"'
        if ptype == 'ListNode':
            nums = [n.strip() for n in token.strip('[]').split(',') if n.strip()]
            return f'_bl({",".join(nums)})' if nums else 'null'
        if token.startswith('[') and token.endswith(']'):
            inner = token[1:-1].strip()
            if inner:
                elems = [e.strip() for e in inner.split(',')]
                if ptype.lower() in ('string[]',):
                    return f"new String[]{{{','.join(chr(34)+e+chr(34) for e in elems)}}}"
                return f"new int[]{{{','.join(elems)}}}"
        return token

    for e in entries:
        num = e.get("num", 0)
        refactored = e.get("final_code", "")
        if not refactored or e.get("code_unchanged"):
            print(f"  #{num}: unchanged — skip"); continue
        info = parse_method_info(refactored)
        if not info:
            print(f"  #{num}: no method found — skip"); continue
        method_name, params = info
        wrapped = wrap_code(refactored)
        class_name = 'Wrapper'
        for m in re.finditer(r'class\s+(\w+)\s*\{', wrapped):
            class_name = m.group(1)
        td = dataset.get(num)
        if not td:
            print(f"  #{num}: no test data — skip"); continue

        pub_input = td.get("public_tests_input", "")
        pub_output = td.get("public_tests_output", "")
        priv_inputs = td.get("private_tests_input", [])
        priv_outputs = td.get("private_tests_output", [])

        print(f"  #{num}: running {len(priv_inputs)} private tests...", end="", flush=True)
        total_pass = 0; total_tests = 0; fail_info = []

        # Generate wrapper — shared helper + test main
        def _make_test_wrapper(test_input: str) -> str:
            pairs = _parse_test_params(test_input, params)
            args = []
            for ptype, pname in params:
                token = ""
                for tn, tv in pairs:
                    if tn.lower() == pname.lower():
                        token = tv; break
                args.append(_token_to_java(token, ptype) if token else _default_for_type(ptype))
            call = f'new {class_name}().{method_name}({",".join(args)})'
            return f'class _BW_ {{\n{_BUILD_LIST}\n{_PRINT_RESULT}\npublic static void main(String[] a){{System.out.println(_printResult({call})));}}\n}}'

        # Test helpers
        def norm(s: str) -> str:
            return s.strip().replace('\n','').replace(' ','').replace('\\[','[').replace('\\]',']')

        for test_in, test_out in [(pub_input, pub_output)] + list(zip(priv_inputs, priv_outputs)):
            if not test_in.strip(): continue
            total_tests += 1
            tw = _make_test_wrapper(test_in)
            combined = 'import java.util.*;\n' + wrapped.strip() + '\n' + tw
            with tempfile.NamedTemporaryFile(mode='w', suffix='.java', delete=False) as f:
                f.write(combined); src = f.name
            try:
                r = subprocess.run(["javac", "--release", "25", "-cp", STUBS_DIR, src],
                                   capture_output=True, text=True, timeout=15)
                if r.returncode != 0:
                    fail_info.append({test_in[:30] + "...": "compile fail"})
                    continue
                tmpdir = os.path.dirname(src)
                r2 = subprocess.run(["java", "-cp", f"{tmpdir}:{STUBS_DIR}", "_BW_"],
                                    capture_output=True, text=True, timeout=10)
                actual = r2.stdout.strip().replace('\n','')
                expected = norm(test_out)
                if actual == expected:
                    total_pass += 1
                else:
                    fail_info.append({test_in[:20]: f"exp={expected[:40]} act={actual[:40]}"})
            except Exception as ex:
                fail_info.append({test_in[:20]: f"err={str(ex)[:40]}"})
            finally:
                try: os.unlink(src)
                except: pass

        mark = "✓" if total_pass == total_tests else "✗"
        print(f" {mark} {total_pass}/{total_tests}", end="")
        if fail_info:
            print(f" {fail_info[0]}", end="")
        print()
        if total_tests > 0:
            pass


def cmd_halstead(args: argparse.Namespace) -> None:
    """Compute Halstead metrics for a Java file."""
    from app.utils.halstead import compute_mi
    code = open(args.code).read() if os.path.exists(args.code) else args.code
    _, mi1 = compute_mi(code, 0)
    print(f"MI (CC=0): {mi1}")
    for line in code.split('\n'):
        if 'public int' in line or 'public boolean' in line or 'public ListNode' in line or 'public String' in line or 'public double' in line or 'public long' in line:
            print(f"  Found method: {line.strip()[:80]}")


# ═══════════════════════════════════════════════════════════════════
# SECTION 3: Main dispatch
# ═══════════════════════════════════════════════════════════════════

async def _run_multi_cmd(args: argparse.Namespace) -> None:
    from app.modules.agent_service import AgentService
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
        print(f"{mark} | {r.get('exit_status','?'):15} | CC Δ={r.get('cc_delta',0):+d} | {r.get('duration_ms',0)//1000}s")

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


async def _run_single_cmd(args: argparse.Namespace) -> None:
    from app.modules.agent_service import AgentService
    from app.modules.validator import Validator
    from app.utils.performance import PerformanceTracker
    from app.utils.response_parser import ResponseParser

    import yaml
    from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH

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
            t0 = time.time(); r = await original_generate(messages, **kwargs);
            ms = int((time.time()-t0)*1000); raw = r.get("choices",[{}])[0].get("message",{}).get("content","");
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
        print(f"{mark} | CC Δ={cc_delta:+d} | {dur//1000}s")

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


def cmd_report(args: argparse.Namespace) -> None:
    """Generate full report CSV from benchmark results, with optional CSR/BER."""
    from app.utils.halstead import compute_mi

    if args.ber and not args.dataset:
        print("ERROR: --dataset required when using --ber"); sys.exit(1)

    entries = load_entries(args.dir)
    if not entries:
        print(f"No batch files found in {args.dir}"); sys.exit(1)

    total = len(entries)
    out_path = args.output or f"report_{args.mode}.csv"
    is_multi = args.mode == "multi"

    print(f"Loaded {total} entries from {args.dir}")

    # Load dataset for BER
    ber_dataset = {}
    if args.ber and args.dataset and os.path.exists(args.dataset):
        with open(args.dataset) as f:
            for de in json.load(f):
                ber_dataset[de["num"]] = de
        print(f"  Dataset: {len(ber_dataset)} entries for test cases")

    rows = []
    tot_t1 = tot_t2a = tot_t2b = tot_t2c = tot_t3 = 0
    for idx, e in enumerate(entries):
        num = e.get("num", 0)
        diff = e.get("difficulty", "?")
        intent = e.get("intent", "?")
        status = e.get("status", "FAIL")
        exit_st = e.get("exit_status", "?")
        dur = e.get("duration_ms", 0)
        unchanged = e.get("code_unchanged", False)
        orig_cc = e.get("original_cc", 0)
        refa_cc = e.get("refactored_cc", 0)
        cc_delta = e.get("cc_delta", 0)

        # Halstead MI
        final_code = e.get("final_code", "")
        _, orig_mi = compute_mi(e.get("original_code", ""), orig_cc)
        _, refa_mi = compute_mi(final_code, refa_cc) if not unchanged and final_code.strip() else (None, orig_mi)
        mi_delta = round(refa_mi - orig_mi, 2)

        # Multi-only fields
        phase4_pass = e.get("phase4_pass", False) if is_multi else "N/A"
        judge_v = e.get("judge_verdict", "N/A") if is_multi else "N/A"
        strat_iter = e.get("strategy_iter", "N/A") if is_multi else "N/A"
        syn_iter = e.get("syntax_iter", "N/A") if is_multi else "N/A"

        # Phase4 tier counts
        t1 = t2a = t2b = t2c = t3 = 0
        if is_multi:
            for f in e.get("phase4_findings", []):
                tier = f.get("tier", "")
                if "TIER_1" in tier: t1 += 1
                elif "TIER_2_A" in tier: t2a += 1
                elif "TIER_2_B" in tier: t2b += 1
                elif "TIER_2_C" in tier: t2c += 1
                elif "TIER_3" in tier: t3 += 1
        tot_t1 += t1; tot_t2a += t2a; tot_t2b += t2b; tot_t2c += t2c; tot_t3 += t3

        # Gen timings
        gen_steps = len(e.get("gen_timings", [])) if is_multi else "N/A"
        gen_times = [g.get("time_ms", 0) for g in e.get("gen_timings", [])]
        avg_gen_ms = round(sum(gen_times) / len(gen_times), 0) if gen_times else "N/A"

        # GPU
        gpu_val = e.get("gpu_metrics", {}).get("peak_memory_used_mb", 0)
        gpu_mb = round(gpu_val / (1024*1024), 0) if gpu_val > 10_000_000 else gpu_val

        # CSR + BER (integrated — single compilation pass when both requested)
        csr_pass = ber_val = pub_p = priv_p = "-"
        if not final_code.strip() or unchanged:
            pass
        elif args.ber and args.dataset:
            # BER with test wrapper — also serves as CSR check
            result = _check_entry_ber(e, ber_dataset.get(num))
            csr_pass = result["csr"]
            if result["ber"]:
                ber_val = 1.0
            elif result["csr"] and result["has_input"]:
                ber_val = 0.0
            pub_p = 1 if result["ber"] else 0
            priv_p = 0
        elif args.csr:
            # CSR only — compile bare code
            with tempfile.NamedTemporaryFile(mode='w', suffix='.java', delete=False) as f:
                f.write(wrap_code(final_code) if final_code else ""); src = f.name
            try:
                r = subprocess.run(["javac", "--release", "25", "-cp", STUBS_DIR, src],
                                   capture_output=True, text=True, timeout=15)
                csr_pass = r.returncode == 0
            except FileNotFoundError:
                csr_pass = "ERR"
            finally:
                try: os.unlink(src)
                except: pass

        # Progress
        mi_str = f"MI={refa_mi:.1f}" if refa_mi else "MI=-"
        csr_str = f" {'✓' if csr_pass is True else '✗'}javac" if args.csr else ""
        ber_str = f" ber={ber_val:.2f}" if args.ber and isinstance(ber_val, (int, float)) else ""
        print(f"  [{idx+1:3d}/{total}] #{num} ({diff}) [{intent:<25}] → {mi_str}{csr_str}{ber_str}")

        row = {
            "num": num, "difficulty": diff, "intent": intent,
            "exit_status": exit_st, "status": status,
            "phase4_pass": phase4_pass, "judge_verdict": judge_v,
            "original_cc": orig_cc, "refactored_cc": refa_cc, "cc_delta": cc_delta,
            "original_mi": round(orig_mi, 2), "refactored_mi": round(refa_mi, 2), "mi_delta": mi_delta,
            "duration_ms": dur, "strategy_iter": strat_iter, "syntax_iter": syn_iter,
            "code_unchanged": unchanged, "gpu_peak_mb": gpu_mb,
            "tier1_syntax": t1, "tier2a_cc": t2a, "tier2b_boundary": t2b,
            "tier2c_intent_math": t2c, "tier3_judge": t3,
            "gen_steps": gen_steps, "avg_gen_ms": avg_gen_ms,
            "csr_pass": csr_pass, "ber": ber_val,
            "public_passed": pub_p, "private_passed": priv_p,
            "unchanged": unchanged,
        }
        rows.append(row)

    # Build summary
    total_good = sum(1 for r in rows if r["status"] == "PASS")
    cc_deltas = [r["cc_delta"] for r in rows]
    mi_deltas = [r["mi_delta"] for r in rows if isinstance(r["mi_delta"], (int, float))]
    tiers_total = tot_t1 + tot_t2a + tot_t2b + tot_t2c + tot_t3
    resolved = sum(1 for r in rows if is_multi and isinstance(r["strategy_iter"], int) and r["strategy_iter"] > 1 and r["exit_status"] == "SUCCESS")
    exhausted = sum(1 for r in rows if r["exit_status"] == "ABORT_STRATEGY")
    csr_good = sum(1 for r in rows if r["csr_pass"] is True)
    csr_total = total
    ber_pass = sum(1 for r in rows if r.get("public_passed") == 1)
    ber_attempted = sum(1 for r in rows if r["csr_pass"] is True)
    ber_sum = sum(r["ber"] for r in rows if isinstance(r["ber"], (int, float)))

    per_intent = {}
    for r in rows:
        i = r["intent"]
        if i not in per_intent:
            per_intent[i] = {"count": 0, "passed": 0, "cc": 0, "mi": 0, "dur": 0}
        per_intent[i]["count"] += 1
        per_intent[i]["passed"] += 1 if r["status"] == "PASS" else 0
        per_intent[i]["cc"] += r["cc_delta"]
        per_intent[i]["mi"] += r["mi_delta"] if isinstance(r["mi_delta"], (int, float)) else 0
        per_intent[i]["dur"] += r["duration_ms"]

    per_diff = {}
    for r in rows:
        d = r["difficulty"]
        if d not in per_diff:
            per_diff[d] = {"count": 0, "passed": 0}
        per_diff[d]["count"] += 1
        per_diff[d]["passed"] += 1 if r["status"] == "PASS" else 0

    # Write CSV
    csv_cols = [
        "num","difficulty","intent","exit_status","status","phase4_pass","judge_verdict",
        "original_cc","refactored_cc","cc_delta","original_mi","refactored_mi","mi_delta",
        "duration_ms","strategy_iter","syntax_iter","code_unchanged","gpu_peak_mb",
        "tier1_syntax","tier2a_cc","tier2b_boundary","tier2c_intent_math","tier3_judge",
        "gen_steps","avg_gen_ms","csr_pass","ber","public_passed","private_passed",
    ]

    with open(out_path, "w") as f:
        f.write(",".join(csv_cols) + "\n")
        for r in rows:
            vals = [str(r.get(c, "")) for c in csv_cols]
            f.write(",".join(vals) + "\n")

    print(f"\nSaved: {out_path}")

    # Terminal table
    print(f"\n{'='*60}")
    print(f"REPORT — {args.dir} ({args.mode}-agent)")
    print(f"{'='*60}")
    print(f"  Pass rate:      {total_good}/{total} ({total_good*100//total}%)")
    print(f"  Avg CC Δ:       {sum(cc_deltas)/len(cc_deltas):.2f}  (-{sum(1 for c in cc_deltas if c<0)} / 0{sum(1 for c in cc_deltas if c==0)} / +{sum(1 for c in cc_deltas if c>0)})")
    if mi_deltas:
        print(f"  Avg MI Δ:       {sum(mi_deltas)/len(mi_deltas):.2f}")
    print(f"  Avg duration:   {sum(r['duration_ms'] for r in rows)//len(rows)//1000}s")
    if is_multi and tiers_total:
        print(f"  Interception:   {(tot_t1+tot_t2a+tot_t2b+tot_t2c)*100//tiers_total}%  Resolution: {resolved*100//max(1,resolved+exhausted)}%")
    if csr_total:
        print(f"  CSR:            {csr_good}/{csr_total} ({csr_good*100//csr_total}%)", end="")
    if ber_attempted:
        print(f"  BER (public):   {ber_pass}/{ber_attempted} ({ber_pass*100//ber_attempted}%)", end="")
    print()
    print(f"\n  Per intent:")
    for intent in sorted(per_intent):
        c = per_intent[intent]
        pct = c["passed"]*100//max(1,c["count"])
        bar = "█" * (pct // 5)
        print(f"    {intent:<30} {c['passed']:3d}/{c['count']:3d} ({pct:3d}%) CC={c['cc']/max(1,c['count']):.1f} {bar}")
    print(f"{'='*60}")


def _check_entry_ber(entry: dict, dataset_entry: dict | None) -> dict:
    """Run CSR + public BER for one entry. Returns {csr, ber, has_input, unchanged}."""
    num = entry.get("num", 0)
    final = entry.get("final_code", "")
    unchanged = entry.get("code_unchanged", False)
    csr_ok = False
    ber_ok = False
    pub_in = None

    if not unchanged and final:
        wrapped = wrap_code(final)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.java', delete=False) as f:
            f.write(wrapped)
            src = f.name
        try:
            r = subprocess.run(["javac", "--release", "25", "-cp", STUBS_DIR, src],
                               capture_output=True, text=True, timeout=15)
            csr_ok = r.returncode == 0
        except Exception:
            csr_ok = False
        finally:
            try: os.unlink(src)
            except: pass

    if csr_ok and dataset_entry:
        raw_in = dataset_entry.get("public_tests_input", "")
        raw_out = dataset_entry.get("public_tests_output", "")
        pub_in = raw_in.strip()
        pub_out = raw_out.strip()

        if pub_in and pub_out:
            info = parse_method_info(final)
            if info:
                method_name, params = info
                wrapped = wrap_code(final)
                class_name = "Wrapper"
                for m in re.finditer(r'class\s+(\w+)\s*\{', wrapped):
                    class_name = m.group(1)

                pairs = _parse_ber_params(pub_in, params)
                args = []
                for ptype, pname in params:
                    token = ""
                    for tn, tv in pairs:
                        if tn.lower() == pname.lower():
                            token = tv
                            break
                    args.append(_ber_token_to_java(token, ptype) if token else 'null')

                call = f'new {class_name}().{method_name}({",".join(args)})'

                bl_def = ("static ListNode _bl(int... v){if(v.length==0)return null;"
                    "ListNode h=new ListNode(v[0]);ListNode c=h;"
                    "for(int i=1;i<v.length;i++){c.next=new ListNode(v[i]);c=c.next;}return h;}")
                nv_def = ("static int _nv(ListNode n){"
                    'for(String fn:new String[]{"val","value"}){'
                    "try{java.lang.reflect.Field f=n.getClass().getDeclaredField(fn);"
                    "f.setAccessible(true);return f.getInt(n);}catch(Exception e){}"
                    "}return -1;}")
                pr_def = ("static String _pr(Object o){"
                    'if(o==null)return"null";'
                    "if(o instanceof ListNode){StringBuilder sb=new StringBuilder(\"[\");ListNode n=(ListNode)o;"
                    "while(n!=null){sb.append(_nv(n));n=n.next;if(n!=null)sb.append(',');}"
                    'sb.append("]");return sb.toString();}'
                    "if(o instanceof int[]){int[]a=(int[])o;StringBuilder sb=new StringBuilder(\"[\");"
                    "for(int i=0;i<a.length;i++){sb.append(a[i]);if(i<a.length-1)sb.append(',');}"
                    'sb.append("]");return sb.toString();}'
                    "return o.toString();}")

                helpers = bl_def + nv_def + pr_def
                main_body = f'System.out.println(_pr({call}));'
                tw = "class _BW_{" + helpers + "public static void main(String[]a){" + main_body + "}}"

                combined = 'import java.util.*;\n' + wrapped.strip() + '\n' + tw
                with tempfile.NamedTemporaryFile(mode='w', suffix='.java', delete=False) as f:
                    f.write(combined)
                    src = f.name
                try:
                    r = subprocess.run(["javac", "--release", "25", "-cp", STUBS_DIR, src],
                                       capture_output=True, text=True, timeout=15)
                    if r.returncode == 0:
                        tmpdir = os.path.dirname(src)
                        r2 = subprocess.run(["java", "-cp", f"{tmpdir}:{STUBS_DIR}", "_BW_"],
                                            capture_output=True, text=True, timeout=10)
                        actual = r2.stdout.strip().replace('\n','').replace(' ','')
                        expected = pub_out.strip().replace('\n','').replace(' ','').replace('\\[','[').replace('\\]',']')
                        if actual == expected:
                            ber_ok = True
                except Exception:
                    pass
                finally:
                    try: os.unlink(src)
                    except: pass

    return {"num": num, "csr": csr_ok, "ber": ber_ok, "has_input": bool(pub_in), "unchanged": unchanged}


def _parse_ber_params(text: str, params: list) -> list[tuple[str, str]]:
    """Parse LeetCode test input format. Returns (param_name, value_string) pairs."""
    text = text.strip().replace('\\[','[').replace('\\]',']').replace('\\n','\n')
    if '=' in text:
        pairs = []; i = 0
        while i < len(text):
            m = re.match(r'(\w+)\s*=\s*', text[i:])
            if not m: break
            name = m.group(1); i += m.end()
            if i < len(text) and text[i] == '[':
                d = 0; j = i
                while j < len(text) and (d > 0 or text[j] == '['):
                    if text[j] == '[': d += 1
                    elif text[j] == ']': d -= 1
                    j += 1
                value = '[' + text[i+1:j-1] + ']' if j > i else text[i:j]; i = j
            elif i < len(text) and text[i] == '"':
                j = i + 1
                while j < len(text) and text[j] != '"': j += 1
                value = text[i:j+1]; i = j + 1
            else:
                j = i
                while j < len(text) and text[j] not in (',','\n'): j += 1
                value = text[i:j].strip(); i = j
            pairs.append((name, value))
            while i < len(text) and text[i] in (',',' ','\n','\t'): i += 1
        if pairs: return pairs
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    return [(params[min(idx, len(params)-1)][1], line) for idx, line in enumerate(lines)]


def _ber_token_to_java(token: str, ptype: str) -> str:
    """Convert a LeetCode test token to a Java value."""
    token = token.strip()
    ptype_l = ptype.lower()
    if ptype_l in ('int','long','double','float','boolean','short','byte'):
        return token
    if ptype_l == 'string':
        return f'"{token}"'
    if ptype == 'ListNode':
        nums = [n.strip() for n in token.strip('[]').split(',') if n.strip()]
        return f'_bl({",".join(nums)})' if nums else 'null'
    if token.startswith('[') and token.endswith(']'):
        inner = token[1:-1].strip()
        if inner and ptype_l in ('int[]',):
            return f"new int[]{{{','.join(e.strip() for e in inner.split(','))}}}"
    return token


def main():
    parser = _build_shared_parser()
    args = parser.parse_args()

    if args.command == "run-multi":
        asyncio.run(_run_multi_cmd(args))
    elif args.command == "run-single":
        asyncio.run(_run_single_cmd(args))
    elif args.command == "aggregate":
        cmd_aggregate(args)
    elif args.command == "csr":
        cmd_csr(args)
    elif args.command == "ber":
        cmd_ber(args)
    elif args.command == "halstead":
        cmd_halstead(args)
    elif args.command == "report":
        cmd_report(args)


if __name__ == "__main__":
    main()
