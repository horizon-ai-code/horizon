"""Halstead metrics subcommand."""
import os


def cmd_halstead(args) -> None:
    from app.utils.halstead import compute_mi
    code = open(args.code).read() if os.path.exists(args.code) else args.code
    _, mi1 = compute_mi(code, 0)
    print(f"MI (CC=0): {mi1}")
    for line in code.split('\n'):
        if 'public int' in line or 'public boolean' in line or 'public ListNode' in line or 'public String' in line or 'public double' in line or 'public long' in line:
            print(f"  Found method: {line.strip()[:80]}")
