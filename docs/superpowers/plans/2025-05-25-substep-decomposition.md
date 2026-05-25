# Sub-Step Decomposition + Prompt Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split overloaded single-call prompts into chained sub-steps with narrower scope, add few-shot examples and anti-pattern guardrails, and add generator self-review before validator to improve 3B model output quality.

**Architecture:** Phase 2 architect becomes 2 sub-calls (analysis then synthesis). Phase 3 generator gets self-review call with retry loop. Phase 5 auditor receives plan context. All prompts restructured with few-shot, CoT, and anti-pattern directives.

**Tech Stack:** Python 3.10, Pydantic, llama-cpp-python, YAML prompts, unittest+pytest, javalang, lizard

---

## File Structure

| File | Role | Action |
|------|------|--------|
| `app/utils/schemas.py` | Pydantic models for new LLM response types | Add 2 models |
| `prompts.yaml` | All LLM system prompts | Replace 4, add 2 |
| `app/modules/orchestrator.py` | 6-phase state machine | Add fields, split phases, inject context |
| `tests/test_orchestrator_flow.py` | Integration-style unit tests with mocked LLM | Add 5 test methods |

---

### Task 1: New Pydantic Schemas

**Files:**
- Modify: `app/utils/schemas.py`

- [ ] **Step 1: Add ArchitectAnalysisResponse and CodeReviewResponse**

Read `app/utils/schemas.py` first, then add these two models at the end of the file, before the existing classes or after the last one:

```python
class ArchitectAnalysisResponse(BaseModel):
    analysis_scratchpad: str
    primary_targets: List[str] = []
    secondary_targets: List[str] = []
    new_structures_needed: List[str] = []
    must_preserve: List[str] = []


class CodeReviewResponse(BaseModel):
    review_scratchpad: str
    all_mutations_applied: bool = True
    extra_additions: List[str] = []
    changed_literals: List[str] = []
    syntax_issues: List[str] = []
    verdict: Literal["PASS", "FAIL"]
```

- [ ] **Step 2: Verify schema imports and types**

Run: `python -c "from app.utils.schemas import ArchitectAnalysisResponse, CodeReviewResponse; print(ArchitectAnalysisResponse(analysis_scratchpad='test')); print(CodeReviewResponse(review_scratchpad='ok', verdict='PASS'))"`

Expected: No errors, prints model instances.

- [ ] **Step 3: Commit**

```bash
git add app/utils/schemas.py
git commit -m "feat: add ArchitectAnalysisResponse and CodeReviewResponse schemas"
```

---

### Task 2: Rewrite Classifier Prompt

**Files:**
- Modify: `prompts.yaml:2-29`

- [ ] **Step 1: Replace the classifier prompt**

Replace the existing `planner.classifier:` prompt content (lines 2-29) with:

```yaml
  classifier: |
    ### ROLE
    Classify code refactoring intents from natural language instructions.

    ### CATEGORIES
    1. CONTROL_FLOW: FLATTEN_CONDITIONAL | DECOMPOSE_CONDITIONAL | CONSOLIDATE_CONDITIONAL | REMOVE_CONTROL_FLAG | REPLACE_LOOP_WITH_PIPELINE | SPLIT_LOOP
    2. METHOD_MOVEMENT: EXTRACT_METHOD | INLINE_METHOD
    3. STATE_MANAGEMENT: EXTRACT_VARIABLE | INLINE_VARIABLE | EXTRACT_CONSTANT | RENAME_SYMBOL

    ### REASONING STEPS
    STEP 1: Read the instruction. Is it about conditionals? Methods? Variables? Loops?
    STEP 2: Read the code. Does the code actually contain what the instruction references?
    STEP 3: Never select REPLACE_LOOP_WITH_PIPELINE or SPLIT_LOOP unless the code has a for/while/do-while loop.
    STEP 4: Output ONLY JSON. No preamble, no markdown, no explanation.

    ### EXAMPLE
    Instruction: "Flatten the nested ifs in processOrder using guard clauses"
    Code: public class A { void processOrder() { if(x) { if(y) { doWork(); } } } }

    Output:
    {
      "classification_scratchpad": "Instruction targets conditional structure. Code has nested if-statements in processOrder method. Category is CONTROL_FLOW, intent is FLATTEN_CONDITIONAL.",
      "intent_packet": {
        "refactor_category": "CONTROL_FLOW",
        "specific_intent": "FLATTEN_CONDITIONAL",
        "scope_anchor": {
          "class": "A",
          "member": "processOrder",
          "unit_type": "METHOD_UNIT"
        }
      }
    }
```

- [ ] **Step 2: Verify YAML is valid**

Run: `python -c "import yaml; yaml.safe_load(open('prompts.yaml')); print('YAML valid')"`

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add prompts.yaml
git commit -m "feat: restructure classifier prompt with CoT steps and few-shot example"
```

---

### Task 3: Add Architect Analysis Prompt + Rewrite Synthesis Prompt

**Files:**
- Modify: `prompts.yaml:31-64`

- [ ] **Step 1: Add architect_analysis prompt after the existing architect section**

After the `planner.architect:` block (ends at line 64), add this new prompt under `planner:`:

```yaml
  architect_analysis: |
    ### ROLE
    Analyze what needs to change in the code. Identify targets, dependencies, and elements to preserve. Do NOT design mutations yet.

    ### TASK
    Given the intent packet and user instruction, identify:
    1. PRIMARY targets: methods or fields the instruction directly asks to change
    2. SECONDARY targets: methods or fields affected by the primary changes (callers, referenced fields)
    3. NEW structures: methods, fields, constants, or enums the refactoring requires
    4. MUST PRESERVE: strSearching literals, exception types, error messages, method signatures that must stay identical

    ### OUTPUT FORMAT
    Output ONLY JSON. No preamble.
    {
      "analysis_scratchpad": "Reasoning about the code structure and what needs to change",
      "primary_targets": ["methodName"],
      "secondary_targets": ["otherMethod"],
      "new_structures_needed": ["helperMethod", "CONSTANT_NAME"],
      "must_preserve": ["Exception: IllegalArgumentException", "String: 'Order has no items'"]
    }
```

- [ ] **Step 2: Replace the architect prompt with synthesis-focused version**

Replace the existing `planner.architect:` prompt content (lines 31-64) with:

```yaml
  architect: |
    ### ROLE
    Translate the structural analysis into precise AST mutations. You operate on the analysis, not the raw code.

    ### INPUT
    You receive:
    - Analysis: list of primary targets, secondary targets, new structures needed, elements to preserve
    - Intent packet: the classified intent
    - User instruction: the original request
    - Code: the original code

    ### RULES
    1. Map each primary_target to a MODIFY_METHOD mutation with specific logic_changes
    2. Map each new_structure to ADD_METHOD, ADD_FIELD, ADD_CONSTANT, or ADD_ENUM
    3. Map each secondary_target only if it must change (e.g., caller signature update)
    4. Include every item in must_preserve exactly as-is (no modification)
    5. CONCISENESS: One mutation per target. Do not repeat.

    ### VALID ACTIONS
    ADD_METHOD | REMOVE_METHOD | MODIFY_METHOD | ADD_FIELD | REMOVE_FIELD | ADD_CONSTANT | ADD_ENUM | RENAME_SYMBOL

    ### OUTPUT FORMAT
    Output ONLY JSON. No preamble, no markdown.
    {
      "architect_scratchpad": "How each analysis item maps to a specific mutation",
      "ast_modification_plan": {
        "target_class": "ClassName",
        "ast_mutations": [
          {
            "action": "MODIFY_METHOD",
            "target": "methodName",
            "details": {
              "modifiers": ["public"],
              "type": "void",
              "parameters": [],
              "logic_changes": ["Replace nested ifs with guard clauses using early returns/exceptions"],
              "body_abstract": "Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw."
            }
          }
        ]
      }
    }
```

- [ ] **Step 2: Verify YAML is valid**

Run: `python -c "import yaml; yaml.safe_load(open('prompts.yaml')); print('YAML valid')"`

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add prompts.yaml
git commit -m "feat: split architect into analysis + synthesis sub-prompts"
```

---

### Task 4: Rewrite Generator Coder Prompt + Add Self-Review Prompt

**Files:**
- Modify: `prompts.yaml:66-82`

- [ ] **Step 1: Replace the coder prompt**

Replace the existing `generator.coder:` prompt (lines 66-82) with:

```yaml
  coder: |
    ### ROLE
    Silent execution engine. Apply the ast_modification_plan to the base code exactly as specified.

    ### RULES
    1. Apply mutations in the order listed in the plan
    2. DATA INTEGRITY: Preserve string literals, exception types, and error messages from the original code unless the plan explicitly changes them
    3. CONSTANT USAGE: If the plan defines constants or enums, use their names — do not keep the original numeric literal values

    ### ANTI-PATTERNS (DO NOT DO ANY OF THESE)
    - Do NOT add any method not listed in the plan's ast_mutations
    - Do NOT remove any method not listed in the plan's ast_mutations
    - Do NOT change exception types (IllegalArgumentException stays as is, etc.)
    - Do NOT merge multiple guard clauses or validation checks into one combined check
    - Do NOT invent new variables, parameters, or classes
    - Do NOT add comments or documentation (// or /* */)
    - Do NOT add or remove import statements
    - Do NOT output any text outside the <code> block

    ### OUTPUT FORMAT
    Output ONLY the refactored code wrapped in <code> tags. No explanation, no markdown, no preamble.

    <code>
    public class X { ... }
    </code>
```

- [ ] **Step 2: Add the coder_review prompt**

Below the `generator.coder:` block, add:

```yaml
  coder_review: |
    ### ROLE
    Quality checker. Audit the refactored code against the modification plan before final validation.

    ### CHECKLIST
    1. MUTATION FIDELITY: Does the refactored code implement every mutation in the plan?
    2. NO EXTRA ADDITIONS: Are there any methods, fields, or constants NOT listed in the plan?
    3. LITERAL INTEGRITY: Are all original string literals and error messages preserved (unless plan explicitly changes them)?
    4. SYNTAX: Are there any obvious syntax issues? (missing semicolons, unclosed braces, mismatched parentheses, missing return statements)
    5. EXCEPTION TYPES: Were any exception types changed from the original?

    ### VERDICT
    - PASS: All checks pass. Code is ready for validation.
    - FAIL: One or more issues found. List them.

    ### OUTPUT FORMAT
    Output ONLY JSON. No preamble.
    {
      "review_scratchpad": "Brief summary of each check result",
      "all_mutations_applied": true,
      "extra_additions": [],
      "changed_literals": [],
      "syntax_issues": [],
      "verdict": "PASS"
    }
```

- [ ] **Step 3: Verify YAML is valid**

Run: `python -c "import yaml; yaml.safe_load(open('prompts.yaml')); print('YAML valid')"`

Expected: `YAML valid`

- [ ] **Step 4: Commit**

```bash
git add prompts.yaml
git commit -m "feat: add anti-patterns to coder prompt and new coder_review prompt"
```

---

### Task 5: Rewrite Judge Auditor Prompt with Plan Context

**Files:**
- Modify: `prompts.yaml` — the `judge.auditor:` section

- [ ] **Step 1: Replace the auditor prompt**

Replace the existing `judge.auditor:` prompt with:

```yaml
  auditor: |
    ### ROLE
    Structural Auditor. Detect logic drift or semantic errors in refactored code.

    ### CONTEXT YOU RECEIVE
    You will be given:
    - Plan summary: what the refactoring was intended to do
    - Planned mutations: what specific changes were requested
    - Original code and refactored code

    ### AUDIT TASKS
    1. PLAN FIDELITY: Do the changes in the refactored code match what the plan intended? Changes that match the plan are EXPECTED, not errors.
    2. VARIABLE TRACE: Map every variable/parameter in the original to its counterpart in the refactored version.
    3. LOGIC CHECK: For the same inputs, do the conditional paths produce the same outputs?
    4. VERDICT: REVISE only if the functional output would change for a given input.

    ### RULES
    - Standard refactoring idioms (guard clauses with early returns, returning boolean evaluations directly, extracting helper methods) are ACCEPTABLE and encouraged.
    - Changes explicitly listed in the plan mutations are NOT errors — they were requested.
    - Demand REVISE only if logic drift would cause different behavior. Stylistic changes and idiomatic improvements are fine.

    ### OUTPUT FORMAT
    Output ONLY JSON. No preamble, no markdown tags, no XML tags.
    {
      "audit_scratchpad": {
        "variable_trace": [{"original": "x", "refactored": "y", "mapping": "IDENTITY"}],
        "logic_comparison": "Structural summary of conditional paths."
      },
      "verdict": "ACCEPT",
      "issues": []
    }
```

- [ ] **Step 2: Verify YAML is valid**

Run: `python -c "import yaml; yaml.safe_load(open('prompts.yaml')); print('YAML valid')"`

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add prompts.yaml
git commit -m "feat: add plan context injection instructions to auditor prompt"
```

---

### Task 6: Add New State Fields to OrchestrationState

**Files:**
- Modify: `app/modules/orchestrator.py:28-68`

- [ ] **Step 1: Add architect_analysis, generator_self_review, and self_review_attempts fields**

Add these three fields to the `OrchestrationState` class, after the existing `syntax_error_context` field (line 48):

```python
    # Sub-Step Decomposition
    architect_analysis: Optional[Dict] = None

    # Generator Self-Review
    generator_self_review: Optional[Dict] = None
    self_review_attempts: int = 0
```

The full field list should look like:

```python
class OrchestrationState(BaseModel):
    session_id: str
    base_code: str
    working_code: str
    user_instruction: str

    # Structural Artifacts
    intent_packet: Optional[Dict] = None
    active_plan: Optional[Dict] = None

    # Loop Counters
    strategy_iter: int = 1
    strategy_iter_incremented: bool = False
    syntax_iter: int = 0

    # Diagnostic Memory
    cumulative_feedback: List[Dict] = []
    feedback_cap: int = 3

    # Syntax Healing
    syntax_error_context: Optional[Dict] = None

    # Sub-Step Decomposition
    architect_analysis: Optional[Dict] = None

    # Generator Self-Review
    generator_self_review: Optional[Dict] = None
    self_review_attempts: int = 0

    # Lifecycle
    current_phase: int = 1
    exit_status: ExitStatus = ExitStatus.PROCESSING

    # Baseline Metrics
    original_complexity: int = 0
    previous_fault_count: int = 999
    fault_stall_count: int = 0
```

- [ ] **Step 2: Verify no import errors**

Run: `python -c "from app.modules.orchestrator import OrchestrationState; s = OrchestrationState(session_id='test', base_code='x', working_code='x', user_instruction='y'); print(s.architect_analysis); print(s.self_review_attempts)"`

Expected: `None` and `0`

- [ ] **Step 3: Commit**

```bash
git add app/modules/orchestrator.py
git commit -m "feat: add architect_analysis and self_review fields to OrchestrationState"
```

---

### Task 7: Split _run_phase_2 into Classifier + Analysis + Synthesis

**Files:**
- Modify: `app/modules/orchestrator.py:165-244`

- [ ] **Step 1: Add the ArchitectAnalysis call between classifier and architect**

Replace the entire `_run_phase_2` method with the split version:

```python
    async def _run_phase_2(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 2: The Strategy Block (Inference 1, 2, 3)."""
        state.strategy_iter_incremented = False
        # Step 3: Classifier
        if not state.intent_packet or state.strategy_iter > 1:
            await self._notify(
                client,
                Role.Planner,
                f"Ph2: Classifying intent (Strategy Iter {state.strategy_iter})...",
                phase=2,
            )
            await self.agent_service.swap(self.model_config["planner"])

            prompt = f"<code>{state.base_code}</code>\n<instruction>{state.user_instruction}</instruction>"
            if state.cumulative_feedback:
                prompt += f"\n\n### PREVIOUS ATTEMPT FEEDBACK\n{json.dumps(state.cumulative_feedback, indent=2)}"

            messages: List[ChatCompletionRequestMessage] = [
                {"role": "system", "content": self.prompts["planner"]["classifier"]},
                {"role": "user", "content": prompt},
            ]

            raw = await self.agent_service.generate(
                messages, temp=0.1, max_tokens=500, response_model=IntentClassifierResponse
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
        if state.cumulative_feedback:
            analysis_prompt += f"\n\n### PREVIOUS ATTEMPT FEEDBACK\n{json.dumps(state.cumulative_feedback, indent=2)}"

        messages = [
            {"role": "system", "content": self.prompts["planner"]["architect_analysis"]},
            {"role": "user", "content": analysis_prompt},
        ]

        raw = await self.agent_service.generate(
            messages, temp=0.1, max_tokens=1024
        )
        analysis_text = raw["choices"][0]["message"].get("content") or ""
        print(
            f"\n--- Planner Analysis Output ---\n{analysis_text}\n-------------------------------"
        )

        try:
            state.architect_analysis = json.loads(
                ResponseParser.extract_json_text(analysis_text)
            )
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

        messages = [
            {"role": "system", "content": self.prompts["planner"]["architect"]},
            {"role": "user", "content": arch_prompt},
        ]

        raw = await self.agent_service.generate(
            messages, temp=0.2, max_tokens=2048, response_model=ASTArchitectResponse
        )
        arch_text = raw["choices"][0]["message"].get("content") or ""
        print(
            f"\n--- Planner Architect Output ---\n{arch_text}\n------------------------------"
        )

        architect_res = ResponseParser.extract_json(arch_text, ASTArchitectResponse)
        state.active_plan = architect_res.ast_modification_plan.model_dump()

        await self._notify(
            client,
            Role.Planner,
            "Modification plan generated.",
            content=json.dumps(state.active_plan),
        )

        state.current_phase = 3
```

- [ ] **Step 2: Add extract_json_text helper to ResponseParser**

The above code references `ResponseParser.extract_json_text` which doesn't exist yet. Add this static method to `app/utils/response_parser.py`:

```python
    @staticmethod
    def extract_json_text(text: Optional[str]) -> str:
        """Extracts raw JSON string from text, stripping markdown blocks and thinking tags."""
        if text is None:
            return "{}"
        # Strip thinking blocks
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
        # Look for json code blocks
        json_block_pattern = r"```json\s*(.*?)\s*```"
        match = re.search(json_block_pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        # Try to find the first '{' and last '}'
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return text[start:end+1].strip()
        return "{}"
```

- [ ] **Step 3: Verify imports**

Run: `python -c "from app.modules.orchestrator import Orchestrator; print('Import OK')"`

Expected: `Import OK`

- [ ] **Step 4: Commit**

```bash
git add app/modules/orchestrator.py app/utils/response_parser.py
git commit -m "feat: split architect into analysis + synthesis sub-calls in phase 2"
```

---

### Task 8: Add Generator Self-Review to _run_phase_3

**Files:**
- Modify: `app/modules/orchestrator.py:246-313`

- [ ] **Step 1: Add self-review after successful code extraction in _run_phase_3**

In `_run_phase_3`, after the existing code that sets `state.working_code = new_code` and before setting `state.current_phase = 4`, add the self-review logic. The relevant section currently looks like:

```python
        new_code = ResponseParser.extract_xml(coder_text, "code")
        if new_code:
            state.working_code = new_code
            state.syntax_iter = 0
            state.syntax_error_context = None
            await self._notify(
                client, Role.Generator, "Code refactored.", content=new_code
            )
            state.current_phase = 4
            print(new_code)
```

Replace the entire block after `new_code = ResponseParser.extract_xml(...)` with:

```python
        new_code = ResponseParser.extract_xml(coder_text, "code")
        if new_code:
            state.working_code = new_code
            state.syntax_iter = 0
            state.syntax_error_context = None
            await self._notify(
                client, Role.Generator, "Code refactored.", content=new_code
            )
            print(new_code)

            # Step 6b: Generator Self-Review (NEW)
            if state.self_review_attempts == 0:
                await self._notify(
                    client, Role.Generator, "Ph3: Self-reviewing output..."
                )
            review_prompt = (
                f"Plan: {json.dumps(state.active_plan)}\n"
                f"Original: <code>{state.base_code}</code>\n"
                f"Refactored: <code>{state.working_code}</code>"
            )
            review_messages: List[ChatCompletionRequestMessage] = [
                {"role": "system", "content": self.prompts["generator"]["coder_review"]},
                {"role": "user", "content": review_prompt},
            ]
            raw_review = await self.agent_service.generate(
                review_messages, temp=0.1, max_tokens=512
            )
            review_text = raw_review["choices"][0]["message"].get("content") or ""
            print(
                f"\n--- Generator Self-Review Output ---\n{review_text}\n-------------------------------------"
            )

            try:
                review = json.loads(ResponseParser.extract_json_text(review_text))
            except (json.JSONDecodeError, ValueError):
                review = {"verdict": "PASS"}

            state.generator_self_review = review

            if review.get("verdict") == "FAIL" and state.self_review_attempts < 2:
                state.self_review_attempts += 1
                issues = (
                    review.get("syntax_issues", [])
                    + review.get("extra_additions", [])
                    + review.get("changed_literals", [])
                )
                state.syntax_error_context = {
                    "attempt": state.self_review_attempts,
                    "error": "; ".join(issues[:3]) if issues else "Review flagged issues.",
                    "broken_code": state.working_code,
                }
                state.current_phase = 3
                return
            else:
                state.self_review_attempts = 0
                state.current_phase = 4
        else:
            # existing no-code-block handling...
```

- [ ] **Step 2: Verify imports and syntax**

Run: `python -c "from app.modules.orchestrator import Orchestrator; print('Import OK')"`

Expected: `Import OK`

- [ ] **Step 3: Commit**

```bash
git add app/modules/orchestrator.py
git commit -m "feat: add generator self-review with retry loop to phase 3"
```

---

### Task 9: Inject Plan Context into _run_phase_5 Auditor

**Files:**
- Modify: `app/modules/orchestrator.py:488-529`

- [ ] **Step 1: Build plan summary and inject into auditor prompt**

Replace the `_run_phase_5` method content with the plan-context-aware version:

```python
    async def _run_phase_5(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 5: Heuristic Adjudication (Inference 4)."""
        await self._notify(client, Role.Judge, "Ph5: Running final audit...", phase=5)
        await self.agent_service.swap(self.model_config["judge"])

        # Build plan context summary for the auditor
        intent = ""
        target_class = ""
        target_method = ""
        if state.intent_packet:
            intent = state.intent_packet.get("specific_intent", "")
            scope = state.intent_packet.get("scope_anchor", {})
            target_class = scope.get("class", "")
            target_method = scope.get("member", "")

        mutations = state.active_plan.get("ast_mutations", []) if state.active_plan else []
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
            f"Original: <code>{state.base_code}</code>\n"
            f"Refactored: <code>{state.working_code}</code>\n"
            f"Intent: {json.dumps(state.intent_packet)}"
        )
        messages: List[ChatCompletionRequestMessage] = [
            {"role": "system", "content": self.prompts["judge"]["auditor"]},
            {"role": "user", "content": audit_prompt},
        ]

        raw = await self.agent_service.generate(
            messages, temp=0.1, max_tokens=1000, response_model=StructuralAuditorResponse
        )
        audit_text = raw["choices"][0]["message"].get("content") or ""
        print(
            f"\n--- Judge Auditor Output ---\n{audit_text}\n--------------------------"
        )

        audit_res = ResponseParser.extract_json(audit_text, StructuralAuditorResponse)

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
                {"failure_tier": FailureTier.TIER_3_JUDGE, "error": audit_res.issues}
            )
            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.current_phase = 2
```

- [ ] **Step 2: Verify import and syntax**

Run: `python -c "from app.modules.orchestrator import Orchestrator; print('Import OK')"`

Expected: `Import OK`

- [ ] **Step 3: Commit**

```bash
git add app/modules/orchestrator.py
git commit -m "feat: inject plan context into auditor prompt in phase 5"
```

---

### Task 10: Test — Architect Split Flow

**Files:**
- Modify: `tests/test_orchestrator_flow.py`

- [ ] **Step 1: Write the test**

Add this test method to the `TestOrchestratorFlow` class:

```python
    async def test_architect_split_flow(self):
        """Architect analysis call produces targets list, synthesis produces valid plan."""
        mock_yaml = MagicMock()
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        mock_open = MagicMock()

        with patch("builtins.open", mock_open), patch("yaml.safe_load", mock_yaml):
            orch = Orchestrator(self.agent_service, self.validator, self.db)

            responses = [
                # Ph2: Classifier
                json.dumps({
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "CONTROL_FLOW",
                        "specific_intent": "FLATTEN_CONDITIONAL",
                        "scope_anchor": {"class": "A", "member": "m", "unit_type": "METHOD_UNIT"},
                    },
                }),
                # Ph2: Architect Analysis
                json.dumps({
                    "analysis_scratchpad": "Target is method m with nested ifs",
                    "primary_targets": ["m"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": ["Exception: IllegalArgumentException"],
                }),
                # Ph2: Architect Synthesis
                json.dumps({
                    "architect_scratchpad": "Mapping analysis to mutations",
                    "ast_modification_plan": {
                        "target_class": "A",
                        "ast_mutations": [
                            {
                                "action": "MODIFY_METHOD",
                                "target": "m",
                                "details": {
                                    "modifiers": ["public"],
                                    "type": "void",
                                    "parameters": [],
                                    "logic_changes": ["Flatten nested ifs"],
                                    "body_abstract": "Use guard clauses"
                                },
                            }
                        ],
                    },
                }),
                # Ph3: Coder
                "<code>public class A { void m() { if(!a) throw new IllegalArgumentException(); doWork(); } }</code>",
                # Ph3: Self-Review
                json.dumps({"review_scratchpad": "ok", "all_mutations_applied": True, "extra_additions": [], "changed_literals": [], "syntax_issues": [], "verdict": "PASS"}),
                # Ph5: Auditor
                json.dumps({
                    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "ok"},
                    "verdict": "ACCEPT",
                    "issues": [],
                }),
                # Ph6: Insights
                json.dumps({"insights": [{"title": "T", "details": "D"}]}),
            ]

            async def mock_gen(messages, **kwargs):
                content = responses.pop(0)
                return {"choices": [{"message": {"content": content}}]}

            self.agent_service.generate.side_effect = mock_gen

            client = MockClient()
            user_code = "public class A { void m() { if(a) { if(b) { doWork(); } } } }"
            user_instruction = "Flatten it."

            await orch.execute_orchestration(client, user_code, user_instruction)  # type: ignore

            self.assertIsNotNone(client.results)
            # Verify we got through all phases
            status_msgs = [s[1] for s in client.statuses]
            self.assertTrue(any("Ph6" in m for m in status_msgs))
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `python -m pytest tests/test_orchestrator_flow.py::TestOrchestratorFlow::test_architect_split_flow -v`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_orchestrator_flow.py
git commit -m "test: add architect split flow test"
```

---

### Task 11: Test — Generator Self-Review Pass

**Files:**
- Modify: `tests/test_orchestrator_flow.py`

- [ ] **Step 1: Write the test**

```python
    async def test_generator_self_review_pass(self):
        """Clean refactored code passes self-review and advances to phase 4."""
        mock_yaml = MagicMock()
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        mock_open = MagicMock()

        with patch("builtins.open", mock_open), patch("yaml.safe_load", mock_yaml):
            orch = Orchestrator(self.agent_service, self.validator, self.db)

            responses = [
                # Ph2: Classifier
                json.dumps({
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "METHOD_MOVEMENT",
                        "specific_intent": "EXTRACT_METHOD",
                        "scope_anchor": {"class": "A", "member": "m", "unit_type": "METHOD_UNIT"},
                    },
                }),
                # Ph2: Architect Analysis
                json.dumps({
                    "analysis_scratchpad": "Extract part of m into helper",
                    "primary_targets": ["m"],
                    "secondary_targets": [],
                    "new_structures_needed": ["helper"],
                    "must_preserve": [],
                }),
                # Ph2: Architect Synthesis
                json.dumps({
                    "architect_scratchpad": "Map to mutations",
                    "ast_modification_plan": {
                        "target_class": "A",
                        "ast_mutations": [
                            {"action": "MODIFY_METHOD", "target": "m", "details": {"modifiers": ["public"], "type": "void", "parameters": [], "logic_changes": ["Call helper instead of inline"], "body_abstract": "helper();"}},
                            {"action": "ADD_METHOD", "target": "helper", "details": {"modifiers": ["private"], "type": "void", "parameters": [], "logic_changes": [], "body_abstract": "int x = 1;"}},
                        ],
                    },
                }),
                # Ph3: Coder
                "<code>class A { void m() { helper(); } private void helper() { int x = 1; } }</code>",
                # Ph3: Self-Review -> PASS
                json.dumps({"review_scratchpad": "ok", "all_mutations_applied": True, "extra_additions": [], "changed_literals": [], "syntax_issues": [], "verdict": "PASS"}),
                # Ph5: Auditor -> ACCEPT
                json.dumps({
                    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "ok"},
                    "verdict": "ACCEPT",
                    "issues": [],
                }),
                # Ph6: Insights
                json.dumps({"insights": [{"title": "T", "details": "D"}]}),
            ]

            async def mock_gen(messages, **kwargs):
                content = responses.pop(0)
                return {"choices": [{"message": {"content": content}}]}

            self.agent_service.generate.side_effect = mock_gen

            client = MockClient()
            user_code = "class A { void m() { int x = 1; } }"
            user_instruction = "Extract helper method."

            await orch.execute_orchestration(client, user_code, user_instruction)  # type: ignore

            self.assertIsNotNone(client.results)
            # Verify self-review PASS status was sent
            status_msgs = [s[1] for s in client.statuses]
            self.assertTrue(any("Ph4" in m for m in status_msgs))
```

- [ ] **Step 2: Run the test**

Run: `python -m pytest tests/test_orchestrator_flow.py::TestOrchestratorFlow::test_generator_self_review_pass -v`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_orchestrator_flow.py
git commit -m "test: add generator self-review pass test"
```

---

### Task 12: Test — Generator Self-Review Fail Retry

**Files:**
- Modify: `tests/test_orchestrator_flow.py`

- [ ] **Step 1: Write the test**

```python
    async def test_generator_self_review_fail_retry(self):
        """Failed self-review triggers coder retry with review issues in error context."""
        mock_yaml = MagicMock()
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        mock_open = MagicMock()

        with patch("builtins.open", mock_open), patch("yaml.safe_load", mock_yaml):
            orch = Orchestrator(self.agent_service, self.validator, self.db)

            # First attempt: coder produces code, self-review FAILs
            # Second attempt: coder produces fixed code, self-review passes
            responses = [
                # Ph2: Classifier
                json.dumps({
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "CONTROL_FLOW",
                        "specific_intent": "FLATTEN_CONDITIONAL",
                        "scope_anchor": {"class": "A", "member": "m", "unit_type": "METHOD_UNIT"},
                    },
                }),
                # Ph2: Architect Analysis
                json.dumps({
                    "analysis_scratchpad": "Flatten nested ifs",
                    "primary_targets": ["m"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": [],
                }),
                # Ph2: Architect Synthesis
                json.dumps({
                    "architect_scratchpad": "Map to mutations",
                    "ast_modification_plan": {
                        "target_class": "A",
                        "ast_mutations": [
                            {"action": "MODIFY_METHOD", "target": "m", "details": {"modifiers": ["public"], "type": "void", "parameters": [], "logic_changes": ["Flatten"], "body_abstract": "Flattened code"}},
                        ],
                    },
                }),
                # Ph3: Coder (attempt 1)
                "<code>public class A { void m() { if(a) { if(b) { doWork(); } } } }</code>",
                # Ph3: Self-Review -> FAIL
                json.dumps({"review_scratchpad": "Not flattened", "all_mutations_applied": False, "extra_additions": [], "changed_literals": [], "syntax_issues": [], "verdict": "FAIL"}),
                # Ph3: Coder (retry 2) — now with error context
                "<code>public class A { void m() { if(!a) return; if(!b) return; doWork(); } }</code>",
                # Ph3: Self-Review -> PASS
                json.dumps({"review_scratchpad": "ok", "all_mutations_applied": True, "extra_additions": [], "changed_literals": [], "syntax_issues": [], "verdict": "PASS"}),
                # Ph5: Auditor -> ACCEPT
                json.dumps({
                    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "ok"},
                    "verdict": "ACCEPT",
                    "issues": [],
                }),
                # Ph6: Insights
                json.dumps({"insights": [{"title": "T", "details": "D"}]}),
            ]

            async def mock_gen(messages, **kwargs):
                content = responses.pop(0)
                return {"choices": [{"message": {"content": content}}]}

            self.agent_service.generate.side_effect = mock_gen

            client = MockClient()
            user_code = "public class A { void m() { if(a) { if(b) { doWork(); } } } }"
            user_instruction = "Flatten it."

            await orch.execute_orchestration(client, user_code, user_instruction)  # type: ignore

            self.assertIsNotNone(client.results)
            status_msgs = [s[1] for s in client.statuses]
            # Should see self-review notification
            self.assertTrue(any("Self-reviewing" in m for m in status_msgs))
```

- [ ] **Step 2: Run the test**

Run: `python -m pytest tests/test_orchestrator_flow.py::TestOrchestratorFlow::test_generator_self_review_fail_retry -v`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_orchestrator_flow.py
git commit -m "test: add generator self-review fail-retry test"
```

---

### Task 13: Test — Generator Self-Review Exhausted + Auditor Plan Context

**Files:**
- Modify: `tests/test_orchestrator_flow.py`

- [ ] **Step 1: Write the test for review exhaustion**

```python
    async def test_generator_self_review_fail_exhausted(self):
        """After 2 failed self-reviews, proceed to Phase 4 anyway."""
        mock_yaml = MagicMock()
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        mock_open = MagicMock()

        with patch("builtins.open", mock_open), patch("yaml.safe_load", mock_yaml):
            orch = Orchestrator(self.agent_service, self.validator, self.db)

            responses = [
                # Ph2: Classifier
                json.dumps({
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "STATE_MANAGEMENT",
                        "specific_intent": "RENAME_SYMBOL",
                        "scope_anchor": {"class": "A", "member": "foo", "unit_type": "METHOD_UNIT"},
                    },
                }),
                # Ph2: Architect Analysis
                json.dumps({
                    "analysis_scratchpad": "Rename foo to bar",
                    "primary_targets": ["foo"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": [],
                }),
                # Ph2: Architect Synthesis
                json.dumps({
                    "architect_scratchpad": "Rename mutation",
                    "ast_modification_plan": {
                        "target_class": "A",
                        "ast_mutations": [
                            {"action": "RENAME_SYMBOL", "target": "foo", "details": {"modifiers": [], "type": "", "parameters": [], "logic_changes": ["Rename to bar"], "body_abstract": ""}},
                        ],
                    },
                }),
                # Ph3: Coder (attempt 1)
                "<code>class A { void bar() { int x = 1; } }</code>",
                # Ph3: Self-Review -> FAIL (attempt 1)
                json.dumps({"review_scratchpad": "wrong", "all_mutations_applied": False, "extra_additions": [], "changed_literals": [], "syntax_issues": [], "verdict": "FAIL"}),
                # Ph3: Coder (attempt 2) with error context
                "<code>class A { void bar() { int x = 1; } }</code>",
                # Ph3: Self-Review -> FAIL (attempt 2)
                json.dumps({"review_scratchpad": "still wrong", "all_mutations_applied": False, "extra_additions": [], "changed_literals": [], "syntax_issues": [], "verdict": "FAIL"}),
                # Ph3: Coder (attempt 3 — exhausted, so review skipped)
                "<code>class A { void bar() { int x = 1; } }</code>",
                # Ph5: Auditor -> ACCEPT
                json.dumps({
                    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "ok"},
                    "verdict": "ACCEPT",
                    "issues": [],
                }),
                # Ph6: Insights
                json.dumps({"insights": [{"title": "T", "details": "D"}]}),
            ]

            async def mock_gen(messages, **kwargs):
                content = responses.pop(0)
                return {"choices": [{"message": {"content": content}}]}

            self.agent_service.generate.side_effect = mock_gen

            client = MockClient()
            user_code = "class A { void foo() { int x = 1; } }"
            user_instruction = "Rename foo to bar."

            await orch.execute_orchestration(client, user_code, user_instruction)  # type: ignore

            self.assertIsNotNone(client.results)
            self.db.complete_session.assert_called_once()
```

- [ ] **Step 2: Write the test for auditor plan context injection**

```python
    async def test_auditor_gets_plan_context(self):
        """Phase 5 auditor prompt contains plan summary and mutations list."""
        mock_yaml = MagicMock()
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        mock_open = MagicMock()

        with patch("builtins.open", mock_open), patch("yaml.safe_load", mock_yaml):
            orch = Orchestrator(self.agent_service, self.validator, self.db)

            responses = [
                # Ph2: Classifier
                json.dumps({
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "CONTROL_FLOW",
                        "specific_intent": "FLATTEN_CONDITIONAL",
                        "scope_anchor": {"class": "OrderProcessor", "member": "processOrder", "unit_type": "METHOD_UNIT"},
                    },
                }),
                # Ph2: Architect Analysis
                json.dumps({
                    "analysis_scratchpad": "Target is processOrder",
                    "primary_targets": ["processOrder"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": [],
                }),
                # Ph2: Architect Synthesis
                json.dumps({
                    "architect_scratchpad": "Plan mutations",
                    "ast_modification_plan": {
                        "target_class": "OrderProcessor",
                        "ast_mutations": [
                            {"action": "MODIFY_METHOD", "target": "processOrder", "details": {"modifiers": ["public"], "type": "void", "parameters": [], "logic_changes": ["Use guard clauses"], "body_abstract": "Linear validations"}},
                        ],
                    },
                }),
                # Ph3: Coder
                "<code>public class OrderProcessor { public void processOrder() { if(!x) return; doWork(); } }</code>",
                # Ph3: Self-Review -> PASS
                json.dumps({"review_scratchpad": "ok", "all_mutations_applied": True, "extra_additions": [], "changed_literals": [], "syntax_issues": [], "verdict": "PASS"}),
                # Ph5: Auditor -> ACCEPT
                json.dumps({
                    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "ok"},
                    "verdict": "ACCEPT",
                    "issues": [],
                }),
                # Ph6: Insights
                json.dumps({"insights": [{"title": "T", "details": "D"}]}),
            ]

            captured_prompt = None

            async def mock_gen(messages, **kwargs):
                nonlocal captured_prompt
                content = responses.pop(0)
                # Capture the auditor call (5th call total: classifier, analysis, synthesis, coder, review, auditor)
                # The auditor is the 6th call (index 5 in responses remaining)
                if "Plan Context" in str(messages[-1].get("content", "")):
                    captured_prompt = messages[-1].get("content", "")
                return {"choices": [{"message": {"content": content}}]}

            self.agent_service.generate.side_effect = mock_gen

            client = MockClient()
            user_code = "public class OrderProcessor { public void processOrder() { if(x) { doWork(); } } }"
            user_instruction = "Flatten it."

            await orch.execute_orchestration(client, user_code, user_instruction)  # type: ignore

            self.assertIsNotNone(captured_prompt, "Auditor prompt should have been captured")
            self.assertIn("Plan Context", captured_prompt)
            self.assertIn("FLATTEN_CONDITIONAL", captured_prompt)
            self.assertIn("OrderProcessor.processOrder", captured_prompt)
            self.assertIn("MODIFY_METHOD", captured_prompt)
            self.assertIn("Mutations:", captured_prompt)
```

- [ ] **Step 2: Run both tests**

Run: `python -m pytest tests/test_orchestrator_flow.py::TestOrchestratorFlow::test_generator_self_review_fail_exhausted tests/test_orchestrator_flow.py::TestOrchestratorFlow::test_auditor_gets_plan_context -v`

Expected: Both PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_orchestrator_flow.py
git commit -m "test: add review exhaustion and auditor context injection tests"
```

---

### Task 14: Run All Existing Tests

**Files:**
- No file changes — verification only

- [ ] **Step 1: Run all unit tests**

Run: `python -m pytest tests/ -v --ignore=tests/test_performance.py`

Expected: All tests pass. The `test_performance.py` may be skipped (requires pytest-specific features not installed).

- [ ] **Step 2: Fix any regressions**

If any existing tests fail, fix them before proceeding. Likely failure: `test_full_success_flow` may need updated response sequence to include analysis + self-review calls. Update the test's `responses` list to include the 2 extra responses.

- [ ] **Step 3: Run full test suite after fixes**

Run: `python -m pytest tests/ -v --ignore=tests/test_performance.py`

Expected: All passing.

- [ ] **Step 4: Commit any test fixes**

```bash
git add tests/
git commit -m "fix: update existing tests for new sub-step calls in flow"
```

---

### Task 15: Final Verification + Cleanup

- [ ] **Step 1: Run full test suite one last time**

Run: `python -m pytest tests/ -v --ignore=tests/test_performance.py`

- [ ] **Step 2: Run Pyright type checker on modified files**

Run: `python -m pyright app/modules/orchestrator.py app/utils/schemas.py app/utils/response_parser.py --ignoreexternal`

Expected: 0 errors

- [ ] **Step 3: Verify prompts.yaml loads correctly with full system**

Run: `python -c "
import yaml
from app.utils.paths import PROMPTS_CONFIG_PATH
with open(PROMPTS_CONFIG_PATH) as f:
    prompts = yaml.safe_load(f)
# Verify all expected prompt keys exist
assert 'classifier' in prompts['planner']
assert 'architect_analysis' in prompts['planner']
assert 'architect' in prompts['planner']
assert 'coder' in prompts['generator']
assert 'coder_review' in prompts['generator']
assert 'auditor' in prompts['judge']
assert 'insights' in prompts['judge']
print('All prompts verified')
"`

Expected: `All prompts verified`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final verification and cleanup"
```
```

- [ ] **Step 5: Print summary of what was built**

Expected output:

```
Sub-Step Decomposition + Prompt Hardening — Complete

Files modified:  4 (prompts.yaml, orchestrator.py, schemas.py, response_parser.py)
Files created:   0
Tests added:     5 new test methods
Commits:         10 (1 schema, 3 prompts, 3 orchestrator, 3 tests)
```
