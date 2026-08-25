"""Unified Horizon benchmark tool.

Usage:
  python -m benchmark run-multi --dataset <file> --batch N
  python -m benchmark run-single --dataset <file> --batch N
  python -m benchmark aggregate --dir <results_dir>
  python -m benchmark csr --dir <results_dir>
  python -m benchmark ber --dir <results_dir> --dataset <file>
  python -m benchmark halstead --code <file>
  python -m benchmark report --dir <results_dir> --mode multi --csr --ber
"""
import argparse
import asyncio
import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from .dataset import DEFAULT_DATASET, RESULTS_DIR  # noqa: E402


def _build_shared_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Horizon benchmarking tool")
    sub = p.add_subparsers(dest="command", required=True)

    # run-multi
    rm = sub.add_parser("run-multi", help="Run multi-agent pipeline")
    rm.add_argument("--dataset", type=str, default=DEFAULT_DATASET)
    rm.add_argument("--batch", type=int, default=None)
    rm.add_argument("--batch-size", type=int, default=50)
    rm.add_argument("--start", type=int, default=None)
    rm.add_argument("--end", type=int, default=None)
    rm.add_argument("--resume", action="store_true")
    rm.add_argument("--out-dir", type=str, default=os.path.join(RESULTS_DIR, "v2", "multi"))

    # run-single
    rs = sub.add_parser("run-single", help="Run single-model baseline")
    rs.add_argument("--dataset", type=str, default=DEFAULT_DATASET)
    rs.add_argument("--batch", type=int, default=None)
    rs.add_argument("--batch-size", type=int, default=50)
    rs.add_argument("--start", type=int, default=None)
    rs.add_argument("--end", type=int, default=None)
    rs.add_argument("--resume", action="store_true")
    rs.add_argument("--out-dir", type=str, default=os.path.join(RESULTS_DIR, "v2", "single"))

    # aggregate
    ag = sub.add_parser("aggregate", help="Summarize benchmark results (offline)")
    ag.add_argument("--dir", type=str, default=os.path.join(RESULTS_DIR, "v2", "multi"))

    # csr
    cs = sub.add_parser("csr", help="Compilation success rate (needs JDK)")
    cs.add_argument("--dir", type=str, default=os.path.join(RESULTS_DIR, "v2", "multi"))

    # ber
    be = sub.add_parser("ber", help="Behavioral equivalence rate (needs JDK)")
    be.add_argument("--dir", type=str, default=os.path.join(RESULTS_DIR, "v2", "multi"))
    be.add_argument("--dataset", type=str, default=DEFAULT_DATASET)

    # halstead
    ha = sub.add_parser("halstead", help="Halstead metrics for a Java file")
    ha.add_argument("--code", type=str, required=True)

    # report
    rp = sub.add_parser("report", help="Generate full report CSV with optional CSR/BER")
    rp.add_argument("--dir", type=str, required=True)
    rp.add_argument("--mode", type=str, choices=["multi", "single"], required=True)
    rp.add_argument("--output", type=str, default=None)
    rp.add_argument("--dataset", type=str, default=DEFAULT_DATASET)
    rp.add_argument("--csr", action="store_true")
    rp.add_argument("--ber", action="store_true")

    return p


def main():
    parser = _build_shared_parser()
    args = parser.parse_args()

    if args.command == "run-multi":
        from .runners.multi import _run_multi_cmd
        asyncio.run(_run_multi_cmd(args))
    elif args.command == "run-single":
        from .runners.single import _run_single_cmd
        asyncio.run(_run_single_cmd(args))
    elif args.command == "aggregate":
        from .analysis.aggregate import cmd_aggregate
        cmd_aggregate(args)
    elif args.command == "csr":
        from .analysis.csr import cmd_csr
        cmd_csr(args)
    elif args.command == "ber":
        from .analysis.ber import cmd_ber
        cmd_ber(args)
    elif args.command == "halstead":
        from .analysis.halstead import cmd_halstead
        cmd_halstead(args)
    elif args.command == "report":
        from .analysis.report import cmd_report
        cmd_report(args)


if __name__ == "__main__":
    main()
