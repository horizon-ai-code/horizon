from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.parent

MODELS_DIR = ROOT_DIR / "models"

MODELS_CONFIG_PATH = ROOT_DIR / "model_config.yaml"

PROMPTS_CONFIG_PATH = ROOT_DIR / "prompts.yaml"

DB_DIR = ROOT_DIR / "db"

DB_PATH = DB_DIR / "history.db"
