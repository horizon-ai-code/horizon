"""Aggregate subcommand — summarize benchmark results (offline)."""
import sys
from collections import Counter

from ..dataset import load_entries


def cmd_aggregate(args) -> None:
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
        exit_st = e.get("exit_status", "")
        if exit_st in ("ABORT_STRATEGY", "NO_CHANGE"):
            refa_cc = orig_cc
            cc_delta = 0
        else:
            refa_cc = e.get("refactored_cc", 0)
            cc_delta = e.get("cc_delta", 0)
        _, omi = compute_mi(orig, orig_cc) if orig.strip() else (None, 0.0)
        _, rmi = compute_mi(refa, refa_cc) if refa.strip() and refa != orig else (None, 0.0)
        em.append({
            "num": e.get("num", 0), "difficulty": e.get("difficulty", "?"), "intent": e.get("intent", "?"),
            "exit_status": str(e.get("exit_status", "?")), "status": e.get("status", "FAIL"),
            "original_cc": orig_cc, "refactored_cc": refa_cc, "cc_delta": cc_delta,
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
    print("\n  Per intent:")
    for intent in sorted(per_intent):
        c = per_intent[intent]["count"]
        p = per_intent[intent]["passed"]
        print(f"    {intent:<30} {p:3d}/{c:3d} ({p*100//c:3d}%)")
    print("\n  Per difficulty:")
    for d in ["Easy", "Medium", "Hard"]:
        c = per_diff[d]["count"]
        p = per_diff[d]["passed"]
        print(f"    {d:<10} {p:3d}/{c:3d} ({p*100//c:3d}%)")
    print(f"{'='*55}")
