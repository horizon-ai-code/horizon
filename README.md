# Horizon

AI-driven Java refactoring pipeline powered by LLM orchestration.

Stack: **FastAPI** (backend), **Next.js** (frontend)

## Quick start

```bash
docker compose up --build
```

Open http://localhost:3000

## Structure

```
├── backend/       — FastAPI + LLM orchestration (Python)
├── frontend/      — Next.js UI (TypeScript)
├── models/        — GGUF model files
├── docs/          — API documentation
└── scripts/       — setup and download utilities
```
