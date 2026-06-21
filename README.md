# Horizon

AI-driven Java refactoring pipeline powered by LLM orchestration.

Stack: **FastAPI** (backend), **Next.js** (frontend)

## Quick start

### GPU (NVIDIA recommended)

```bash
docker compose -f https://raw.githubusercontent.com/horizon-ai-code/horizon/main/docker-compose.yml up -d
```

### CPU (any machine)

```bash
docker compose -f https://raw.githubusercontent.com/horizon-ai-code/horizon/main/docker-compose.cpu.yml up -d
```

Open http://localhost:3000

## Development

```bash
# Backend (hot-reload)
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (hot-reload)
cd frontend && npm run dev
```

## Structure

```
├── backend/       — FastAPI + LLM orchestration (Python)
├── frontend/      — Next.js UI (TypeScript)
├── docs/          — API documentation
└── scripts/       — setup and download utilities
```
