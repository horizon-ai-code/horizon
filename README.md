<div align="center">

<img src="https://raw.githubusercontent.com/horizon-ai-code/horizon/main/frontend/public/logo-dark.png" width="220" alt="Horizon AI Logo">

# Horizon

*AI-driven Java refactoring pipeline powered by multi-agent LLM orchestration.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue)](backend/pyproject.toml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](frontend/package.json)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](docker-compose.yml)

</div>

<br>

<div align="center">
  <img src="screenshots/UI.png" width="800" alt="Horizon AI Screenshot">
</div>

<br>

## Features

- **Multi-agent orchestration** — three small language models collaborate (planner, generator, judge) to produce high-quality refactoring
- **6-phase refactoring pipeline** — plan, generate, verify, mutate, deduplicate, and rank in a single automated workflow
- **Real-time WebSocket** — live streaming of analysis, code diffs, and progress updates to the UI
- **GPU + CPU support** — single pre-built image auto-detects GPU at runtime; no-GPU machines run CPU-only automatically
- **No cloud dependency** — everything runs fully local on commodity hardware; no API keys, no data leaving your machine
- **REST API** — full HTTP API for headless integration and automation

## Installation

### GPU (NVIDIA recommended)

```bash
docker compose -f https://raw.githubusercontent.com/horizon-ai-code/horizon/main/docker-compose.yml up -d
```

### CPU (any machine)

```bash
docker compose -f https://raw.githubusercontent.com/horizon-ai-code/horizon/main/docker-compose.cpu.yml up -d
```

Open [http://localhost:3000](http://localhost:3000)

> No build required — images are pre-built and pulled from GitHub Container Registry. Everything (app code + models) is bundled inside the image.

## Architecture

```
┌──────────┐    WebSocket     ┌──────────┐    ┌─────────────────────────────┐
│  Next.js │ ◄──────────────► │  FastAPI │    │     LLM Orchestration       │
│  Frontend│                  │  Backend │    │                             │
│  :3000   │                  │  :8000   │    │  ┌────────┐  ┌───────────┐  │
└──────────┘                  └────┬─────┘    │  │Planner  │  │ Generator │  │
                                   │          │  └────────┘  └───────────┘  │
                                   │          │  ┌──────────────────────┐   │
                                   │          │  │  Judge (Verifier)    │   │
                                   │          │  └──────────────────────┘   │
                                   │          └─────────────────────────────┘
                                   │
                              ┌────▼─────┐
                              │  Models  │
                              │ (GGUF)   │
                              └──────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10, FastAPI, llama-cpp-python, uvicorn |
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Framer Motion |
| AI Models | Qwen2.5-Coder (3B, 7B), Llama-3.2 (3B) — GGUF quantized |
| Distribution | Docker, GitHub Container Registry (GHCR), NVIDIA CUDA 13 |

## Structure

```
├── backend/       — FastAPI application + LLM orchestration (Python)
├── frontend/      — Next.js user interface (TypeScript)
├── docs/          — API documentation and guides
├── scripts/       — setup, download, and utility scripts
├── docker-compose.yml      — GPU bundle
└── docker-compose.cpu.yml  — CPU bundle
```

## Contributors

<a href="https://github.com/horizon-ai-code/horizon/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=horizon-ai-code/horizon" />
</a>

## License

MIT — see [LICENSE](LICENSE)
