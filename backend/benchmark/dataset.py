"""Shared utilities for the Horizon benchmark tool."""
import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile

HERE = os.path.dirname(__file__)
STUBS_DIR = os.path.join(HERE, "stubs")
DATA_DIR = os.path.join(HERE, "data")
RESULTS_DIR = os.path.join(HERE, "results")

DEFAULT_DATASET = os.path.join(DATA_DIR, "dataset_final.json")


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


_STUBS_CP: str | None = None


def stubs_classpath() -> str:
    """Return classpath dir with compiled stubs, compiling from source at runtime.

    Compiles stubs/*.java with the current JDK into a temp dir so the
    classpath always matches the installed JDK (avoids Java 25 vs 21 drift).
    """
    global _STUBS_CP
    if _STUBS_CP is not None:
        return _STUBS_CP
    _STUBS_CP = STUBS_DIR
    javac = shutil.which("javac")
    java_files = sorted(f for f in os.listdir(STUBS_DIR) if f.endswith(".java"))
    if javac and java_files:
        tmp = tempfile.mkdtemp(prefix="horizon_stubs_")
        ok = True
        for f in java_files:
            r = subprocess.run([javac, "-d", tmp, os.path.join(STUBS_DIR, f)],
                               capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                ok = False
        if ok:
            _STUBS_CP = tmp
    return _STUBS_CP
