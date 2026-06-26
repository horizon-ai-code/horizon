import re
from collections.abc import Callable
from typing import Any

import javalang
import javalang.tree
import lizard

from app.utils.ast_walker import ASTWalker
from app.utils.code_utils import strip_import_lines
from app.utils.schemas import ErrorReport, ValidationFinding
from app.utils.types import FailureTier, RefactorIntent, StructureUnit

from .verifier import RefactorVerifier


class Validator:
    def __init__(self):
        self.templates = [
            lambda s: s,
            lambda s: f"class ASTWrapper {{\n{s}\n}}",
            lambda s: f"class ASTWrapper {{\nvoid m() {{\n{s}\n}}\n}}",
        ]
        self.line_offsets = [0, 1, 2]
        self.unit_map = {
            0: StructureUnit.CLASS_UNIT,
            1: StructureUnit.METHOD_UNIT,
            2: StructureUnit.STATEMENT_UNIT,
        }

        self.verifier_registry: dict[RefactorIntent, Callable] = {
            RefactorIntent.FLATTEN_CONDITIONAL: RefactorVerifier.verify_flatten_conditional,
            RefactorIntent.DECOMPOSE_CONDITIONAL: RefactorVerifier.verify_decompose_conditional,
            RefactorIntent.CONSOLIDATE_CONDITIONAL: RefactorVerifier.verify_consolidate_conditional,
            RefactorIntent.REMOVE_CONTROL_FLAG: RefactorVerifier.verify_remove_control_flag,
            RefactorIntent.REPLACE_LOOP_WITH_PIPELINE: RefactorVerifier.verify_replace_loop_with_pipeline,
            RefactorIntent.SPLIT_LOOP: RefactorVerifier.verify_split_loop,
            RefactorIntent.EXTRACT_METHOD: RefactorVerifier.verify_extract_method,
            RefactorIntent.INLINE_METHOD: RefactorVerifier.verify_inline_method,
            RefactorIntent.EXTRACT_VARIABLE: RefactorVerifier.verify_extract_variable,
            RefactorIntent.INLINE_VARIABLE: RefactorVerifier.verify_inline_variable,
            RefactorIntent.EXTRACT_CONSTANT: RefactorVerifier.verify_extract_constant,
            RefactorIntent.RENAME_SYMBOL: RefactorVerifier.verify_rename_symbol,
        }

    @staticmethod
    def format_syntax_error(error_str: str) -> str:
        match = re.search(r"line (\d+):(\d+) (.+)", error_str)
        if match:
            return f"[L{match.group(1)}:{match.group(2)}] {match.group(3)}. Fix and output valid Java only."
        return f"Syntax error: {error_str[:150]}. Fix and output valid Java only."

    def check_syntax(self, snippet: str) -> dict[str, Any]:
        clean_snippet = snippet.strip()
        result: dict[str, Any] = {"is_valid": False, "errors": [], "unit": None}
        if not clean_snippet:
            return result

        stripped = strip_import_lines(clean_snippet)
        for index, template in enumerate(self.templates):
            wrapped_code = template(stripped)
            try:
                tree = javalang.parse.parse(wrapped_code)
                result["is_valid"] = True
                result["unit"] = self.unit_map[index]
                result["ast"] = tree
                return result
            except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError) as e:
                result["errors"].append(str(e))
                continue
        return result

    def get_complexity(self, snippet: str) -> int:
        clean_snippet = snippet.strip()
        stripped = strip_import_lines(clean_snippet)
        max_cc = 1
        for template in self.templates:
            wrapped_code = template(stripped)
            try:
                javalang.parse.parse(wrapped_code)
            except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError):
                continue
            analysis = lizard.analyze_file.analyze_source_code(
                "mock.java", wrapped_code
            )
            if analysis.function_list:
                max_cc = max(f.cyclomatic_complexity for f in analysis.function_list)
                break
        return max_cc

    def get_method_complexity(self, snippet: str, method_name: str) -> int | None:
        clean_snippet = snippet.strip()
        stripped = strip_import_lines(clean_snippet)
        for template in self.templates:
            wrapped_code = template(stripped)
            try:
                javalang.parse.parse(wrapped_code)
            except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError):
                continue
            analysis = lizard.analyze_file.analyze_source_code(
                "mock.java", wrapped_code
            )
            for func in analysis.function_list:
                fname = func.name.split("::")[-1]
                if fname == method_name:
                    return func.cyclomatic_complexity
        return None

    def has_structural_change(self, orig_code: str, refac_code: str) -> bool:
        orig_res = self.check_syntax(orig_code)
        refac_res = self.check_syntax(refac_code)
        if not orig_res["is_valid"] or not refac_res["is_valid"]:
            return orig_code.strip() != refac_code.strip()
        orig_sig = ASTWalker.get_structural_signature(orig_res["ast"])
        refac_sig = ASTWalker.get_structural_signature(refac_res["ast"])
        return orig_sig != refac_sig

    def verify_intent(
        self, intent: RefactorIntent, orig_code: str, refac_code: str
    ) -> ValidationFinding | None:
        orig_res = self.check_syntax(orig_code)
        refac_res = self.check_syntax(refac_code)
        if not orig_res["is_valid"] or not refac_res["is_valid"]:
            return ValidationFinding(
                failure_tier=FailureTier.TIER_1_SYNTAX,
                error_report=ErrorReport(
                    message="Cannot verify intent: Syntax error in input."
                ),
                recovery_hint="Ensure both original and refactored code are syntactically valid.",
            )
        verifier = self.verifier_registry.get(intent)
        if not verifier:
            return None
        try:
            success, msg = verifier(orig_res["ast"], refac_res["ast"])
        except Exception as e:
            return ValidationFinding(
                failure_tier=FailureTier.TIER_2_C_INTENT_MATH,
                error_report=ErrorReport(
                    message=f"Verifier crashed: {str(e)[:100]}",
                ),
                recovery_hint="Check if the refactoring actually achieved the structural goal.",
            )
        if success:
            return None
        return ValidationFinding(
            failure_tier=FailureTier.TIER_2_C_INTENT_MATH,
            error_report=ErrorReport(message=msg),
            recovery_hint="Check if the refactoring actually achieved the structural goal.",
        )

    def verify_boundary(
        self, orig_code: str, refac_code: str, target_scopes: list[str]
    ) -> ValidationFinding | None:
        orig_res = self.check_syntax(orig_code)
        refac_res = self.check_syntax(refac_code)

        if not orig_res["is_valid"] or not refac_res["is_valid"]:
            return None

        orig_unit = orig_res["ast"]
        refac_unit = refac_res["ast"]

        orig_methods = {
            m.name: ASTWalker.get_structural_signature(m)
            for m in ASTWalker.find_nodes(orig_unit, javalang.tree.MethodDeclaration)
        }
        refac_methods = {
            m.name: ASTWalker.get_structural_signature(m)
            for m in ASTWalker.find_nodes(refac_unit, javalang.tree.MethodDeclaration)
        }

        for name, h in orig_methods.items():
            if name not in target_scopes and name in refac_methods:
                if h != refac_methods[name]:
                    return ValidationFinding(
                        failure_tier=FailureTier.TIER_2_B_BOUNDARY,
                        error_report=ErrorReport(
                            message=f"Boundary Violation: Method '{name}' was modified but was outside target scope(s).",
                            faulty_node=name,
                        ),
                        recovery_hint=f"Next plan must strictly preserve the body of '{name}'.",
                    )

        return None

    CC_RULES: dict[RefactorIntent, str] = {
        RefactorIntent.FLATTEN_CONDITIONAL: "LOOSENED",
        RefactorIntent.DECOMPOSE_CONDITIONAL: "EXTRACT_RULE",
        RefactorIntent.CONSOLIDATE_CONDITIONAL: "STRICT",
        RefactorIntent.REMOVE_CONTROL_FLAG: "STRICT",
        RefactorIntent.REPLACE_LOOP_WITH_PIPELINE: "STRICT",
        RefactorIntent.SPLIT_LOOP: "LOOSENED",
        RefactorIntent.EXTRACT_METHOD: "EXTRACT_RULE",
        RefactorIntent.INLINE_METHOD: "SKIP",
        RefactorIntent.EXTRACT_VARIABLE: "STRICT",
        RefactorIntent.INLINE_VARIABLE: "STRICT",
        RefactorIntent.EXTRACT_CONSTANT: "STRICT",
        RefactorIntent.RENAME_SYMBOL: "STRICT",
    }

    @staticmethod
    def get_cc_rule(intent: RefactorIntent) -> str:
        return Validator.CC_RULES.get(intent, "STRICT")

    def verify_complexity(
        self, base_code: str, working_code: str, intent_packet: dict
    ) -> tuple[ValidationFinding | None, int | None, int | None]:
        intent_enum = RefactorIntent(intent_packet["specific_intent"])
        cc_rule = self.get_cc_rule(intent_enum)
        orig_cc = self.get_complexity(base_code)

        if cc_rule == "SKIP":
            return (None, orig_cc, orig_cc)

        if cc_rule == "EXTRACT_RULE":
            target = intent_packet.get("scope_anchor", {}).get("member", "")
            if target:
                orig_mcc = self.get_method_complexity(base_code, target)
                refac_mcc = self.get_method_complexity(working_code, target)
                if orig_mcc is not None and refac_mcc is not None:
                    if refac_mcc > orig_mcc:
                        return (
                            ValidationFinding(
                                failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                                error_report=ErrorReport(
                                    message=f"CC of target method '{target}' increased from {orig_mcc} to {refac_mcc}"
                                ),
                                recovery_hint="Ensure the source method's complexity decreases after extraction.",
                            ),
                            orig_mcc,
                            refac_mcc,
                        )
                    return (None, orig_mcc, refac_mcc)
                if refac_mcc is None:
                    return (
                        ValidationFinding(
                            failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                            error_report=ErrorReport(
                                message=f"Target method '{target}' not found in refactored code."
                            ),
                            recovery_hint="Preserve the target method name in the refactored output.",
                        ),
                        orig_cc,
                        None,
                    )
            return (None, orig_cc, orig_cc)

        refac_cc = self.get_complexity(working_code)
        threshold = orig_cc + (1 if cc_rule == "LOOSENED" else 0)
        if refac_cc > threshold:
            return (
                ValidationFinding(
                    failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                    error_report=ErrorReport(
                        message=f"CC increased from {orig_cc} to {refac_cc} (limit: {threshold})"
                    ),
                    recovery_hint="Simplify logic to maintain or reduce complexity.",
                ),
                orig_cc,
                refac_cc,
            )
        return (None, orig_cc, refac_cc)
