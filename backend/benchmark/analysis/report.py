"""Full report CSV generation, with optional CSR/BER."""
import json
import os
import subprocess
import sys
import tempfile

from ..dataset import load_entries, wrap_code, stubs_classpath
from .ber import _check_entry_ber


def cmd_report(args) -> None:
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

    cp = stubs_classpath()

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
        unchanged = e.get("final_code", "").strip() == e.get("original_code", "").strip()
        orig_cc = e.get("original_cc", 0)
        if exit_st in ("ABORT_STRATEGY", "NO_CHANGE"):
            refa_cc = orig_cc
            cc_delta = 0
        else:
            refa_cc = e.get("refactored_cc", 0)
            cc_delta = e.get("cc_delta", 0)

        # Halstead MI
        final_code = e.get("final_code", "")
        _, orig_mi = compute_mi(e.get("original_code", ""), orig_cc)
        _, refa_mi = compute_mi(final_code, refa_cc) if final_code.strip() else (None, orig_mi)
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
        if not final_code.strip():
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
                r = subprocess.run(["javac", "--release", "21", "-cp", cp, src],
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
    print("\n  Per intent:")
    for intent in sorted(per_intent):
        c = per_intent[intent]
        pct = c["passed"]*100//max(1,c["count"])
        bar = "█" * (pct // 5)
        print(f"    {intent:<30} {c['passed']:3d}/{c['count']:3d} ({pct:3d}%) CC={c['cc']/max(1,c['count']):.1f} {bar}")
    print(f"{'='*60}")
