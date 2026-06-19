import subprocess
import sys
from pathlib import Path

CONFIG_PATH = Path("/app/model_config.yaml")


def has_gpu() -> bool:
    try:
        result = subprocess.run(
            ["nvidia-smi"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def patch_config() -> None:
    if has_gpu():
        return

    import yaml

    config = yaml.safe_load(CONFIG_PATH.read_text())
    changed = False

    for key in config:
        if isinstance(config[key], dict) and "layers" in config[key]:
            if config[key]["layers"] != 0:
                config[key]["layers"] = 0
                changed = True

    if changed:
        CONFIG_PATH.write_text(yaml.dump(config))
        print("[detect_gpu] No GPU detected — set n_gpu_layers=0 for all models", flush=True)


if __name__ == "__main__":
    patch_config()
