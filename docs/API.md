# Horizon Code — Frontend API Reference

## Overview

Horizon Code is a Java code refactoring engine powered by three small LLMs (3B GGUF models). It accepts Java source code + a natural-language instruction, runs a 6-phase orchestration pipeline, and returns refactored code with insights. All real-time communication happens over WebSocket. Session history is available via REST.

**Base URL:** `http://localhost:8000`

**CORS origins:** `http://localhost:3000`, `http://127.0.0.1:3000`

---

## REST Endpoints

### `GET /health` — Health Check

Returns server health and current timestamp.

**Response** `200 OK`:
```json
{
  "status": "ok",
  "timestamp": "2026-06-07T12:00:00.123456Z"
}
```

---

### `GET /api/history` — List History

Lists all past refactoring sessions, newest first. Each entry is a lightweight stub (id + instruction only). Use the detail endpoint for full data.

**Response** `200 OK`: `Array<HistoryStub>`
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_instruction": "Extract the validation logic into a separate method"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "user_instruction": "Flatten nested if statements in processOrder"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUIDv4) | Session identifier |
| `user_instruction` | `string` | Original instruction from user |

---

### `GET /api/history/{history_id}` — Get Session Detail

Returns full detail for a single session, including original/refactored code, complexity metrics, all orchestration log entries, GPU metrics, and insights.

**Path parameter:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `history_id` | `string` (UUIDv4) | Yes | Session ID from history list |

**Errors:**
| Status | Condition | Response |
|--------|-----------|----------|
| 404 | ID not found | `{ "detail": "Refactor history not found" }` |
| 409 | System busy (orchestration in progress) | `{ "detail": "System is currently busy with an active orchestration." }` |

**Response** `200 OK`: `HistoryDetail`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_instruction": "Extract the validation logic into a separate method",
  "original_code": "class OrderProcessor {\n  void process(Order o) {\n    if (o.amount > 1000) {\n      validateHighValue(o);\n    }\n    save(o);\n  }\n}",
  "refactored_code": "class OrderProcessor {\n  void process(Order o) {\n    validateIfHighValue(o);\n    save(o);\n  }\n\n  void validateIfHighValue(Order o) {\n    if (o.amount > 1000) {\n      validateHighValue(o);\n    }\n  }\n}",
  "insights": "[{\"title\": \"Extracted Method\", \"details\": \"Created `validateIfHighValue` to encapsulate high-value validation logic.\"}, {\"title\": \"Complexity Reduced\", \"details\": \"CC of `process` dropped from 3 to 2.\"}]",
  "original_complexity": 3,
  "refactored_complexity": 2,
  "planner_model": "qwen2.5-coder-3b-instruct-q4_k_m",
  "generator_model": "qwen2.5-coder-3b-instruct-q4_k_m",
  "judge_model": "llama-3.2-3b-instruct-q4_k_m",
  "avg_gpu_utilization": 45.20,
  "avg_gpu_memory": 78.53,
  "avg_gpu_memory_used": 4194000000.0,
  "inference_time": 23.45,
  "created_at": "2026-06-07T12:00:00",
  "logs": [
    {
      "role": "Planner",
      "status": "Intent Classified: EXTRACT_METHOD",
      "content": "Intent Classified: EXTRACT_METHOD\n\n**Category:** `METHOD_MOVEMENT`\n**Intent:** `EXTRACT_METHOD`\n**Target Unit:** `METHOD_UNIT`\n**Target Class:** `OrderProcessor`\n**Target Member:** `process`",
      "created_at": "2026-06-07T12:00:01"
    }
  ]
}
```

**Field reference:**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `string` (UUIDv4) | No | Session identifier |
| `user_instruction` | `string` | No | Original user instruction |
| `original_code` | `string` | No | Java code before refactoring |
| `refactored_code` | `string` | Yes | Java code after refactoring (`null` if aborted) |
| `insights` | `string` | Yes | JSON array of insight objects, or plain error string |
| `original_complexity` | `int` | Yes | Cyclomatic complexity before |
| `refactored_complexity` | `int` | Yes | Cyclomatic complexity after |
| `planner_model` | `string` | Yes | Planner model name |
| `generator_model` | `string` | Yes | Generator model name |
| `judge_model` | `string` | Yes | Judge model name |
| `avg_gpu_utilization` | `float` | Yes | Average GPU utilization % |
| `avg_gpu_memory` | `float` | Yes | Average GPU memory usage % |
| `avg_gpu_memory_used` | `float` | Yes | Average GPU memory used (bytes) |
| `inference_time` | `float` | Yes | Total wall-clock seconds |
| `created_at` | `string` (datetime) | No | Session creation timestamp |
| `logs` | `array<LogEntry>` | No | Ordered orchestration log entries |

**LogEntry object:**
```json
{
  "role": "Planner",
  "status": "Ph2: Classifying intent (Strategy Iter 1)...",
  "content": "Intent Classified: EXTRACT_METHOD\n\n**Category:** `METHOD_MOVEMENT`...",
  "created_at": "2026-06-07T12:00:01"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `role` | `string` (enum) | Agent role: `Planner`, `Generator`, `Judge`, `Validator`, `System` |
| `status` | `string` | Brief status line (what the agent is doing) |
| `content` | `string` \| `null` | Formatted Markdown with structured data (see Content Formatting section) |
| `created_at` | `string` (datetime) | When this log entry was created |

---

### `DELETE /api/history/{history_id}` — Delete Session

Deletes a session record and all its associated log entries (cascading delete).

**Path parameter:** Same as GET detail.

**Errors:**
| Status | Condition | Response |
|--------|-----------|----------|
| 404 | ID not found | `{ "detail": "Refactor history not found" }` |
| 409 | System busy | `{ "detail": "System is currently busy with an active orchestration." }` |

**Response** `200 OK`: `DeleteResponse`
```json
{
  "status": "history_deleted",
  "message": "Refactor history 550e8400-e29b-41d4-a716-446655440000 deleted"
}
```

---

## WebSocket — `/ws`

The primary real-time channel. One connection per client; multiple refactors can be sent sequentially over the same connection (only one processes at a time).

### Connection Lifecycle

```
Client connects -> ws://localhost:8000/ws
Server accepts -> (101 Switching Protocols)
Server starts heartbeat -> sends ping every 15s
Client must respond with pong within 30s or marked stale
Client sends -> refactor request | halt | pong | reconnect
Server streams -> status messages during processing
Server sends -> result message (always)
Server sends -> insights message (always, after result)
Connection stays -> ready for next request
Client disconnects -> server stops heartbeat, cancels running task
```

### Client -> Server Messages

#### Start Refactoring

Send any valid JSON object that matches the `RefactorRequest` schema:

```json
{
  "code": "class Calc {\n  int add(int a, int b) {\n    int result = a + b;\n    return result;\n  }\n}",
  "user_instruction": "Inline the result variable"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `code` | `string` | Yes | 10-100,000 characters. Must be valid Java (or mostly valid). |
| `user_instruction` | `string` | Yes | 3-10,000 characters. Natural language instruction. |

**Possible error responses:**

| Error | Response |
|-------|----------|
| Malformed JSON (not parseable) | `{ "type": "error", "message": "Malformed JSON payload", "details": "..." }` |
| Validation failure (fields invalid) | `{ "type": "error", "message": "Invalid data format", "details": [{"loc": ["code"], "msg": "Code must be at least 10 characters", "type": "value_error"}] }` |
| System busy (409 conflict) | Status message: `"Server is currently busy with another request. Your request is in the queue..."` |
| Already processing | Status message: `"A refactor is already in progress. Please halt it first if you want to start a new one."` |

#### Halt (Cancel Running Refactor)

```json
{ "type": "halt" }
```

**Response:**
```json
{ "type": "halt_acknowledged", "id": "550e8400-e29b-41d4-a716-446655440000" }
```

The running orchestration task is cancelled immediately. The session is NOT deleted from history -- it appears as `"Halted"` / `"ABORTED"`.

---

#### Pong (Heartbeat Response)

The frontend **MUST** respond to every server `ping` to avoid being marked stale.

```json
{ "type": "pong" }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Must be `"pong"` |

**Behavior:** Resets the server's missed-pong counter to 0. No response payload from server.

**Failure to respond:**
- After **1 missed pong** (15s): counter increments, still active
- After **2 missed pongs** (30s): connection marked **stale**
- Stale connections: server stops sending `status` messages, but orchestration **continues** silently (LLM inference, DB writes, phase transitions still happen)
- If client never responds to pings, heartbeat keeps incrementing and stays stale indefinitely

**Important:** A stale connection can still receive `result` and `insights` messages -- those bypass the stale check. The connection is never auto-closed by the heartbeat; it only suppresses `status` streaming.

---

#### Reconnect (Session Restoration)

Reattach to a previous session after disconnect. The backend looks up the session by ID and either replays completed results or swaps the live client reference for an ongoing orchestration.

```json
{
  "type": "reconnect",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Must be `"reconnect"` |
| `session_id` | `string` (UUIDv4) | Yes | Session ID from a previous `connection_id`, `result`, or history list |

**Reconnection scenarios:**

**Completed session (status: `"Completed"`):**
The server replays the full result and insights exactly as they were sent originally. The frontend receives (in sequence):
1. `result` message with the saved code, metrics, exit status
2. `insights` message with the saved insights
3. `status` message: `"Session restored."` (role `System`)

The restored `result` uses the saved `refactored_code` on success, or the saved `original_code` / error state on failure.

**Ongoing session (status: `"Processing"` or `"Halted"`):**
The server swaps its internal client reference so **live** `status` messages stream to the reconnected WebSocket. The new connection receives:
1. `status` message: `"Reconnected to ongoing session. Status: Processing"` (or `"Halted"`)

From that point forward, all subsequent status updates (from whatever phase the orchestration is currently in), the final `result`, and `insights` flow to the reconnected socket.

**Errors:**

| Error | Response |
|-------|----------|
| Missing or empty `session_id` | `{ "type": "error", "message": "Missing session_id" }` |
| Session ID not found in database | `{ "type": "error", "message": "Session not found" }` |
| Unknown session status value | `{ "type": "error", "message": "Unknown session status: ..." }` |

**Note:** The reconnected WebSocket gets its own heartbeat cycle. The client should handle `ping` messages and respond with `pong` as normal after reconnecting.

### Server -> Client Messages

All server messages share a `type` discriminator field. Below is the complete catalog.

#### `connection_id` -- New Session ID

Sent at the start of each new refactor. A fresh UUID is generated per request.

```json
{
  "type": "connection_id",
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**When:** Immediately after a valid refactor request is received, before processing starts.

**Use:** Correlate subsequent `result` and `insights` messages to this specific refactor. The `id` persists even if the same WebSocket connection runs multiple refactors sequentially.

---

#### `status` -- Streaming Phase Updates

The most frequent message type. Sent throughout all 6 orchestration phases. Each message contains:
- Which agent role is active
- What the agent is doing (status line)
- Formatted content payload (Markdown with structured data)

```json
{
  "type": "status",
  "role": "Planner",
  "content": "Intent Classified: EXTRACT_METHOD\n\n**Category:** `METHOD_MOVEMENT`\n**Intent:** `EXTRACT_METHOD`\n**Target Unit:** `METHOD_UNIT`\n**Target Class:** `OrderProcessor`\n**Target Member:** `process`"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` | Always `"status"` |
| `role` | `string` (enum) | Which agent is producing this update |
| `content` | `string` | Formatted Markdown (see Content Formatting section below) |

**Role reference:**

| Role | Phase(s) | What it means |
|------|----------|---------------|
| `System` | Any | Lifecycle events: queue waiting, processing started, errors, halts, finalization |
| `Planner` | Phase 2 | Classifying intent, analyzing code structure, designing mutation plan |
| `Generator` | Phase 3 | Applying mutations, generating refactored code, sequential editing |
| `Validator` | Phase 4 | Syntax checks, complexity verification, boundary checks, intent math |
| `Judge` | Phase 5 | Final audit verdict (ACCEPT/REVISE), insights generation |

**Typical status message sequence (successful run):**

```
[System]   Your request is now being processed...
[Planner]  Ph2: Classifying intent (Strategy Iter 1)...
[Planner]  Intent Classified: EXTRACT_METHOD
[Planner]  Ph2: Analyzing code structure...
[Planner]  Structure analysis complete.
[Planner]  Ph2: Designing mutation plan...
[Planner]  Modification plan generated.
[Generator] Ph3: Implementing plan...
[Generator] Code refactored.
[Validator] Ph4: Validating (Strategy 1, Syntax 0)...
[Validator] Syntax OK. Running Structural Checks...
[Validator] Structural Checks Passed.
[Judge]     Ph5: Running final audit...
[Judge]     Audit Finished: ACCEPT
[System]    Ph6: Finalizing session (Status: SUCCESS)...
[Judge]     Generating insights...
```

**Retry sequences:** The system retries up to 3 times at the strategy level. When a phase fails, the pipeline loops back:

```
[Validator] Syntax Fail (Attempt 1). Healing...       -> back to Phase 3
[Validator] Structural Checks Failed (2 issues).      -> back to Phase 2
[Judge]     Audit requested revision.                 -> back to Phase 2
```

The outer strategy loop counter is shown in status messages (e.g., "Strategy Iter 2"). After 3 strategy iterations without success, the system aborts.

---

#### `result` -- Final Output

Sent exactly once per refactor, after all phases complete. Contains the refactored code (or original on failure), complexity metrics, performance data, and model info.

```json
{
  "type": "result",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "class OrderProcessor {\n  void process(Order o) {\n    validateIfHighValue(o);\n    save(o);\n  }\n\n  void validateIfHighValue(Order o) {\n    if (o.amount > 1000) {\n      validateHighValue(o);\n    }\n  }\n}",
  "exit_status": "SUCCESS",
  "original_complexity": 3,
  "refactored_complexity": 2,
  "performance": {
    "avg_gpu_utilization": 45.20,
    "avg_gpu_memory": 78.53,
    "avg_gpu_memory_used": 4194000000.00,
    "inference_time": 23.45
  },
  "planner_model": "qwen2.5-coder-3b-instruct-q4_k_m",
  "generator_model": "qwen2.5-coder-3b-instruct-q4_k_m",
  "judge_model": "llama-3.2-3b-instruct-q4_k_m"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` | Always `"result"` |
| `id` | `string` (UUIDv4) | Matches the `connection_id` from the request |
| `code` | `string` | Final code -- refactored on SUCCESS, original otherwise |
| `exit_status` | `string` (enum) | Outcome of the orchestration |
| `original_complexity` | `int` \| `null` | Cyclomatic complexity before refactoring |
| `refactored_complexity` | `int` \| `null` | Cyclomatic complexity after refactoring |
| `performance` | `object` | GPU and timing metrics |
| `planner_model` | `string` \| `null` | Planner model identifier |
| `generator_model` | `string` \| `null` | Generator model identifier |
| `judge_model` | `string` \| `null` | Judge model identifier |

**`performance` object:**

| Field | Type | Description |
|-------|------|-------------|
| `avg_gpu_utilization` | `float` | Average GPU utilization % (0 if no GPU) |
| `avg_gpu_memory` | `float` | Average GPU memory % (0 if no GPU) |
| `avg_gpu_memory_used` | `float` | Average GPU memory used in bytes (0 if no GPU) |
| `inference_time` | `float` | Total wall-clock seconds for the entire run |

**Exit status values:**

| Value | Meaning | `code` field contains |
|-------|---------|----------------------|
| `SUCCESS` | Refactoring completed and passed all checks | Refactored code |
| `ABORT_STRATEGY` | Failed after 3 strategy retry cycles | Original code (unchanged) |
| `ABORT_SYNTAX` | Persistent syntax errors, synthesis failed | Original code (unchanged) |
| `ABORT_SEMANTIC` | Semantic drift unresolvable | Original code (unchanged) |
| `PROCESSING` | Internal state -- should never appear in a result message | N/A |

**Frontend handling:** Check `exit_status`. If not `SUCCESS`, display the original code and show an error state. The `insights` follow-up will contain a plain-text explanation.

---

#### `insights` -- Post-Result Analysis

Sent once per refactor, immediately after the `result` message. On success, contains a structured list of insight objects explaining what was done. On failure, contains a plain string with the abort reason.

**Success case:**
```json
{
  "type": "insights",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "insights": [
    {
      "title": "Extracted Method",
      "details": "Created `validateIfHighValue` to encapsulate the high-value order validation logic. The extracted method handles the conditional check and delegates to `validateHighValue`."
    },
    {
      "title": "Complexity Reduced",
      "details": "Cyclomatic complexity of `process` method dropped from 3 to 2 by moving the conditional branch into a dedicated method."
    },
    {
      "title": "Single Responsibility",
      "details": "`process` now focuses on orchestration (validate, save) while validation logic lives in its own method."
    }
  ]
}
```

**Failure case:**
```json
{
  "type": "insights",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "insights": "Refactoring aborted: ABORT_STRATEGY. Reverted to original code."
}
```

Note: The `id` field matches the `connection_id` / `result.id`, allowing correlation.

---

#### `halt_acknowledged` -- Client Halt Confirmed

```json
{
  "type": "halt_acknowledged",
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Sent immediately when the server acknowledges a halt request. The current orchestration is cancelled and the session is marked as "Halted" in the database.

---

#### `ping` -- Heartbeat Keepalive

Sent automatically every **15 seconds** after the WebSocket connection is established. The frontend **must** respond with a `pong` message to keep the connection active.

```json
{
  "type": "ping",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ts": "2026-06-07T12:00:15.123456Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` | Always `"ping"` |
| `id` | `string` (UUIDv4) | Current session connection ID |
| `ts` | `string` (ISO datetime) | Server timestamp of when this ping was sent |

**How heartbeat works server-side:**

1. On WebSocket connect, an async task starts the heartbeat loop
2. Every 15 seconds (`HEARTBEAT_INTERVAL`), the server:
   - Increments `missed_pongs` counter by 1
   - Sends `{"type": "ping", "id": "...", "ts": "..."}` to the client
3. When the client sends `{"type": "pong"}`, the server calls `handle_pong()` which resets `missed_pongs = 0`
4. If `missed_pongs >= 2` (30 seconds without response), the connection is marked **stale** (`is_stale = True`)

**Stale connection behavior:**
- The server's `_notify` method checks `is_stale` before sending every `status` message
- If stale: `send_status` is **skipped** entirely
- Critical messages (`result`, `insights`) are **not** filtered by stale check -- they always send
- The heartbeat continues running even for stale connections (allows recovery if client starts responding again)
- The orchestration pipeline is **not affected** by staleness -- LLM inference, phase transitions, DB writes all continue normally
- The connection is never forcibly closed by the heartbeat system

**Frontend requirements:**
- Register a `message` handler for `type === "ping"`
- Respond immediately with `{"type": "pong"}`
- If the user's device goes to sleep or network drops, the connection goes stale silently
- On reconnect (via WebSocket `onclose` + manual reconnect), the client sends a `reconnect` message to restore state

---

## Content Formatting Reference

The `content` field in `status` messages and history log entries is **formatted Markdown**. The frontend should render it as rich text. Below are all the formatting patterns the system produces, with examples.

### Intent Classification

```markdown
Category: `METHOD_MOVEMENT`
Intent: `EXTRACT_METHOD`
Target Unit: `METHOD_UNIT`
Target Class: `OrderProcessor`
Target Member: `process`
```

### Mutation Plan

```markdown
**Target Class:** `OrderProcessor`

**Mutations:**
- **ADD_METHOD** on `validateIfHighValue(Order o)`
  - *Add new method that extracts the high-value check logic*
- **MODIFY_METHOD** on `process(Order o)`
  - *Replace conditional block with call to new method*
```

### Validation Findings (single or multiple)

```markdown
**Total Faults:** 2

**[TIER_2_A_COMPLEXITY]**
> CC of target method 'process' increased from 3 to 5
- *Hint:* Ensure the source method's complexity decreases or stays the same after extraction.

**[TIER_2_B_BOUNDARY]**
> Modified unexpected code outside target scope 'OrderProcessor.process'
- *Hint:* Only change code inside the target method boundaries.
```

**Failure tier reference:**

| Tier | Meaning |
|------|---------|
| `TIER_1_SYNTAX` | Java syntax error in generated code |
| `TIER_2_A_COMPLEXITY` | Cyclomatic complexity increased beyond threshold |
| `TIER_2_B_BOUNDARY` | Code outside the intended scope was modified |
| `TIER_2_C_INTENT_MATH` | Structural changes don't match the requested intent |
| `TIER_3_JUDGE` | Judge model rejected the output |

### Audit Verdict

```markdown
**Verdict:** ✅ ACCEPT
```

Or:

```markdown
**Verdict:** ❌ REVISE

**Issues:**
- {'issue_type': 'LOGIC_DRIFT', 'description': 'Variable order is now reassigned in the extracted method'}
- {'issue_type': 'SEMANTIC_DRIFT', 'description': 'Null check removed from validation path'}
```

**Audit issue types:**

| Type | Meaning |
|------|---------|
| `IDENTICAL_CODE` | Refactored code is byte-identical to original (no changes applied) |
| `LOGIC_DRIFT` | Control flow or variable behavior changed |
| `SEMANTIC_DRIFT` | Meaning of the code changed (output differs) |

### Architecture Analysis

```markdown
**Primary Targets:** `process`
**Secondary Targets:** `validateHighValue`
**New Structures Needed:** `validateIfHighValue method`
**Must Preserve:** `OrderProcessor class`, `save method`
```

Or may appear as raw JSON code block if the format doesn't match any known template:

```markdown
```json
{
  "analysis_scratchpad": "...",
  "primary_targets": ["process"],
  "secondary_targets": [],
  "new_structures_needed": ["validateIfHighValue"],
  "must_preserve": ["OrderProcessor", "save"]
}
```
```

### Generic Fallback

Any JSON that doesn't match a known structure is rendered as a code block:

```markdown
```json
{
  "key": "value"
}
```
```

---

## Intent Classification Reference

The system classifies every user instruction into one of 12 intents, grouped under 3 categories. This determines which validation rules apply and how the plan is structured.

### CONTROL_FLOW

| Intent | Enum Value | Description |
|--------|------------|-------------|
| Flatten Conditional | `FLATTEN_CONDITIONAL` | Reduce nested if-else depth, use guard clauses or early returns |
| Decompose Conditional | `DECOMPOSE_CONDITIONAL` | Extract complex boolean expressions into well-named methods/variables |
| Consolidate Conditional | `CONSOLIDATE_CONDITIONAL` | Merge duplicate conditional branches |
| Remove Control Flag | `REMOVE_CONTROL_FLAG` | Replace boolean flag variables with break/continue/return |
| Replace Loop with Pipeline | `REPLACE_LOOP_WITH_PIPELINE` | Convert imperative loops to Java Stream operations |
| Split Loop | `SPLIT_LOOP` | Separate a loop doing multiple things into distinct loops |

### METHOD_MOVEMENT

| Intent | Enum Value | Description |
|--------|------------|-------------|
| Extract Method | `EXTRACT_METHOD` | Pull a block of code into its own named method |
| Inline Method | `INLINE_METHOD` | Replace method calls with the method body at each call site |

### STATE_MANAGEMENT

| Intent | Enum Value | Description |
|--------|------------|-------------|
| Extract Variable | `EXTRACT_VARIABLE` | Break a complex expression into a named local variable |
| Inline Variable | `INLINE_VARIABLE` | Replace a temp variable with its expression inline |
| Extract Constant | `EXTRACT_CONSTANT` | Replace a magic number/literal with a named constant |
| Rename Symbol | `RENAME_SYMBOL` | Rename a method, variable, or field to a better name |

---

## Orchestration Phases (Internal Reference)

Understanding the phases helps interpret the status message stream.

```
+-------------+    +--------------+    +--------------+
|  PHASE 1    |    |   PHASE 2    |    |   PHASE 3    |
|  Baseline   |--->|  Strategy    |--->|  Execution   |
|  (CC calc)  |    | (Planner LLM)|    |(Generator LLM)|
+-------------+    +--------------+    +------+-------+
                                               |
                    +--------------+    +------+-------+
                    |   PHASE 4    |<---|  Syntax fail  |
                    |  Validation  |    |  (retry <=3x) |
                    +------+-------+    +--------------+
                           |
              +------------+------------+
              | PASS       | FAIL        |
              v            v              |
    +--------------+  +--------------+   |
    |   PHASE 5    |  | Back to      |---+
    |  Adjudication|  | Phase 2      |
    | (Judge LLM)  |  | (<=3 cycles) |
    +------+-------+  +--------------+
           |
    +------+----------+
    |ACCEPT| REVISE    |
    v      v           |
+--------------+       |
|   PHASE 6    |  Back to
| Finalization |  Phase 2
|(result+insight)|
+--------------+
```

| Phase | Agent | What Happens |
|-------|-------|--------------|
| 1. Baseline | Validator | Calculate original cyclomatic complexity |
| 2. Strategy | Planner LLM | 3 sub-steps: classify intent -> analyze structure -> design mutation plan |
| 3. Execution | Generator LLM | Apply mutations to produce refactored code. Multi-sample at 3 temps, pick best. Falls back to syntax healing on error. |
| 4. Validation | Validator | Tiered checks: syntax -> complexity -> boundary -> intent math. Can trigger targeted fix or loop back. |
| 5. Adjudication | Judge LLM | Audit original vs refactored: ACCEPT or REVISE. Override for hallucinated IDENTICAL_CODE. |
| 6. Finalization | System | Send result -> generate insights -> send insights -> persist to DB |

**Retry limits:**
- Syntax healing: 3 inner attempts per strategy cycle
- Strategy revision: 3 outer cycles total
- Architect plan synthesis: 2 attempts (temp 0.2, then 0.5)
- Judge audit: 2 attempts (temp 0.1 / 1500 tokens, then 0.3 / 2048 tokens)
- Sequential mutation retries: 3 per step

---

## Typical Frontend Implementation Guide

### 1. Establish WebSocket Connection

```javascript
let ws;
let currentSessionId = null;
let heartbeatInterval = null;

function connectWebSocket() {
  ws = new WebSocket('ws://localhost:8000/ws');

  ws.onopen = () => {
    console.log('WebSocket connected');
    // Optionally send reconnect if restoring a session
    // const savedId = localStorage.getItem('lastSessionId');
    // if (savedId) ws.send(JSON.stringify({ type: 'reconnect', session_id: savedId }));
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    clearInterval(heartbeatInterval);
    // Optionally auto-reconnect after delay
    // setTimeout(() => connectWebSocket(), 3000);
  };

  ws.onmessage = handleMessage;
}
```

### 2. Listen for Messages

```javascript
function handleMessage(event) {
  const msg = JSON.parse(event.data);

  switch (msg.type) {

    // === Lifecycle ===

    case 'connection_id':
      currentSessionId = msg.id;
      localStorage.setItem('lastSessionId', msg.id);
      break;

    // === Heartbeat ===

    case 'ping':
      // MUST respond immediately with pong or connection goes stale
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    // === Orchestration progress ===

    case 'status':
      updateProgressBar(msg.content);
      addLogEntry(msg.role, msg.content);
      break;

    // === Final result ===

    case 'result':
      if (msg.exit_status === 'SUCCESS') {
        showDiff(msg.code, originalCode);
      } else {
        showError(msg.exit_status);
      }
      updateMetrics(msg.performance);
      break;

    // === Post-result insights ===

    case 'insights':
      if (Array.isArray(msg.insights)) {
        renderInsights(msg.insights);
      } else {
        showInsightMessage(msg.insights);
      }
      break;

    // === Halt acknowledgment ===

    case 'halt_acknowledged':
      showCancelledState();
      break;

    // === Protocol errors ===

    case 'error':
      showError(msg.message, msg.details);
      break;
  }
}
```

### 3. Send Refactor Request

```javascript
function startRefactor(code, instruction) {
  ws.send(JSON.stringify({
    code: code,
    user_instruction: instruction
  }));
}
```

### 4. Cancel

```javascript
function cancelRefactor() {
  ws.send(JSON.stringify({ type: 'halt' }));
}
```

### 5. Reconnect to Session (After Disconnect)

Use when the WebSocket reopens after an unexpected close. Restore the previous session so the user doesn't lose progress.

```javascript
function reconnectToSession(sessionId) {
  ws.send(JSON.stringify({
    type: 'reconnect',
    session_id: sessionId
  }));
}

// Usage: after websocket reconnects, restore last known session
// ws.onopen = () => {
//   const lastId = localStorage.getItem('lastSessionId');
//   if (lastId) reconnectToSession(lastId);
// };
```

**Completed session:** You'll receive `result`, `insights`, and `"Session restored."` status.

**Ongoing session:** You'll receive `"Reconnected to ongoing session..."` status, then live updates continue streaming.

### 6. Load History

```javascript
// List (stubs with id + instruction)
const stubs = await fetch('/api/history').then(r => r.json());

// Full detail
const detail = await fetch(`/api/history/${id}`).then(r => r.json());
// detail.logs[] -> render as timeline
// detail.original_code / detail.refactored_code -> show diff
// detail.insights -> parse JSON, render
```

### Edge Cases to Handle

| Scenario | What to expect | How to handle |
|----------|---------------|---------------|
| System busy (another user) | Status message: "Server is currently busy..." then auto-starts when lock frees | Show "queued" state, disable send button |
| Already has running task | Status: "A refactor is already in progress..." | Show "halt first" message |
| Exit status not SUCCESS | `result.code` is the original code | Display original code, show failure reason from insights |
| Connection lost mid-run | WebSocket `onclose` fires. Orchestration continues server-side. | Auto-reconnect socket, send `reconnect` with `session_id` to re-attach to live session |
| Connection goes stale (no pong) | Server stops sending `status` updates but pipeline continues | If user still sees stale UI, close and reconnect, then send reconnect message |
| Reconnect to completed session | Server replays `result` + `insights` + `"Session restored."` | Re-render result/insights from the replay |
| Reconnect to ongoing session | Server swaps to new socket. Live `status` streaming resumes. | Continue showing progress as normal |
| Reconnect with invalid/missing session_id | `{ "type": "error", "message": "Missing session_id" }` or `"Session not found"` | Start fresh refactor instead |
| 409 from REST endpoints | Orchestration lock held | Retry after current run completes |
| GPU metrics all zero | No GPU available (NVML init failed) | Hide GPU panel or show "N/A" |
| Empty insights on success | Insights generation failed (rare) | Show generic "Refactoring successful" message |
| Rapid sequential requests | Each gets queued behind the lock | Auto-start after previous finishes |

---

## Error Codes Summary

| Code | Source | Condition |
|------|--------|-----------|
| 404 | REST `GET/DELETE /api/history/{id}` | Session ID not found |
| 409 | REST endpoints + WebSocket | Orchestration lock held (another refactor running) |
| `error` (WS type) | WebSocket | Malformed JSON, validation failure, missing/invalid session_id for reconnect |
| `halt_acknowledged` (WS type) | WebSocket | User-requested cancellation confirmed |
| `ping` (WS type) | WebSocket | Server heartbeat every 15s (bidirectional) |
| `pong` (WS client msg) | WebSocket | Client heartbeat response (must reply within 30s) |
| `reconnect` (WS client msg) | WebSocket | Client requests session restoration after reconnect |

---

## Constraints & Limits

| Item | Limit |
|------|-------|
| Code input max length | 100,000 characters |
| Code input min length | 10 characters |
| Instruction max length | 10,000 characters |
| Instruction min length | 3 characters |
| Concurrent orchestrations | 1 (global `asyncio.Lock`) |
| Max strategy retries (outer loop) | 3 |
| Max syntax heal attempts (inner loop) | 3 |
| Max mutations per plan | 8 (truncated if more) |
| Cumulative feedback entries | Capped at 3 (ring buffer) |
| Sequential mutation retries | 3 per step |
| Architect plan synthesis attempts | 2 |
| Judge audit attempts | 2 |
| Generator multi-sample temperatures | 3 (0.1, 0.3, 0.5), or 1 during healing |
| Heartbeat interval (`HEARTBEAT_INTERVAL`) | 15 seconds |
| Max missed pongs before stale (`MAX_MISSED_PONGS`) | 2 |
| Stale timeout (interval x max missed) | 30 seconds |
| Stale behavior | Status messages suppressed; orchestration continues; result/insights still sent |

---

## Appendix: TypeScript Types

For convenience, here are TypeScript interfaces for all message types:

```typescript
// === REST endpoints ===

interface HistoryStub {
  id: string;        // UUIDv4
  user_instruction: string;
}

interface HistoryDetail {
  id: string;
  user_instruction: string;
  original_code: string;
  refactored_code: string | null;
  insights: string | null;
  original_complexity: number | null;
  refactored_complexity: number | null;
  planner_model: string | null;
  generator_model: string | null;
  judge_model: string | null;
  avg_gpu_utilization: number | null;
  avg_gpu_memory: number | null;
  avg_gpu_memory_used: number | null;
  inference_time: number | null;
  created_at: string;  // ISO datetime
  logs: LogEntry[];
}

interface LogEntry {
  role: 'Planner' | 'Generator' | 'Judge' | 'Validator' | 'System';
  status: string;
  content: string | null;
  created_at: string;  // ISO datetime
}

interface DeleteResponse {
  status: 'history_deleted';
  message: string;
}

// === WebSocket Client -> Server ===

interface RefactorRequest {
  code: string;
  user_instruction: string;
}

interface PongRequest {
  type: 'pong';
}

interface HaltRequest {
  type: 'halt';
}

interface ReconnectRequest {
  type: 'reconnect';
  session_id: string;  // UUIDv4 from previous connection
}

// === WebSocket Server -> Client ===

type ServerMessage =
  | ConnectionIdMessage
  | PingMessage
  | StatusMessage
  | ResultMessage
  | InsightsMessage
  | HaltAcknowledgedMessage
  | ErrorMessage;

interface ConnectionIdMessage {
  type: 'connection_id';
  id: string;
}

interface PingMessage {
  type: 'ping';
  id: string;
  ts: string;  // ISO datetime
}

interface StatusMessage {
  type: 'status';
  role: 'Planner' | 'Generator' | 'Judge' | 'Validator' | 'System';
  content: string;  // Markdown
}

interface PerformanceMetrics {
  avg_gpu_utilization: number;
  avg_gpu_memory: number;
  avg_gpu_memory_used: number;
  inference_time: number;
}

interface ResultMessage {
  type: 'result';
  id: string;
  code: string;
  exit_status:
    | 'SUCCESS'
    | 'ABORT_STRATEGY'
    | 'ABORT_SYNTAX'
    | 'ABORT_SEMANTIC'
    | 'PROCESSING';
  original_complexity: number | null;
  refactored_complexity: number | null;
  performance: PerformanceMetrics;
  planner_model: string | null;
  generator_model: string | null;
  judge_model: string | null;
}

interface RefactorInsight {
  title: string;
  details: string;
}

interface InsightsMessage {
  type: 'insights';
  id: string;
  insights: RefactorInsight[] | string;  // array on success, string on failure
}

interface HaltAcknowledgedMessage {
  type: 'halt_acknowledged';
  id: string;
}

interface ErrorMessage {
  type: 'error';
  message: string;
  details: any;
}
```
