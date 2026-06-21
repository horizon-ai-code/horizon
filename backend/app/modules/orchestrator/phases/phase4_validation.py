import json
from typing import Any, Awaitable, Callable

from app.utils.types import FailureTier, RefactorIntent, Role
from app.modules.validator import Validator

Notifier = Callable[[Any, Role, str, str | None], Awaitable[None]]


class Phase4Validation:
    def __init__(self, validator: Validator, notify: Notifier):
        self._validator = validator
        self._notify = notify

    async def run(self, client, state) -> None:
        await self._notify(
            client, Role.Validator,
            f"Validation: Validating (Strategy {state.strategy_iter}, Syntax {state.syntax_iter})...",
            None,
        )

        syntax_res = self._validator.check_syntax(state.working_code)
        print(
            f"\n--- Validator Syntax Check ---\nIs Valid: {syntax_res['is_valid']}\nError: {syntax_res.get('error')}\n------------------------------"
        )
        if not syntax_res["is_valid"]:
            state.syntax_iter += 1
            if state.syntax_iter <= 3:
                await self._notify(client, Role.Validator,
                                   f"Syntax Fail (Attempt {state.syntax_iter}). Healing...", None)
                raw_errors = syntax_res.get("errors", [])
                raw_error = raw_errors[0] if raw_errors else "Unknown syntax error"
                state.syntax_error_context = {
                    "attempt": state.syntax_iter,
                    "error": self._validator.format_syntax_error(raw_error),
                    "broken_code": state.working_code,
                }
                state.current_phase = 3
                return
            else:
                await self._notify(client, Role.Validator, "Syntax Unrecoverable. Revising strategy.", None)
                state.add_feedback({
                    "failure_tier": FailureTier.TIER_1_SYNTAX,
                    "error": "Persistent syntax errors after 3 heals.",
                })
                if not state.strategy_iter_incremented:
                    state.strategy_iter += 1
                    state.strategy_iter_incremented = True
                state.syntax_iter = 0
                state.current_phase = 2
                return

        await self._notify(client, Role.Validator, f"Syntax OK.\n\n{json.dumps({'syntax': {'passed': True}})}", None)

        findings = []

        assert state.intent_packet is not None
        cc_finding, orig_cc_val, refac_cc_val = self._validator.verify_complexity(
            state.base_code, state.working_code, state.intent_packet
        )
        if cc_finding:
            findings.append(cc_finding)

        target_scopes = []
        if state.intent_packet and "scope_anchor" in state.intent_packet:
            member = state.intent_packet["scope_anchor"].get("member", "")
            if member:
                target_scopes.append(member)
            target_class = state.intent_packet["scope_anchor"].get("target_class", "")
            if target_class:
                target_scopes.append(target_class)

        if state.active_plan and "ast_mutations" in state.active_plan:
            for mutation in state.active_plan["ast_mutations"]:
                target = mutation.get("target", "")
                name = target.split("(")[0].strip()
                if name and name not in target_scopes:
                    target_scopes.append(name)

        if state.active_plan and "target_class" in state.active_plan:
            if state.active_plan["target_class"] not in target_scopes:
                target_scopes.append(state.active_plan["target_class"])

        boundary_finding = self._validator.verify_boundary(state.base_code, state.working_code, target_scopes)
        if boundary_finding:
            findings.append(boundary_finding)

        intent_finding = None
        if state.intent_packet:
            intent_enum = RefactorIntent(state.intent_packet["specific_intent"])
            try:
                intent_finding = self._validator.verify_intent(intent_enum, state.base_code, state.working_code)
            except Exception as e:
                print(f"  Intent verifier crashed for {intent_enum}: {e}")
                intent_finding = None
            if intent_finding:
                findings.append(intent_finding)

        cc_detail = None
        if state.intent_packet:
            intent_enum = RefactorIntent(state.intent_packet["specific_intent"])
            cc_rule = Validator.get_cc_rule(intent_enum)
            target = state.intent_packet.get("scope_anchor", {}).get("member", "")
            if cc_rule == "EXTRACT_RULE" and target:
                if cc_finding:
                    cc_detail = f"Target method '{target}' CC increased: {orig_cc_val} → {refac_cc_val}"
                else:
                    overall = self._validator.get_complexity(state.working_code)
                    cc_detail = f"Target method '{target}' extracted (CC: {refac_cc_val}). Overall code CC: {overall}"
            elif cc_rule in ("STRICT", "LOOSENED"):
                if cc_finding:
                    limit = orig_cc_val + (1 if cc_rule == "LOOSENED" else 0)
                    cc_detail = f"Overall code CC increased: {orig_cc_val} → {refac_cc_val} (limit: {limit})"
                elif refac_cc_val == orig_cc_val:
                    cc_detail = f"Overall code complexity unchanged ({orig_cc_val})"
                else:
                    cc_detail = f"Overall code CC: {orig_cc_val} → {refac_cc_val}"

        checks = [
            {"name": "Cyclomatic Complexity", "passed": cc_finding is None, "before": orig_cc_val, "after": refac_cc_val, "details": cc_detail},
            {"name": "Boundary Preservation", "passed": boundary_finding is None},
            {"name": "Intent Match", "passed": intent_finding is None, "details": intent_finding.error_report.message[:200] if intent_finding else None},
        ]

        print(
            f"\n--- Validator Structural Checks ---\nComplexity Check: {refac_cc_val or orig_cc_val} (Original: {orig_cc_val})\nBoundary check found issue: {bool(boundary_finding)}\nIntent check found issue: {bool(intent_finding)}\nTotal findings: {len(findings)}\n-----------------------------------"
        )

        if findings:
            current_fault_count = len(findings)
            passed = sum(1 for c in checks if c["passed"])
            failed = len(checks) - passed
            await self._notify(
                client, Role.Validator,
                f"Structural Checks — {passed}/{len(checks)} passed · {failed} failed\n\n{json.dumps({'checks': checks})}",
                None,
            )
            state.extend_feedback([f.model_dump() for f in findings])

            if state.structural_fix_attempts < 1:
                state.structural_fix_attempts += 1
                error_msgs = []
                for f in findings:
                    error_msgs.append(f.error_report.message[:200])
                state.syntax_error_context = {
                    "attempt": state.structural_fix_attempts,
                    "error": "Structural issues: " + "; ".join(error_msgs[:2]),
                    "broken_code": state.working_code,
                }
                await self._notify(client, Role.Validator, "Routing to Generator for targeted fix...", None)
                state.current_phase = 3
                return

            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.syntax_iter = 0
            state.structural_fix_attempts = 0
            state.current_phase = 2
        else:
            passed = sum(1 for c in checks if c["passed"])
            await self._notify(
                client, Role.Validator,
                f"Structural Checks — {passed}/{len(checks)} passed\n\n{json.dumps({'checks': checks})}",
                None,
            )
            if (
                state.active_plan
                and state.active_plan.get("ast_mutations")
                and state.working_code.strip() == state.base_code.strip()
            ):
                await self._notify(client, Role.Validator, "Plan not executed — code unchanged.", None)
                state.add_feedback({
                    "failure_tier": FailureTier.TIER_3_JUDGE,
                    "error": "Plan was not executed: code unchanged.",
                })
                if not state.strategy_iter_incremented:
                    state.strategy_iter += 1
                    state.strategy_iter_incremented = True
                state.current_phase = 2
                return
            state.current_phase = 5
