# Test Results

**Moved from `test_results/` (root) to `tests/results/` — June 2026.**

This directory stores outputs from test runs, organized by component:

| Directory | Source Tests | Contents |
|-----------|-------------|----------|
| `pipeline/` | `tests/pipeline/*` | Full pipeline runs (12 intents, edge cases, repetition) |
| `model/` | `tests/model/*` | Isolated model tests (planner, generator, judge) |
| `pipeline/` | `tests/pipeline/*` | Polish validation outputs |
| `orchestration/` | Integration tests | Orchestration reports |
| `pre-existing/` | Pre-existing | Historical test data |

## Naming Convention

```
<component>_<description>_<YYYY-MM-DDTHHMMSS>.json
```

For pipeline results, use date-based subdirectories:
```
pipeline/YYYY-MM-DD/results.json
```
