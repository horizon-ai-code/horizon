"""Tests for OrchestrationConfig — config loading and validation."""

import pytest

from app.modules.orchestrator.config import ModelEntry, OrchestrationConfig


class TestOrchestrationConfig:
    def test_from_dict_valid(self):  # TC-CFG-001
        config = OrchestrationConfig.from_dict({
            "planner": {"name": "p", "filename": "p.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
            "generator": {"name": "g", "filename": "g.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
            "judge": {"name": "j", "filename": "j.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 28},
            "single": {"name": "s", "filename": "s.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 4096, "layers": 20},
        })
        assert config.planner.name == "p"
        assert config.judge.max_tokens == 4096

    def test_from_dict_missing_key_raises(self):  # TC-CFG-002
        with pytest.raises((TypeError, KeyError)):
            OrchestrationConfig.from_dict({
                "planner": {"name": "p", "filename": "p.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
            })

    def test_model_entry_frozen(self):  # TC-CFG-005
        entry = ModelEntry(name="m", filename="m.gguf", temperature=0.1, max_tokens=4096, context_size=4096, layers=20)
        with pytest.raises(Exception):  # noqa: B017 — frozen dataclass raises type-dependent error
            entry.temperature = 0.5

    def test_creation(self):
        entry = ModelEntry(name="test", filename="t.gguf", temperature=0.2, max_tokens=2048, context_size=4096, layers=32)
        assert entry.name == "test"
        assert entry.layers == 32
