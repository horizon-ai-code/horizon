"""Tests for OrchestrationConfig — config loading and validation."""

import pytest
from app.modules.orchestrator.config import OrchestrationConfig, ModelEntry


class TestOrchestrationConfig:
    def test_from_dict_valid(self):
        config = OrchestrationConfig.from_dict({
            "planner": {"name": "p", "filename": "p.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
            "generator": {"name": "g", "filename": "g.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
            "judge": {"name": "j", "filename": "j.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 28},
            "single": {"name": "s", "filename": "s.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 4096, "layers": 20},
        })
        assert config.planner.name == "p"
        assert config.judge.max_tokens == 4096

    def test_from_dict_missing_key_raises(self):
        with pytest.raises((TypeError, KeyError)):
            OrchestrationConfig.from_dict({
                "planner": {"name": "p", "filename": "p.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
            })

    def test_model_entry_frozen(self):
        entry = ModelEntry(name="m", filename="m.gguf", temperature=0.1, max_tokens=4096, context_size=4096, layers=20)
        with pytest.raises(Exception):
            entry.temperature = 0.5


class TestModelEntry:
    def test_creation(self):
        entry = ModelEntry(name="test", filename="t.gguf", temperature=0.2, max_tokens=2048, context_size=4096, layers=32)
        assert entry.name == "test"
        assert entry.layers == 32
