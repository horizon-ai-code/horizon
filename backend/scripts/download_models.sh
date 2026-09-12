#!/bin/bash

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODELS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/temp_models"
mkdir -p "$MODELS_DIR"

# Model URLs
QWEN_7B_URL="https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"
QWEN_3B_URL="https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf"
LLAMA_3B_URL="https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"

download_model() {
    local filename=$1
    local url=$2
    local target="$MODELS_DIR/$filename"

    if [ -f "$target" ]; then
        echo -e "\e[33m[SKIP]\e[0m $filename already exists."
    else
        echo -e "\e[32m[DOWNLOADING]\e[0m $filename..."
        # -L: Follow redirects (required for Hugging Face LFS)
        # -c: Continue partial downloads
        # --show-progress: Forces the bar to show in the terminal
        wget -c --show-progress -O "$target" "$url"

        if [ $? -ne 0 ]; then
            echo -e "\e[31m[ERROR]\e[0m Failed to download $filename."
            exit 1
        fi
    fi
}

# Execute downloads
download_model "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf" "$QWEN_7B_URL"
download_model "qwen_coder.gguf" "$QWEN_3B_URL"
download_model "llama_engine.gguf" "$LLAMA_3B_URL"

echo "------------------------------------------------"
echo "All models successfully downloaded to $MODELS_DIR"
