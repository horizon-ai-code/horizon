import asyncio
import json
import re
from typing import Any, Dict, List, Optional

import yaml
from llama_cpp import ChatCompletionRequestMessage
from pydantic import BaseModel, ValidationError

from app.modules.agent_service import AgentService
from app.modules.connection_manager import ClientConnection
from app.modules.context_manager import DatabaseManager
from app.modules.validator import Validator
from app.utils.ast_matcher import ASTMatcher
from app.utils.formatters import format_agent_output, format_plan_for_generator
from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
from app.utils.performance import PerformanceTracker
from app.utils.response_parser import ResponseParser, detect_repetition
from app.utils.schemas import (
    ArchitectAnalysisResponse,
    ASTArchitectResponse,
    ErrorReport,
    IntentClassifierResponse,
    RefactorInsightsResponse,
    StructuralAuditorResponse,
    ValidationFinding,
)
from app.utils.types import ExitStatus, FailureTier, RefactorIntent, Role


class OrchestrationState(BaseModel):
    session_id: str
    base_code: str
    working_code: str
    user_instruction: str

    # Structural Artifacts
    intent_packet: Optional[Dict] = None
    active_plan: Optional[Dict] = None

    # Loop Counters
    strategy_iter: int = 1  # Outer Loop (Max 3)
    strategy_iter_incremented: bool = False
    syntax_iter: int = 0  # Inner Loop (Max 3)

    # Diagnostic Memory
    cumulative_feedback: List[Dict] = []
    feedback_cap: int = 3

    # Syntax Healing
    syntax_error_context: Optional[Dict] = None
    structural_fix_attempts: int = 0

    # Sequential Mutation Application
    mutation_queue: List[Dict] = []
    mutation_index: int = 0
    sequential_attempts: int = 0
    gen_timings: List[Dict] = []

    # Sub-Step Decomposition
    architect_analysis: Optional[Dict] = None

    # Lifecycle
    current_phase: int = 1
    exit_status: ExitStatus = ExitStatus.PROCESSING

    # Baseline Metrics
    original_complexity: int = 0

    def add_feedback(self, entry: Dict) -> None:
        self.cumulative_feedback.append(entry)
        if len(self.cumulative_feedback) > self.feedback_cap:
            self.cumulative_feedback.pop(0)

    def extend_feedback(self, entries: List[Dict]) -> None:
        self.cumulative_feedback.extend(entries)
        while len(self.cumulative_feedback) > self.feedback_cap:
            self.cumulative_feedback.pop(0)


class Orchestrator:
    USE_SEQUENTIAL: bool = True
    SKIP_JUDGE: bool = False

    def __init__(
        self,
        agent_service: AgentService,
        validator: Validator,
        db: DatabaseManager,
    ) -> None:
        self.agent_service: AgentService = agent_service
        self.validator: Validator = validator
        self.db: DatabaseManager = db

        try:
            with open(MODELS_CONFIG_PATH, "r") as config:
                self.model_config: Dict[str, Any] = yaml.safe_load(config)
            with open(PROMPTS_CONFIG_PATH, "r") as p_config:
                self.prompts: Dict[str, Any] = yaml.safe_load(p_config)
        except yaml.YAMLError as e:
            print(f"Error loading config: {e}")

    @staticmethod
    def _order_mutations(mutations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Order mutations by dependency: RENAME first, then ADD_*, then MODIFY."""
        def sort_key(m: Dict[str, Any]) -> int:
            action = m.get("action", "")
            if action == "RENAME_SYMBOL":
                return 0
            if action.startswith("ADD_"):
                return 1
            if action in ("MODIFY_METHOD", "REMOVE_METHOD"):
                return 2
            return 3
        return sorted(mutations, key=sort_key)

    def _chunkify(self, code: str) -> List[Dict[str, Any]]:
        """Split Java code into labeled chunks at structural boundaries."""
        lines = code.strip().split('\n')
        chunks = []
        current = []
        brace_depth = 0
        chunk_id = 0

        for line in lines:
            stripped = line.strip()
            current.append(line)
            brace_depth += stripped.count('{') - stripped.count('}')

            # Split at method/field boundaries — when brace depth goes to 0 after being >0
            # Or at class-level declarations
            if brace_depth == 0 and current:
                # Check if this is a complete declaration
                text = '\n'.join(current).strip()
                if text:
                    chunk_id += 1
                    chunks.append({"id": str(chunk_id), "text": text, "action": "KEEP"})
                current = []

        # Remaining lines
        if current:
            text = '\n'.join(current).strip()
            if text:
                chunk_id += 1
                chunks.append({"id": str(chunk_id), "text": text, "action": "KEEP"})

        return chunks

    def _map_plan_to_chunks(self, plan: dict, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """For each mutation, mark target chunk for MODIFY, ADD, or DELETE."""
        mutations = plan.get("ast_mutations", [])
        if not mutations:
            return chunks

        add_counter = 0
        for mutation in mutations:
            action = mutation.get("action", "")
            target = mutation.get("target", "")
            details = mutation.get("details", {})

            if action in ("ADD_METHOD", "ADD_FIELD", "ADD_CONSTANT", "ADD_ENUM"):
                add_counter += 1
                typ = details.get("type", "") or ""
                mods = " ".join(details.get("modifiers", []))
                body = details.get("body_abstract", "") or ""
                signature = f"{mods} {typ} {target}".strip()
                if action == "ADD_CONSTANT":
                    signature = f"{mods} {typ} {target}".strip() if typ else f"static final {target}"
                elif action == "ADD_FIELD":
                    signature = f"{mods} {typ} {target}".strip() if typ else f"private {target}"
                elif action == "ADD_METHOD":
                    signature = f"{mods} {typ} {target}".strip() if typ else target

                chunks.insert(0, {
                    "id": f"add-{add_counter}",
                    "text": "",
                    "action": action,
                    "instruction": f"{action} — {body}" if body else f"{action}: declare {signature}",
                })

            elif action in ("MODIFY_METHOD", "RENAME_SYMBOL"):
                for chunk in chunks:
                    if target in chunk["text"] and chunk.get("action") == "KEEP":
                        chunk["action"] = action
                        chunk["instruction"] = (
                            f"{action} — {details.get('body_abstract', '') or f'Apply {action} to {target}'}"
                        )
                        break

        return chunks

    def _build_chunked_prompt(self, chunks: List[Dict[str, Any]], base_code: str) -> str:
        """Build XML-chunked prompt for Generator."""
        prompt = "<file>\n"
        for c in chunks:
            text = c.get("text", "")
            if text:
                prompt += f'<chunk id="{c["id"]}">{text}</chunk>\n'
            else:
                prompt += f'<chunk id="{c["id"]}" empty="true">{c.get("instruction", "")}</chunk>\n'
        prompt += "</file>\n\nInstructions:\n"

        active_mutations = 0
        for c in chunks:
            action = c.get("action", "KEEP")
            if action != "KEEP":
                active_mutations += 1
                prompt += f'  {c["id"]}: {action} — {c.get("instruction", "apply change")}\n'
            else:
                prompt += f'  {c["id"]}: KEEP\n'

        prompt += f"\nOutput ONLY the {active_mutations} chunk(s) that CHANGE. Skip KEEP chunks.\n"
        prompt += "Use exactly the same chunk IDs as above.\n<file>"
        return prompt

    def _parse_chunked_output(self, raw: str) -> Dict[str, str]:
        """Extract changed chunks from model output."""
        import re as _re
        modified = {}
        for match in _re.finditer(r'<chunk id="([^"]+)"[^>]*>(.*?)</chunk>', raw, _re.DOTALL):
            chunk_id = match.group(1)
            new_text = match.group(2).strip()
            if new_text:
                modified[chunk_id] = new_text
        return modified

    def _merge_chunks(self, original_chunks: List[Dict[str, Any]], modified: Dict[str, str]) -> str:
        """Replace modified chunks, keep unchanged, build final code."""
        result_lines = []
        for c in original_chunks:
            action = c.get("action", "KEEP")
            if action in ("ADD_METHOD", "ADD_FIELD", "ADD_CONSTANT", "ADD_ENUM"):
                if c["id"] in modified:
                    result_lines.append(modified[c["id"]])
                elif c.get("text"):
                    result_lines.append(c["text"])
                continue
            if action == "DELETE":
                continue
            if c["id"] in modified:
                result_lines.append(modified[c["id"]])
            else:
                result_lines.append(c.get("text", ""))
        return '\n'.join(line for line in result_lines if line)

    async def execute_orchestration(
        self, client: ClientConnection, user_code: str, user_instruction: str
    ) -> None:
        tracker = PerformanceTracker()
        await tracker.start_tracking()

        # 1. Initialize State
        state = OrchestrationState(
            session_id=str(client.id),
            base_code=user_code,
            working_code=user_code,
            user_instruction=user_instruction,
        )

        self.state = state

        try:
            # 2. Persist session start
            self.db.create_session(
                id=state.session_id,
                instruction=state.user_instruction,
                original_code=state.base_code,
            )

            # --- PHASE 1: Baseline ---
            await self._notify(
                client, Role.Validator, "Ph1: Baselining code structure...", phase=1
            )
            state.original_complexity = self.validator.get_complexity(state.base_code)
            state.current_phase = 2

            while state.exit_status == ExitStatus.PROCESSING:
                if state.current_phase == 2:
                    await self._run_phase_2(client, state)
                elif state.current_phase == 3:
                    # Sequential on first attempt for multi-mutation plans
                    if (self.USE_SEQUENTIAL
                        and state.strategy_iter == 1
                        and not state.syntax_error_context
                        and state.active_plan
                        and len(state.active_plan.get("ast_mutations", [])) > 1):
                        await self._run_sequential_phase_3(client, state)
                        if state.mutation_index >= len(state.mutation_queue):
                            state.current_phase = 4
                            continue
                        state.working_code = state.base_code
                        state.mutation_index = 0
                        state.mutation_queue = []
                        state.sequential_attempts = 0
                    await self._run_phase_3(client, state)
                elif state.current_phase == 4:
                    await self._run_phase_4(client, state)
                    if self.SKIP_JUDGE and state.current_phase == 5:
                        state.current_phase = 6
                elif state.current_phase == 5:
                    await self._run_phase_5(client, state)
                elif state.current_phase == 6:
                    break

                # Global circuit breaker
                if state.strategy_iter > 3:
                    state.exit_status = ExitStatus.ABORT_STRATEGY
                    state.current_phase = 6
                    break

            # --- PHASE 6: Finalization ---
            await tracker.stop_tracking()
            performance_metrics = tracker.get_metrics()

            await self._run_phase_6(client, state, performance_metrics)

        except asyncio.CancelledError:
            await tracker.stop_tracking()
            self.db.mark_as_halted(client.id)
            await self._notify(client, Role.System, "Process halted.")
            raise
        except Exception as e:
            await tracker.stop_tracking()
            print(f"Orchestration Error: {e}")
            await client.send_status(role=Role.System, content=f"Error: {str(e)[:200]}")
            raise e
        finally:
            await self.agent_service.unload()

    async def _run_phase_2(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 2: The Strategy Block (Inference 1, 2, 3)."""
        state.strategy_iter_incremented = False
        # Step 3: Classifier
        if not state.intent_packet:
            await self._notify(
                client,
                Role.Planner,
                f"Ph2: Classifying intent (Strategy Iter {state.strategy_iter})...",
                phase=2,
            )
            await self.agent_service.swap(self.model_config["planner"])

            prompt = f"<code>{state.base_code}</code>\n<instruction>{state.user_instruction}</instruction>"

            messages: List[ChatCompletionRequestMessage] = [
                {"role": "system", "content": self.prompts["planner"]["classifier"]},
                {"role": "user", "content": prompt},
            ]

            raw = await self.agent_service.generate(
                messages,
                temp=0.1,
                max_tokens=500,
                response_model=IntentClassifierResponse,
            )
            response_text = raw["choices"][0]["message"].get("content") or ""
            print(
                f"\n--- Planner Classifier Output ---\n{response_text}\n-------------------------------"
            )

            classifier_res = ResponseParser.extract_json(
                response_text, IntentClassifierResponse
            )
            state.intent_packet = classifier_res.intent_packet.model_dump()

            await self._notify(
                client,
                Role.Planner,
                f"Intent Classified: {state.intent_packet['specific_intent']}",
                content=json.dumps(state.intent_packet),
            )

        # Step 4: Cognitive Reset
        await self.agent_service.clear_context()

        # Step 5a: Architect ANALYSIS (NEW)
        await self._notify(
            client, Role.Planner, "Ph2: Analyzing code structure...", phase=2
        )

        analysis_prompt = (
            f"Intent Packet: {json.dumps(state.intent_packet)}\n"
            f"User Instruction: {state.user_instruction}\n"
            f"Code: <code>{state.base_code}</code>"
        )

        system_content = self.prompts["planner"]["architect_analysis"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["planner"]["analysis_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages = [
            {
                "role": "system",
                "content": system_content,
            },
            {"role": "user", "content": analysis_prompt},
        ]

        raw = await self.agent_service.generate(
            messages,
            temp=0.1,
            max_tokens=1024,
            response_model=ArchitectAnalysisResponse,
        )
        analysis_text = raw["choices"][0]["message"].get("content") or ""
        print(
            f"\n--- Planner Analysis Output ---\n{analysis_text}\n-------------------------------"
        )

        try:
            analysis_model = ResponseParser.extract_json(
                analysis_text, ArchitectAnalysisResponse
            )
            state.architect_analysis = analysis_model.model_dump()
        except Exception:
            state.architect_analysis = {}

        await self._notify(
            client,
            Role.Planner,
            "Structure analysis complete.",
            content=json.dumps(state.architect_analysis),
        )

        # Step 4b: Cognitive Reset between sub-steps
        await self.agent_service.clear_context()

        # Step 5c: Architect SYNTHESIS (MODIFIED)
        await self._notify(
            client, Role.Planner, "Ph2: Designing mutation plan...", phase=2
        )

        arch_prompt = (
            f"Analysis: {json.dumps(state.architect_analysis)}\n"
            f"Intent: {json.dumps(state.intent_packet)}\n"
            f"Instruction: {state.user_instruction}\n"
            f"Code: <code>{state.base_code}</code>"
        )
        if state.cumulative_feedback:
            arch_prompt += f"\n\n### PREVIOUS ATTEMPT FEEDBACK\n{json.dumps(state.cumulative_feedback, indent=2)}"

        system_content = self.prompts["planner"]["architect"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["planner"]["synthesis_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": arch_prompt},
        ]

        for _attempt in range(2):
            temp = 0.2 if _attempt == 0 else 0.5
            try:
                raw = await self.agent_service.generate(
                    messages, temp=temp, max_tokens=2048,
                    response_model=ASTArchitectResponse,
                    check_repetition=detect_repetition,
                )
                arch_text = raw["choices"][0]["message"].get("content") or ""
                header = f"--- Planner Architect Output ---"
                if _attempt > 0:
                    header = f"--- Planner Architect Output (Retry {_attempt}) ---"
                print(f"\n{header}\n{arch_text}\n------------------------------")
                architect_res = ResponseParser.extract_json(arch_text, ASTArchitectResponse)
                state.active_plan = architect_res.ast_modification_plan.model_dump()
                break
            except (ValidationError, ValueError) as e:
                if _attempt == 0:
                    print(f"  Architect attempt 1 failed. Retrying with temp=0.5...")
                    await self.agent_service.clear_context()
                else:
                    raise

        # Enrich plan with concrete mutation details from code analysis
        intent_key = state.intent_packet.get("specific_intent", "") if state.intent_packet else None
        target_method = state.intent_packet.get("scope_anchor", {}).get("member", "") if state.intent_packet else None
        enriched = ASTMatcher.enrich_mutations(
            state.base_code,
            state.active_plan.get("ast_mutations", []),
            intent=intent_key,
            target_method=target_method,
        )
        state.active_plan["ast_mutations"] = enriched
        state.active_plan["enriched_by"] = "ASTMatcher"

        # Safety: deduplicate identical (action, target) pairs + cap at 8
        deduped = []
        seen = set()
        for m in state.active_plan.get("ast_mutations", []):
            key = (m.get("action"), m.get("target"))
            if key not in seen:
                seen.add(key)
                deduped.append(m)
        if len(deduped) > 8:
            print(f"WARNING: Truncated plan: {len(deduped)} → 8 mutations")
            deduped = deduped[:8]
        state.active_plan["ast_mutations"] = deduped

        await self._notify(
            client,
            Role.Planner,
            "Modification plan generated.",
            content=json.dumps(state.active_plan),
        )

        state.current_phase = 3

    async def _run_phase_3(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 3: Plan Execution (Inference 3)."""
        await self._notify(client, Role.Generator, "Ph3: Implementing plan...", phase=3)
        await self.agent_service.swap(self.model_config["generator"])
        await self.agent_service.clear_context()

        if state.syntax_error_context:
            ctx = state.syntax_error_context
            coder_prompt = (
                f"Modification Plan: {json.dumps(state.active_plan)}\n\n"
                f"### PREVIOUS SYNTAX ERROR (Attempt {ctx['attempt']}/3)\n"
                f"{ctx['error']}\n\n"
                f"### CURRENT BROKEN CODE\n"
                f"<code>{ctx['broken_code']}</code>\n\n"
                f"Fix the syntax error above. Output only valid Java wrapped in <code> tags."
            )
        else:
            coder_prompt = format_plan_for_generator(
                state.active_plan or {}, state.base_code
            )

        system_content = self.prompts["generator"]["coder"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["generator"]["coder_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages: List[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": coder_prompt},
        ]

        heal_temp = 0.3 if state.syntax_error_context else 0.1
        retry_temp = 0.3 if state.strategy_iter > 1 else heal_temp
        gen_max_tokens = 3072

        # Multi-sample generation — try 3 temperatures, pick best
        samples = []
        for sample_temp in (retry_temp, 0.3, 0.5) if not state.syntax_error_context else (retry_temp,):
            raw = await self.agent_service.generate(
                messages, temp=sample_temp, max_tokens=gen_max_tokens
            )
            coder_text = raw["choices"][0]["message"].get("content") or ""
            sample_code = ResponseParser.extract_xml(coder_text, "code")
            if sample_code:
                # Apply repair
                sample_code = self._repair_generator_output(state.base_code, sample_code)
                # Quick syntax check
                syntax_ok = False
                try:
                    import javalang
                    wrapped = f"class _W_ {{ {sample_code} }}" if "class" not in sample_code else sample_code
                    javalang.parse.parse(wrapped)
                    syntax_ok = True
                except Exception:
                    pass
                cc = self.validator.get_complexity(sample_code) if syntax_ok else 999
                samples.append({
                    "code": sample_code,
                    "syntax_ok": syntax_ok,
                    "cc": cc,
                    "temp": sample_temp,
                })

        if samples:
            # Pick best: prefer syntax valid, then lowest CC increase
            def sample_score(s):
                if not s["syntax_ok"]:
                    return (-1000, 0)
                cc_delta = s["cc"] - state.original_complexity
                return (0, -cc_delta)  # higher score = better
            best = max(samples, key=sample_score)

            print(
                f"\n--- Generator Multi-Sample ---\n"
                f"Tried {len(samples)} temps. Best: temp={best['temp']} CC={best['cc']} syntax={'OK' if best['syntax_ok'] else 'FAIL'}\n"
                f"----------------------------"
            )

            if best["syntax_ok"]:
                state.working_code = best["code"]
                state.syntax_iter = 0
                state.syntax_error_context = None
                await self._notify(
                    client, Role.Generator, "Code refactored.", content=best["code"]
                )
                print(best["code"])
                state.current_phase = 4
                return
            else:
                # All samples failed syntax — try normal single-shot for healing
                state.syntax_iter += 1
                if state.syntax_iter <= 3:
                    state.syntax_error_context = {
                        "attempt": state.syntax_iter,
                        "error": "Multi-sample: all outputs had syntax errors.",
                        "broken_code": state.working_code or state.base_code,
                    }
                    state.current_phase = 3
                    return
                state.add_feedback({
                    "failure_tier": FailureTier.TIER_1_SYNTAX,
                    "error": "Multi-sample: no valid code after multiple attempts.",
                })
                if not state.strategy_iter_incremented:
                    state.strategy_iter += 1
                    state.strategy_iter_incremented = True
                state.syntax_iter = 0
                state.current_phase = 2
                return

        # Fallback: no code blocks at all
        else:
            # Syntax fail at the gate — no <code> block found
            state.syntax_iter += 1
            if state.syntax_iter <= 3:
                state.syntax_error_context = {
                    "attempt": state.syntax_iter,
                    "error": "No <code> block found in generator output.",
                    "broken_code": state.working_code,
                }
                state.current_phase = 3
                return
            state.add_feedback(
                {
                    "failure_tier": FailureTier.TIER_1_SYNTAX,
                    "error": "No <code> block found after 3 attempts.",
                }
            )
            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.syntax_iter = 0
            state.current_phase = 2

    async def _run_sequential_phase_3(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Apply mutations one at a time. Full class context, single target."""
        import time as _time

        mutations = self._order_mutations(
            state.active_plan.get("ast_mutations", [])
        )
        state.mutation_queue = mutations
        state.mutation_index = 0
        state.sequential_attempts = 0
        state.gen_timings = []

        await self._notify(
            client, Role.Generator,
            f"Ph3: Sequential editing ({len(mutations)} mutations)...",
            phase=3
        )
        await self.agent_service.swap(self.model_config["generator"])
        await self.agent_service.clear_context()

        system_content = self.prompts["generator"]["coder"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["generator"]["coder_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        while state.mutation_index < len(state.mutation_queue):
            mutation = state.mutation_queue[state.mutation_index]
            action = mutation.get("action", "")
            target = mutation.get("target", "")
            details = mutation.get("details", {})

            current_code = state.working_code
            mutation_text = (
                f"{action} {target}\n"
                f"Details: {json.dumps(details, indent=2)}"
            )

            # For MODIFY steps, include context about ADD_* items already applied
            context = ""
            if action.startswith("MODIFY_") and state.mutation_index > 0:
                added_items = [
                    m for m in state.mutation_queue[:state.mutation_index]
                    if m.get("action", "").startswith("ADD_")
                ]
                if added_items:
                    context = "\nPreviously added items (must be referenced in updated method):\n"
                    for item in added_items:
                        d = item.get("details", {})
                        extra = f" ({d.get('type', '')})" if d.get("type") else ""
                        if d.get("value"):
                            extra += f" = {d['value']}"
                        context += f"  - {item['action']} {item['target']}{extra}\n"

            user_prompt = (
                f"Current Code:\n<code>{current_code}</code>\n\n"
                f"Apply ONLY this mutation ({state.mutation_index + 1}/{len(state.mutation_queue)}):\n"
                f"{mutation_text}\n"
                f"{context}"
                f"\nOutput ONLY the complete updated code in <code> tags. "
                f"Do NOT change anything except this mutation."
            )

            messages: List[ChatCompletionRequestMessage] = [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_prompt},
            ]

            t0 = _time.time()
            raw = await self.agent_service.generate(
                messages, temp=0.1, max_tokens=3072
            )
            gen_time_ms = int((_time.time() - t0) * 1000)

            coder_text = raw["choices"][0]["message"].get("content") or ""
            new_code = ResponseParser.extract_xml(coder_text, "code")

            timing_entry = {
                "step": state.mutation_index + 1,
                "action": action,
                "target": target,
                "time_ms": gen_time_ms,
            }

            if not new_code:
                state.sequential_attempts += 1
                timing_entry["status"] = "NO_CODE_BLOCK"
                state.gen_timings.append(timing_entry)
                if state.sequential_attempts <= 3:
                    await self._notify(
                        client, Role.Generator,
                        f"No <code> block for {action} {target}. Retrying (attempt {state.sequential_attempts}/3)..."
                    )
                    continue
                state.working_code = state.base_code
                timing_entry["status"] = "EXHAUSTED"
                state.gen_timings.append(timing_entry)
                return

            syntax_res = self.validator.check_syntax(new_code)
            if not syntax_res["is_valid"]:
                state.sequential_attempts += 1
                timing_entry["status"] = "SYNTAX_FAIL"
                errors = syntax_res.get("errors", ["Unknown"])
                timing_entry["error"] = str(errors[0]) if errors else "Unknown"
                state.gen_timings.append(timing_entry)
                if state.sequential_attempts <= 3:
                    state.syntax_error_context = {
                        "attempt": state.sequential_attempts,
                        "error": str(errors[0]) if errors else "Unknown",
                        "broken_code": new_code,
                    }
                    await self._notify(
                        client, Role.Generator,
                        f"Syntax fail on {action} {target}. Healing (attempt {state.sequential_attempts}/3)..."
                    )
                    continue
                state.working_code = state.base_code
                return

            target_scopes = [target]
            if state.intent_packet:
                member = state.intent_packet["scope_anchor"].get("member", "")
                if member and member not in target_scopes:
                    target_scopes.append(member)

            boundary_finding = self.validator.verify_boundary(
                current_code, new_code, target_scopes
            )
            if boundary_finding:
                state.sequential_attempts += 1
                timing_entry["status"] = "BOUNDARY_FAIL"
                timing_entry["error"] = boundary_finding.error_report.message
                state.gen_timings.append(timing_entry)
                if state.sequential_attempts <= 3:
                    await self._notify(
                        client, Role.Generator,
                        f"Boundary violation on {action} {target}. Retrying (attempt {state.sequential_attempts}/3)..."
                    )
                    continue
                state.working_code = state.base_code
                return

            # Success
            state.working_code = new_code
            state.sequential_attempts = 0
            state.syntax_error_context = None
            timing_entry["status"] = "OK"
            state.gen_timings.append(timing_entry)
            state.mutation_index += 1

            print(f"\n--- Sequential Step {state.mutation_index}/{len(state.mutation_queue)} ---")
            print(f"Action: {action} {target} | Time: {gen_time_ms}ms | Status: OK")
            await self._notify(
                client, Role.Generator,
                f"Applied {action} {target} ({state.mutation_index}/{len(state.mutation_queue)}). {gen_time_ms}ms"
            )

        state.syntax_iter = 0
        state.syntax_error_context = None
        total_time = sum(e["time_ms"] for e in state.gen_timings)
        await self._notify(
            client, Role.Generator,
            f"All {len(state.mutation_queue)} mutations applied. Total gen time: {total_time}ms"
        )

    async def _run_phase_4(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 4: Deterministic Validation (Tier 1 & 2)."""
        await self._notify(
            client,
            Role.Validator,
            f"Ph4: Validating (Strategy {state.strategy_iter}, Syntax {state.syntax_iter})...",
            phase=4,
        )

        # Step 7: Tier 1 - Syntax
        syntax_res = self.validator.check_syntax(state.working_code)
        print(
            f"\\n--- Validator Syntax Check ---\\nIs Valid: {syntax_res['is_valid']}\\nError: {syntax_res.get('error')}\\n------------------------------"
        )
        if not syntax_res["is_valid"]:
            state.syntax_iter += 1
            if state.syntax_iter <= 3:
                await self._notify(
                    client,
                    Role.Validator,
                    f"Syntax Fail (Attempt {state.syntax_iter}). Healing...",
                )
                raw_errors = syntax_res.get("errors", [])
                raw_error = raw_errors[0] if raw_errors else "Unknown syntax error"
                state.syntax_error_context = {
                    "attempt": state.syntax_iter,
                    "error": self.validator.format_syntax_error(raw_error),
                    "broken_code": state.working_code,
                }
                state.current_phase = 3
                return
            else:
                await self._notify(
                    client, Role.Validator, "Syntax Unrecoverable. Revising strategy."
                )
                state.add_feedback(
                    {
                        "failure_tier": FailureTier.TIER_1_SYNTAX,
                        "error": "Persistent syntax errors after 3 heals.",
                    }
                )
                if not state.strategy_iter_incremented:
                    state.strategy_iter += 1
                    state.strategy_iter_incremented = True
                state.syntax_iter = 0
                state.current_phase = 2
                return

        await self._notify(
            client, Role.Validator, "Syntax OK. Running Structural Checks..."
        )

        # Step 8: Tier 2 - Structural
        findings = []

        # Check A: Complexity (per-intent routing)
        assert state.intent_packet is not None
        intent_enum = RefactorIntent(state.intent_packet["specific_intent"])
        cc_rule = self._get_cc_rule(intent_enum)
        current_cc = state.original_complexity

        if cc_rule == "SKIP":
            pass
        elif cc_rule == "EXTRACT_RULE":
            target_method = state.intent_packet.get("scope_anchor", {}).get(
                "member", ""
            )
            if target_method:
                orig_method_cc = self.validator.get_method_complexity(
                    state.base_code, target_method
                )
                refac_method_cc = self.validator.get_method_complexity(
                    state.working_code, target_method
                )
                if orig_method_cc is not None and refac_method_cc is not None:
                    if refac_method_cc > orig_method_cc:
                        findings.append(
                            ValidationFinding(
                                failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                                error_report=ErrorReport(
                                    message=f"CC of target method '{target_method}' increased from {orig_method_cc} to {refac_method_cc}"
                                ),
                                recovery_hint="Ensure the source method's complexity decreases or stays the same after extraction.",
                            )
                        )
                elif refac_method_cc is None:
                    findings.append(
                        ValidationFinding(
                            failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                            error_report=ErrorReport(
                                message=f"Target method '{target_method}' not found in refactored code."
                            ),
                            recovery_hint="Preserve the target method name in the refactored output.",
                        )
                    )
        else:
            current_cc = self.validator.get_complexity(state.working_code)
            threshold = state.original_complexity + (1 if cc_rule == "LOOSENED" else 0)
            if current_cc > threshold:
                findings.append(
                    ValidationFinding(
                        failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                        error_report=ErrorReport(
                            message=f"CC increased from {state.original_complexity} to {current_cc} (limit: {threshold})"
                        ),
                        recovery_hint="Simplify logic to maintain or reduce complexity.",
                    )
                )

        # Check B: Boundary Verification
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
                # Extract method name if it has a signature
                name = target.split("(")[0].strip()
                if name and name not in target_scopes:
                    target_scopes.append(name)

        if state.active_plan and "target_class" in state.active_plan:
            if state.active_plan["target_class"] not in target_scopes:
                target_scopes.append(state.active_plan["target_class"])

        boundary_finding = self.validator.verify_boundary(
            state.base_code, state.working_code, target_scopes
        )
        if boundary_finding:
            findings.append(boundary_finding)

        # Check C: Intent Math
        intent_finding = None
        if state.intent_packet:
            intent_enum = RefactorIntent(state.intent_packet["specific_intent"])
            intent_finding = self.validator.verify_intent(
                intent_enum, state.base_code, state.working_code
            )
            if intent_finding:
                findings.append(intent_finding)

        current_cc_val = (
            current_cc
            if cc_rule not in ("SKIP", "EXTRACT_RULE")
            else state.original_complexity
        )
        print(
            f"\\n--- Validator Structural Checks ---\\nComplexity Check: {current_cc_val} (Original: {state.original_complexity})\\nBoundary check found issue: {bool(boundary_finding)}\\nIntent check found issue: {bool(intent_finding)}\\nTotal findings: {len(findings)}\\n-----------------------------------"
        )
        if findings:
            current_fault_count = len(findings)
            await self._notify(
                client,
                Role.Validator,
                f"Structural Checks Failed ({current_fault_count} issues).",
                content=json.dumps([f.model_dump() for f in findings]),
            )
            state.extend_feedback([f.model_dump() for f in findings])

            # Try structural fix — send errors to Generator for targeted fix
            if state.structural_fix_attempts < 1:
                state.structural_fix_attempts += 1
                # Build error context for Generator from findings
                error_msgs = []
                for f in findings:
                    error_msgs.append(f.error_report.message[:200])
                state.syntax_error_context = {
                    "attempt": state.structural_fix_attempts,
                    "error": "Structural issues: " + "; ".join(error_msgs[:2]),
                    "broken_code": state.working_code,
                }
                await self._notify(
                    client,
                    Role.Validator,
                    f"Routing to Generator for targeted fix...",
                )
                state.current_phase = 3
                return

            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.syntax_iter = 0
            state.structural_fix_attempts = 0
            state.current_phase = 2
        else:
            await self._notify(client, Role.Validator, "Structural Checks Passed.")
            if (
                state.active_plan
                and state.active_plan.get("ast_mutations")
                and state.working_code.strip() == state.base_code.strip()
            ):
                await self._notify(
                    client,
                    Role.Validator,
                    "Plan not executed — code unchanged.",
                )
                state.add_feedback(
                    {
                        "failure_tier": FailureTier.TIER_3_JUDGE,
                        "error": "Plan was not executed: code unchanged.",
                    }
                )
                if not state.strategy_iter_incremented:
                    state.strategy_iter += 1
                    state.strategy_iter_incremented = True
                state.current_phase = 2
                return
            state.current_phase = 5

    @staticmethod
    def _strip_outer_wrapper(code: str, base_code: str) -> str:
        """Strip the outermost class wrapper if base had none and refactored has one.

        Handles only the top-level class — inner/nested classes preserved.
        Fields, constants, and helper methods inside the wrapper stay in the output.
        """
        if "class" in base_code:
            return code
        text = code.strip()
        class_match = re.search(
            r'(?:public|private|protected|static|abstract|final|\s)*class\s+\w+',
            text
        )
        if not class_match:
            return code
        brace_start = text.find('{', class_match.end())
        if brace_start == -1:
            return code
        depth = 0
        for i in range(brace_start, len(text)):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    inner = text[brace_start + 1:i].strip()
                    return inner
        return code

    async def _run_phase_5(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 5: Heuristic Adjudication (Inference 4)."""
        await self._notify(client, Role.Judge, "Ph5: Running final audit...", phase=5)
        await self.agent_service.swap(self.model_config["judge"])

        # Normalize both sides for judge comparison:
        # 1. Strip imports so parity is consistent
        # 2. Strip outer class wrapper if original had none
        def _normalize_for_judge(code: str) -> str:
            no_imports = "\n".join(
                line for line in code.splitlines()
                if not line.strip().startswith("import ")
            )
            return self._strip_outer_wrapper(no_imports, state.base_code)

        judge_base = _normalize_for_judge(state.base_code)
        judge_refac = _normalize_for_judge(state.working_code)

        # Build plan context summary for the auditor
        intent = ""
        target_class = ""
        target_method = ""
        if state.intent_packet:
            intent = state.intent_packet.get("specific_intent", "")
            scope = state.intent_packet.get("scope_anchor", {})
            target_class = scope.get("target_class", "")
            target_method = scope.get("member", "")

        mutations = (
            state.active_plan.get("ast_mutations", []) if state.active_plan else []
        )
        mutation_actions = [m.get("action", "?") for m in mutations]
        mutation_targets = [m.get("target", "?") for m in mutations]

        plan_summary = f"Intent: {intent}. Target: {target_class}.{target_method}."
        mutations_list = (
            f"Mutations: {', '.join(f'{a}({t})' for a, t in zip(mutation_actions, mutation_targets))}"
            if mutation_actions
            else "Mutations: none"
        )

        audit_prompt = (
            f"## Plan Context\n{plan_summary}\n{mutations_list}\n\n"
            f"## Code\n"
            f"Original: <code>{judge_base}</code>\n"
            f"Refactored: <code>{judge_refac}</code>\n"
            f"Intent: {json.dumps(state.intent_packet)}"
        )
        system_content = self.prompts["judge"]["auditor"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["judge"].get("auditor_guidance", {}).get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages: List[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": audit_prompt},
        ]

        for _jattempt in range(2):
            jtemp = 0.1 if _jattempt == 0 else 0.3
            jmax = 1500 if _jattempt == 0 else 2048
            try:
                raw = await self.agent_service.generate(
                    messages,
                    temp=jtemp,
                    max_tokens=jmax,
                    response_model=StructuralAuditorResponse,
                )
                audit_text = raw["choices"][0]["message"].get("content") or ""
                jheader = f"--- Judge Auditor Output ---"
                if _jattempt > 0:
                    jheader = f"--- Judge Auditor Output (Retry {_jattempt}) ---"
                print(
                    f"\n{jheader}\n{audit_text}\n--------------------------"
                )
                audit_res = ResponseParser.extract_json(audit_text, StructuralAuditorResponse)
                break
            except (ValidationError, ValueError) as e:
                if _jattempt == 0:
                    print(f"  Judge attempt 1 failed (truncated). Retrying with temp=0.3, max_tokens=2048...")
                    await self.agent_service.clear_context()
                else:
                    raise

        # Override: judge hallucinated IDENTICAL_CODE but code clearly changed
        if (audit_res.verdict == "REVISE"
            and audit_res.issues
            and audit_res.issues[0].issue_type == "IDENTICAL_CODE"):
            if state.working_code.strip() != state.base_code.strip():
                print("WARNING: Judge hallucinated IDENTICAL_CODE — overriding to ACCEPT")
                audit_res.verdict = "ACCEPT"
                audit_res.issues = []

        await self._notify(
            client,
            Role.Judge,
            f"Audit Finished: {audit_res.verdict}",
            content=json.dumps(audit_res.model_dump()),
        )

        if audit_res.verdict == "ACCEPT":
            state.exit_status = ExitStatus.SUCCESS
            state.current_phase = 6
        else:
            await self._notify(client, Role.Judge, "Audit requested revision.")
            state.add_feedback(
                {"failure_tier": FailureTier.TIER_3_JUDGE,
                 "error": [i.model_dump() for i in audit_res.issues]}
            )
            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.current_phase = 2

    async def _run_phase_6(
        self,
        client: ClientConnection,
        state: OrchestrationState,
        metrics: Dict[str, Any],
    ) -> None:
        """Phase 6: Finalization & Reporting."""
        # Strip outer wrapper from working_code for final output
        state.working_code = self._strip_outer_wrapper(
            state.working_code, state.base_code
        )

        await self._notify(
            client,
            Role.System,
            f"Ph6: Finalizing session (Status: {state.exit_status})...",
            phase=6,
        )

        final_code = (
            state.working_code
            if state.exit_status == ExitStatus.SUCCESS
            else state.base_code
        )

        # 1. Send immediate result (without insights)
        await client.send_result(
            final_code=final_code,
            original_complexity=state.original_complexity,
            refactored_complexity=self.validator.get_complexity(final_code),
            performance_metrics=metrics,
            planner_model=self.model_config["planner"].get("name"),
            generator_model=self.model_config["generator"].get("name"),
            judge_model=self.model_config["judge"].get("name"),
        )

        # 2. Generate final insights as follow-up
        insights: Any = []
        if state.exit_status == ExitStatus.SUCCESS:
            await self._notify(client, Role.Judge, "Generating insights...")
            try:
                insights = await self.generate_insights(
                    state.base_code,
                    state.working_code,
                    state.original_complexity,
                    self.validator.get_complexity(state.working_code),
                )
            except Exception as e:
                print(f"Error generating insights: {e}")
                insights = "Refactoring successful (Insights generation failed)."
        else:
            insights = (
                f"Refactoring aborted: {state.exit_status}. Reverted to original code."
            )

        # 3. Send insights follow-up
        await client.send_insights(insights)

        # 4. Final DB update
        self.db.complete_session(
            id=state.session_id,
            refactored_code=final_code,
            insights=json.dumps(insights)
            if not isinstance(insights, str)
            else insights,
            original_complexity=state.original_complexity,
            refactored_complexity=self.validator.get_complexity(final_code),
            performance_metrics=metrics,
            exit_status=state.exit_status.value,
            final_intent=json.dumps(state.intent_packet),
            final_plan=json.dumps(state.active_plan),
            outer_loops=state.strategy_iter,
            inner_loops=state.syntax_iter,
            planner_model=self.model_config["planner"].get("name"),
            generator_model=self.model_config["generator"].get("name"),
            judge_model=self.model_config["judge"].get("name"),
        )

    async def generate_insights(
        self,
        user_code: str,
        refactored_code: str,
        original_complexity: int,
        refactored_complexity: int,
    ) -> Any:
        await self.agent_service.swap(self.model_config["judge"])

        prompt: str = (
            f"--- ORIGINAL CODE ---\n{user_code}\n\n"
            f"--- REFACTORED CODE ---\n{refactored_code}\n\n"
            f"Original Complexity: {original_complexity}\n"
            f"Refactored Complexity: {refactored_complexity}\n"
        )
        messages: List[ChatCompletionRequestMessage] = [
            {
                "role": "system",
                "content": self.prompts["judge"]["insights"],
            },
            {"role": "user", "content": prompt},
        ]

        raw_reponse = await self.agent_service.generate(
            messages=messages,
            temp=0.1,
            max_tokens=1000,
            stream=False,
            response_model=RefactorInsightsResponse,
        )

        text = raw_reponse["choices"][0]["message"].get("content") or ""
        print(f"\n--- Judge Insights Output ---\n{text}\n---------------------------")

        try:
            insights_res = ResponseParser.extract_json(text, RefactorInsightsResponse)
            return [i.model_dump() for i in insights_res.insights]
        except Exception as e:
            print(f"Failed to parse insights JSON: {e}")
            return text.strip()

    @staticmethod
    def _get_cc_rule(intent: RefactorIntent) -> str:
        rules: Dict[RefactorIntent, str] = {
            RefactorIntent.FLATTEN_CONDITIONAL: "LOOSENED",
            RefactorIntent.DECOMPOSE_CONDITIONAL: "STRICT",
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
        return rules.get(intent, "STRICT")

    @staticmethod
    def _repair_generator_output(original: str, generated: str) -> str:
        """Strip common defensive additions from Generator output."""
        import re as _re

        result = generated

        # 1. Strip throws declarations added to method signatures
        orig_throws = set(_re.findall(r'throws\s+(\w+Exception)', original))
        gen_throws = set(_re.findall(r'throws\s+(\w+Exception)', result))
        for exc in gen_throws - orig_throws:
            result = _re.sub(
                r'\s*throws\s+' + _re.escape(exc) + r'(?=\s*\{)',
                '', result
            )

        # 2. Remove null checks not in original
        orig_null_count = len(_re.findall(r'if\s*\(\s*\w+\s*==\s*null\s*\)', original))
        gen_null_checks = list(_re.finditer(r'if\s*\(\s*\w+\s*==\s*null\s*\)\s*\{?', result))
        extra_nulls = len(gen_null_checks) - orig_null_count
        if extra_nulls > 0:
            # Remove the last N null checks from the generated code
            for match in reversed(gen_null_checks[-extra_nulls:]):
                start = match.start()
                # Find matching closing brace
                depth = 0
                end = start
                in_block = False
                for i in range(start, len(result)):
                    if result[i] == '{':
                        depth += 1
                        in_block = True
                    elif result[i] == '}':
                        depth -= 1
                        if in_block and depth == 0:
                            end = i + 1
                            break
                result = result[:start] + result[end:]

        # 3. Strip 'public' modifier from bare methods that weren't public
        org_pub_methods = set(_re.findall(r'public\s+\w+\s+(\w+)\s*\(', original))
        gen_pub_methods = set(_re.findall(r'public\s+\w+\s+(\w+)\s*\(', result))
        for method in gen_pub_methods - org_pub_methods:
            result = _re.sub(
                r'\bpublic\s+(' + _re.escape(method) + r')\s*\(',
                r'\1(',
                result
            )

        return result

    async def _run_chunked_phase_3(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 3 via chunk-based editing — only modified chunks go to Generator."""
        await self._notify(client, Role.Generator, "Ph3: Chunk-based editing...", phase=3)
        await self.agent_service.swap(self.model_config["generator"])
        await self.agent_service.clear_context()

        chunks = self._chunkify(state.base_code)
        chunks = self._map_plan_to_chunks(state.active_plan or {}, chunks)
        prompt = self._build_chunked_prompt(chunks, state.base_code)

        system = self.prompts["generator"]["coder_guidance"].get(
            "CHUNK_EDITOR",
            self.prompts["generator"]["coder"]
        )

        messages: List[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ]

        raw = await self.agent_service.generate(messages, temp=0.1, max_tokens=3072)
        coder_text = raw["choices"][0]["message"].get("content") or ""
        print(f"\n--- Chunk Editor Output ---\n{coder_text}\n-------------------------")

        modified = self._parse_chunked_output(coder_text)
        if modified:
            working_code = self._merge_chunks(chunks, modified)
            state.working_code = working_code
            state.syntax_iter = 0
            state.syntax_error_context = None
            await self._notify(
                client, Role.Generator,
                f"Chunk editing complete ({len(modified)} chunks modified).",
                content=working_code
            )
            print(working_code)
        else:
            # No chunks parsed — keep original as fallback
            state.working_code = state.base_code

    async def _notify(
        self,
        client: ClientConnection,
        role: Role,
        message: str,
        content: Optional[str] = None,
        phase: Optional[int] = None,
        outer_loop: int = 0,
        inner_loop: int = 0,
    ) -> None:
        """Helper to print to terminal, persist to DB, and notify frontend."""
        print(f"[{role}] {message}")

        # Persist the log entry to the database in real-time
        self.db.log_status(
            session_id=client.id,
            role=role.value,
            status=message,
            content=content,
            phase=phase,
            outer_loop=outer_loop,
            inner_loop=inner_loop,
        )

        formatted_message = format_agent_output(message, content)
        await client.send_status(role=role, content=formatted_message)
