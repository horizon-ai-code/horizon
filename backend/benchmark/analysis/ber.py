"""Behavioral Equivalence Rate (BER) — compile + run tests against refactored code."""
import json
import os
import re
import subprocess
import sys
import tempfile

from ..dataset import load_entries, wrap_code, parse_method_info, stubs_classpath


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


def cmd_ber(args) -> None:
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

    cp = stubs_classpath()

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
            return f'class _BW_ {{\n{_BUILD_LIST}\n{_PRINT_RESULT}\npublic static void main(String[] a){{System.out.println(_printResult({call}));}}\n}}'

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
                r = subprocess.run(["javac", "--release", "21", "-cp", cp, src],
                                   capture_output=True, text=True, timeout=15)
                if r.returncode != 0:
                    fail_info.append({test_in[:30] + "...": "compile fail"})
                    continue
                tmpdir = os.path.dirname(src)
                r2 = subprocess.run(["java", "-cp", f"{tmpdir}:{cp}", "_BW_"],
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


def _check_entry_ber(entry: dict, dataset_entry: dict | None) -> dict:
    """Run CSR + public BER for one entry. Returns {csr, ber, has_input, unchanged}."""
    num = entry.get("num", 0)
    final = entry.get("final_code", "")
    unchanged = entry.get("final_code", "").strip() == entry.get("original_code", "").strip()
    csr_ok = False
    ber_ok = False
    pub_in = None

    cp = stubs_classpath()

    if final:
        wrapped = wrap_code(final)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.java', delete=False) as f:
            f.write(wrapped)
            src = f.name
        try:
            r = subprocess.run(["javac", "--release", "21", "-cp", cp, src],
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
                    r = subprocess.run(["javac", "--release", "21", "-cp", cp, src],
                                       capture_output=True, text=True, timeout=15)
                    if r.returncode == 0:
                        tmpdir = os.path.dirname(src)
                        r2 = subprocess.run(["java", "-cp", f"{tmpdir}:{cp}", "_BW_"],
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
