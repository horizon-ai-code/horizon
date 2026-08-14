"""Compilation Success Rate (CSR) subcommand — needs JDK."""
import os
import subprocess
import sys
import tempfile

from ..dataset import load_entries, wrap_code, stubs_classpath


def cmd_csr(args) -> None:
    entries = load_entries(args.dir)
    if not entries:
        print(f"No batch files in {args.dir}"); sys.exit(1)

    cp = stubs_classpath()
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
            r = subprocess.run(["javac", "--release", "21", "-cp", cp, src], capture_output=True, text=True, timeout=30)
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
