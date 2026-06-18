import os
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
REQUIREMENTS_FILE = BASE_DIR / "requirements.txt"

MODELS = {
    "deepseek_engine.gguf": "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
    "qwen_coder.gguf": "https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf",
    "llama_engine.gguf": "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
}


def run_command(command: str, env: dict | None = None) -> None:
    process = subprocess.Popen(
        command,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
        text=True,
        bufsize=1,  # Line buffering
        universal_newlines=True,
    )

    # Use a while loop to capture output as it happens
    if process.stdout:
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                print(line, end="", flush=True)  # Flush is critical

    process.wait()
    if process.returncode != 0:
        print(f"\nCommand failed with return code {process.returncode}")
        sys.exit(1)


def install_dependencies() -> None:
    run_command(f"pip install -r {REQUIREMENTS_FILE}")

    custom_env = os.environ.copy()
    custom_env["CUDACXX"] = "/usr/local/cuda/bin/nvcc"

    conda_prefix = os.environ.get("CONDA_PREFIX")

    print(conda_prefix)
    if not conda_prefix:
        sys.exit(1)

    custom_env["CC"] = f"{conda_prefix}/bin/x86_64-conda-linux-gnu-gcc"
    custom_env["CXX"] = f"{conda_prefix}/bin/x86_64-conda-linux-gnu-g++"
    custom_env["CMAKE_ARGS"] = "-DGGML_CUDA=on"
    custom_env["FORCE_CMAKE"] = "1"

    print("config setup done installing llama.cpp")

    # run_command(
    #     "pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir",
    #     env=custom_env,
    # )

    run_command("chmod +x install_llama_cpp.sh")
    run_command(
        "pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir"
    )


def download_models() -> None:
    MODELS_DIR.mkdir(exist_ok=True)
    for filename, url in MODELS.items():
        target_path = MODELS_DIR / filename
        if not target_path.exists():
            # -L follows redirects, -c resumes partial downloads
            run_command(f"wget -O {target_path} {url}")


if __name__ == "__main__":
    # install_dependencies()
    download_models()
