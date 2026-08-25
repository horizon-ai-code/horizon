# System Design Document

Horizon - Technical Architecture v1.0

|              |                           |           |             |
| ------------ | ------------------------- | --------- | ----------- |
| Project      | **Horizon**               | Date      | **Aug 2026** |
| Status       | **Draft**                 | Version   | **1.0**       |

## Introduction

This document describes the technical architecture, component design, database schema, and API structure for Horizon — an AI-driven Java refactoring pipeline powered by multi-agent LLM orchestration. Horizon accepts Java source code and a natural-language instruction, runs a 6-phase orchestration pipeline across three small language models (Planner, Generator, Judge), and returns refactored code with validation insights. Everything runs fully local on commodity hardware with no cloud API keys required.

It is the primary technical reference throughout development. Living document during the Design phase.

## System Architecture

### Overview

Horizon uses a client-server architecture where both tiers can run on the same machine. The server is a FastAPI monolith that hosts backend logic, AI inference (llama-cpp with quantized GGUF models), and a SQLite database in a single process. The client is a Next.js 16 SPA that communicates with the server over WebSocket (primary, bidirectional) and REST (history CRUD). Both tiers are containerised with Docker and pushed to GitHub Container Registry (GHCR).

```
Browser (Next.js 16 SPA)
    │
    ├── WebSocket (ws://localhost:8000/ws)
    │       Real-time streaming: status, glassbox events, results, insights
    │
    ├── WebSocket (ws://localhost:8000/ws/system)
    │       Read-only GPU/CPU metrics every 2 seconds
    │
    └── REST (http://localhost:8000)
            History CRUD, health check
            │
            v
    FastAPI Server (single process)
    ├── AgentService       — LLM lifecycle & inference
    ├── Orchestrator       — 6-phase pipeline engine
    ├── Validator          — AST parsing, complexity, intent verification
    ├── ConnectionManager  — WebSocket client tracking
    ├── MessageRouter      — WS message dispatch
    └── DatabaseManager    — SQLite via Peewee ORM
            │
            v
    SQLite (WAL mode, foreign keys)
```

### Components

| Component          | Responsibility                                                                                      | Technology                                  | Interfaces With                      |
| ------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| Next.js SPA        | All user-facing screens: code editor, terminal, flow graph, insights, system metrics                | Next.js 16, React 19, Tailwind CSS 4, Zustand, Framer Motion | FastAPI (WS + REST)                  |
| FastAPI            | HTTP/WS server: routing, CORS, lifespan events, middleware, reconnection handling, request validation | Python 3.10, FastAPI, uvicorn, Pydantic     | All modules, SQLite                  |
| AgentService       | LLM lifecycle: load, unload, swap between models; inference with GBNF grammar enforcement; repetition detection; mid-generation halt | llama-cpp-python, GGUF Q4_K_M models        | Orchestrator                         |
| Orchestrator       | 6-phase pipeline engine: baseline → strategy → execution → validation → adjudication → finalization | Python, asyncio, Pydantic                   | AgentService, Validator, DatabaseManager |
| Validator          | Java AST parsing (javalang), cyclomatic complexity (lizard), structural signature hashing, 12 intent verifiers, 4-tier failure escalation | javalang, lizard, hashlib                   | Orchestrator                         |
| ConnectionManager  | WebSocket client registry: connect, disconnect, broadcast, per-client message queues, heartbeat tracking | Python, asyncio                             | MessageRouter, System Monitor        |
| MessageRouter      | WS message dispatch: routes `multi`, `single`, `halt`, `reconnect`, `pong` to handlers; busy guard; task lifecycle | Python, asyncio                             | ConnectionManager, Orchestrator, AgentService |
| SQLite             | Persistent storage: session history, per-step orchestration audit trail, GPU/performance metrics    | SQLite 3 (WAL, foreign keys), Peewee ORM    | FastAPI (via DatabaseManager)        |
| Docker + GHCR      | Reproducible container builds: GPU (CUDA 13) and CPU variants; image distribution via GitHub Container Registry | Docker, docker-compose                      | FastAPI, Next.js SPA                 |

## Technology Stack

| Layer          | Technology                | Version    | Justification                                                                           |
| -------------- | ------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Frontend       | Next.js + React           | 16 / 19    | App Router with server components; React ecosystem familiarity; Turbopack for fast dev  |
| Styling        | Tailwind CSS              | 4.x        | Utility-first, design-token consistency, zero-runtime CSS                               |
| State          | Zustand                   | 5.x        | Lightweight global store; no boilerplate; excellent TypeScript support                  |
| Backend        | FastAPI + uvicorn         | 0.109+     | Native async, auto-generated OpenAPI docs, WebSocket support, Pydantic validation       |
| AI Inference   | llama-cpp-python          | 0.2+       | Local GGUF model inference; GPU offloading; GBNF grammar for structured JSON            |
| Models         | Qwen2.5-Coder / Llama-3.2 | 3B / 7B    | Q4_K_M quantisation for ~4 GB VRAM; 3B for agents, 7B for single-shot mode              |
| Java Parsing   | javalang                  | 0.13+      | Pure-Python Java AST parser; no external JVM dependency                                 |
| Complexity     | lizard                    | 1.21+      | Cyclomatic complexity analysis; fast, accurate, language-agnostic                        |
| Database       | SQLite 3                  | -          | Zero-config, embedded, single-file; WAL journal for concurrent reads during writes      |
| ORM            | Peewee                    | 3.17+      | Lightweight ORM; tenacity retry wrapper for DB contention                               |
| Validation     | Pydantic                  | 2.5+       | Request/response validation; GBNF JSON schema generation for LLM structured output      |
| Monitoring     | Sentry                    | 2.0+       | Opt-in error tracking; environment-aware DSN; both backend and frontend                 |
| Container      | Docker + GHCR             | -          | Reproducible builds; GPU (CUDA 13) and CPU images; `restart: unless-stopped`            |

### Model Configuration

| Role      | Model                         | Temperature | Context | GPU Layers | Purpose                                     |
| --------- | ----------------------------- | ----------- | ------- | ---------- | ------------------------------------------- |
| Planner   | Qwen2.5-Coder-3B-Instruct     | 0.1         | 6,144   | 36         | Classifies intent, architects AST plan      |
| Generator | Qwen2.5-Coder-3B-Instruct     | 0.1         | 6,144   | 36         | Applies code changes with syntax healing    |
| Judge     | Llama-3.2-3B-Instruct         | 0.1         | 6,144   | 28         | Reviews for semantic preservation           |
| Single    | Qwen2.5-Coder-7B-Instruct     | 0.1         | 4,096   | 20         | Direct single-shot refactoring (no pipeline) |

All models use Q4_K_M quantisation targeting ~4 GB VRAM. Only one model is loaded at a time; AgentService handles swap/unload to stay within memory budget. `flash_attn=True` for efficient attention on consumer GPUs.

## Database Design

### refactor_history

| Column                  | Type           | Nullable? | Notes                                                                 |
| ----------------------- | -------------- | --------- | --------------------------------------------------------------------- |
| id                      | UUID           | No        | Primary key — session identifier                                      |
| status                  | VARCHAR        | No        | Processing / Completed / Halted / Zombie                              |
| exit_status             | VARCHAR        | Yes       | SUCCESS / ABORT_STRATEGY / ABORTED / ABORT_SYSTEM                     |
| title                   | VARCHAR(255)   | Yes       | First 255 chars of user instruction                                   |
| user_instruction        | TEXT           | No        | Full natural-language refactoring instruction                         |
| original_code           | TEXT           | No        | User's original Java source                                           |
| refactored_code         | TEXT           | Yes       | Output code after refactoring                                         |
| insights                | TEXT           | Yes       | JSON array of `[{title, details}]` post-refactor findings             |
| final_intent            | TEXT           | Yes       | JSON — classified intent (category, target, confidence)               |
| final_plan              | TEXT           | Yes       | JSON — AST modification plan from Planner                             |
| total_outer_loops       | INTEGER        | No        | Strategy iterations consumed                                          |
| total_inner_loops       | INTEGER        | No        | Syntax healing attempts consumed                                      |
| original_complexity     | INTEGER        | Yes       | Cyclomatic complexity before refactoring                              |
| refactored_complexity   | INTEGER        | Yes       | Cyclomatic complexity after refactoring                               |
| mode                    | VARCHAR        | No        | "multi" (6-phase pipeline) or "single" (direct LLM)                   |
| planner_model           | VARCHAR        | Yes       | Planner model used for this session                                   |
| generator_model         | VARCHAR        | Yes       | Generator model used for this session                                 |
| judge_model             | VARCHAR        | Yes       | Judge model used for this session                                     |
| avg_gpu_utilization     | FLOAT          | Yes       | Mean GPU utilisation % over session                                   |
| avg_gpu_memory          | FLOAT          | Yes       | Mean GPU memory % over session                                        |
| avg_gpu_memory_used     | FLOAT          | Yes       | Mean GPU memory GB used                                               |
| peak_gpu_utilization    | FLOAT          | Yes       | Peak GPU utilisation %                                                |
| peak_gpu_memory_used    | FLOAT          | Yes       | Peak GPU memory GB used                                               |
| inference_time          | FLOAT          | Yes       | Total inference time in seconds                                       |
| phase_states            | TEXT           | Yes       | JSON — per-phase state map for flow graph visualisation               |
| created_at              | DATETIME       | No        | Set by DB — not editable                                              |

### orchestration_log

| Column       | Type      | Nullable? | Notes                                                 |
| ------------ | --------- | --------- | ----------------------------------------------------- |
| id           | INTEGER    | No        | Primary key — auto-increment                          |
| session      | FK (UUID)  | No        | FK → refactor_history, CASCADE delete                 |
| role         | VARCHAR    | No        | Planner / Generator / Judge / Validator / System       |
| status       | TEXT       | No        | Human-readable status message                         |
| content      | TEXT       | Yes       | JSON payload — standardised per role                  |
| phase        | INTEGER    | Yes       | Pipeline phase (1–6)                                  |
| outer_loop   | INTEGER    | No        | Strategy iteration counter                            |
| inner_loop   | INTEGER    | No        | Syntax healing iteration counter                      |
| created_at   | DATETIME   | No        | Set by DB — immutable                                  |

SQLite runs in WAL journal mode with foreign keys enabled. Tenacity retry wrapper (3 attempts, 0.5 s backoff) handles `OperationalError` on concurrent access. A module-level `asyncio.Lock` serialises all orchestration work (10-minute timeout on acquisition).

## API Design

### Standards

- Primary protocol: WebSocket (bidirectional, streaming)
- Secondary protocol: REST JSON (history CRUD, health)
- OpenAPI 3.0 spec auto-generated at `/docs` and `/redoc` when server runs
- Base URL: `http://localhost:8000`
- CORS: `localhost:3000`, `127.0.0.1:3000` only — all methods, all headers, credentials enabled
- No authentication (local single-user application)
- All timestamps in ISO 8601 UTC format
- Errors: `{ error: string, code: string }` with appropriate HTTP/WS error codes

### WebSocket Endpoints

| Route            | Direction      | Description                                                    |
| ---------------- | -------------- | -------------------------------------------------------------- |
| `/ws`            | Bidirectional  | Primary channel — refactor requests, streaming status, results, insights |
| `/ws/system`     | Server → Client | Read-only — GPU/CPU/RAM metrics every 2 seconds                |

### Client → Server Message Types (`/ws`)

| Type          | Payload                                    | Description                                     |
| ------------- | ------------------------------------------ | ----------------------------------------------- |
| `multi`       | `{ code, user_instruction }`               | Start full 6-phase pipeline refactoring         |
| `single`      | `{ code, user_instruction }`               | Start single-shot LLM refactoring (no pipeline) |
| `halt`        | —                                          | Interrupt current orchestration                 |
| `pong`        | —                                          | Heartbeat response (missed-pong counter reset)  |
| `reconnect`   | `{ session_id }`                           | Reattach to a previously started session        |

### Server → Client Message Types (`/ws`)

| Type                | Key Fields                                                           | Purpose                                          |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| `status`            | `role, content, phase, planner_model, generator_model, judge_model`  | Streaming pipeline status and phase transitions |
| `connection_id`     | `id, created_at`                                                     | Session UUID assigned after connection          |
| `phase_states`      | `states, failingPhase, strategyIteration, syntaxHealAttempt`         | Per-phase state map for flow graph visualisation |
| `result`            | `id, code, exit_status, original_complexity, refactored_complexity, performance, model names` | Final refactoring result with metrics |
| `insights`          | `id, insights`                                                       | Post-refactor findings as structured items       |
| `error`             | `code, message, details`                                             | Error with optional Pydantic validation details  |
| `ping`              | `id, ts`                                                             | Heartbeat probe — client must respond with pong  |
| `halt_acknowledged` | `id`                                                                 | Confirmation that orchestration was stopped      |

### Structured Glassbox Messages (Server → Client)

These provide real-time transparency into each pipeline stage:

| Type                    | Key Fields                                                                       | Phase |
| ----------------------- | -------------------------------------------------------------------------------- | ----- |
| `phase_started`         | `phase, name, agent, strategy_iteration, max_strategy_iterations`                | 2–5   |
| `phase_completed`       | `phase, name, duration_ms, status`                                               | 2–5   |
| `intent_classified`     | `category, intent, target_unit, target_class, target_member, confidence`         | 2     |
| `architecture_analysis` | `primary_targets, secondary_targets, new_structures, must_preserve`              | 2     |
| `mutation_plan`         | `target_class, mutations[{ action, target, description, status }]`               | 2     |
| `mutation_status`       | `action, target, attempt, max_attempts, status, error?`                          | 3     |
| `generator_progress`    | `mutations_completed, mutations_total, temperature?, sample_index?, total_samples?` | 3 |
| `validation_result`     | `strategy_iteration, checks[{ tier, name, passed, details, before_value, after_value }], total_passed, total_failed` | 4 |
| `audit_result`          | `verdict, issues[{ issue_type, description, severity }], attempt, max_attempts`  | 5     |
| `phase_timing_summary`  | `total_duration_ms, phases[{ phase, duration_ms }]`                              | 6     |
| `system_metrics`        | `metrics{ gpu_utilization, gpu_memory_percent, gpu_memory_used_gb, cpu_percent, memory_percent, ... }` | All  |

### REST Endpoints

| Method | Endpoint                | Description                                                   |
| ------ | ----------------------- | ------------------------------------------------------------- |
| GET    | `/health`               | Health check — DB connectivity, returns `ok` or `degraded`    |
| GET    | `/api/history`          | List all session stubs (id, title, status, created_at)        |
| GET    | `/api/history/{id}`     | Full session detail with orchestration logs                   |
| DELETE | `/api/history/{id}`     | Cascade-delete a session and its logs                         |
| DELETE | `/api/history`          | Clear all history                                             |
| PATCH  | `/api/history/{id}`     | Rename a session (body: `{ "title": "..." }`)                  |

## Orchestration Pipeline

The core of Horizon is a 6-phase pipeline across three specialist LLMs:

```
PHASE 1: Baseline
    ↓   [lizard CC analysis, model notification]
PHASE 2: Strategy (Planner)
    ↓   [Intent classification → Architecture analysis → Plan synthesis → Deduplication]
    ↓   Circuit breaker: max 3 strategy iterations
PHASE 3: Execution (Generator)
    ↓   [Sequential mutations (multi-target) or single-shot generation]
    ↓   Syntax healing: max 3 retries with error context
PHASE 4: Validation (Validator)
    ↓   TIER_1: Syntax (javalang parse) → heal → Phase 3
    ↓   TIER_2_A: Cyclomatic Complexity → structural fix → Phase 2
    ↓   TIER_2_B: Boundary Scoping → structural fix → Phase 2
    ↓   TIER_2_C: Intent Verification → feedback → Phase 2
    ↓   All pass → Phase 5
PHASE 5: Adjudication (Judge)
    ↓   ACCEPT → Phase 6
    ↓   REVISE → Phase 2 (with cumulative feedback, max 3 judge retries)
PHASE 6: Finalisation
        [Send result → Generate insights → Persist metrics to DB]
```

### Validation Tiers

| Tier              | Trigger                          | Recovery Strategy                                   |
| ----------------- | -------------------------------- | --------------------------------------------------- |
| TIER_1 (Syntax)   | javalang parse fails             | Re-generate with syntax error context (max 3)       |
| TIER_2_A (CC)     | Cyclomatic complexity increased  | Targeted structural fix → Phase 2 with feedback     |
| TIER_2_B (Boundary)| Non-target code modified        | Same escalation as TIER_2_A                          |
| TIER_2_C (Intent) | Expected structural change missing | Same escalation                                    |
| TIER_3 (Judge)    | LLM judge returns REVISE          | Phase 2 strategy retry with cumulative feedback (max 3) |

## Security & Robustness

### Isolation

- **Network**: CORS restricted to `localhost:3000` and `127.0.0.1:3000`. No external origins permitted.
- **Containers**: Backend and frontend run in separate Docker containers. Backend uses GPU reservation (device: nvidia, all capabilities). Both `restart: unless-stopped`.
- **Database**: SQLite is a single local file. No network port exposed. WAL journal + foreign keys protect integrity during concurrent access.
- **No authentication**: Designed as a single-user local tool. No JWT, bcrypt, OAuth, or user management.

### Pipeline Robustness

- **Circuit breaker**: Maximum 3 strategy iterations globally. Each phase has independent retry caps.
- **Syntax healing**: Generator retries failed parses up to 3 times with truncated error context.
- **Mutation cap**: Sequential mutation attempts capped at 20.
- **Feedback ring buffer**: Cumulative judge feedback limited to last 3 entries (prevents unbounded context growth).
- **Deduplication**: Plan dedup cap of 8 prevents repetitive strategies.
- **Session cleanup**: On startup, zombie sessions (Processing > 1 hr) are reset and halted sessions (> 5 hrs) are deleted.

### Concurrency

- A single `asyncio.Lock` serialises all orchestration work (10-minute timeout on acquisition).
- Busy guard: only one `multi` or `single` task runs at a time; concurrent requests get `SYSTEM_BUSY`.
- Active tasks tracked in a set; auto-cleaned via `task.add_done_callback`.
- `AgentService.stop()` sets a halt flag checked between inference chunks; raises `InterruptedError` to cancel safely.

### Model Isolation

- Only one LLM is loaded in VRAM at a time.
- `AgentService.swap()` unloads the current model (`gc.collect()` + 0.5 s sleep for CUDA driver) before loading the next.
- `flash_attn=True` for memory-efficient attention on consumer GPUs.
- Repeat penalty 1.2 applied to all generations to prevent degenerate loops.

### Error Telemetry

- Sentry SDK initialised with environment-aware DSN (optional).
- Captures unhandled exceptions and performance traces in both backend and frontend.
- Module-level HTTP middleware logs `[METHOD] /path -- status (ms)` for every request.
