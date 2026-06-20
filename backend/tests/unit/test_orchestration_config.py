import tempfile
from pathlib import Path

from app.modules.orchestration_config import (
    ModelEntry,
    OrchestrationConfig,
    OrchestrationSettings,
)

VALID_YAML = """
planner:
  name: Qwen-3B
  temperature: 0.1
  max_tokens: 4096
  context_size: 6144
  layers: 36
  filename: qwen.gguf
generator:
  name: Qwen-3B
  temperature: 0.1
  max_tokens: 4096
  context_size: 6144
  layers: 36
  filename: qwen.gguf
judge:
  name: Llama-3B
  temperature: 0.1
  max_tokens: 4096
  context_size: 6144
  layers: 28
  filename: llama.gguf
single:
  name: Qwen-7B
  temperature: 0.1
  max_tokens: 4096
  context_size: 4096
  layers: 20
  filename: qwen7b.gguf
orchestration:
  classifier_max_tokens: 500
  mutation_cap: 20
"""


class TestOrchestrationConfig:
    def test_parses_model_config(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(VALID_YAML)
            f.flush()
            config = OrchestrationConfig.from_yaml(Path(f.name))

        assert config.planner.name == "Qwen-3B"
        assert config.planner.temperature == 0.1
        assert config.planner.max_tokens == 4096
        assert config.orchestration.classifier_max_tokens == 500
        assert config.orchestration.mutation_cap == 20

    def test_model_entry_dict_compatibility(self):
        entry = ModelEntry(
            name="test",
            temperature=0.1,
            max_tokens=512,
            context_size=1024,
            layers=16,
            filename="test.gguf",
        )

        assert entry["filename"] == "test.gguf"
        assert entry["layers"] == 16
        assert entry["context_size"] == 1024
        assert entry["temperature"] == 0.1

    def test_uses_default_orchestration_settings(self):
        minimal_yaml = """
planner:
  name: P
  temperature: 0.1
  max_tokens: 4096
  context_size: 6144
  layers: 36
  filename: p.gguf
generator:
  name: G
  temperature: 0.1
  max_tokens: 4096
  context_size: 6144
  layers: 36
  filename: g.gguf
judge:
  name: J
  temperature: 0.1
  max_tokens: 4096
  context_size: 6144
  layers: 28
  filename: j.gguf
single:
  name: S
  temperature: 0.1
  max_tokens: 4096
  context_size: 4096
  layers: 20
  filename: s.gguf
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(minimal_yaml)
            f.flush()
            config = OrchestrationConfig.from_yaml(Path(f.name))

        assert config.orchestration.classifier_max_tokens == 500
        assert config.orchestration.mutation_cap == 20
