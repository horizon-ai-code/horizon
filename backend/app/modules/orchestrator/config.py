from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class ModelEntry:
    name: str
    temperature: float
    max_tokens: int
    context_size: int
    layers: int
    filename: str

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def keys(self):
        return ("name", "temperature", "max_tokens", "context_size", "layers", "filename")


@dataclass(frozen=True)
class OrchestrationSettings:
    classifier_max_tokens: int = 500
    analysis_max_tokens: int = 1024
    judge_max_tokens: int = 1536
    judge_max_retries: int = 3
    deduplication_cap: int = 8
    feedback_cap: int = 3
    strategy_loop_cap: int = 3
    syntax_retry_cap: int = 3
    mutation_cap: int = 20
    truncation_size: int = 10
    broken_code_truncation: int = 2000
    status_truncation: int = 200
    syntax_error_truncation: int = 150
    verifier_crash_truncation: int = 100
    repeat_penalty: float = 1.2


@dataclass(frozen=True)
class OrchestrationConfig:
    planner: ModelEntry
    generator: ModelEntry
    judge: ModelEntry
    single: ModelEntry
    orchestration: OrchestrationSettings

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "OrchestrationConfig":
        return cls(
            planner=ModelEntry(**raw["planner"]),
            generator=ModelEntry(**raw["generator"]),
            judge=ModelEntry(**raw["judge"]),
            single=ModelEntry(**raw.get("single", raw["planner"])),
            orchestration=OrchestrationSettings(**raw.get("orchestration", {})),
        )

    @classmethod
    def from_yaml(cls, path: Path) -> "OrchestrationConfig":
        with open(path) as f:
            raw: dict[str, Any] = yaml.safe_load(f) or {}
        required = ["planner", "generator", "judge", "single"]
        missing = [k for k in required if k not in raw]
        if missing:
            raise ValueError(f"Missing required model config sections: {missing}")
        return cls.from_dict(raw)
